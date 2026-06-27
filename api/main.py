from __future__ import annotations

import csv
import io
import json
import os
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
import psycopg2
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from api.database import (
    SCB_CONTEXT_PATH,
    connection_url_safe,
    fetch_application_count,
    fetch_applications,
    fetch_applications_by_diarienummer,
    fetch_applications_by_provider,
    fetch_municipality_enrichment,
    fetch_pipeline_status,
    fetch_providers,
    fetch_stats_by_education_area,
    fetch_stats_by_provider,
    fetch_stats_by_region,
    fetch_stats_by_study_form,
    fetch_stats_by_year,
    fetch_stats_multi_municipality,
    reload_database,
)
from api.models import ApplicationRow, PredictRequest, PredictResponse, YearStats

_MODEL_PATH = Path(__file__).parent / "model.joblib"
_COLUMNS_PATH = Path(__file__).parent / "model_columns.json"
_CATEGORICAL_FEATURES = ["lan", "utbildningsomrade", "studieform", "huvudmannatyp"]

_predict_model: Any | None
_training_columns: list[str] | None
_model_name: str | None
try:
    _predict_model = joblib.load(_MODEL_PATH)
    _training_columns = json.loads(_COLUMNS_PATH.read_text(encoding="utf-8"))
    _model_name = type(_predict_model).__name__
except FileNotFoundError:
    _predict_model = None
    _training_columns = None
    _model_name = None

# CORS: restrict to the known frontend origin in production via ALLOWED_ORIGINS env var.
# Falls back to "*" when not set so local development works without configuration.
_allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
_allowed_origins = (
    [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]
    if _allowed_origins_env
    else ["*"]
)

# /refresh token: if REFRESH_SECRET is set, callers must supply it via
# X-Refresh-Token header. Leave unset during local development.
_REFRESH_SECRET = os.getenv("REFRESH_SECRET", "")

app = FastAPI(
    title="MYH Application Data API",
    description="Query MYH application round results from 2018 to 2025.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

_NOTEBOOKS_DIR = Path(__file__).parent.parent / "static" / "notebooks"
if _NOTEBOOKS_DIR.exists():
    app.mount("/notebooks", StaticFiles(directory=_NOTEBOOKS_DIR), name="notebooks")


@app.exception_handler(psycopg2.Error)
async def database_error_handler(request: Request, exc: psycopg2.Error) -> JSONResponse:
    """Convert any unhandled psycopg2 error into a clean 503 response."""
    return JSONResponse(
        status_code=503,
        content={"detail": f"Database unavailable: {exc.__class__.__name__}"},
    )


@app.get("/pipeline/status", tags=["Admin"])
def pipeline_status() -> list[dict[str, Any]]:
    """Run live data quality checks against the applications table and return a structured report."""
    return fetch_pipeline_status()


@app.get("/health", tags=["Admin"])
def health_check() -> dict[str, Any]:
    """Check whether the API can reach the database."""
    notebooks_dir = _NOTEBOOKS_DIR
    notebooks_info = {
        "dir_exists": notebooks_dir.exists(),
        "resolved_path": str(notebooks_dir.resolve()),
        "files": sorted(f.name for f in notebooks_dir.iterdir())
        if notebooks_dir.exists()
        else [],
        "mounted": notebooks_dir.exists(),
    }
    scb_info = {
        "path": str(SCB_CONTEXT_PATH.resolve()),
        "exists": SCB_CONTEXT_PATH.exists(),
    }
    try:
        row_count = fetch_application_count()
        return {
            "status": "ok",
            "row_count": row_count,
            "db_url": connection_url_safe,
            "notebooks": notebooks_info,
            "scb_context": scb_info,
        }
    except Exception as exc:
        return {
            "status": "error",
            "error": str(exc),
            "db_url": connection_url_safe,
            "notebooks": notebooks_info,
            "scb_context": scb_info,
        }


@app.get("/applications", response_model=list[ApplicationRow], tags=["Applications"])
def list_applications(
    year: int | None = Query(None, description="Source year, for example 2024"),
    decision: str | None = Query(None, description="approved | rejected | withdrawn"),
    region: str | None = Query(None, description="County contains this text"),
    municipality: str | None = Query(
        None, description="Municipality contains this text"
    ),
    provider: str | None = Query(None, description="Provider contains this text"),
    studieform: str | None = Query(None, description="Study form contains this text"),
    search: str | None = Query(
        None,
        description="Search across program name, provider, city, area, and case number",
    ),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> list[dict[str, Any]]:
    """List applications with combinable filters and pagination."""
    return fetch_applications(
        year=year,
        decision=decision,
        region=region,
        municipality=municipality,
        provider=provider,
        studieform=studieform,
        search=search,
        limit=limit,
        offset=offset,
    )


@app.get(
    "/applications/{diarienummer}",
    response_model=list[ApplicationRow],
    tags=["Applications"],
)
def get_application_by_diarienummer(diarienummer: str) -> list[dict[str, Any]]:
    """Return all rows for one MYH case number."""
    rows = fetch_applications_by_diarienummer(diarienummer)
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No application found for diarienummer '{diarienummer}'",
        )
    return rows


@app.get("/providers", response_model=list[str], tags=["Providers"])
def list_providers() -> list[str]:
    """List all provider names."""
    return fetch_providers()


@app.get(
    "/providers/{name}/applications",
    response_model=list[ApplicationRow],
    tags=["Providers"],
)
def get_provider_applications(name: str) -> list[dict[str, Any]]:
    """Return applications where the provider name contains the supplied text."""
    rows = fetch_applications_by_provider(name)
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No applications found for provider search '{name}'",
        )
    return rows


