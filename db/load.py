"""Load the curated CSV into PostgreSQL."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import pandas as pd
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent.parent
CSV_PATH = BASE_DIR / "data" / "curated_applications.csv"
SCHEMA_PATH = Path(__file__).parent / "schema.sql"

_DSN = dict(
    host=os.getenv("PG_HOST", "localhost"),
    port=int(os.getenv("PG_PORT", "5432")),
    dbname=os.getenv("PG_DATABASE", "data_pipeline_de25"),
    user=os.getenv("PG_USER", "postgres"),
    password=os.getenv("PG_PASSWORD", ""),
)


def _nan_to_none(value: Any) -> Any:
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


def prepare_for_database(applications: pd.DataFrame) -> pd.DataFrame:
    """Restore data types that are lost when the curated CSV is read back."""
    integer_columns = [
        "yh_poang",
        "studietakt_procent",
        "antal_kommuner",
        "sokta_omgangar",
        "beviljade_omgangar",
    ]
    for column in integer_columns:
        applications[column] = pd.to_numeric(applications[column], errors="coerce")

    boolean_columns = ["is_distance", "has_multiple_municipalities"]
    for column in boolean_columns:
        applications[column] = applications[column].map(
            {"True": True, "False": False, True: True, False: False}
        )

    return applications


def main() -> None:
    if not CSV_PATH.exists():
        print(f"Error: curated CSV not found: {CSV_PATH}")
        print("Run data_preparation.ipynb first to generate the file.")
        sys.exit(1)

    if not SCHEMA_PATH.exists():
        print(f"Error: schema file not found: {SCHEMA_PATH}")
        sys.exit(1)

    print(f"Reading {CSV_PATH} ...")
    try:
        applications = pd.read_csv(CSV_PATH, encoding="utf-8-sig")
        applications = prepare_for_database(applications)
        print(f"  {len(applications):,} rows read from CSV")
    except Exception as exc:
        print(f"Error reading CSV: {exc}")
        sys.exit(1)

    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    columns = list(applications.columns)
    rows = [
        tuple(_nan_to_none(v) for v in row)
        for row in applications.itertuples(index=False, name=None)
    ]

    print("Applying schema and inserting rows ...")
    try:
        conn = psycopg2.connect(**_DSN)
        try:
            with conn.cursor() as cur:
                for statement in schema_sql.split(";"):
                    statement = statement.strip()
                    if statement:
                        cur.execute(statement)
                print("  Schema applied (DROP + CREATE + indexes)")

                psycopg2.extras.execute_values(
                    cur,
                    f"INSERT INTO applications ({', '.join(columns)}) VALUES %s",
                    rows,
                    page_size=500,
                )
            conn.commit()
            print(f"  {len(applications):,} rows inserted")
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception as exc:
        print(f"Error: {exc}")
        sys.exit(1)

    print("Verifying ...")
    try:
        conn = psycopg2.connect(**_DSN)
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM applications")
                total_rows = cur.fetchone()[0]
        finally:
            conn.close()
        print(f"Done — {total_rows:,} rows in applications table.")
    except Exception as exc:
        print(f"Verification query failed after insert: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
