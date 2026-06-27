export const API_BASE = "https://de25-hemtenta-christofer.onrender.com";

export interface ApplicationRow {
  id: number;
  source_year: number;
  source_file: string;
  source_sheet: string;
  diarienummer: string;
  utbildningsnamn: string;
  utbildningsomrade: string | null;
  beslut: string | null;
  beslut_normalized: string | null;
  lan: string | null;
  kommun: string | null;
  yh_poang: number | null;
  studieform: string | null;
  studietakt_procent: number | null;
  typ_av_examen: string | null;
  utbildningsanordnare: string | null;
  huvudmannatyp: string | null;
  flera_kommuner: string | null;
  antal_kommuner: number | null;
  sokta_omgangar: number | null;
  beviljade_omgangar: number | null;
  sun5_inriktning: string | null;
  sun5_inriktning_namn: string | null;
  seqf_niva: string | null;
  smalt_yrkesomrade: string | null;
  is_distance: boolean | null;
  has_multiple_municipalities: boolean | null;
}

export interface YearStats {
  source_year: number;
  total_rows: number;
  approved: number;
  rejected: number;
  withdrawn: number;
  approval_rate_pct: number;
}

export interface RegionStats {
  lan: string;
  total_rows: number;
  approved: number;
  rejected: number;
  approval_rate_pct: number;
}

export interface AreaStats {
  utbildningsomrade: string;
  total_rows: number;
  approved: number;
  rejected: number;
  approval_rate_pct: number;
}

export interface StudyFormStats {
  studieform: string;
  total_rows: number;
  approved: number;
  rejected: number;
  approval_rate_pct: number;
}

export interface ProviderStats {
  utbildningsanordnare: string;
  total_rows: number;
  approved: number;
  rejected: number;
  approval_rate_pct: number;
}

export interface MultiMunicipalityStats {
  total_rows: number;
  has_multiple_municipalities: number;
  county_marker_rows: number;
}

export interface ExplorerFilters {
  year?: string | number;
  decision?: string;
  region?: string;
  municipality?: string;
  provider?: string;
  education_area?: string;
  search?: string;
}

export interface MunicipalityEnrichmentRow {
  municipality: string;
  county: string | null;
  total_applications: number;
  approved_applications: number;
  rejected_applications: number;
  approval_rate_percent: number;
  scb_year?: number | null;
  scb_municipality_code?: string | null;
  population?: number | null;
  employment_rate_percent?: number | null;
  unemployment_rate_percent?: number | null;
  applications_per_100k_residents?: number | null;
  approved_per_100k_residents?: number | null;
}

export interface PredictRequest {
  lan: string;
  utbildningsomrade: string;
  studieform: string;
  huvudmannatyp: string;
  source_year: number;
  yh_poang: number;
  studietakt_procent: number;
  is_distance: boolean;
  has_multiple_municipalities: boolean;
}

export interface PredictResponse {
  approval_probability: number;
  rejection_probability: number;
  model_name: string;
}

export interface PipelineStatusCheck {
  check: string;
  status: "ok" | "error";
  detail: string;
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const detail = text ? `: ${text.slice(0, 120)}` : "";
    throw new Error(`API ${res.status} on ${path}${detail}`);
  }

  return res.json() as Promise<T>;
}

async function requestOrFallback<T>(path: string, fallback: () => Promise<T>) {
  try {
    return await request<T>(path);
  } catch (error) {
    if (error instanceof Error && error.message.includes("API 404")) {
      return fallback();
    }
    throw error;
  }
}

function paramsToQuery(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  });
  return qs.toString();
}

