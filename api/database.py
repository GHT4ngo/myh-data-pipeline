from __future__ import annotations

import os
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import pandas as pd
import psycopg2
import psycopg2.extras
import psycopg2.pool
from dotenv import load_dotenv

load_dotenv()

_pg_host = os.getenv("PG_HOST", "localhost")
_local_hosts = {"localhost", "127.0.0.1", "db"}
_sslmode = os.getenv("PG_SSLMODE", "prefer" if _pg_host in _local_hosts else "require")

_DSN: dict[str, Any] = {
    "host": _pg_host,
    "port": int(os.getenv("PG_PORT", "5432")),
    "dbname": os.getenv("PG_DATABASE", "data_pipeline_de25"),
    "user": os.getenv("PG_USER", "postgres"),
    "password": os.getenv("PG_PASSWORD", ""),
    "sslmode": _sslmode,
}

connection_url_safe = (
    f"postgresql://{_DSN['user']}:***@{_DSN['host']}:{_DSN['port']}/{_DSN['dbname']}"
)

BASE_DIR = Path(__file__).parent.parent
CSV_PATH = BASE_DIR / "data" / "curated_applications.csv"
SCB_CONTEXT_PATH = (
    BASE_DIR / "external_enrichment" / "data" / "scb_municipality_context.csv"
)
SCHEMA_PATH = BASE_DIR / "db" / "schema.sql"

_pool: psycopg2.pool.ThreadedConnectionPool | None = None

# Cache the SCB enrichment table indexed by municipality_key so
# /stats/municipality-enrichment does not re-read the CSV from disk on every
# request. The cache is keyed on the file's mtime so a regenerated CSV is
# picked up automatically without a restart.
_scb_cache_mtime: float | None = None
_scb_cache_df: pd.DataFrame | None = None


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.ThreadedConnectionPool(1, 10, **_DSN)
    return _pool


@contextmanager
def _cursor(
    *, autocommit: bool = False
) -> Generator[psycopg2.extras.DictCursor, None, None]:
    pool = _get_pool()
    conn = pool.getconn()
    try:
        conn.autocommit = autocommit
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        try:
            yield cur
            if not autocommit:
                conn.commit()
        except Exception:
            if not autocommit:
                conn.rollback()
            raise
        finally:
            cur.close()
    finally:
        conn.autocommit = False
        pool.putconn(conn)


def contains(value: str) -> str:
    """Prepare text for a case-insensitive SQL contains search."""
    return f"%{value.strip()}%"


def _nan_to_none(value: Any) -> Any:
    """Convert NaN / NA / NaT to None for psycopg2 compatibility."""
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


def fetch_applications(
    *,
    year: int | None,
    decision: str | None,
    region: str | None,
    municipality: str | None,
    provider: str | None,
    studieform: str | None,
    search: str | None,
    limit: int,
    offset: int,
) -> list[dict[str, Any]]:
    """Return application rows matching all supplied filters."""
    filters: list[str] = []
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    if year is not None:
        filters.append("source_year = %(year)s")
        params["year"] = year
    if decision is not None:
        filters.append("beslut_normalized = %(decision)s")
        params["decision"] = decision
    if region is not None:
        filters.append("lan ILIKE %(region)s")
        params["region"] = contains(region)
    if municipality is not None:
        filters.append("kommun ILIKE %(municipality)s")
        params["municipality"] = contains(municipality)
    if provider is not None:
        filters.append("utbildningsanordnare ILIKE %(provider)s")
        params["provider"] = contains(provider)
    if studieform is not None:
        filters.append("studieform ILIKE %(studieform)s")
        params["studieform"] = contains(studieform)
    if search is not None:
        filters.append(
            "(utbildningsnamn ILIKE %(search)s"
            " OR utbildningsanordnare ILIKE %(search)s"
            " OR diarienummer ILIKE %(search)s"
            " OR kommun ILIKE %(search)s"
            " OR utbildningsomrade ILIKE %(search)s)"
        )
        params["search"] = contains(search)

    where_clause = f"WHERE {' AND '.join(filters)}" if filters else ""
    sql = (
        f"SELECT * FROM applications {where_clause} "
        "ORDER BY id LIMIT %(limit)s OFFSET %(offset)s"
    )

    with _cursor() as cur:
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]


def fetch_applications_by_diarienummer(diarienummer: str) -> list[dict[str, Any]]:
    """Return all rows for a case number."""
    with _cursor() as cur:
        cur.execute(
            "SELECT * FROM applications "
            "WHERE diarienummer = %(diarienummer)s "
            "ORDER BY source_year, id",
            {"diarienummer": diarienummer},
        )
        return [dict(row) for row in cur.fetchall()]


