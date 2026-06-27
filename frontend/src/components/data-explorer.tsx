import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  Download,
  Eye,
  Filter,
  MapPin,
  Monitor,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { api, type ApplicationRow, type ExplorerFilters } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/data-states";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const PAGE_SIZE = 50;
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const DECISIONS = ["approved", "rejected", "withdrawn"];
const CSV_FIELD_GROUPS: {
  section: string;
  fields: { field: keyof ApplicationRow; meaning: string; notes: string }[];
}[] = [
  {
    section: "Source tracking",
    fields: [
      {
        field: "id",
        meaning: "Internal row id generated in the database.",
        notes: "Example: 123",
      },
      {
        field: "source_year",
        meaning: "Application round year from the original MYH file.",
        notes: "Example: 2024",
      },
      {
        field: "source_file",
        meaning: "Original Excel file the row came from.",
        notes: "Example: ansokningsomgang-2024.xlsx",
      },
      {
        field: "source_sheet",
        meaning: "Excel sheet used during import.",
        notes: "Example: Tabell 3",
      },
      {
        field: "diarienummer",
        meaning: "MYH case/reference number.",
        notes: "Used to identify an application case.",
      },
    ],
  },
  {
    section: "Education",
    fields: [
      {
        field: "utbildningsnamn",
        meaning: "Name of the education/program.",
        notes: "Example: Data Engineer",
      },
      {
        field: "utbildningsomrade",
        meaning: "Education area/category.",
        notes: "Display label: Area",
      },
      {
        field: "yh_poang",
        meaning: "YH credits/points for the education.",
        notes: "Display label: Points",
      },
      {
        field: "studieform",
        meaning: "Study form from the source data.",
        notes: "Bunden is shown as På plats. Distans is shown as Distance.",
      },
      {
        field: "studietakt_procent",
        meaning: "Study pace in percent.",
        notes: "Example: 100",
      },
      {
        field: "typ_av_examen",
        meaning: "Exam type.",
        notes: "Yrkeshögskoleexamen is shown as YH. Kvalificerad yrkeshögskoleexamen is shown as KYH.",
      },
    ],
  },
  {
    section: "Decision and location",
    fields: [
      {
        field: "beslut",
        meaning: "Original Swedish decision text from the source file.",
        notes: "Example: Beviljad",
      },
      {
        field: "beslut_normalized",
        meaning: "Cleaned decision value used by the dashboard.",
        notes: "Values: approved, rejected, withdrawn",
      },
      {
        field: "lan",
        meaning: "County/region from the source data.",
        notes: "Display label: Region/County",
      },
      {
        field: "kommun",
        meaning: "Municipality/city from the source data.",
        notes: "Display label: City",
      },
    ],
  },
  {
    section: "Provider",
    fields: [
      {
        field: "utbildningsanordnare",
        meaning: "Education provider/school/organization.",
        notes: "The table may shorten the display name, but the CSV keeps the full value.",
      },
      {
        field: "huvudmannatyp",
        meaning: "Provider ownership/type.",
        notes: "Examples: Privat, Kommun, Region, Statlig",
      },
    ],
  },
  {
    section: "Multi-municipality fields",
    fields: [
      {
        field: "flera_kommuner",
        meaning: "Original source marker for applications connected to several municipalities.",
        notes: "Source information only. This is not a Swedish county.",
      },
      {
        field: "antal_kommuner",
        meaning: "Number of municipalities connected to the application, when available.",
        notes: "May be empty for older source files.",
      },
      {
        field: "sokta_omgangar",
        meaning: "Number of rounds applied for, when available.",
        notes: "May be empty for older source files.",
      },
      {
        field: "beviljade_omgangar",
        meaning: "Number of rounds approved/granted, when available.",
        notes: "May be empty for older source files.",
      },
    ],
  },
  {
    section: "Newer classification fields",
    fields: [
      {
        field: "sun5_inriktning",
        meaning: "SUN5 subject classification code.",
        notes: "Mostly available in newer files.",
      },
      {
        field: "sun5_inriktning_namn",
        meaning: "SUN5 subject classification name.",
        notes: "Mostly available in newer files.",
      },
      {
        field: "seqf_niva",
        meaning: "SeQF qualification level.",
        notes: "Mostly available in newer files.",
      },
      {
        field: "smalt_yrkesomrade",
        meaning: "Narrow occupational area.",
        notes: "Mostly available in newer files.",
      },
    ],
  },
  {
    section: "Derived dashboard fields",
    fields: [
      {
        field: "is_distance",
        meaning: "Derived true/false field.",
        notes: "True when the study form is distance-based.",
      },
      {
        field: "has_multiple_municipalities",
        meaning: "Derived true/false field.",
        notes: "True when the row is connected to more than one municipality.",
      },
    ],
  },
];
const DETAIL_FIELDS: { key: keyof ApplicationRow; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "source_year", label: "Source year" },
  { key: "source_file", label: "Source file" },
  { key: "source_sheet", label: "Source sheet" },
  { key: "diarienummer", label: "Case number" },
  { key: "utbildningsnamn", label: "Program" },
  { key: "utbildningsomrade", label: "Area" },
  { key: "beslut", label: "Decision" },
  { key: "beslut_normalized", label: "Decision normalized" },
  { key: "lan", label: "Region / county" },
  { key: "kommun", label: "City" },
  { key: "yh_poang", label: "Points" },
  { key: "studieform", label: "Study form" },
  { key: "studietakt_procent", label: "Study pace percent" },
  { key: "typ_av_examen", label: "Exam" },
  { key: "utbildningsanordnare", label: "Provider" },
  { key: "huvudmannatyp", label: "Provider type" },
  { key: "flera_kommuner", label: "Multiple cities" },
  { key: "antal_kommuner", label: "City count" },
  { key: "sokta_omgangar", label: "Applied rounds" },
  { key: "beviljade_omgangar", label: "Approved rounds" },
  { key: "sun5_inriktning", label: "SUN5 specialization" },
  { key: "sun5_inriktning_namn", label: "SUN5 specialization name" },
  { key: "seqf_niva", label: "SeQF level" },
  { key: "smalt_yrkesomrade", label: "Narrow occupational area" },
  { key: "is_distance", label: "Distance education" },
  { key: "has_multiple_municipalities", label: "Has multiple cities" },
];

