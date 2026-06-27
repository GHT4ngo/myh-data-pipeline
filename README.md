# MYH Data Pipeline

A data engineering project that turns MYH application-round Excel files into a curated dataset, a PostgreSQL database, a FastAPI service, a machine learning prediction model, SCB municipality enrichment, and a live frontend dashboard.

## Live Dashboard

### [myh-data-pipeline-dashboard.lovable.app](https://myh-data-pipeline-dashboard.lovable.app/)

Interactive dashboard built with React. It can browse all 9,983 MYH applications, explore approval statistics, inspect exported notebooks, query the API, test a prediction model, and compare municipality results with Statistics Sweden context.

**Data:** 2018–2025, 8 MYH application rounds, 9,983 records  
**External enrichment:** Statistics Sweden population + BAS employment/unemployment snapshot  
**Backend stack:** Python 3.11, pandas, openpyxl, PostgreSQL 16, psycopg2, FastAPI, Pydantic, Uvicorn, scikit-learn, XGBoost, joblib, Docker, Ruff  
**Frontend stack:** React 19, TanStack Router, TanStack Query, Recharts, Tailwind CSS, shadcn/ui, Vite  
**Hosting:** API on Render, database on Neon, dashboard on Lovable (Cloudflare Workers ready via `wrangler.jsonc`)

## What This Project Does

The raw source data is spread across eight MYH Excel files. The files use different sheet names, header rows, column names, and value conventions. This project harmonizes those files into one consistent `applications` table and exposes it through a read API consumed by the live frontend.

The project also includes two optional analysis layers:

- a Random Forest model that estimates approval probability for a new YH application
- a separate SCB enrichment notebook that adds municipality population, employment rate, and unemployment rate as contextual indicators

The final result can be used in four ways:

- as a curated CSV exported from `data_preparation.ipynb`
- as a PostgreSQL table loaded by `db/load.py` or Docker Compose
- as a FastAPI service with 17 documented endpoints
- as a live React dashboard with notebooks, charts, explorer, prediction, and SCB enrichment

---

## Repository File Reference

Every file in this repository and what it does.

### Root

| File | Description |
|------|-------------|
| `README.md` | This file |
| `explanation.md` | Plain-language walkthrough of the whole project |
| `pyproject.toml` | Ruff linter and formatter config (line length 88, Python 3.11+, double quotes) |
| `render.yaml` | Render deployment definition — Docker runtime, all required environment variables (`PG_*`, `ALLOWED_ORIGINS`, `REFRESH_SECRET`), deploy hooks |
| `.gitignore` | Ignore rules (`.env`, generated `data/`, Python cache, local notes) |
| `.env.example` | Template showing which environment variables are required (PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD, PG_SSLMODE, ALLOWED_ORIGINS, REFRESH_SECRET) |

### Notebooks and pipeline

| File | Description |
|------|-------------|
| `data_preparation.ipynb` | Main transformation notebook: loads 8 Excel files, harmonizes column names and decision values, cleans and enriches the data, validates quality, and exports `data/curated_applications.csv` |
| `pipeline.ipynb` | Creates the PostgreSQL schema, loads the CSV, verifies row counts and nulls, and documents the full FastAPI service with code and endpoint descriptions |
| `prediction_model.ipynb` | Trains Decision Tree, Random Forest, and XGBoost classifiers. Selects the best by F1 score, tunes with GridSearchCV, and saves the model to `api/model.joblib` |
| `convert_notebooks.py` | Converts the four `.ipynb` notebooks to dark-themed HTML files served by the API. Uses Pygments Monokai for code cells and a custom markdown renderer for prose cells |
| `docker-compose.yml` | Starts a PostgreSQL 16 container and the FastAPI container together for local development |
| `Dockerfile` | Container definition for the FastAPI service: Python 3.11-slim, installs `requirements-api.txt`, runs Uvicorn |
| `requirements.txt` | Python dependencies for the notebooks and pipeline (pandas, openpyxl, matplotlib, scikit-learn, XGBoost, joblib, psycopg2-binary, python-dotenv, FastAPI, Uvicorn, Pygments, Ruff) |
| `requirements-api.txt` | Python dependencies for the deployed API container (subset: FastAPI, Uvicorn, psycopg2-binary, pandas, joblib, scikit-learn, python-dotenv) |

