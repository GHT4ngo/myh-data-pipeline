import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Database,
  DatabaseZap,
  ArrowRight,
  FileSpreadsheet,
  Wand2,
  Sparkles,
  ShieldCheck,
  Server,
  AppWindow,
  ExternalLink,
  Github,
  BrainCircuit,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { StatsDashboard } from "@/components/stats-dashboard";
import { DataExplorer } from "@/components/data-explorer";
import { ExternalEnrichment } from "@/components/external-enrichment";
import { API_BASE, api } from "@/lib/api";
import type { PipelineStatusCheck, PredictRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MYH Data Pipeline, YH application rounds 2018-2025" },
      {
        name: "description",
        content:
          "Live dashboard for the MYH application data pipeline: 8 years, 8 Excel files, 9,983 records harmonized into PostgreSQL and served via FastAPI.",
      },
      { property: "og:title", content: "MYH Data Pipeline" },
      {
        property: "og:description",
        content:
          "Swedish vocational education (YH) application rounds 2018–2025, harmonized and served live.",
      },
    ],
  }),
  component: Index,
});

const SECTIONS = [
  { id: "pipeline", label: "Pipeline" },
  { id: "story", label: "Story" },
  { id: "notebooks", label: "Notebooks" },
  { id: "stats", label: "Dashboard" },
  { id: "explorer", label: "Explorer" },
  { id: "enrichment", label: "SCB" },
  { id: "api", label: "API" },
  { id: "tech", label: "Tech" },
  { id: "predict", label: "Predictor" },
  { id: "pipeline-report", label: "Data Quality" },
];

function Index() {
  const [active, setActive] = useState("hero");

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav active={active} />
      <main className="mx-auto max-w-7xl px-5 pb-32 sm:px-8">
        <Hero />
        <Pipeline />
        <ProjectStory />
        <Notebooks />
        <Section id="stats" eyebrow="05 / Statistics" title="Live dashboard">
          <p className="mb-8 max-w-2xl text-sm text-muted-foreground">
            All charts hit the FastAPI directly, no mock data, no caching layer.
            If the API is cold-starting on Render's free tier, the data may take up
            to 60 seconds to appear. Charts will populate automatically.
          </p>
          <StatsDashboard />
        </Section>
        <Section id="explorer" eyebrow="06 / Records" title="Data explorer">
          <p className="mb-8 max-w-2xl text-sm text-muted-foreground">
            Query{" "}
            <span className="font-mono text-primary">GET /applications</span>{" "}
            with combinable filters. 50 rows per page, server-side pagination.
          </p>
          <DataExplorer />
          <div id="enrichment" className="mt-8 scroll-mt-24">
            <ExternalEnrichment />
          </div>
        </Section>
        <ApiReference />
        <TechDetails />
        <Predictor />
        <PipelineStatus />

      </main>
      <Footer />
    </div>
  );
}

// ── Nav ────────────────────────────────────────────────────────────────────────