@app.get("/stats/by-year", response_model=list[YearStats], tags=["Stats"])
def stats_by_year() -> list[dict[str, Any]]:
    """Return yearly totals and approval rates."""
    return fetch_stats_by_year()


@app.get("/stats/by-education-area", tags=["Stats"])
def stats_by_education_area() -> list[dict[str, Any]]:
    """Return totals and approval rates by education area."""
    return fetch_stats_by_education_area()


@app.get("/stats/by-region", tags=["Stats"])
def stats_by_region(
    include_multi_municipality_marker: bool = Query(
        False,
        description=(
            "Include rows where the raw county value is 'Flera kommuner'. "
            "Default is false because that value is not a real county."
        ),
    ),
) -> list[dict[str, Any]]:
    """Return totals and approval rates by county."""
    return fetch_stats_by_region(
        include_multi_municipality_marker=include_multi_municipality_marker
    )


@app.get("/stats/by-study-form", tags=["Stats"])
def stats_by_study_form() -> list[dict[str, Any]]:
    """Return totals and approval rates by study form."""
    return fetch_stats_by_study_form()


@app.get("/stats/by-provider", tags=["Stats"])
def stats_by_provider(
    limit: int = Query(20, ge=1, le=100, description="Number of providers to return"),
) -> list[dict[str, Any]]:
    """Return top providers by application count."""
    return fetch_stats_by_provider(limit)


@app.get("/stats/multi-municipality", tags=["Stats"])
def stats_multi_municipality() -> dict[str, Any]:
    """Return counts for applications spanning several municipalities."""
    return fetch_stats_multi_municipality()


@app.get("/stats/municipality-enrichment", tags=["Stats"])
def stats_municipality_enrichment(
    year: int | None = Query(None, description="Source year, for example 2024"),
    decision: str | None = Query(None, description="approved | rejected | withdrawn"),
    region: str | None = Query(None, description="County contains this text"),
    municipality: str | None = Query(
        None, description="Municipality contains this text"
    ),
    provider: str | None = Query(None, description="Provider contains this text"),
    studieform: str | None = Query(None, description="Study form contains this text"),
    search: str | None = Query(
        None,
        description="Search across program name, provider, city, area, and case number",
    ),
    education_area: str | None = Query(
        None, description="Education area contains this text"
    ),
    limit: int = Query(30, ge=1, le=100),
) -> list[dict[str, Any]]:
    """Return municipality application metrics with optional SCB enrichment."""
    return fetch_municipality_enrichment(
        year=year,
        decision=decision,
        region=region,
        municipality=municipality,
        provider=provider,
        studieform=studieform,
        search=search,
        education_area=education_area,
        limit=limit,
    )


def rows_to_csv_stream(rows: list[dict[str, Any]]) -> StreamingResponse:
    """Convert rows to a CSV download."""
    if not rows:
        raise HTTPException(status_code=404, detail="No data to export")

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    buffer.seek(0)

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=export.csv"},
    )


@app.get("/export/applications", tags=["Export"])
def export_applications(
    year: int | None = Query(None),
    decision: str | None = Query(None),
    region: str | None = Query(None),
    municipality: str | None = Query(None),
    provider: str | None = Query(None),
    studieform: str | None = Query(None),
    search: str | None = Query(None),
) -> StreamingResponse:
    """Download filtered applications as CSV."""
    rows = fetch_applications(
        year=year,
        decision=decision,
        region=region,
        municipality=municipality,
        provider=provider,
        studieform=studieform,
        search=search,
        limit=10_000,
        offset=0,
    )
    return rows_to_csv_stream(rows)


@app.get("/export/stats/by-year", tags=["Export"])
def export_stats_by_year() -> StreamingResponse:
    """Download yearly stats as CSV."""
    return rows_to_csv_stream(fetch_stats_by_year())


@app.post("/predict", response_model=PredictResponse, tags=["Predict"])
def predict_approval(request: PredictRequest) -> PredictResponse:
    """Estimate the approval probability for a new YH application."""
    if _predict_model is None or _training_columns is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Run prediction_model.ipynb first.",
        )

    try:
        input_row = pd.DataFrame([request.model_dump()])
        input_encoded = pd.get_dummies(
            input_row, columns=_CATEGORICAL_FEATURES, drop_first=False
        )
        input_aligned = input_encoded.reindex(columns=_training_columns, fill_value=0)
        probabilities = _predict_model.predict_proba(input_aligned)[0]
        # Look up the approved-class index from the model's own class list rather
        # than assuming index 1 = approved. Handles both int (1) and str ("approved") labels.
        classes = list(_predict_model.classes_)
        approved_index = classes.index(1) if 1 in classes else classes.index("approved")
        approval_probability = float(probabilities[approved_index])
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Prediction failed: {exc}"
        ) from exc

    return PredictResponse(
        approval_probability=round(approval_probability, 4),
        rejection_probability=round(1 - approval_probability, 4),
        model_name=_model_name,
    )


@app.post("/refresh", tags=["Admin"])
def refresh_database(x_refresh_token: str = Header(default="")) -> dict[str, Any]:
    """Reload the database from data/curated_applications.csv.

    Requires X-Refresh-Token header when REFRESH_SECRET is set in the environment.
    """
    if _REFRESH_SECRET and x_refresh_token != _REFRESH_SECRET:
        raise HTTPException(
            status_code=401, detail="Missing or invalid X-Refresh-Token header"
        )
    try:
        row_count = reload_database()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Reload failed: {exc}") from exc
    return {"status": "ok", "rows_loaded": row_count}
