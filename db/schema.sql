-- MYH Data Pipeline, applications table
-- Run once to (re)create the schema. load.py calls this automatically.

DROP TABLE IF EXISTS applications;

CREATE TABLE applications (
    id                          SERIAL PRIMARY KEY,

    -- Source traceability
    source_year                 SMALLINT    NOT NULL,
    source_file                 TEXT        NOT NULL,
    source_sheet                TEXT        NOT NULL,

    -- Core identifiers
    diarienummer                TEXT        NOT NULL,
    utbildningsnamn             TEXT        NOT NULL,
    utbildningsomrade           TEXT,

    -- Decision
    beslut                      TEXT,
    beslut_normalized           TEXT,

    -- Location
    lan                         TEXT,
    kommun                      TEXT,

    -- Program details
    yh_poang                    SMALLINT,
    studieform                  TEXT,
    studietakt_procent          SMALLINT,
    typ_av_examen               TEXT,           -- null for 2018 and 2020

    -- Provider
    utbildningsanordnare        TEXT,
    huvudmannatyp               TEXT,

    -- Geography
    flera_kommuner              TEXT,           -- null for 2018
    antal_kommuner              SMALLINT,       -- null for 2018

    -- Round counts (introduced in 2020)
    sokta_omgangar              SMALLINT,       -- null for 2018-2019
    beviljade_omgangar          SMALLINT,       -- null for 2018-2019

    -- SUN5 / SeQF classification (introduced in 2023)
    sun5_inriktning             TEXT,
    sun5_inriktning_namn        TEXT,
    seqf_niva                   TEXT,
    smalt_yrkesomrade           TEXT,

    -- Derived / enriched columns
    is_distance                 BOOLEAN,
    has_multiple_municipalities BOOLEAN
);
-- Note: diarienummer is not unique within a year. A single application can
-- appear on multiple rows when it covers several municipalities (observed in
-- 2019 "Lista" sheet). The serial id is the only row-level key.

CREATE INDEX idx_applications_source_year    ON applications (source_year);
CREATE INDEX idx_applications_beslut_norm    ON applications (beslut_normalized);
CREATE INDEX idx_applications_lan            ON applications (lan);
CREATE INDEX idx_applications_utbildomrade   ON applications (utbildningsomrade);
CREATE INDEX idx_applications_anordnare      ON applications (utbildningsanordnare);
