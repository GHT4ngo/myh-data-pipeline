import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DatabaseZap, Info, Map as MapIcon } from "lucide-react";
import { api, type MunicipalityEnrichmentRow } from "@/lib/api";
import { ChartSkeleton, ErrorState } from "@/components/data-states";

const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

const tooltipStyle = {
  backgroundColor: "hsl(var(--surface-1))",
  background: "var(--surface-1)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 12,
} as const;

const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: { stroke: "var(--border)" },
} as const;

type MapMetric =
  | "applications_per_100k_residents"
  | "approval_rate_percent"
  | "unemployment_rate_percent"
  | "employment_rate_percent";

interface YearSummary {
  year: number;
  total_applications: number;
  approved_applications: number;
  population: number;
  applications_per_100k_residents: number | null;
  approval_rate_percent: number | null;
  unemployment_rate_percent: number | null;
  employment_rate_percent: number | null;
}

const METRIC_LABELS: Record<MapMetric, string> = {
  applications_per_100k_residents: "Applications per 100k",
  approval_rate_percent: "Approval rate",
  unemployment_rate_percent: "Unemployment rate",
  employment_rate_percent: "Employment rate",
};

// SVG map: viewBox "0 0 200 380", coordinates use this projection.
const MAP_W = 200;
const MAP_H = 380;
const MAP_LON_MIN = 10.5;
const MAP_LAT_MAX = 69.1;
const MAP_LON_RANGE = 13.7; // 10.5°E – 24.2°E
const MAP_LAT_RANGE = 13.8; // 55.3°N – 69.1°N

function countyToXY(lat: number, lon: number): [number, number] {
  return [
    ((lon - MAP_LON_MIN) / MAP_LON_RANGE) * MAP_W,
    ((MAP_LAT_MAX - lat) / MAP_LAT_RANGE) * MAP_H,
  ];
}

// Geographic centroids [lat, lon] for each county.
// Keys match normalizeCounty() output (diacritics stripped, " lan" removed).
const COUNTY_LAT_LON: Record<string, [number, number]> = {
  Norrbotten:        [67.5, 20.5],
  Vasterbotten:      [65.0, 18.0],
  Jamtland:          [63.5, 14.5],
  Vasternorrland:    [63.0, 17.5],
  Gavleborg:         [61.5, 16.5],
  Dalarna:           [61.0, 14.5],
  Varmland:          [60.0, 13.5],
  Orebro:            [59.5, 15.0],
  Vastmanland:       [59.7, 16.3],
  Uppsala:           [60.0, 17.5],
  Stockholm:         [59.4, 18.0],
  Sodermanland:      [59.0, 17.0],
  Gotland:           [57.5, 18.5],
  "Vastra Gotaland": [58.2, 13.2],
  Jonkoping:         [57.7, 14.5],
  Ostergotland:      [58.4, 15.7],
  Halland:           [56.8, 13.0],
  Kronoberg:         [56.8, 14.8],
  Kalmar:            [57.0, 16.0],
  Blekinge:          [56.2, 15.2],
  Skane:             [55.8, 13.5],
};

// Simplified mainland outline of Sweden (clockwise from north tip).
// Precomputed with countyToXY(); viewBox "0 0 200 380".
const SWEDEN_OUTLINE =
  "M 112,1" +
  // Norwegian border south-west
  " L 102,30 L 73,58 L 51,99 L 44,140 L 29,168 L 22,209" +
  " L 26,237 L 19,264 L 9,281 L 12,292" +
  // West coast
  " L 19,306 L 20,319 L 29,341 L 32,361 L 34,369" +
  // South coast (Skåne)
  " L 44,377 L 56,375 L 63,369" +
  // East coast going north
  " L 75,355 L 86,341 L 92,325 L 92,292" +
  " L 115,267 L 117,251 L 102,231 L 99,209" +
  " L 105,182 L 117,168 L 152,140 L 161,113 L 172,91 L 183,85 L 193,88" +
  // Finnish border (Torne River) going north
  " L 197,72 L 190,58 L 175,44 L 153,30 L 131,17 L 112,3 Z";

