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
import {
  api,
  type AreaStats,
  type ProviderStats,
  type RegionStats,
  type StudyFormStats,
  type YearStats,
} from "@/lib/api";
import { ChartSkeleton, ErrorState } from "@/components/data-states";

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

const retry = {
  retry: 4,
  retryDelay: (attempt: number) => Math.min(5000 * attempt, 20000),
};

function formatNumber(value: number) {
  return value.toLocaleString("sv-SE");
}

function formatPercent(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(1)}%` : "-";
}

function Panel({
  title,
  subtitle,
  children,
  span = 1,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  span?: 1 | 2;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface-1/60 p-5 ${
        span === 2 ? "lg:col-span-2" : ""
      }`}
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  tone = "blue",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "blue" | "green" | "red" | "amber";
}) {
  const tones = {
    blue: "from-primary/30 to-cyan-400/10 text-primary",
    green: "from-success/25 to-emerald-300/10 text-success",
    red: "from-destructive/25 to-rose-300/10 text-destructive",
    amber: "from-warning/25 to-yellow-300/10 text-warning",
  };

  return (
    <div className="rounded-xl border border-border bg-surface-1/60 p-5">
      <div className={`rounded-lg bg-gradient-to-br ${tones[tone]} p-4`}>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-2 font-mono text-3xl font-semibold tabular-nums text-foreground">
          {value}
        </div>
        {detail && <div className="mt-2 text-xs text-muted-foreground">{detail}</div>}
      </div>
    </div>
  );
}

export function StatsDashboard() {
  const yearQ = useQuery({ queryKey: ["by-year"], queryFn: api.byYear, ...retry });
  const regionQ = useQuery({ queryKey: ["by-region"], queryFn: api.byRegion, ...retry });
  const areaQ = useQuery({ queryKey: ["by-area"], queryFn: api.byArea, ...retry });
  const studyQ = useQuery({ queryKey: ["by-study-form"], queryFn: api.byStudyForm, ...retry });
  const providerQ = useQuery({ queryKey: ["by-provider"], queryFn: () => api.byProvider(10), ...retry });

  const totals = yearQ.data
    ? yearQ.data.reduce(
        (acc, year) => {
          acc.total += year.total_rows;
          acc.approved += year.approved;
          acc.rejected += year.rejected;
          acc.withdrawn += year.withdrawn;
          return acc;
        },
        { total: 0, approved: 0, rejected: 0, withdrawn: 0 },
      )
    : null;

  const highestVolume = [...(yearQ.data ?? [])].sort(
    (a, b) => b.total_rows - a.total_rows,
  )[0];
  const lowestApproval = [...(yearQ.data ?? [])].sort(
    (a, b) => a.approval_rate_pct - b.approval_rate_pct,
  )[0];
  const overallApproval = totals ? (totals.approved / totals.total) * 100 : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total applications"
          value={totals ? formatNumber(totals.total) : "-"}
          detail="Curated rows in PostgreSQL"
        />
        <StatCard
          label="Overall approval"
          value={overallApproval !== null ? `${overallApproval.toFixed(1)}%` : "-"}
          detail={totals ? `${formatNumber(totals.approved)} approved` : undefined}
          tone="green"
        />
        <StatCard
          label="Highest volume"
          value={highestVolume ? String(highestVolume.source_year) : "-"}
          detail={highestVolume ? `${formatNumber(highestVolume.total_rows)} applications` : undefined}
          tone="blue"
        />
        <StatCard
          label="Lowest approval"
          value={lowestApproval ? String(lowestApproval.source_year) : "-"}
          detail={lowestApproval ? `${lowestApproval.approval_rate_pct.toFixed(1)}% approved` : undefined}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel
          title="Applications over time"
          subtitle="Volume trend with highlighted peak and latest year"
        >
          {yearQ.isLoading && <ChartSkeleton />}
          {yearQ.isError && <ErrorState error={yearQ.error} onRetry={() => yearQ.refetch()} />}
          {yearQ.data && <YearArea data={yearQ.data} />}
        </Panel>

        <Panel title="Approval rate trend" subtitle="Approved applications divided by total">
          {yearQ.isLoading && <ChartSkeleton />}
          {yearQ.isError && <ErrorState error={yearQ.error} onRetry={() => yearQ.refetch()} />}
          {yearQ.data && <ApprovalArea data={yearQ.data} />}
        </Panel>

        <Panel title="Decision comparison" subtitle="Approved, rejected, and withdrawn by year" span={2}>
          {yearQ.isLoading && <ChartSkeleton height={320} />}
          {yearQ.isError && <ErrorState error={yearQ.error} onRetry={() => yearQ.refetch()} />}
          {yearQ.data && <DecisionBars data={yearQ.data} />}
        </Panel>

        <Panel title="County comparison" subtitle="Top counties by application volume">
          {regionQ.isLoading && <ChartSkeleton height={360} />}
          {regionQ.isError && <ErrorState error={regionQ.error} onRetry={() => regionQ.refetch()} />}
          {regionQ.data && <RegionsBar data={regionQ.data} />}
        </Panel>

        <Panel title="Education areas" subtitle="Volume and approval rate by subject area">
          {areaQ.isLoading && <ChartSkeleton height={360} />}
          {areaQ.isError && <ErrorState error={areaQ.error} onRetry={() => areaQ.refetch()} />}
          {areaQ.data && <AreasBar data={areaQ.data} />}
        </Panel>

        <Panel title="Study form comparison" subtitle="On-site, distance, and other study forms">
          {studyQ.isLoading && <ChartSkeleton height={320} />}
          {studyQ.isError && <ErrorState error={studyQ.error} onRetry={() => studyQ.refetch()} />}
          {studyQ.data && <StudyFormBars data={studyQ.data} />}
        </Panel>

        <Panel title="Top providers" subtitle="Largest providers by application count">
          {providerQ.isLoading && <ChartSkeleton height={320} />}
          {providerQ.isError && <ErrorState error={providerQ.error} onRetry={() => providerQ.refetch()} />}
          {providerQ.data && <ProviderBars data={providerQ.data} />}
        </Panel>

      </div>
    </div>
  );
}