def fetch_providers() -> list[str]:
    """Return all provider names."""
    with _cursor() as cur:
        cur.execute(
            "SELECT DISTINCT utbildningsanordnare "
            "FROM applications "
            "WHERE utbildningsanordnare IS NOT NULL "
            "ORDER BY utbildningsanordnare"
        )
        return [row[0] for row in cur.fetchall()]


def fetch_applications_by_provider(provider_name: str) -> list[dict[str, Any]]:
    """Return rows where the provider name contains the supplied text."""
    with _cursor() as cur:
        cur.execute(
            "SELECT * FROM applications "
            "WHERE utbildningsanordnare ILIKE %(provider_name)s "
            "ORDER BY source_year, id",
            {"provider_name": contains(provider_name)},
        )
        return [dict(row) for row in cur.fetchall()]


def fetch_stats_by_year() -> list[dict[str, Any]]:
    """Return yearly totals and approval rates."""
    with _cursor() as cur:
        cur.execute("""
            SELECT
                source_year,
                COUNT(*) AS total_rows,
                SUM(CASE WHEN beslut_normalized = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN beslut_normalized = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                SUM(
                    CASE WHEN beslut_normalized = 'withdrawn' THEN 1 ELSE 0 END
                ) AS withdrawn,
                ROUND(
                    100.0 * SUM(CASE WHEN beslut_normalized = 'approved' THEN 1 ELSE 0 END)
                    / COUNT(*), 1
                ) AS approval_rate_pct
            FROM applications
            GROUP BY source_year
            ORDER BY source_year
        """)
        return [dict(row) for row in cur.fetchall()]


def fetch_stats_by_education_area() -> list[dict[str, Any]]:
    """Return totals and approval rates by education area."""
    with _cursor() as cur:
        cur.execute("""
            SELECT
                utbildningsomrade,
                COUNT(*) AS total_rows,
                SUM(CASE WHEN beslut_normalized = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN beslut_normalized = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                ROUND(
                    100.0 * SUM(CASE WHEN beslut_normalized = 'approved' THEN 1 ELSE 0 END)
                    / COUNT(*), 1
                ) AS approval_rate_pct
            FROM applications
            WHERE utbildningsomrade IS NOT NULL
            GROUP BY utbildningsomrade
            ORDER BY total_rows DESC
        """)
        return [dict(row) for row in cur.fetchall()]


def fetch_stats_by_region(
    *, include_multi_municipality_marker: bool = False
) -> list[dict[str, Any]]:
    """Return totals by county.

    The raw source sometimes stores "Flera kommuner" in the county column. That
    is not a real county, so the default region chart hides it.
    """
    filters = ["lan IS NOT NULL"]
    if not include_multi_municipality_marker:
        filters.append("lan <> 'Flera kommuner'")

    sql = f"""
        SELECT
            lan,
            COUNT(*) AS total_rows,
            SUM(CASE WHEN beslut_normalized = 'approved' THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN beslut_normalized = 'rejected' THEN 1 ELSE 0 END) AS rejected,
            ROUND(
                100.0 * SUM(CASE WHEN beslut_normalized = 'approved' THEN 1 ELSE 0 END)
                / COUNT(*), 1
            ) AS approval_rate_pct
        FROM applications
        WHERE {" AND ".join(filters)}
        GROUP BY lan
        ORDER BY total_rows DESC
    """
    with _cursor() as cur:
        cur.execute(sql)
        return [dict(row) for row in cur.fetchall()]


def fetch_stats_by_study_form() -> list[dict[str, Any]]:
    """Return totals and approval rates by study form."""
    with _cursor() as cur:
        cur.execute("""
            SELECT
                studieform,
                COUNT(*) AS total_rows,
                SUM(CASE WHEN beslut_normalized = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN beslut_normalized = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                ROUND(
                    100.0 * SUM(CASE WHEN beslut_normalized = 'approved' THEN 1 ELSE 0 END)
                    / COUNT(*), 1
                ) AS approval_rate_pct
            FROM applications
            WHERE studieform IS NOT NULL
            GROUP BY studieform
            ORDER BY total_rows DESC
        """)
        return [dict(row) for row in cur.fetchall()]


def fetch_stats_by_provider(limit: int) -> list[dict[str, Any]]:
    """Return top providers by application count."""
    with _cursor() as cur:
        cur.execute(
            """
            SELECT
                utbildningsanordnare,
                COUNT(*) AS total_rows,
                SUM(CASE WHEN beslut_normalized = 'approved' THEN 1 ELSE 0 END) AS approved,
                SUM(CASE WHEN beslut_normalized = 'rejected' THEN 1 ELSE 0 END) AS rejected,
                ROUND(
                    100.0 * SUM(CASE WHEN beslut_normalized = 'approved' THEN 1 ELSE 0 END)
                    / COUNT(*), 1
                ) AS approval_rate_pct
            FROM applications
            WHERE utbildningsanordnare IS NOT NULL
            GROUP BY utbildningsanordnare
            ORDER BY total_rows DESC
            LIMIT %(limit)s
            """,
            {"limit": limit},
        )
        return [dict(row) for row in cur.fetchall()]


