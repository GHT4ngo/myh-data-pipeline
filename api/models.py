from __future__ import annotations

from pydantic import BaseModel, Field


class ApplicationRow(BaseModel):
    """One row from the applications table."""

    id: int
    source_year: int
    source_file: str
    source_sheet: str

    diarienummer: str
    utbildningsnamn: str
    utbildningsomrade: str | None

    beslut: str | None
    beslut_normalized: str | None

    lan: str | None
    kommun: str | None

    yh_poang: int | None
    studieform: str | None
    studietakt_procent: int | None
    typ_av_examen: str | None

    utbildningsanordnare: str | None
    huvudmannatyp: str | None

    flera_kommuner: str | None
    antal_kommuner: int | None

    sokta_omgangar: int | None
    beviljade_omgangar: int | None

    sun5_inriktning: str | None
    sun5_inriktning_namn: str | None
    seqf_niva: str | None
    smalt_yrkesomrade: str | None

    is_distance: bool | None
    has_multiple_municipalities: bool | None

    model_config = {"from_attributes": True}


class YearStats(BaseModel):
    """Decision counts and approval rate for one source year."""

    source_year: int
    total_rows: int
    approved: int
    rejected: int
    withdrawn: int
    approval_rate_pct: float


class PredictRequest(BaseModel):
    """Input fields for the approval probability prediction."""

    lan: str
    utbildningsomrade: str
    studieform: str
    huvudmannatyp: str
    source_year: int = Field(ge=2018, le=2030)
    yh_poang: int = Field(ge=50, le=2000)
    studietakt_procent: int = Field(ge=25, le=100)
    is_distance: bool = False
    has_multiple_municipalities: bool = False


class PredictResponse(BaseModel):
    """Approval probability estimate returned by the model."""

    approval_probability: float
    rejection_probability: float
    model_name: str