function YearArea({ data }: { data: YearStats[] }) {
  const sorted = [...data].sort((a, b) => a.source_year - b.source_year);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={sorted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.65} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="source_year" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--primary)", strokeOpacity: 0.25 }} />
        <Area
          type="monotone"
          dataKey="total_rows"
          name="Applications"
          stroke="var(--primary)"
          strokeWidth={2.5}
          fill="url(#volumeGradient)"
          dot={{ r: 4, fill: "var(--primary)", strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        >
          <LabelList dataKey="total_rows" position="top" formatter={(v: number) => formatNumber(v)} fontSize={10} fill="var(--muted-foreground)" />
        </Area>
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ApprovalArea({ data }: { data: YearStats[] }) {
  const sorted = [...data].sort((a, b) => a.source_year - b.source_year);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={sorted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="approvalGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--success)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="var(--success)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="source_year" {...axisProps} />
        <YAxis {...axisProps} unit="%" domain={[0, 60]} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatPercent(v), "Approval"]} />
        <Area
          type="monotone"
          dataKey="approval_rate_pct"
          name="Approval rate"
          stroke="var(--success)"
          strokeWidth={2.5}
          fill="url(#approvalGradient)"
          dot={{ r: 4, fill: "var(--success)", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DecisionBars({ data }: { data: YearStats[] }) {
  const sorted = [...data].sort((a, b) => a.source_year - b.source_year);
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={sorted} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="approvedBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--success)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--success)" stopOpacity={0.45} />
          </linearGradient>
          <linearGradient id="rejectedBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--destructive)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="source_year" {...axisProps} />
        <YAxis {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)", opacity: 0.4 }} />
        <Bar dataKey="approved" name="Approved" fill="url(#approvedBar)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="rejected" name="Rejected" fill="url(#rejectedBar)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="withdrawn" name="Withdrawn" fill="var(--warning)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RegionsBar({ data }: { data: RegionStats[] }) {
  const top = [...data].sort((a, b) => b.total_rows - a.total_rows).slice(0, 10).reverse();
  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={top} layout="vertical" margin={{ top: 8, right: 24, left: 12, bottom: 0 }}>
        <defs>
          <linearGradient id="regionBar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="oklch(0.75 0.16 195)" stopOpacity={1} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" horizontal={false} />
        <XAxis type="number" {...axisProps} />
        <YAxis type="category" dataKey="lan" width={130} {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)", opacity: 0.4 }} />
        <Bar dataKey="total_rows" name="Applications" fill="url(#regionBar)" radius={[0, 4, 4, 0]}>
          <LabelList dataKey="total_rows" position="right" formatter={(v: number) => formatNumber(v)} fontSize={10} fill="var(--muted-foreground)" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AreasBar({ data }: { data: AreaStats[] }) {
  const top = [...data].sort((a, b) => b.total_rows - a.total_rows).slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={360}>
      <ComposedChart data={top} margin={{ top: 8, right: 20, left: 0, bottom: 70 }}>
        <defs>
          <linearGradient id="areaBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
            <stop offset="100%" stopColor="oklch(0.72 0.17 155)" stopOpacity={0.65} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="utbildningsomrade" interval={0} angle={-30} textAnchor="end" height={80} {...axisProps} />
        <YAxis yAxisId="left" {...axisProps} />
        <YAxis yAxisId="right" orientation="right" unit="%" {...axisProps} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar yAxisId="left" dataKey="total_rows" name="Applications" fill="url(#areaBar)" radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="approval_rate_pct" name="Approval %" stroke="var(--success)" strokeWidth={2.25} dot={{ r: 4, fill: "var(--success)", strokeWidth: 0 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function StudyFormBars({ data }: { data: StudyFormStats[] }) {
  const chartData = [...data].sort((a, b) => b.total_rows - a.total_rows);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="studyFormBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
            <stop offset="100%" stopColor="oklch(0.72 0.17 155)" stopOpacity={0.65} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="studieform" {...axisProps} />
        <YAxis yAxisId="left" {...axisProps} />
        <YAxis yAxisId="right" orientation="right" unit="%" domain={[0, 100]} {...axisProps} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) =>
            name === "Approval %" ? [formatPercent(value), name] : [formatNumber(Number(value)), name]
          }
        />
        <Bar yAxisId="left" dataKey="total_rows" name="Applications" fill="url(#studyFormBar)" radius={[4, 4, 0, 0]}>
          <LabelList dataKey="total_rows" position="top" formatter={(v: number) => formatNumber(v)} fontSize={10} fill="var(--muted-foreground)" />
        </Bar>
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="approval_rate_pct"
          name="Approval %"
          stroke="var(--success)"
          strokeWidth={2.25}
          dot={{ r: 4, fill: "var(--success)", strokeWidth: 0 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

type ProviderChartRow = ProviderStats & {
  rank: number;
  rankName: string;
  shortName: string;
};

function ProviderBars({ data }: { data: ProviderStats[] }) {
  const chartData: ProviderChartRow[] = [...data]
    .sort((a, b) => b.total_rows - a.total_rows)
    .map((row, index) => {
      const shortName =
        row.utbildningsanordnare.replace(/Aktiebolag|AB|Kommun/g, "").trim() ||
        row.utbildningsanordnare;
      return {
        ...row,
        rank: index + 1,
        rankName: `#${index + 1} ${shortName}`,
        shortName,
      };
    })
    .reverse();

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 88, left: 24, bottom: 0 }}>
        <defs>
          <linearGradient id="providerBar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="oklch(0.75 0.16 195)" stopOpacity={1} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" horizontal={false} />
        <XAxis type="number" {...axisProps} />
        <YAxis type="category" dataKey="rankName" width={180} {...axisProps} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: "var(--surface-2)", opacity: 0.4 }}
          formatter={(value, name) =>
            name === "Approval %" ? [formatPercent(value), name] : [formatNumber(Number(value)), name]
          }
        />
        <Bar dataKey="total_rows" name="Applications" fill="url(#providerBar)" radius={[0, 4, 4, 0]}>
          <LabelList content={ProviderValueLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ProviderValueLabel(props: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  payload?: ProviderChartRow;
}) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const height = Number(props.height ?? 0);
  const row = props.payload;

  if (!row) return null;

  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      dominantBaseline="middle"
      fill="var(--muted-foreground)"
      fontSize={10}
    >
      {formatNumber(row.total_rows)} | {formatPercent(row.approval_rate_pct)}
    </text>
  );
}