def fetch_stats_multi_municipality() -> dict[str, Any]:
    """Summarise rows that span several municipalities."""
    with _cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(*) AS total_rows,
                SUM(CASE WHEN has_multiple_municipalities THEN 1 ELSE 0 END)
                    AS has_multiple_municipalities,
                SUM(CASE WHEN lan = 'Flera kommuner' THEN 1 ELSE 0 END)
                    AS county_marker_rows
            FROM applications
        """)
        return dict(cur.fetchone())


def fetch_municipality_enrichment(
    *,
    year: int | None,
    decision: str | None,
    region: str | None,
    municipality: str | None,
    provider: str | None,
    studieform: str | None,
    search: str | None,
    education_area: str | None,
    limit: int,
) -> list[dict[str, Any]]:
    """Return application metrics by municipality with optional SCB context.

    The SCB file is intentionally kept outside the core database pipeline. If
    the enrichment notebook has not been run yet, the endpoint still returns
    application metrics and leaves external context fields empty.
    """
    filters = [
        "kommun IS NOT NULL",
        "kommun <> 'Flera kommuner'",
        "kommun <> ''",
    ]
    params: dict[str, Any] = {"limit": limit}

    if year is not None:
        filters.append("source_year = %(year)s")
        params["year"] = year
    if decision is not None:
        filters.append("beslut_normalized = %(decision)s")
        params["decision"] = decision
    if region is not None:
        filters.append("lan ILIKE %(region)s")
        params["region"] = contains(region)
    if municipality is not None:
        filters.append("kommun ILIKE %(municipality)s")
        params["municipality"] = contains(municipality)
    if provider is not None:
        filters.append("utbildningsanordnare ILIKE %(provider)s")
        params["provider"] = contains(provider)
    if studieform is not None:
        filters.append("studieform ILIKE %(studieform)s")
        params["studieform"] = contains(studieform)
    if education_area is not None:
        filters.append("utbildningsomrade ILIKE %(education_area)s")
        params["education_area"] = contains(education_area)
    if search is not None:
        filters.append(
            "(utbildningsnamn ILIKE %(search)s"
            " OR utbildningsanordnare ILIKE %(search)s"
            " OR diarienummer ILIKE %(search)s"
            " OR kommun ILIKE %(search)s"
            " OR utbildningsomrade ILIKE %(search)s)"
        )
        params["search"] = contains(search)

    sql = f"""
        SELECT
            kommun AS municipality,
            MAX(lan) AS county,
            COUNT(*) AS total_applications,
            SUM(CASE WHEN beslut_normalized = 'approved' THEN 1 ELSE 0 END)
                AS approved_applications,
            SUM(CASE WHEN beslut_normalized = 'rejected' THEN 1 ELSE 0 END)
                AS rejected_applications,
            ROUND(
                100.0 * SUM(CASE WHEN beslut_normalized = 'approved' THEN 1 ELSE 0 END)
                / COUNT(*), 1
            ) AS approval_rate_percent
        FROM applications
        WHERE {" AND ".join(filters)}
        GROUP BY kommun
        ORDER BY total_applications DESC
        LIMIT %(limit)s
    """

    with _cursor() as cur:
        cur.execute(sql, params)
        rows = [dict(row) for row in cur.fetchall()]

    for row in rows:
        if row.get("approval_rate_percent") is not None:
            row["approval_rate_percent"] = float(row["approval_rate_percent"])

    context = _load_scb_context()
    if context is None:
        return rows

    if year is not None:
        context = context[context["year"] <= year]

    if context.empty:
        return rows

    latest_context = (
        context.sort_values("year")
        .groupby("municipality_key", as_index=False)
        .tail(1)
        .set_index("municipality_key")
    )

    for row in rows:
        municipality_key = str(row["municipality"]).strip().lower()
        if municipality_key not in latest_context.index:
            continue

        context_row = latest_context.loc[municipality_key]
        population = context_row.get("population")
        total_applications = row["total_applications"]
        approved_applications = row["approved_applications"]

        row.update(
            {
                "scb_year": int(context_row["year"]),
                "scb_municipality_code": _optional_str(
                    context_row.get("municipality_code")
                ),
                "population": _optional_int(population),
                "employment_rate_percent": _optional_float(
                    context_row.get("employment_rate_percent")
                ),
                "unemployment_rate_percent": _optional_float(
                    context_row.get("unemployment_rate_percent")
                ),
                "applications_per_100k_residents": _per_100k(
                    total_applications,
                    population,
                ),
                "approved_per_100k_residents": _per_100k(
                    approved_applications,
                    population,
                ),
            }
        )

    return rows


def _load_scb_context() -> pd.DataFrame | None:
    """Return the SCB enrichment table (cached, mtime-aware).

    Returns None when the file does not exist yet (the enrichment notebook
    has not been run). The cache invalidates automatically when the file
    is rewritten.
    """
    global _scb_cache_mtime, _scb_cache_df
    if not SCB_CONTEXT_PATH.exists():
        _scb_cache_mtime = None
        _scb_cache_df = None
        return None

    mtime = SCB_CONTEXT_PATH.stat().st_mtime
    if _scb_cache_df is None or _scb_cache_mtime != mtime:
        context = pd.read_csv(SCB_CONTEXT_PATH, encoding="utf-8-sig")
        context["municipality_key"] = context["municipality"].str.strip().str.lower()
        _scb_cache_df = context
        _scb_cache_mtime = mtime
    return _scb_cache_df


def _optional_int(value: Any) -> int | None:
    if pd.isna(value):
        return None
    return int(value)


def _optional_float(value: Any) -> float | None:
    if pd.isna(value):
        return None
    return float(value)


def _optional_str(value: Any) -> str | None:
    if pd.isna(value):
        return None
    return str(value)


def _per_100k(value: int | float, population: Any) -> float | None:
    if pd.isna(population) or not population:
        return None
    return round(float(value) / float(population) * 100_000, 1)


def fetch_application_count() -> int:
    """Return the total number of rows in the applications table."""
    with _cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM applications")
        return cur.fetchone()[0]


def fetch_pipeline_status() -> list[dict[str, Any]]:
    """Run live data quality checks against the applications table."""
    checks: list[dict[str, Any]] = []

    def record(name: str, passed: bool, detail: str = "") -> None:
        checks.append(
            {"check": name, "status": "ok" if passed else "error", "detail": detail}
        )

    try:
        with _cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM applications")
            total_rows = cur.fetchone()[0]
            record(
                "Database reachable", True, f"{total_rows:,} rows in applications table"
            )

            cur.execute("SELECT COUNT(DISTINCT source_year) FROM applications")
            year_count = cur.fetchone()[0]
            record(
                "Year coverage (2018-2025)",
                year_count == 8,
                f"{year_count} / 8 years present",
            )

            for col in ("diarienummer", "utbildningsnamn", "beslut_normalized"):
                cur.execute(f"SELECT COUNT(*) FROM applications WHERE {col} IS NULL")
                null_count = cur.fetchone()[0]
                record(
                    f"{col} non-null",
                    null_count == 0,
                    "all populated" if null_count == 0 else f"{null_count} nulls found",
                )

            cur.execute(
                "SELECT COUNT(*) FROM applications "
                "WHERE beslut_normalized NOT IN ('approved', 'rejected', 'withdrawn')"
            )
            unknown_decisions = cur.fetchone()[0]
            record(
                "beslut_normalized values valid",
                unknown_decisions == 0,
                "approved / rejected / withdrawn only"
                if unknown_decisions == 0
                else f"{unknown_decisions} unknown values",
            )

            cur.execute(
                "SELECT COUNT(*) FROM applications WHERE huvudmannatyp = 'Landsting'"
            )
            landsting_count = cur.fetchone()[0]
            record(
                "No Landsting values remain",
                landsting_count == 0,
                "all mapped to Region"
                if landsting_count == 0
                else f"{landsting_count} Landsting rows found",
            )

    except Exception as exc:
        checks.append(
            {"check": "Database reachable", "status": "error", "detail": str(exc)}
        )

    return checks


def reload_database() -> int:
    """Recreate the applications table and reload it from the curated CSV."""
    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"Curated CSV not found: {CSV_PATH}. Run data_preparation.ipynb first."
        )
    if not SCHEMA_PATH.exists():
        raise FileNotFoundError(f"Schema file not found: {SCHEMA_PATH}")

    applications = pd.read_csv(CSV_PATH, encoding="utf-8-sig")

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
        applications[column] = (
            applications[column]
            .astype(str)
            .str.strip()
            .str.lower()
            .map({"true": True, "false": False})
        )

    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    columns = list(applications.columns)
    rows = [
        tuple(_nan_to_none(v) for v in row)
        for row in applications.itertuples(index=False, name=None)
    ]

    with _cursor() as cur:
        for statement in schema_sql.split(";"):
            statement = statement.strip()
            if statement:
                cur.execute(statement)
        psycopg2.extras.execute_values(
            cur,
            f"INSERT INTO applications ({', '.join(columns)}) VALUES %s",
            rows,
            page_size=500,
        )

    return len(applications)
