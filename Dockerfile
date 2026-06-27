FROM python:3.11-slim

WORKDIR /app

COPY requirements-api.txt .
RUN pip install --no-cache-dir -r requirements-api.txt

# data/ is intentionally NOT copied: the curated CSV is gitignored and the
# production database is seeded from db/seed.sql or by a one-off run of
# db/load.py against the connected PostgreSQL instance. POST /refresh therefore
# only works in environments where data/curated_applications.csv has been
# mounted or copied in separately.
COPY api/ api/
COPY db/ db/
COPY static/ static/
COPY external_enrichment/data/ external_enrichment/data/

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
