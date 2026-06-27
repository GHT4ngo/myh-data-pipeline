# Project Explanation

This file is a plain-language walkthrough of the project.

## Goal

This project is about turning messy source data into something another system
can use.

The source data is MYH Excel files for application rounds from 2018 to 2025.
Each file describes applications to higher vocational education programs, but the
files are not perfectly consistent. Some years use different sheet names,
different header rows, and slightly different column names.

The goal was to create one trusted applications table, store it in PostgreSQL,
expose it through a FastAPI service, and add two optional layers on top: an ML
approval predictor and an external SCB enrichment.

## Data Preparation

`data_preparation.ipynb` is the main transformation notebook.

The notebook does this:

1. Reads the raw Excel files.
2. Documents which sheet and header row each year uses.
3. Compares which columns exist in which years.
4. Renames different source column names into one shared schema.
5. Cleans values, such as text spacing and numeric columns.
6. Normalizes decisions into `approved`, `rejected`, and `withdrawn`.
7. Adds helpful columns such as `is_distance` and
   `has_multiple_municipalities`.
8. Runs validation checks.
9. Exports `data/curated_applications.csv` (9,983 rows, 26 columns).

The most important design choice is traceability. Every row keeps
`source_year`, `source_file`, and `source_sheet`, so it is possible to go back to
the original Excel file if something looks strange.

## Database

`db/schema.sql` creates the PostgreSQL table.

The table uses a generated `id` as primary key because `diarienummer` is not
unique in all cases. Some applications can appear more than once when they are
connected to several municipalities.

Indexes cover `source_year`, `beslut_normalized`, `lan`, `utbildningsomrade`,
and `utbildningsanordnare` to keep the filtered and aggregated endpoints fast.

`db/load.py` loads the curated CSV into PostgreSQL. It is idempotent,
which means it recreates the table each time so the result is clean and
repeatable. `pipeline.ipynb` shows the same flow inside a notebook so the
SQL load is part of the documented data journey.

## API

The FastAPI code lives in `api/`. It exposes 17 endpoints, all read-only
except for two operational ones (`POST /refresh`, `POST /predict`).

### Applications and providers

- `GET /applications` — list with filters (`year`, `decision`, `region`,
  `municipality`, `provider`, `studieform`, free-text `search`) and pagination.
- `GET /applications/{diarienummer}` — every row for one case number.
- `GET /providers` — distinct provider names.
- `GET /providers/{name}/applications` — contains-search on provider name.

### Statistics

- `GET /stats/by-year` — yearly totals and approval rate.
- `GET /stats/by-education-area` — totals and approval rate by area.
- `GET /stats/by-region` — totals and approval rate by county
  (`Flera kommuner` excluded by default).
- `GET /stats/by-study-form` — totals and approval rate by study form.
- `GET /stats/by-provider` — top providers by application count.
- `GET /stats/multi-municipality` — summary of rows that span several
  municipalities.
- `GET /stats/municipality-enrichment` — MYH municipality metrics joined with
  the SCB context (population, employment rate, applications per 100k).

### Export

- `GET /export/applications` — filtered applications as CSV.
- `GET /export/stats/by-year` — yearly stats as CSV.

### Operational

- `GET /health` — database reachability + notebook/SCB asset checks.
- `GET /pipeline/status` — live data quality checks against the live database.
- `POST /predict` — approval probability for a new application (ML model).
- `POST /refresh` — rebuild the database from the curated CSV. Protected by
  `X-Refresh-Token` when `REFRESH_SECRET` is set.

The provider and text filters use case-insensitive contains search. For example,
searching for `teknik` matches provider names that contain that word anywhere
in the name.

## ML Prediction Model

`prediction_model.ipynb` trains Decision Tree, Random Forest, and XGBoost
classifiers on the 2018-2025 dataset.

- Tuning is done with `GridSearchCV`, 5-fold cross-validation, scoring on F1
  for the approved class.
- Class imbalance is handled with `class_weight='balanced'` (or
  `scale_pos_weight` for XGBoost).
- The best model by F1 is saved to `api/model.joblib`, with the feature column
  list in `api/model_columns.json`.

`POST /predict` reuses that model: it one-hot encodes the request, reindexes to
the saved column list, and returns the approval and rejection probabilities.

Note that this is **not** the official MYH process. MYH evaluates program
quality, regional need, and employer demand from documents the model cannot see.
The model only learns historical patterns and is useful to show that the curated
dataset is ML-ready.

## External Enrichment (SCB)

`external_enrichment/scb_enrichment.ipynb` fetches Statistics Sweden
data through the PxWeb API:

- Population per municipality per year (BefolkningNy).
- Employment and unemployment rate per municipality per year (ArbStatusAr).

The notebook merges the two tables, attaches the official SCB municipality
codes, and exports a stable snapshot to
`external_enrichment/data/scb_municipality_context.csv`.

The enrichment is kept **outside** the core MYH pipeline on purpose. The
core data must stay reproducible from MYH Excel files alone, so SCB is
treated as a separate layer that the API joins on demand.

`/stats/municipality-enrichment` joins the SCB context with MYH municipality
metrics and computes `applications_per_100k_residents` and
`approved_per_100k_residents` so municipalities of different sizes can be
compared fairly.

This is contextual analysis, not causation. It helps compare municipality
scale and labour-market conditions without claiming that unemployment explains
MYH decisions.

## `Flera kommuner`

Some rows have `Flera kommuner` in the county column. That value is useful as a
source marker, but it is not a real Swedish county.

The solution keeps the raw value in the data, but the default `/stats/by-region`
endpoint excludes it. A separate `/stats/multi-municipality` endpoint shows how
many rows involve several municipalities.

That gives a cleaner region chart without hiding the fact that the source data
contains this special case.

## `/refresh`

`POST /refresh` rebuilds the database table from the curated CSV.

It does not download new Excel files. It uses the already exported
`data/curated_applications.csv`, recreates the `applications` table, and inserts
the CSV rows again.

It is useful during development because the database can be refreshed after the
notebook exports a new CSV. In production, the endpoint requires
`X-Refresh-Token: $REFRESH_SECRET` when the secret is configured, so it cannot
be triggered anonymously.

## Frontend

The frontend is a separate Lovable + React project deployed to Cloudflare
Workers. It calls the FastAPI service directly and presents the project as a
live dashboard: hero, pipeline diagram, notebook viewer, statistics charts,
applications explorer, SCB enrichment, API reference, ML predictor, and data
quality report.

The frontend source is mirrored into `frontend/` for completeness; the
canonical repo is
[GHT4ngo/myh-data-pipeline-dashboard](https://github.com/GHT4ngo/myh-data-pipeline-dashboard).