async function fetchAllApplications() {
  const pageSize = 1000;
  const rows: ApplicationRow[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const page = await request<ApplicationRow[]>(
      `/applications?limit=${pageSize}&offset=${offset}`,
    );
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

function isApproved(row: ApplicationRow) {
  return row.beslut_normalized === "approved";
}

function isRejected(row: ApplicationRow) {
  return row.beslut_normalized === "rejected";
}

function approvalRate(total: number, approved: number) {
  return total > 0 ? Number(((approved / total) * 100).toFixed(1)) : 0;
}

function summarizeBy<T extends string>(
  rows: ApplicationRow[],
  getKey: (row: ApplicationRow) => T | null | undefined,
) {
  const groups = new Map<T, { total_rows: number; approved: number; rejected: number }>();

  rows.forEach((row) => {
    const key = getKey(row);
    if (!key) return;
    const current = groups.get(key) ?? { total_rows: 0, approved: 0, rejected: 0 };
    current.total_rows += 1;
    if (isApproved(row)) current.approved += 1;
    if (isRejected(row)) current.rejected += 1;
    groups.set(key, current);
  });

  return [...groups.entries()]
    .map(([key, value]) => ({
      key,
      ...value,
      approval_rate_pct: approvalRate(value.total_rows, value.approved),
    }))
    .sort((a, b) => b.total_rows - a.total_rows);
}

async function fallbackStudyForm(): Promise<StudyFormStats[]> {
  const rows = await fetchAllApplications();
  return summarizeBy(rows, (row) => row.studieform).map(({ key, ...stats }) => ({
    studieform: key,
    ...stats,
  }));
}

async function fallbackProvider(limit: number): Promise<ProviderStats[]> {
  const rows = await fetchAllApplications();
  return summarizeBy(rows, (row) => row.utbildningsanordnare)
    .slice(0, limit)
    .map(({ key, ...stats }) => ({
      utbildningsanordnare: key,
      ...stats,
    }));
}

async function fallbackMultiMunicipality(): Promise<MultiMunicipalityStats> {
  const rows = await fetchAllApplications();
  return {
    total_rows: rows.length,
    has_multiple_municipalities: rows.filter(
      (row) => row.has_multiple_municipalities,
    ).length,
    county_marker_rows: rows.filter((row) => row.lan === "Flera kommuner").length,
  };
}

export const api = {
  byYear: () => request<YearStats[]>("/stats/by-year"),
  byRegion: async () => {
    const rows = await request<RegionStats[]>("/stats/by-region");
    return rows.filter((row) => row.lan !== "Flera kommuner");
  },
  byArea: () => request<AreaStats[]>("/stats/by-education-area"),
  byStudyForm: () =>
    requestOrFallback<StudyFormStats[]>(
      "/stats/by-study-form",
      fallbackStudyForm,
    ),
  byProvider: (limit = 10) =>
    requestOrFallback<ProviderStats[]>(`/stats/by-provider?limit=${limit}`, () =>
      fallbackProvider(limit),
    ),
  multiMunicipality: () =>
    requestOrFallback<MultiMunicipalityStats>(
      "/stats/multi-municipality",
      fallbackMultiMunicipality,
    ),
  municipalityEnrichment: (params: ExplorerFilters & { limit?: number }) => {
    const queryParams = {
      year: params.year,
      decision: params.decision,
      region: params.region,
      municipality: params.municipality,
      provider: params.provider,
      education_area: params.education_area,
      search: params.search,
      limit: params.limit,
    };

    return request<MunicipalityEnrichmentRow[]>(
      `/stats/municipality-enrichment?${paramsToQuery(queryParams)}`,
    );
  },
  applications: (params: Record<string, string | number | undefined>) =>
    request<ApplicationRow[]>(`/applications?${paramsToQuery(params)}`),
  exportApplicationsUrl: (
    params: Record<string, string | number | undefined>,
  ) => `${API_BASE}/export/applications?${paramsToQuery(params)}`,
  pipelineStatus: () => request<PipelineStatusCheck[]>("/pipeline/status"),
  predict: (body: PredictRequest): Promise<PredictResponse> =>
    fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    }).then((res) => {
      if (!res.ok) throw new Error(`API ${res.status} on /predict`);
      return res.json() as Promise<PredictResponse>;
    }),
};