### Source Data

Eight original MYH Excel files, one per application year, committed as-is from the MYH website.

| File | Year | Sheet | Header row | Rows |
|------|------|-------|------------|------|
| `resultat_ansokning/beslut-for-samtliga-ansokningar-...-2018.xlsx` | 2018 | Lista | 0 | 1 105 |
| `resultat_ansokning/beslut-for-samtliga-ansokningar-...-2019.xlsx` | 2019 | Lista | 0 | 1 237 |
| `resultat_ansokning/resultat-ansokningsomgang-2020.xlsx` | 2020 | Tabell 3 | 0 | 1 482 |
| `resultat_ansokning/resultat-ansokningsomgang-2021.xlsx` | 2021 | Tabell 3 | 0 | 1 238 |
| `resultat_ansokning/resultat-ansokningsomgang-2022.xlsx` | 2022 | Tabell 3 | 0 | 1 207 |
| `resultat_ansokning/resultat-ansokningsomgang-2023.xlsx` | 2023 | Tabell 3 | 5 | 1 263 |
| `resultat_ansokning/resultat-ansokningsomgang-2024.xlsx` | 2024 | Tabell 3 | 5 | 1 277 |
| `resultat_ansokning/resultat-ansokningsomgang-2025.xlsx` | 2025 | Tabell 3 | 6 | 1 190 |

### Database

| File | Description |
|------|-------------|
| `db/schema.sql` | PostgreSQL DDL: creates the `applications` table with 26 data columns plus an `id` SERIAL primary key, sets types, and creates indexes on `source_year`, `beslut_normalized`, `lan`, `utbildningsomrade`, and `utbildningsanordnare` |
| `db/load.py` | Standalone script that reads `data/curated_applications.csv` and loads it into PostgreSQL. Used outside Jupyter for automated reloads |
| `db/seed.sql` | Seed SQL executed by Docker Compose on first container start |

### API

| File | Description |
|------|-------------|
| `api/__init__.py` | Empty package marker |
| `api/main.py` | FastAPI application: 17 route handlers for applications, providers, stats, exports, prediction, enrichment, refresh, and health. Serves static notebook HTML at `/notebooks/` |
| `api/database.py` | psycopg2 connection pool and all query functions. Raw SQL with `%(name)s` parameters, no ORM. Includes `fetch_applications`, all stats aggregations, `fetch_municipality_enrichment`, `reload_database`, `fetch_pipeline_status` |
| `api/models.py` | Pydantic response models: `ApplicationRow`, `YearStats`, `PredictRequest`, `PredictResponse` |
| `api/model.joblib` | Serialized Random Forest classifier trained in `prediction_model.ipynb` |
| `api/model_columns.json` | List of feature column names the model expects after one-hot encoding |

### External Enrichment

| File | Description |
|------|-------------|
| `external_enrichment/scb_enrichment.ipynb` | Fetches population and BAS labour-market data from Statistics Sweden's PxWeb API, merges it with MYH municipality summaries, and exports a stable snapshot CSV |
| `external_enrichment/data/scb_municipality_context.csv` | Stable SCB snapshot, one row per municipality-year (2018–2025). Columns: `municipality`, `year`, `population`, `unemployment_rate_percent`, `employment_rate_percent`, `municipality_code` |
| `external_enrichment/data/.gitkeep` | Placeholder to keep the data directory tracked before the CSV is generated |

### Static Notebooks (HTML exports)

Generated by `convert_notebooks.py`. Served by the API at `/notebooks/<name>.html` and shown in the dashboard via iframe.

| File | Description |
|------|-------------|
| `static/notebooks/data_preparation.html` | Dark-themed HTML export of the data preparation notebook |
| `static/notebooks/pipeline.html` | Dark-themed HTML export of the pipeline notebook |
| `static/notebooks/prediction_model.html` | Dark-themed HTML export of the ML model notebook |
| `static/notebooks/scb_enrichment.html` | Dark-themed HTML export of the SCB enrichment notebook |
| `static/notebooks/.gitkeep` | Placeholder to keep the directory tracked |

### Frontend