export function DataExplorer({
  onFiltersChange,
}: {
  onFiltersChange?: (filters: ExplorerFilters) => void;
}) {
  const [year, setYear] = useState<string>("");
  const [decision, setDecision] = useState<string>("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [provider, setProvider] = useState("");
  const [educationArea, setEducationArea] = useState("");
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState<ApplicationRow | null>(null);
  const [page, setPage] = useState(0);

  const params = useMemo(
    () => ({
      year: year || undefined,
      decision: decision || undefined,
      region: region || undefined,
      municipality: city || undefined,
      provider: provider || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [year, decision, region, city, provider, page],
  );

  const exportParams = useMemo(
    () => ({
      year: year || undefined,
      decision: decision || undefined,
      region: region || undefined,
      municipality: city || undefined,
      provider: provider || undefined,
    }),
    [year, decision, region, city, provider],
  );

  const sharedFilters = useMemo(
    () => ({
      year: year || undefined,
      decision: decision || undefined,
      region: region || undefined,
      municipality: city || undefined,
      provider: provider || undefined,
      education_area: educationArea || undefined,
      search: search || undefined,
    }),
    [city, decision, educationArea, provider, region, search, year],
  );

  useEffect(() => {
    onFiltersChange?.(sharedFilters);
  }, [onFiltersChange, sharedFilters]);

  const q = useQuery({
    queryKey: ["applications", params],
    queryFn: () => api.applications(params),
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const filtered = useMemo(() => {
    if (!q.data) return [];
    const searchNeedle = search.trim().toLowerCase();
    const areaNeedle = educationArea.trim().toLowerCase();
    const cityNeedle = city.trim().toLowerCase();

    return q.data.filter(
      (row) => {
        const matchesSearch = Boolean(
          !searchNeedle ||
            row.utbildningsnamn?.toLowerCase().includes(searchNeedle) ||
            row.utbildningsanordnare?.toLowerCase().includes(searchNeedle) ||
            row.diarienummer?.toLowerCase().includes(searchNeedle) ||
            row.kommun?.toLowerCase().includes(searchNeedle) ||
            row.utbildningsomrade?.toLowerCase().includes(searchNeedle),
        );
        const matchesEducationArea =
          !areaNeedle ||
          Boolean(row.utbildningsomrade?.toLowerCase().includes(areaNeedle));
        const matchesCity =
          !cityNeedle || Boolean(row.kommun?.toLowerCase().includes(cityNeedle));

        return matchesSearch && matchesEducationArea && matchesCity;
      },
    );
  }, [city, educationArea, q.data, search]);

  const resetPage = (fn: (value: string) => void) => (value: string) => {
    setPage(0);
    fn(value);
  };

  function clearFilters() {
    setYear("");
    setDecision("");
    setRegion("");
    setCity("");
    setProvider("");
    setEducationArea("");
    setSearch("");
    setPage(0);
  }

  const hasFilters = Boolean(
    year || decision || region || city || provider || educationArea || search,
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface-1/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filters
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasFilters}
              onClick={clearFilters}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Clear
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={api.exportApplicationsUrl(exportParams)}>
                <Download className="h-3.5 w-3.5" /> CSV
              </a>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search loaded rows: program, provider, city, area..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="bg-surface-2/60 pl-9"
            />
          </div>
          <NativeSelect
            value={year}
            onChange={resetPage(setYear)}
            placeholder="All years"
            options={YEARS.map((item) => ({ value: String(item), label: String(item) }))}
          />
          <NativeSelect
            value={decision}
            onChange={resetPage(setDecision)}
            placeholder="All decisions"
            options={DECISIONS.map((item) => ({
              value: item,
              label: decisionLabel(item),
            }))}
          />
          <Input
            placeholder="Region/county contains..."
            value={region}
            onChange={(event) => {
              setPage(0);
              setRegion(event.target.value);
            }}
            className="bg-surface-2/60"
          />
          <Input
            placeholder="City contains..."
            value={city}
            onChange={(event) => {
              setPage(0);
              setCity(event.target.value);
            }}
            className="bg-surface-2/60"
          />
          <Input
            placeholder="Provider contains..."
            value={provider}
            onChange={(event) => {
              setPage(0);
              setProvider(event.target.value);
            }}
            className="bg-surface-2/60"
          />
          <Input
            placeholder="Area (filters this page only)..."
            value={educationArea}
            onChange={(event) => {
              setPage(0);
              setEducationArea(event.target.value);
            }}
            className="bg-surface-2/60 lg:col-span-2"
          />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Provider, region/county, and city filter the full dataset server-side. Area and the text search box filter only the rows on this page.
        </p>
        <CsvContentsAccordion />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface-1/60">
        {q.isError ? (
          <div className="p-5">
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 border-b border-border bg-surface-2/80 backdrop-blur">
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Th>Year</Th>
                  <Th>Program</Th>
                  <Th>Area</Th>
                  <Th>Points</Th>
                  <Th>Provider</Th>
                  <Th>City</Th>
                  <Th>Decision</Th>
                  <Th>Form</Th>
                  <Th>Exam</Th>
                  <Th>Details</Th>
                </tr>
              </thead>
              <tbody>
                {q.isLoading &&
                  Array.from({ length: 12 }).map((_, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-border/60">
                      {Array.from({ length: 10 }).map((_, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2">
                          <Skeleton className="h-3 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))}
                {!q.isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-10 text-center text-xs text-muted-foreground">
                      No matching records.
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/60 transition-colors hover:bg-surface-2/40"
                  >
                    <Td className="font-mono text-primary">{row.source_year}</Td>
                    <Td className="max-w-[300px] truncate font-medium text-foreground" title={row.utbildningsnamn}>
                      {row.utbildningsnamn}
                    </Td>
                    <Td className="max-w-[170px] truncate text-[11px] text-muted-foreground" title={row.utbildningsomrade ?? ""}>
                      {row.utbildningsomrade ?? "-"}
                    </Td>
                    <Td className="font-mono text-[11px]">{row.yh_poang ?? "-"}</Td>
                    <Td className="max-w-[190px] truncate text-[11px]" title={row.utbildningsanordnare ?? ""}>
                      {shortenProvider(row.utbildningsanordnare)}
                    </Td>
                    <Td className="max-w-[120px] truncate text-[11px] text-muted-foreground" title={row.kommun ?? ""}>
                      {row.kommun ?? "-"}
                    </Td>
                    <Td className="text-center">
                      <DecisionBadge value={row.beslut_normalized ?? row.beslut} />
                    </Td>
                    <Td className="text-center">
                      <StudyFormBadge value={row.studieform} />
                    </Td>
                    <Td className="font-mono text-[11px] text-muted-foreground" title={row.typ_av_examen ?? ""}>
                      {shortenExam(row.typ_av_examen)}
                    </Td>
                    <Td className="text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="View details"
                        aria-label="View details"
                        className="h-7 w-7"
                        onClick={() => setSelectedRow(row)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface-2/40 px-4 py-3">
          <div className="text-xs text-muted-foreground">
            Page <span className="font-mono text-foreground">{page + 1}</span> · loaded{" "}
            <span className="font-mono text-foreground">{q.data?.length ?? 0}</span> rows
            {(search || educationArea || city) && (
              <span>
                {" "}· visible after loaded-row filters{" "}
                <span className="font-mono text-foreground">{filtered.length}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || q.isFetching}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!q.data || q.data.length < PAGE_SIZE || q.isFetching}
              onClick={() => setPage((current) => current + 1)}
              className="gap-1"
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={Boolean(selectedRow)} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <SheetContent className="w-[92vw] overflow-y-auto bg-surface-1 sm:max-w-xl">
          {selectedRow && <RowDetails row={selectedRow} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-semibold">{children}</th>;
}

function Td({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <td title={title} className={`px-3 py-2 align-middle text-xs ${className}`}>
      {children}
    </td>
  );
}

function CsvContentsAccordion() {
  return (
    <Accordion type="single" collapsible className="mt-3 rounded-lg border border-border bg-surface-2/35">
      <AccordionItem value="csv-contents" className="border-0 px-3">
        <AccordionTrigger className="py-3 text-xs font-semibold hover:no-underline">
          What is included in the CSV?
        </AccordionTrigger>
        <AccordionContent className="pb-3">
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
            The CSV export contains the filtered application records, not only the visible 50-row page. It includes both original source fields and cleaned fields used by the dashboard. Some columns are empty for older years because MYH added those fields in later source files.
          </p>
          <div className="overflow-x-auto rounded-md border border-border bg-surface-1/60">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-surface-2/70 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-[170px] px-3 py-2 font-semibold">Field</th>
                  <th className="min-w-[260px] px-3 py-2 font-semibold">Meaning</th>
                  <th className="min-w-[260px] px-3 py-2 font-semibold">Example / Notes</th>
                </tr>
              </thead>
              <tbody>
                {CSV_FIELD_GROUPS.map((group) => (
                  <CsvFieldGroup key={group.section} group={group} />
                ))}
              </tbody>
            </table>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function CsvFieldGroup({
  group,
}: {
  group: (typeof CSV_FIELD_GROUPS)[number];
}) {
  return (
    <>
      <tr className="border-b border-border/70 bg-surface-2/45">
        <td colSpan={3} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-primary">
          {group.section}
        </td>
      </tr>
      {group.fields.map((field) => (
        <tr key={field.field} className="border-b border-border/55 last:border-b-0">
          <td className="px-3 py-2 align-top font-mono text-[11px] text-foreground">
            {field.field}
          </td>
          <td className="px-3 py-2 align-top text-[11px] text-foreground">
            {field.meaning}
          </td>
          <td className="px-3 py-2 align-top text-[11px] text-muted-foreground">
            {field.notes}
          </td>
        </tr>
      ))}
    </>
  );
}

function RowDetails({ row }: { row: ApplicationRow }) {
  return (
    <div className="space-y-5">
      <SheetHeader className="pr-8">
        <SheetTitle>{row.utbildningsnamn || "Application details"}</SheetTitle>
        <SheetDescription>
          {row.diarienummer || "No case number"} · {row.source_year}
        </SheetDescription>
      </SheetHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <DetailHighlight label="Decision" value={decisionLabel(row.beslut_normalized ?? row.beslut)} />
        <DetailHighlight label="Provider" value={row.utbildningsanordnare} />
        <DetailHighlight label="Area" value={row.utbildningsomrade} />
        <DetailHighlight label="Points" value={row.yh_poang} />
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-2/40">
        {DETAIL_FIELDS.map((field) => (
          <div key={field.key} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {field.label}
            </div>
            <div className="min-w-0 break-words text-sm text-foreground">
              {formatDetailValue(row[field.key])}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailHighlight({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/50 p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 min-w-0 break-words text-sm font-medium text-foreground">
        {formatDetailValue(value)}
      </div>
    </div>
  );
}

function formatDetailValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString("sv-SE");
  return value;
}

function decisionLabel(value: string | null) {
  if (!value) return "-";
  const normalized = value.toLowerCase();
  if (normalized.includes("reject") || normalized.includes("avslag") || normalized.includes("ej")) {
    return "Ej beviljad";
  }
  if (normalized.includes("approved") || normalized.includes("bevilj")) {
    return "Beviljad";
  }
  return "Återkallad";
}

function DecisionBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-[11px] text-muted-foreground">-</span>;
  const label = decisionLabel(value);
  const normalized = value.toLowerCase();
  const Icon =
    normalized.includes("reject") || normalized.includes("avslag") || normalized.includes("ej")
      ? X
      : normalized.includes("approved") || normalized.includes("bevilj")
        ? Check
        : Clock;
  const cls =
    normalized.includes("reject") || normalized.includes("avslag") || normalized.includes("ej")
      ? "border-destructive/35 bg-destructive/15 text-destructive"
      : normalized.includes("approved") || normalized.includes("bevilj")
        ? "border-success/35 bg-success/15 text-success"
        : "border-warning/35 bg-warning/15 text-warning";

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md border ${cls}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function StudyFormBadge({ value }: { value: string | null }) {
  const label = studyFormLabel(value);
  const normalized = (value ?? "").toLowerCase();
  const Icon = normalized.includes("distans")
    ? Monitor
    : normalized.includes("bunden")
      ? MapPin
      : CircleHelp;
  const cls = normalized.includes("distans")
    ? "border-primary/35 bg-primary/15 text-primary"
    : normalized.includes("bunden")
      ? "border-success/35 bg-success/15 text-success"
      : "border-border bg-surface-2 text-muted-foreground";

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md border ${cls}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

function studyFormLabel(value: string | null) {
  if (!value) return "Unknown";
  const normalized = value.toLowerCase();
  if (normalized.includes("bunden")) return "På plats";
  if (normalized.includes("distans")) return "Distance";
  return value;
}

function shortenExam(value: string | null) {
  if (!value) return "-";
  const normalized = value.toLowerCase();
  if (normalized.includes("kvalificerad")) return "KYH";
  if (normalized.includes("yrkesh")) return "YH";
  return value;
}

function shortenProvider(value: string | null) {
  if (!value) return "-";
  const shortened = value
    .replace(/\b(Aktiebolag|Kommun|Sveriges)\b/gi, "")
    .replace(/\bAB\b/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[,\-–—]+$/g, "")
    .trim();

  return shortened.length >= 4 ? shortened : value;
}

function NativeSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-md border border-border bg-surface-2/60 px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-surface-1">
          {option.label}
        </option>
      ))}
    </select>
  );
}