export function ExternalEnrichment() {
  const [year, setYear] = useState<string>("all");
  const [mapMetric, setMapMetric] = useState<MapMetric>(
    "applications_per_100k_residents",
  );

  const selectedYear = year === "all" ? undefined : Number(year);

  const q = useQuery({
    queryKey: ["municipality-enrichment", selectedYear],
    queryFn: () =>
      api.municipalityEnrichment({
        year: selectedYear,
        limit: 80,
      }),
    retry: 2,
  });

  const trendQ = useQuery({
    queryKey: ["municipality-enrichment-trend"],
    queryFn: async () => {
      const yearlyRows = await Promise.all(
        YEARS.map(async (item) => ({
          year: item,
          rows: await api.municipalityEnrichment({ year: item, limit: 100 }),
        })),
      );
      return yearlyRows.map(({ year: item, rows }) =>
        summarizeYear(item, rows),
      );
    },
    retry: 2,
  });

  const myhYearLabel = year === "all" ? "2018–2025" : String(year);
  const scbYearLabel = q.data?.find((row) => row.scb_year)?.scb_year;
  const scbYearText = scbYearLabel !== undefined ? String(scbYearLabel) : "—";
  const hasScbData = q.data?.some((row) => row.population);

  return (
    <div className="rounded-xl border border-border bg-surface-1/60">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md border border-primary/35 bg-primary/10 text-primary">
            <DatabaseZap className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              External enrichment: Statistics Sweden municipality context
            </h3>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
              MYH application activity joined with SCB population and BAS labour-market
              statistics. The charts use municipality/kommun, not informal city labels.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="h-9 rounded-md border border-border bg-surface-2 px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring"
          >
            <option value="all" className="bg-surface-1">
              All years
            </option>
            {YEARS.map((item) => (
              <option key={item} value={item} className="bg-surface-1">
                {item}
              </option>
            ))}
          </select>
          <div
            className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px]"
            title="MYH application year shown in the charts below."
          >
            <span className="font-semibold uppercase tracking-wider text-primary">
              MYH
            </span>
            <span className="font-mono text-foreground">{myhYearLabel}</span>
          </div>
          <div
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2.5 py-1 text-[11px]"
            title="Year of the SCB population and BAS labour-market snapshot used to enrich the MYH data. SCB publishes with roughly a 1-year lag, so the most recent available year is used when the MYH year is newer."
          >
            <span className="font-semibold uppercase tracking-wider text-muted-foreground">
              SCB
            </span>
            <span className="font-mono text-foreground">{scbYearText}</span>
          </div>
        </div>
      </div>

      <div className="space-y-6 border-t border-border px-5 pb-5 pt-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <TimeWindowCard
            myhYear={myhYearLabel}
            scbYear={scbYearText}
            isAllYears={year === "all"}
          />
          <GuideCard
            title="Normalization"
            value="per 100k residents"
            text="Raw totals favor large municipalities. Per-capita values make smaller municipalities comparable."
          />
          <GuideCard
            title="Interpretation"
            value="context, not cause"
            text="Employment and unemployment describe the local labour market. They do not prove why MYH approved an application."
          />
        </div>

        {!hasScbData && q.data && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/35 bg-warning/10 p-4 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              The API returned MYH municipality summaries but no SCB values. Re-run{" "}
              <span className="font-mono text-foreground">
                external_enrichment/scb_enrichment.ipynb
              </span>{" "}
              and redeploy with the generated CSV.
            </span>
          </div>
        )}

        {q.isLoading && <ChartSkeleton height={440} />}
        {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {q.data && (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel
                title="Municipality demand index"
                subtitle={`Applications per 100k residents · MYH ${myhYearLabel} · SCB population ${scbYearText}. Municipalities (kommuner), not cities — Solna, Sundbyberg etc. are independent municipalities adjacent to Stockholm.`}
              >
                <DemandIndex data={q.data} />
              </Panel>

              <Panel
                title="Approval rate with labour-market context"
                subtitle={`Bars: approval rate. Line: unemployment rate. Both on the same 0–100% scale. · MYH ${myhYearLabel} · SCB labour ${scbYearText}`}
              >
                <ApprovalLabourComparison data={q.data} />
              </Panel>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_auto]">
              <Panel
                title="Trend over time"
                subtitle="Yearly application intensity (left axis) and approval rate (right axis) · MYH 2018–2025 · each year uses the SCB snapshot for that year (population available 2018–2024; labour-market data starts 2020)"
              >
                {trendQ.isLoading && <ChartSkeleton height={340} />}
                {trendQ.isError && (
                  <ErrorState error={trendQ.error} onRetry={() => trendQ.refetch()} />
                )}
                {trendQ.data && <YearTrend data={trendQ.data} />}
              </Panel>

              <Panel
                title="Sweden context map"
                subtitle={`Colored by selected metric · MYH ${myhYearLabel} · SCB ${scbYearText}`}
              >
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <MapIcon className="h-3.5 w-3.5 text-primary" />
                    SCB county context
                  </div>
                  <select
                    value={mapMetric}
                    onChange={(event) => setMapMetric(event.target.value as MapMetric)}
                    className="h-9 rounded-md border border-border bg-surface-2 px-3 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring"
                  >
                    {Object.entries(METRIC_LABELS).map(([value, label]) => (
                      <option key={value} value={value} className="bg-surface-1">
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <SwedenMap data={q.data} metric={mapMetric} />
              </Panel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GuideCard({
  title,
  value,
  text,
}: {
  title: string;
  value: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/45 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-primary">
        {title}
      </div>
      <div className="mt-2 font-mono text-sm text-foreground">{value}</div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function TimeWindowCard({
  myhYear,
  scbYear,
  isAllYears,
}: {
  myhYear: string;
  scbYear: string;
  isAllYears: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/45 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-primary">
        Time window
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-sm">
        <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-primary">
          MYH {myhYear}
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="rounded border border-border bg-surface-1 px-1.5 py-0.5 text-foreground">
          SCB {scbYear}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {isAllYears
          ? "All MYH years 2018–2025 are aggregated. Each municipality is joined with its most recent SCB snapshot (population stops at 2024, labour-market data at 2024)."
          : "Charts show MYH applications for this year, enriched with SCB population and labour-market figures from the same year (or the latest available year before it)."}
      </p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/35 p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function DemandIndex({ data }: { data: MunicipalityEnrichmentRow[] }) {
  const chartData = data
    .filter(
      (row) =>
        row.applications_per_100k_residents != null &&
        row.total_applications >= 10,
    )
    .sort(
      (a, b) =>
        (b.applications_per_100k_residents ?? 0) -
        (a.applications_per_100k_residents ?? 0),
    )
    .slice(0, 12)
    .reverse();

  if (!chartData.length) return <EmptyChartMessage />;

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 54, left: 28, bottom: 0 }}
      >
        <defs>
          <linearGradient id="demandBar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="var(--success)" stopOpacity={1} />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke="var(--border)"
          strokeDasharray="2 4"
          horizontal={false}
        />
        <XAxis type="number" {...axisProps} />
        <YAxis
          type="category"
          dataKey="municipality"
          width={120}
          {...axisProps}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--surface-2)", opacity: 0.4 }}
          formatter={(value, name) => [
            name === "Applications"
              ? formatNumber(Number(value))
              : formatNumber(Number(value)),
            name,
          ]}
        />
        <Bar
          dataKey="applications_per_100k_residents"
          name="Applications per 100k"
          fill="url(#demandBar)"
          radius={[0, 4, 4, 0]}
        >
          <LabelList
            dataKey="applications_per_100k_residents"
            position="right"
            formatter={(value: number) => formatNumber(value)}
            fontSize={10}
            fill="var(--muted-foreground)"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ApprovalLabourComparison({
  data,
}: {
  data: MunicipalityEnrichmentRow[];
}) {
  const chartData = data
    .filter((row) => row.unemployment_rate_percent != null)
    .sort((a, b) => b.total_applications - a.total_applications)
    .slice(0, 12);

  if (!chartData.length) return <EmptyChartMessage />;

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 80 }}>
        <defs>
          <linearGradient id="approvalBars" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--success)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="municipality"
          interval={0}
          angle={-32}
          textAnchor="end"
          height={90}
          {...axisProps}
        />
        <YAxis
          unit="%"
          domain={[0, 100]}
          ticks={[0, 20, 40, 60, 80, 100]}
          {...axisProps}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => [`${formatNumber(Number(value))}%`, name]}
        />
        <Bar
          dataKey="approval_rate_percent"
          name="Approval rate"
          fill="url(#approvalBars)"
          radius={[4, 4, 0, 0]}
        />
        <Line
          type="monotone"
          dataKey="unemployment_rate_percent"
          name="Unemployment"
          stroke="var(--warning)"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "var(--warning)", strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function YearTrend({ data }: { data: YearSummary[] }) {
  return (
    <ResponsiveContainer width="100%" height={290}>
      <AreaChart data={data} margin={{ top: 8, right: 22, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="year"
          type="number"
          domain={[2018, 2025]}
          ticks={YEARS}
          allowDecimals={false}
          tickFormatter={(value: number) => String(value)}
          {...axisProps}
        />
        <YAxis yAxisId="left" {...axisProps} />
        <YAxis yAxisId="right" orientation="right" unit="%" {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="applications_per_100k_residents"
          name="Applications per 100k"
          stroke="var(--primary)"
          strokeWidth={2.5}
          fill="url(#trendArea)"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="approval_rate_percent"
          name="Approval rate"
          stroke="var(--success)"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "var(--success)", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SwedenMap({
  data,
  metric,
}: {
  data: MunicipalityEnrichmentRow[];
  metric: MapMetric;
}) {
  const countyRows = useMemo(() => summarizeByCounty(data, metric), [data, metric]);
  if (!countyRows.length) return <EmptyChartMessage />;

  const countyMap = new Map(countyRows.map((row) => [normalizeCounty(row.county), row]));
  const values = countyRows.map((row) => row.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  return (
    <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="w-full max-w-[320px]"
        aria-label="Sweden county map"
      >
        {/* Mainland outline */}
        <path
          d={SWEDEN_OUTLINE}
          fill="var(--surface-2)"
          stroke="var(--border)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Gotland island */}
        <ellipse
          cx={117} cy={319} rx={6} ry={18}
          fill="var(--surface-2)"
          stroke="var(--border)"
          strokeWidth="1.5"
        />
        {/* County dots — radius scales with metric value */}
        {Object.entries(COUNTY_LAT_LON).map(([key, [lat, lon]]) => {
          const [cx, cy] = countyToXY(lat, lon);
          const countyData = countyMap.get(key);
          const spread = maxValue - minValue || 1;
          const r = countyData
            ? 4 + 7 * ((countyData.value - minValue) / spread)
            : 4;
          const fill = countyData
            ? metricColor(countyData.value, minValue, maxValue)
            : "var(--muted-foreground)";
          return (
            <g key={key}>
              <circle
                cx={cx} cy={cy} r={r}
                fill={fill}
                stroke="var(--background)"
                strokeWidth="1.5"
              />
              <title>{countyData ? `${countyData.county}: ${formatMetric(countyData.value, metric)}` : key}</title>
            </g>
          );
        })}
      </svg>

      <div className="max-w-[200px] overflow-hidden rounded-lg border border-border bg-surface-1/60">
        <table className="w-full text-xs">
          <thead className="border-b border-border bg-surface-2/65 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-2 py-2 font-semibold">County</th>
              <th className="px-2 py-2 font-semibold text-right">{METRIC_LABELS[metric]}</th>
            </tr>
          </thead>
          <tbody>
            {countyRows.map((row) => (
              <tr key={row.county} className="border-b border-border/50 last:border-0">
                <td className="px-2 py-1.5 font-medium text-foreground">
                  {shortCountyName(row.county)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-primary">
                  {formatMetric(row.value, metric)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function summarizeYear(year: number, rows: MunicipalityEnrichmentRow[]): YearSummary {
  const totals = rows.reduce(
    (acc, row) => {
      const population = row.population ?? 0;
      acc.total_applications += row.total_applications;
      acc.approved_applications += row.approved_applications;
      acc.population += population;
      if (population && row.unemployment_rate_percent != null) {
        acc.unemploymentWeighted += row.unemployment_rate_percent * population;
        acc.labourPopulation += population;
      }
      if (population && row.employment_rate_percent != null) {
        acc.employmentWeighted += row.employment_rate_percent * population;
        acc.employmentPopulation += population;
      }
      return acc;
    },
    {
      total_applications: 0,
      approved_applications: 0,
      population: 0,
      unemploymentWeighted: 0,
      labourPopulation: 0,
      employmentWeighted: 0,
      employmentPopulation: 0,
    },
  );

  return {
    year,
    total_applications: totals.total_applications,
    approved_applications: totals.approved_applications,
    population: totals.population,
    applications_per_100k_residents: totals.population
      ? roundOne((totals.total_applications / totals.population) * 100_000)
      : null,
    approval_rate_percent: totals.total_applications
      ? roundOne((totals.approved_applications / totals.total_applications) * 100)
      : null,
    unemployment_rate_percent: totals.labourPopulation
      ? roundOne(totals.unemploymentWeighted / totals.labourPopulation)
      : null,
    employment_rate_percent: totals.employmentPopulation
      ? roundOne(totals.employmentWeighted / totals.employmentPopulation)
      : null,
  };
}

function summarizeByCounty(data: MunicipalityEnrichmentRow[], metric: MapMetric) {
  const groups = new Map<
    string,
    { total: number; cityCount: number; applications: number }
  >();

  data.forEach((row) => {
    const county = row.county ?? "Unknown";
    const rawValue = row[metric];
    if (rawValue === null || rawValue === undefined) return;

    const current = groups.get(county) ?? {
      total: 0,
      cityCount: 0,
      applications: 0,
    };
    current.total += Number(rawValue) * row.total_applications;
    current.applications += row.total_applications;
    current.cityCount += 1;
    groups.set(county, current);
  });

  return [...groups.entries()]
    .map(([county, value]) => ({
      county,
      cityCount: value.cityCount,
      value: value.applications ? value.total / value.applications : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function normalizeCounty(county: string) {
  return county
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(" län", "")
    .replace(" lan", "");
}

function shortCountyName(county: string) {
  return county
    .replace(" län", "")
    .replace("Västra Götaland", "V. Götaland")
    .replace("Västernorrland", "V-norrland")
    .replace("Södermanland", "Sörmland");
}

function metricColor(value: number, minValue: number, maxValue: number) {
  const spread = maxValue - minValue || 1;
  const ratio = (value - minValue) / spread;
  const hue = 210 - ratio * 85;
  const lightness = 46 + ratio * 18;
  return `oklch(${lightness / 100} 0.18 ${hue})`;
}

function EmptyChartMessage() {
  return (
    <div className="grid min-h-[220px] place-items-center rounded-lg border border-dashed border-border bg-surface-1/45 p-6 text-center text-xs leading-relaxed text-muted-foreground">
      SCB enrichment data is missing for this view.
    </div>
  );
}

function roundOne(value: number) {
  return Number(value.toFixed(1));
}

function formatNumber(value: number) {
  return value.toLocaleString("sv-SE", { maximumFractionDigits: 1 });
}

function formatMetric(value: number, metric: MapMetric) {
  if (
    metric === "approval_rate_percent" ||
    metric === "unemployment_rate_percent" ||
    metric === "employment_rate_percent"
  ) {
    return `${formatNumber(value)}%`;
  }
  return formatNumber(value);
}