The frontend is a React + Vite + TanStack Router app built with Lovable and deployed to Cloudflare Workers. The `frontend/` directory is a copy of the canonical frontend repo ([GHT4ngo/myh-data-pipeline-dashboard](https://github.com/GHT4ngo/myh-data-pipeline-dashboard)) kept in sync manually.

**Application files**

| File | Description |
|------|-------------|
| `src/routes/index.tsx` | Main dashboard page: hero, pipeline diagram, story section, notebook viewer, stats, explorer, SCB enrichment, API reference, tech stack, ML predictor, data quality report |
| `src/routes/predict.tsx` | Standalone predictor page with form inputs and probability result |
| `src/routes/sitemap[.]xml.ts` | TanStack Router file-route that serves the dashboard's sitemap |
| `src/routes/__root.tsx` | TanStack Router root layout (providers, global error boundary) |
| `src/router.tsx` | Route tree and router instance |
| `src/components/data-explorer.tsx` | Applications browser: live search, filters (year, decision, region, study form), paginated table, CSV export |
| `src/components/stats-dashboard.tsx` | Statistics charts: approval by year, education area, region, study form, top providers |
| `src/components/external-enrichment.tsx` | SCB enrichment view: municipality demand index, approval vs labour-market chart, trend over time, Sweden map with county dots |
| `src/components/data-states.tsx` | Shared loading skeletons and error state components |
| `src/components/ui/` | shadcn/ui component library (accordion, badge, button, card, dialog, input, select, table, tabs, tooltip, and others) |
| `src/lib/api.ts` | All API client functions: typed fetch wrappers for every backend endpoint |
| `src/lib/utils.ts` | Shared utility (Tailwind class merging via `cn`) |
| `src/lib/error-capture.ts` | Client-side error capture helper |
| `src/lib/error-page.ts` | Error page rendering helper |
| `src/hooks/use-mobile.tsx` | Responsive breakpoint hook |
| `src/styles.css` | Global CSS and Tailwind directives |
| `src/start.ts` | Cloudflare Workers entry point |
| `src/server.ts` | SSR server setup |
| `src/routeTree.gen.ts` | Auto-generated TanStack Router route tree |
| `public/robots.txt` | Robots exclusion file |

**Config files**

| File | Description |
|------|-------------|
| `package.json` | npm dependencies and build scripts |
| `bun.lock` | Bun lockfile |
| `bunfig.toml` | Bun config |
| `tsconfig.json` | TypeScript compiler config |
| `vite.config.ts` | Vite build config with React and TanStack Router plugins |
| `eslint.config.js` | ESLint config |
| `components.json` | shadcn/ui component registry config |
| `wrangler.jsonc` | Cloudflare Workers deployment config |
| `.prettierrc` / `.prettierignore` | Prettier formatting config |
| `.lovable/project.json` | Lovable project metadata |
| `frontend/README.md` | Lovable-generated frontend README |
| `frontend/.gitignore` | Frontend-specific ignore rules |

---

## Main Data Decisions

- Used 2018–2025 to show more history than the minimum requirement.
- Used `Tabell 3` where available because it is the best main applications table.
- Used `Lista` for 2018–2019 because the older files have a different structure.
- Kept `source_year`, `source_file`, and `source_sheet` for traceability.
- Normalized `Beslut` into `approved`, `rejected`, and `withdrawn`.
- Normalized `Landsting` to `Region`.
- Kept newer SUN5 and SeQF columns as null for older years instead of dropping them.
- Kept `Flera kommuner` as source information but excluded it from county rankings because it is not a county.
- Kept SCB enrichment separate from the core MYH pipeline so the core data remains reproducible.

## External Enrichment

The SCB enrichment uses Statistics Sweden's PxWeb API and exports a stable snapshot to:

`external_enrichment/data/scb_municipality_context.csv`

The snapshot contains municipality-year context:

- population
- employment rate
- unemployment rate
- SCB municipality code

The API joins this with MYH municipality summaries and calculates:

- applications per 100,000 residents
- approved applications per 100,000 residents
- approval rate with labour-market context

This is contextual analysis, not causation. It helps compare municipality scale and labour-market conditions without claiming that unemployment explains MYH decisions.

## ML Prediction Model

`prediction_model.ipynb` trains three classifiers on the full 2018–2025 dataset and selects the best one by F1 score on the approved class.

| Model | After tuning (test F1 approved) |
|-------|--------------------------------|
| Decision Tree | 0.540 |
| **Random Forest** | **0.548** |
| XGBoost | 0.546 |

**Best model:** Random Forest, depth=12, 300 trees, sqrt features  
**Tuning:** GridSearchCV with 5-fold cross-validation  
**Class imbalance:** handled with class weighting

The saved model (`api/model.joblib`) and feature column list (`api/model_columns.json`) are used by `POST /predict`.

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/pipeline/status` | Live data quality checks |
| GET | `/health` | Check database connection and notebook mount |
| GET | `/applications` | List records with filters and pagination |
| GET | `/applications/{diarienummer}` | Get rows for one case number |
| GET | `/providers` | List provider names |
| GET | `/providers/{name}/applications` | Provider contains-search |
| GET | `/stats/by-year` | Yearly totals and approval rates |
| GET | `/stats/by-education-area` | Statistics by education area |
| GET | `/stats/by-region` | Statistics by county |
| GET | `/stats/by-study-form` | Statistics by study form |
| GET | `/stats/by-provider` | Top providers by application count |
| GET | `/stats/multi-municipality` | Summary of multi-municipality rows |
| GET | `/stats/municipality-enrichment` | MYH municipality stats joined with SCB context |
| GET | `/export/applications` | Export filtered applications as CSV |
| GET | `/export/stats/by-year` | Export yearly stats as CSV |
| POST | `/predict` | Approval probability prediction |
| POST | `/refresh` | Rebuild database table from curated CSV (token-protected when `REFRESH_SECRET` is set) |

## Tools and Roles

| Tool | Where | Role |
|------|-------|------|
| Python 3.11 | Backend | Main language for notebooks, pipeline, API, and ML |
| pandas | Notebook | Excel loading, cleaning, harmonization, enrichment |
| openpyxl | Notebook | Excel engine for `.xlsx` files |
| SCB PxWeb API | External enrichment | Population and labour-market context |
| scikit-learn | ML | Decision Tree, Random Forest, GridSearchCV |
| XGBoost | ML | Gradient-boosted classifier comparison |
| joblib | ML | Model serialization |
| PostgreSQL 16 | Database | Stores the curated applications table |
| psycopg2-binary | API / load script | Direct PostgreSQL connection pool and parameterized SQL |
| FastAPI | API | JSON endpoints and Swagger/OpenAPI docs |
| Pydantic | API | Response models |
| Docker Compose | Local run | Starts database and API together |
| Neon | Cloud database | Hosted PostgreSQL |
| Render | Cloud API | Hosts the FastAPI container |
| Ruff | Backend quality | Python formatting and linting |
| Pygments | Notebook export | Syntax highlighting in the dark-themed notebook HTML |
| Jupyter | Notebook work | Explains the transformation step by step |
| Lovable | Frontend | Built and publishes the dashboard frontend |
| Cloudflare Workers | Frontend | Alternative deployment target wired up via `wrangler.jsonc` |
| React 19 / TanStack Router / TanStack Query / Recharts | Frontend | UI, routing, live API state, and charts |
| shadcn/ui / Tailwind CSS | Frontend | Component library and styling |
| Claude Code | Assistant | Code assistant and project assistant during development |
| Codex | Assistant | Project review, dashboard/API polish, and final release preparation |

## Run Locally With Docker

```bash
docker compose up
```

API docs: <http://localhost:8000/docs>

## Run Locally Without Docker

```bash
# 1. Run data_preparation.ipynb to export data/curated_applications.csv
# 2. Load the CSV into PostgreSQL
python db/load.py

# 3. Start the API
uvicorn api.main:app --reload
```

## Development Checks

```bash
# Format and lint the Python source and the notebooks.
ruff format api db convert_notebooks.py *.ipynb external_enrichment/*.ipynb
ruff check  api db convert_notebooks.py *.ipynb external_enrichment/*.ipynb
```

To refresh the notebook HTML shown in the frontend:

```bash
python convert_notebooks.py
```

## Links

- Live dashboard: <https://myh-data-pipeline-dashboard.lovable.app/>
- Frontend repo: <https://github.com/GHT4ngo/myh-data-pipeline-dashboard>

## License

Released under the [MIT License](LICENSE).