function TopNav({ active }: { active: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
        <a href="#hero" className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-md border border-primary/40 bg-primary/15 text-primary">
            <Database className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">MYH Data Pipeline</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Christofer Lindholm
            </div>
          </div>
        </a>
        <nav className="hidden items-center gap-1 md:flex">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active === s.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          <a
            href={`${API_BASE}/docs`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-1 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
          >
            API docs <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </header>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────────

function Hero() {
  const stack = ["Python 3.11", "pandas", "PostgreSQL 16", "FastAPI", "psycopg2", "Docker", "Neon.tech", "Render.com"];
  return (
    <section id="hero" className="relative scroll-mt-20 pt-20 pb-24 sm:pt-28">
      <div className="pointer-events-none absolute inset-0 -z-10 grid-bg" />
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
          Live · {API_BASE.replace("https://", "")}
        </div>
        <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          MYH <span className="text-primary">Data Pipeline</span>
        </h1>
        <p className="mt-4 text-sm font-medium text-muted-foreground">
          by Christofer Lindholm · Data Engineering
        </p>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          8 years · 8 Excel files · 9,983 records →{" "}
          <span className="text-foreground">PostgreSQL + FastAPI</span>.{" "}
          <a
            href="https://www.myh.se/yrkeshogskolan/resultat-ansokningsomgangar/resultat-for-program"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-2 hover:text-primary"
          >
            Swedish vocational education (YH) application rounds
          </a>
          , harmonized from inconsistent source data into one clean, queryable dataset.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          {stack.map((s) => (
            <span
              key={s}
              className="rounded-md border border-border bg-surface-1 px-3 py-1.5 font-mono text-xs text-foreground"
            >
              {s}
            </span>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="#stats"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 glow"
          >
            View dashboard <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#explorer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-1 px-5 py-2.5 text-sm font-semibold transition hover:border-primary hover:text-primary"
          >
            Explore records
          </a>
          <a
            href="https://github.com/GHT4ngo/myh-data-pipeline"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-1 px-5 py-2.5 text-sm font-semibold transition hover:border-primary hover:text-primary"
          >
            <Github className="h-4 w-4" /> Source
          </a>
        </div>

        <dl className="mt-14 grid grid-cols-2 gap-6 border-t border-border pt-8 sm:grid-cols-4">
          <Metric label="Years covered" value="2018–25" />
          <Metric label="Source files" value="8" />
          <Metric label="Records" value="9,983" />
          <Metric label="API endpoints" value="17" />
        </dl>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border/60 py-20">
      <div className="mb-10">
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary">
          {eyebrow}
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// ── Pipeline ───────────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { icon: FileSpreadsheet, label: "Raw MYH files", tone: "blue", desc: "8 yearly Excel files from 2018-2025. Sheet names, header rows, and columns differ across years." },
  { icon: Wand2, label: "Harmonize", tone: "blue", desc: "One column map turns the yearly files into one canonical applications schema with traceable source columns." },
  { icon: Sparkles, label: "Clean & derive", tone: "green", desc: "Normalize decisions, fix Landsting to Region, coerce numeric values, and derive distance/multi-municipality flags." },
  { icon: ShieldCheck, label: "Validate", tone: "green", desc: "Notebook and API checks verify row counts, year coverage, required values, and normalized decision values." },
  { icon: Database, label: "PostgreSQL", tone: "blue", desc: "9,983 rows loaded into one typed applications table with indexes for common filters and stats." },
  { icon: Server, label: "FastAPI", tone: "amber", desc: "17 endpoints expose records, stats, CSV export, refresh, prediction, and SCB municipality enrichment." },
  { icon: BrainCircuit, label: "ML model", tone: "amber", desc: "Random Forest model estimates approval probability from historical MYH application patterns." },
  { icon: DatabaseZap, label: "SCB enrichment", tone: "green", desc: "Separate enrichment notebook joins population, employment, and unemployment context from Statistics Sweden." },
  { icon: AppWindow, label: "Dashboard", tone: "blue", desc: "React, TanStack Query, and Recharts present the API, notebooks, data explorer, ML model, and enrichment layer." },
];

function pipelineTone(tone: string) {
  if (tone === "green") return "border-success/35 text-success";
  if (tone === "amber") return "border-warning/35 text-warning";
  return "border-primary/35 text-primary";
}

function Pipeline() {
  return (
    <Section id="pipeline" eyebrow="02 / Architecture" title="Pipeline overview">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PIPELINE_STEPS.map((s, i) => (
          <div
            key={s.label}
            className={`group relative rounded-xl border bg-surface-1/60 p-5 transition hover:border-primary/50 ${pipelineTone(s.tone)}`}
          >
            <div className="flex items-center justify-between">
              <div className="grid h-9 w-9 place-items-center rounded-md border border-current/30 bg-current/10">
                <s.icon className="h-4 w-4" />
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="mt-4 text-sm font-semibold">{s.label}</div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
            {i < PIPELINE_STEPS.length - 1 && (
              <ArrowRight
                className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-border lg:block"
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Project Story ──────────────────────────────────────────────────────────────

function ProjectStory() {
  return (
    <Section id="story" eyebrow="03 / Walkthrough" title="Project story">
      <p className="mb-8 max-w-2xl text-sm text-muted-foreground">
        Each step below covers the decisions made at that stage, from the source files to the live API.
      </p>
      <Accordion type="multiple" className="rounded-xl border border-border bg-surface-1/60 divide-y divide-border/60">

        <AccordionItem value="source" className="border-0 px-6">
          <AccordionTrigger className="text-sm font-semibold">
            <span className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-primary">01</span>
              The raw data: 8 inconsistent Excel files
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pb-2">
              <p>
                MYH publishes one Excel file per application round. The 2018–2025 files look
                superficially similar but differ in every structural dimension: sheet names
                ("Lista" for 2018–2019, "Tabell 3" from 2020), header row position (row 0 for
                early years, row 5 in 2023–2024, row 6 in 2025), and column naming (the provider
                field alone had three different Swedish headings across years).
              </p>
              <p>
                The 2019 file was particularly problematic: it contained a set of unnamed junk
                columns (<span className="font-mono text-xs text-foreground">Unnamed: *</span>)
                and a <span className="font-mono text-xs text-foreground">Notera:*</span> metadata
                block that had to be stripped before any parsing could happen.
              </p>
              <p>
                The 2023–2025 files introduced three entirely new classification systems: SUN5 subject codes, SeQF qualification levels, and a narrow occupational area field, which do not exist in earlier years. They were kept as null for 2018–2022 to keep the schema consistent across all years.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="harmonize" className="border-0 px-6">
          <AccordionTrigger className="text-sm font-semibold">
            <span className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-primary">02</span>
              Harmonization: building a unified column map
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pb-2">
              <p>
                A single <span className="font-mono text-xs text-foreground">COLUMN_MAP</span> dictionary
                maps every observed Swedish column heading (with diacritics, e.g. "YH-poäng",
                "Utbildningsområde", "Sökta utbildningsomgångar") to a canonical snake_case name.
                The same map is applied to all 8 files before any processing occurs.
              </p>
              <p>
                The decision field (<span className="font-mono text-xs text-foreground">beslut</span>)
                was the most heterogeneous: "Beviljad", "Ej beviljad", "Avslag", "Återkallad",
                and several year-specific phrasings. All are mapped to a three-value normalized
                enum: <span className="font-mono text-xs text-foreground">approved / rejected / withdrawn</span>.
                The raw Swedish value is preserved alongside it.
              </p>
              <p>
                A notable administrative change: Sweden renamed "Landsting" to "Region" in 2019.
                The 2018 file still uses "Landsting" as a provider type value. This was corrected
                in the harmonization step so the <span className="font-mono text-xs text-foreground">huvudmannatyp</span> column
                is consistent across all years.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="clean" className="border-0 px-6">
          <AccordionTrigger className="text-sm font-semibold">
            <span className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-primary">03</span>
              Cleaning and enrichment
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pb-2">
              <p>
                Numeric columns (<span className="font-mono text-xs text-foreground">yh_poang</span>,{" "}
                <span className="font-mono text-xs text-foreground">studietakt_procent</span>,{" "}
                <span className="font-mono text-xs text-foreground">antal_kommuner</span>) were coerced
                with <span className="font-mono text-xs text-foreground">pd.to_numeric(errors="coerce")</span>,
                turning non-numeric strings into NaN rather than raising exceptions.
              </p>
              <p>
                Two boolean derived columns were added:{" "}
                <span className="font-mono text-xs text-foreground">is_distance</span> (True when studieform
                contains "Distans") and{" "}
                <span className="font-mono text-xs text-foreground">has_multiple_municipalities</span>{" "}
                (True when flera_kommuner == "Ja"). These make common queries simpler and faster to index.
              </p>
              <p>
                Null strategy for year-specific columns: columns introduced in later years
                (SUN5/SeQF in 2023+, <span className="font-mono text-xs text-foreground">typ_av_examen</span> missing
                in 2018 and 2020) are kept as null, not imputed or dropped. The schema
                documents which nulls are structural vs. data quality issues.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="db" className="border-0 px-6">
          <AccordionTrigger className="text-sm font-semibold">
            <span className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-primary">04</span>
              Database design: schema, types, and indexing
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pb-2">
              <p>
                The natural candidate for a primary key would be{" "}
                <span className="font-mono text-xs text-foreground">diarienummer</span>, but this was
                explicitly rejected: the 2019 "Lista" sheet records one row per study municipality
                for multi-location programs, so a single diarienummer can legitimately appear on
                multiple rows. A SERIAL surrogate key was used instead.
              </p>
              <p>
                Column types were chosen conservatively: SMALLINT for year (2018–2025),
                studietakt_procent (0-100), and the omgangar counts, saving space on a table
                that currently contains 9,983 rows. All text fields are TEXT (no VARCHAR
                limits) to avoid truncation surprises with long Swedish program names.
              </p>
              <p>
                Five B-tree indexes were created on the columns most likely to appear in WHERE
                clauses: source_year, beslut_normalized, lan, utbildningsomrade, and
                utbildningsanordnare. No composite index was added since filter combinations
                are unpredictable and partial scans on these single-column indexes are fast enough
                for the dataset size.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="api" className="border-0 px-6">
          <AccordionTrigger className="text-sm font-semibold">
            <span className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-primary">05</span>
              API layer: FastAPI and psycopg2
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pb-2">
              <p>
                FastAPI was chosen over Flask for its automatic OpenAPI documentation and
                native support for Pydantic response model validation. The query layer uses
                raw psycopg2 with{" "}
                <span className="font-mono text-xs text-foreground">%(name)s</span> bind
                parameters rather than an ORM; this gives full SQL control without the overhead
                of mapping 26 columns to a declarative model.
              </p>
              <p>
                The <span className="font-mono text-xs text-foreground">fetch_applications</span> function
                uses keyword-only arguments (<span className="font-mono text-xs text-foreground">def fetch_applications(*, year, decision, ...)</span>)
                to prevent positional mismatches when the caller omits several optional filters.
                Text search fields use ILIKE for case-insensitive matching of Swedish county and
                municipality names.
              </p>
              <p>
                CSV export is implemented as a streaming response using Python's
                <span className="font-mono text-xs text-foreground"> io.StringIO</span> and
                <span className="font-mono text-xs text-foreground"> csv.DictWriter</span>, avoiding
                the need to buffer the full dataset in memory. The same filter parameters as
                <span className="font-mono text-xs text-foreground"> /applications</span> are accepted,
                with the limit raised to 10 000 for bulk exports.
              </p>
              <p>
                CORS middleware is configured with <span className="font-mono text-xs text-foreground">allow_origins=["*"]</span> so
                browser-based frontends (including this app) can call the API without proxy setup.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="deploy" className="border-0 px-6">
          <AccordionTrigger className="text-sm font-semibold">
            <span className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-primary">06</span>
              Deployment: Docker, Render, and Neon
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed pb-2">
              <p>
                Local development uses Docker Compose: one postgres:16 container seeded
                automatically from <span className="font-mono text-xs text-foreground">db/seed.sql</span>{" "}
                (a full <span className="font-mono text-xs text-foreground">pg_dump</span> of the production
                dataset), and one API container built from a minimal python:3.11-slim image.
                A single <span className="font-mono text-xs text-foreground">docker compose up</span> gives
                a fully populated local environment in under 2 minutes.
              </p>
              <p>
                Cloud deployment runs on Render.com (free web service) pointing at a Neon.tech
                serverless PostgreSQL instance (free tier, 500 MB). The database was seeded by
                running seed.sql against the Neon connection string via psql. The Render service
                reads DB credentials from environment variables, matching the same{" "}
                <span className="font-mono text-xs text-foreground">PG_*</span> names used locally.
              </p>
              <p>
                The <span className="font-mono text-xs text-foreground">render.yaml</span> blueprint at the
                repo root defines the service, Dockerfile path, and environment variable slots so
                the deployment is fully reproducible from a fresh repo clone. Note: Render's free
                tier spins down after 15 minutes of inactivity. The first request after a quiet
                period triggers a 30-60 second cold start.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ml" className="border-0 px-6">
          <AccordionTrigger className="text-sm font-semibold">
            <span className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-primary">07</span>
              Machine learning: approval probability model
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pb-2 text-sm leading-relaxed text-muted-foreground">
              <p>
                The prediction notebook trains and compares Decision Tree, Random Forest,
                and XGBoost models. Random Forest is kept as the deployed model because it
                gave the best balance of performance and explainability for this project.
              </p>
              <p>
                The saved model is served through <span className="font-mono text-xs text-foreground">POST /predict</span>,
                where the frontend can test a hypothetical YH application without retraining anything.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="scb" className="border-0 px-6">
          <AccordionTrigger className="text-sm font-semibold">
            <span className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-primary">08</span>
              External enrichment: Statistics Sweden snapshot
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pb-2 text-sm leading-relaxed text-muted-foreground">
              <p>
                SCB enrichment is kept in its own notebook and exported as a snapshot CSV.
                That makes the core MYH pipeline reproducible while still adding population,
                employment, and unemployment context for municipality-level comparisons.
              </p>
              <p>
                The dashboard uses this snapshot through <span className="font-mono text-xs text-foreground">GET /stats/municipality-enrichment</span>
                to calculate applications per 100,000 residents and compare approval rate with labour-market indicators.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </Section>
  );
}

// ── Notebooks ─────────────────────────────────────────────────────────────────

const NOTEBOOK_FILES = [
  { label: "Data preparation", file: "data_preparation.html", desc: "Excel ingestion, harmonization, cleaning, enrichment, validation, and CSV export." },
  { label: "Database & API", file: "pipeline.html", desc: "PostgreSQL schema, bulk load, live verification, and the FastAPI layer." },
  { label: "Prediction model", file: "prediction_model.html", desc: "Random Forest training, hyperparameter tuning, evaluation, and model export." },
  { label: "SCB enrichment", file: "scb_enrichment.html", desc: "Statistics Sweden API calls, municipality context, employment/unemployment rates, and snapshot export." },
];

function Notebooks() {
  const [activeIdx, setActiveIdx] = useState(0);
  const nb = NOTEBOOK_FILES[activeIdx];
  const src = `${API_BASE}/notebooks/${nb.file}`;

  return (
    <Section id="notebooks" eyebrow="04 / Notebooks" title="Jupyter notebooks">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Full notebooks including all code and cell outputs. Click any tab to switch notebook.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {NOTEBOOK_FILES.map((n, i) => (
          <button
            key={n.file}
            onClick={() => setActiveIdx(i)}
            className={`rounded-md border px-4 py-1.5 text-sm font-medium transition-colors ${
              i === activeIdx
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {n.label}
          </button>
        ))}
      </div>

      <p className="mb-3 text-xs text-muted-foreground">{nb.desc}</p>

      <div className="overflow-hidden rounded-xl border border-border bg-surface-1/60">
        <div className="flex items-center justify-between border-b border-border/60 bg-surface-2/60 px-4 py-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            {nb.file.replace(".html", ".ipynb")}
          </span>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground transition hover:text-primary"
          >
            open full screen <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <iframe
          key={src}
          src={src}
          className="h-[720px] w-full"
          loading="lazy"
          title={nb.label}
        />
      </div>
    </Section>
  );
}

// ── API Reference ──────────────────────────────────────────────────────────────

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/pipeline/status", "Live data quality checks against the applications table."],
  ["GET", "/health", "Database connectivity and row-count check."],
  ["GET", "/applications", "List applications with year, decision, region, municipality, provider, and study-form filters."],
  ["GET", "/applications/{diarienummer}", "All rows for one MYH case number."],
  ["GET", "/providers", "Distinct education provider names."],
  ["GET", "/providers/{name}/applications", "Provider search using case-insensitive contains matching."],
  ["GET", "/stats/by-year", "Yearly totals and approval rates."],
  ["GET", "/stats/by-region", "County statistics; excludes Flera kommuner by default."],
  ["GET", "/stats/by-education-area", "Volume and approval rate grouped by education area."],
  ["GET", "/stats/by-study-form", "Comparison by Bunden, Distans, and other study forms."],
  ["GET", "/stats/by-provider", "Top providers by application count."],
  ["GET", "/stats/multi-municipality", "Separate summary for rows spanning several municipalities."],
  ["GET", "/stats/municipality-enrichment", "MYH municipality summaries joined with SCB population and labour-market context."],
  ["GET", "/export/applications", "Filtered applications as CSV."],
  ["GET", "/export/stats/by-year", "Yearly stats as CSV."],
  ["POST", "/predict", "ML model: approval probability estimate for a new application."],
  ["POST", "/refresh", "Reload the database table from the curated CSV."],
];

function ApiReference() {
  return (
    <Section id="api" eyebrow="07 / Reference" title="API endpoints">
      <div className="overflow-hidden rounded-xl border border-border bg-surface-1/60">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-2/60">
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 font-semibold">Method</th>
              <th className="px-5 py-3 font-semibold">Path</th>
              <th className="px-5 py-3 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody>
            {ENDPOINTS.map(([m, p, d]) => (
              <tr key={p} className="border-b border-border/60 last:border-0 hover:bg-surface-2/40">
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold ${
                      m === "GET"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-warning/40 bg-warning/10 text-warning"
                    }`}
                  >
                    {m}
                  </span>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-foreground">{p}</td>
                <td className="px-5 py-3 text-xs text-muted-foreground">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5">
        <a
          href={`${API_BASE}/docs`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          Open interactive Swagger UI <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </Section>
  );
}

// ── Tech Details ───────────────────────────────────────────────────────────────

const TOOLS: Array<[string, string, string]> = [
  ["Python 3.11", "Runtime", "Core language for the data pipeline and API"],
  ["pandas", "Data", "Excel ingestion, harmonization, cleaning, and enrichment"],
  ["openpyxl", "Data", "Engine for reading MYH .xlsx files"],
  ["SCB PxWeb API", "External data", "Population and BAS labour-market enrichment snapshot"],
  ["Jupyter", "Notebook", "Documents the raw-data journey and transformation decisions"],
  ["PostgreSQL 16", "Storage", "Stores the curated applications table"],
  ["psycopg2-binary", "Database", "PostgreSQL adapter — direct connection pooling and parameterized SQL queries"],
  ["FastAPI", "API", "Read API with filters, statistics, CSV export, and Swagger docs"],
  ["Pydantic", "API", "Response models for application rows and yearly stats"],
  ["Uvicorn", "API", "ASGI server for running the FastAPI app"],
  ["python-dotenv", "Config", "Loads local PG_* settings from .env"],
  ["Docker", "Local/Deploy", "Containerized API image based on python:3.11-slim"],
  ["Docker Compose", "Local", "Starts PostgreSQL and API together with seeded data"],
  ["Neon.tech", "Cloud DB", "Hosted PostgreSQL for the deployed API"],
  ["Render.com", "Hosting", "Hosts the deployed FastAPI service"],
  ["Ruff", "Quality", "Python formatter and linter configured in the backend repo"],
  ["Lovable", "Frontend", "Created and deploys this React dashboard project"],
  ["React 19", "Frontend", "UI framework for the dashboard and explorer"],
  ["TanStack Query", "Frontend", "Live API fetching, retry, and loading state"],
  ["Recharts", "Frontend", "Gradient trend charts and comparison charts"],
  ["Tailwind CSS v4", "Frontend", "Visual styling and responsive layout"],
  ["Claude Code", "Assistant", "Code assistant and project assistant during development"],
  ["Codex", "Assistant", "Reviewer of the project plus API/frontend polish and release prep"],
];

const HARMONIZATION: Array<[string, string]> = [
  ["beslut", "Mapped to approved / rejected / withdrawn. Handles 'Beviljad', 'Avslag', 'Ej beviljad', 'Återkallad' and per-year variants."],
  ["Header rows", "2018–2022 header on row 0; 2023–2024 on row 5; 2025 on row 6. Detected per-file before parsing."],
  ["Column names", "Unified across all 8 files via a single COLUMN_MAP. Diacritics preserved (YH-poäng, Utbildningsområde, Sökta omgångar)."],
  ["Landsting → Region", "2018 file uses old administrative term. Corrected in harmonization so huvudmannatyp is consistent 2018–2025."],
  ["SUN5 / SeQF", "Columns introduced in 2023. Kept as null for 2018-2022, not imputed or dropped."],
  ["typ_av_examen", "Missing in 2018 and 2020, expected. Documented in the schema."],
  ["yh_poang", "Coerced to int via pd.to_numeric(errors='coerce'). Non-numeric or empty → null."],
  ["is_distance", "Derived: True when studieform contains 'Distans'. Added as a boolean column for easier filtering."],
];

const SCHEMA: Array<[string, string, string]> = [
  ["id", "int", "Surrogate primary key (SERIAL)"],
  ["source_year", "int", "MYH application round year"],
  ["source_file", "text", "Original .xlsx filename"],
  ["source_sheet", "text", "Sheet within the workbook"],
  ["diarienummer", "text", "MYH case number (not unique pre-2019)"],
  ["utbildningsnamn", "text", "Program name"],
  ["utbildningsomrade", "text?", "Education area"],
  ["beslut", "text?", "Raw Swedish decision value"],
  ["beslut_normalized", "text?", "approved / rejected / withdrawn"],
  ["lan", "text?", "County (län)"],
  ["kommun", "text?", "Municipality"],
  ["yh_poang", "int?", "YH credits"],
  ["studieform", "text?", "Form of study"],
  ["studietakt_procent", "int?", "Pace of study (%)"],
  ["typ_av_examen", "text?", "Exam type, null for 2018 and 2020"],
  ["utbildningsanordnare", "text?", "Education provider"],
  ["huvudmannatyp", "text?", "Provider type (Privat/Kommun/Region/Statlig)"],
  ["flera_kommuner", "text?", "Multi-municipality raw value, null for 2018"],
  ["antal_kommuner", "int?", "Municipality count, null for 2018"],
  ["sokta_omgangar", "int?", "Rounds applied for, null for 2018-2019"],
  ["beviljade_omgangar", "int?", "Rounds granted, null for 2018-2019"],
  ["sun5_inriktning", "text?", "SUN5 subject code, 2023+ only"],
  ["sun5_inriktning_namn", "text?", "SUN5 subject name, 2023+ only"],
  ["seqf_niva", "text?", "SeQF qualification level, 2023+ only"],
  ["smalt_yrkesomrade", "text?", "Narrow occupational area, 2023+ only"],
  ["is_distance", "bool?", "Derived: studieform contains 'Distans'"],
  ["has_multiple_municipalities", "bool?", "Derived: more than one kommun"],
];

function TechDetails() {
  return (
    <Section id="tech" eyebrow="08 / Implementation" title="Technical details">
      <div className="mb-10 rounded-xl border border-border bg-surface-1/60 p-6">
        <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider text-primary">
          Tools & stack
        </h3>
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-2/60">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Tool</th>
                <th className="px-4 py-2.5 font-semibold">Layer</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
              </tr>
            </thead>
            <tbody>
              {TOOLS.map(([tool, layer, role]) => (
                <tr key={tool} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs font-semibold text-foreground">{tool}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                      {layer}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-1/60 p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
            Harmonization decisions
          </h3>
          <ul className="mt-5 space-y-4">
            {HARMONIZATION.map(([k, v]) => (
              <li key={k} className="border-l-2 border-primary/40 pl-4">
                <div className="font-mono text-xs font-semibold text-primary">{k}</div>
                <div className="mt-1 text-sm text-muted-foreground">{v}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface-1/60">
          <div className="border-b border-border p-6 pb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary">
              applications schema
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              27 columns (26 data + id). <span className="font-mono">?</span> = nullable.
            </p>
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-surface-2/90 backdrop-blur">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Column</th>
                  <th className="px-5 py-3 font-semibold">Type</th>
                  <th className="px-5 py-3 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {SCHEMA.map(([c, t, n]) => (
                  <tr key={c} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-2.5 font-mono text-xs text-foreground">{c}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-primary">{t}</td>
                    <td className="px-5 py-2.5 text-xs text-muted-foreground">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ── Predictor ──────────────────────────────────────────────────────────────────

const LAN_OPTIONS = [
  "Blekinge","Dalarna","Gotland","Gävleborg","Halland","Jämtland",
  "Jönköping","Kalmar","Kronoberg","Norrbotten","Skåne","Stockholm",
  "Södermanland","Uppsala","Värmland","Västerbotten","Västernorrland",
  "Västmanland","Västra Götaland","Örebro","Östergötland",
];

const AREA_OPTIONS = [
  "Data/IT","Ekonomi, administration och försäljning","Friskvård och kroppsvård",
  "Hotell, restaurang och turism","Hälso- och sjukvård samt socialt arbete",
  "Journalistik och information","Juridik","Kultur, media och design",
  "Lantbruk, djurvård, trädgård, skog och fiske","Miljövård och miljöskydd",
  "Pedagogik och undervisning","Samhällsbyggnad och byggteknik","Säkerhetstjänster",
  "Teknik och tillverkning","Transporttjänster","Övrigt",
];

const DEFAULT_PREDICT_FORM: PredictRequest = {
  lan: "Stockholm",
  utbildningsomrade: "Teknik och tillverkning",
  studieform: "Bunden",
  huvudmannatyp: "Privat",
  source_year: 2025,
  yh_poang: 200,
  studietakt_procent: 100,
  is_distance: false,
  has_multiple_municipalities: false,
};

function Predictor() {
  const [form, setForm] = useState<PredictRequest>(DEFAULT_PREDICT_FORM);

  const { mutate, data, isPending, isError, error, reset } = useMutation({
    mutationFn: () => api.predict(form),
  });

  function updateForm(updates: Partial<PredictRequest>) {
    setForm((prev) => ({ ...prev, ...updates }));
    reset();
  }

  const pct = data ? Math.round(data.approval_probability * 100) : null;
  const barColor =
    pct === null ? "bg-primary"
    : pct >= 45 ? "bg-emerald-500"
    : pct >= 30 ? "bg-amber-500"
    : "bg-red-500";
  const verdictColor =
    pct === null ? "text-foreground"
    : pct >= 45 ? "text-emerald-500"
    : pct >= 30 ? "text-amber-500"
    : "text-red-500";
  const verdict =
    pct === null ? null
    : pct >= 45 ? "Above historical average"
    : pct >= 30 ? "Around historical average"
    : "Below historical average";

  return (
    <Section id="predict" eyebrow="09 / ML Model" title="Approval Predictor">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-primary">
          <BrainCircuit className="h-3 w-3" />
          Random Forest · 9 983 training records
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">
          Fill in the details of a YH application. The model estimates the probability
          it would be approved based on 8 years of MYH decisions (2018–2025).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Application details</CardTitle>
            <CardDescription className="text-xs">
              Values must match the training data exactly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Län (county)</Label>
                <Select value={form.lan} onValueChange={(v) => updateForm({ lan: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LAN_OPTIONS.map((lan) => (
                      <SelectItem key={lan} value={lan} className="text-sm">{lan}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Utbildningsområde</Label>
                <Select value={form.utbildningsomrade} onValueChange={(v) => updateForm({ utbildningsomrade: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AREA_OPTIONS.map((area) => (
                      <SelectItem key={area} value={area} className="text-sm">{area}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Studieform</Label>
                <Select
                  value={form.studieform}
                  onValueChange={(v) => updateForm({ studieform: v, is_distance: v === "Distans" })}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bunden" className="text-sm">Bunden</SelectItem>
                    <SelectItem value="Distans" className="text-sm">Distans</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Huvudmannatyp</Label>
                <Select value={form.huvudmannatyp} onValueChange={(v) => updateForm({ huvudmannatyp: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Privat" className="text-sm">Privat</SelectItem>
                    <SelectItem value="Kommun" className="text-sm">Kommun</SelectItem>
                    <SelectItem value="Region" className="text-sm">Region</SelectItem>
                    <SelectItem value="Statlig" className="text-sm">Statlig</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Application year</Label>
                <Input
                  type="number" min={2018} max={2030}
                  value={form.source_year}
                  onChange={(e) => updateForm({ source_year: Number(e.target.value) })}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">YH-poäng (program size)</Label>
                <Input
                  type="number" min={50} max={2000} step={50}
                  value={form.yh_poang}
                  onChange={(e) => updateForm({ yh_poang: Number(e.target.value) })}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Studietakt (%)</Label>
                <Input
                  type="number" min={25} max={100} step={25}
                  value={form.studietakt_procent}
                  onChange={(e) => updateForm({ studietakt_procent: Number(e.target.value) })}
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <Label className="cursor-pointer text-xs">Multiple municipalities</Label>
                <Switch
                  checked={form.has_multiple_municipalities}
                  onCheckedChange={(v) => updateForm({ has_multiple_municipalities: v })}
                />
              </div>
            </div>

            <Button onClick={() => mutate()} disabled={isPending} className="mt-6 w-full">
              {isPending ? "Predicting…" : "Predict approval probability"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className={`border transition-colors ${data ? "border-primary/40" : "border-border"}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Result</CardTitle>
            </CardHeader>
            <CardContent>
              {!data && !isPending && !isError && (
                <p className="text-sm text-muted-foreground">Fill in the details and click Predict.</p>
              )}
              {isPending && (
                <div className="animate-pulse space-y-3">
                  <div className="h-14 rounded-md bg-muted" />
                  <div className="h-2.5 rounded-full bg-muted" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
              )}
              {isError && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error instanceof Error ? error.message : "Prediction failed."}</span>
                </div>
              )}
              {data && pct !== null && (
                <div className="space-y-4">
                  <div>
                    <div className={`text-5xl font-bold tabular-nums ${verdictColor}`}>{pct}%</div>
                    <p className="mt-1 text-xs text-muted-foreground">{verdict}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                      <span>0 %</span><span>50 %</span><span>100 %</span>
                    </div>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium">Rejection:</span>{" "}
                    {Math.round(data.rejection_probability * 100)} %
                    &nbsp;·&nbsp;
                    <span className="font-medium">Model:</span> {data.model_name}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardContent className="pt-4">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">How it works:</span>{" "}
                A Random Forest model trained on 9,983 MYH applications (2018–2025) predicts based
                on region, education area, study form, operator type, program size, and year.
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Limitation:</span>{" "}
                The model reflects historical patterns only. MYH's actual decisions also weigh
                program quality, employer demand, and regional need, none of which are in the
                dataset. Historical average approval rate: ~36%.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Section>
  );
}

// ── Pipeline Status ────────────────────────────────────────────────────────────

function PipelineStatus() {
  const { data, isLoading, isError } = useQuery<PipelineStatusCheck[]>({
    queryKey: ["pipeline-status"],
    queryFn: api.pipelineStatus,
    staleTime: 60_000,
  });

  const allOk = data?.every((row) => row.status === "ok");

  return (
    <Section id="pipeline-report" eyebrow="10 / Verification" title="Data quality report">
      <p className="mb-8 max-w-2xl text-sm text-muted-foreground">
        Live checks against the{" "}
        <span className="font-mono text-primary">applications</span> table,
        checking row count, year coverage, null constraints, and value integrity.
        Run against the production database on every page load. The four notebooks
        also include their own end logs or output summaries for the recorded walkthrough.
      </p>

      {allOk && data && (
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5" />
          All {data.length} checks passed
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface-1/60">
        {isLoading && (
          <div className="animate-pulse space-y-3 p-6">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="h-10 rounded-md bg-muted" />
            ))}
          </div>
        )}
        {isError && (
          <div className="flex items-start gap-2 p-6 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Could not reach the API. Checks will appear once the service is online.
            </span>
          </div>
        )}
        {data && (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-2/60">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-semibold">Check</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.check} className="border-b border-border/60 last:border-0 hover:bg-surface-2/40">
                  <td className="px-5 py-3 font-mono text-xs text-foreground">{row.check}</td>
                  <td className="px-5 py-3">
                    {row.status === "ok" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-500">
                        <CheckCircle2 className="h-3 w-3" /> ok
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-red-500">
                        <XCircle className="h-3 w-3" /> error
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-5 py-10 sm:flex-row sm:items-center sm:px-8">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold text-foreground">Christofer Lindholm</div>
          <div className="font-mono text-xs text-muted-foreground">
            MYH Data Pipeline · Data Engineering · {new Date().getFullYear()}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <a
            href={`${API_BASE}/docs`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="h-3 w-3" /> Swagger UI
          </a>
          <a
            href="https://github.com/GHT4ngo/myh-data-pipeline"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-primary"
          >
            <Github className="h-3 w-3" /> Source
          </a>
        </div>
      </div>
    </footer>
  );
}
