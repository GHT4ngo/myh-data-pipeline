import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, BrainCircuit, Database } from "lucide-react";
import { api } from "@/lib/api";
import type { PredictRequest } from "@/lib/api";
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

export const Route = createFileRoute("/predict")({
  component: PredictPage,
});

const LAN_OPTIONS = [
  "Blekinge",
  "Dalarna",
  "Gotland",
  "Gävleborg",
  "Halland",
  "Jämtland",
  "Jönköping",
  "Kalmar",
  "Kronoberg",
  "Norrbotten",
  "Skåne",
  "Stockholm",
  "Södermanland",
  "Uppsala",
  "Värmland",
  "Västerbotten",
  "Västernorrland",
  "Västmanland",
  "Västra Götaland",
  "Örebro",
  "Östergötland",
];

const AREA_OPTIONS = [
  "Data/IT",
  "Ekonomi, administration och försäljning",
  "Friskvård och kroppsvård",
  "Hotell, restaurang och turism",
  "Hälso- och sjukvård samt socialt arbete",
  "Journalistik och information",
  "Juridik",
  "Kultur, media och design",
  "Lantbruk, djurvård, trädgård, skog och fiske",
  "Miljövård och miljöskydd",
  "Pedagogik och undervisning",
  "Samhällsbyggnad och byggteknik",
  "Säkerhetstjänster",
  "Teknik och tillverkning",
  "Transporttjänster",
  "Övrigt",
];

const DEFAULT_FORM: PredictRequest = {
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

function PredictPage() {
  const [form, setForm] = useState<PredictRequest>(DEFAULT_FORM);

  const { mutate, data, isPending, isError, error, reset } = useMutation({
    mutationFn: () => api.predict(form),
  });

  function updateForm(updates: Partial<PredictRequest>) {
    setForm((prev) => ({ ...prev, ...updates }));
    reset();
  }

  const pct = data ? Math.round(data.approval_probability * 100) : null;
  const barColor =
    pct === null
      ? "bg-primary"
      : pct >= 45
        ? "bg-emerald-500"
        : pct >= 30
          ? "bg-amber-500"
          : "bg-red-500";
  const verdictColor =
    pct === null
      ? "text-foreground"
      : pct >= 45
        ? "text-emerald-500"
        : pct >= 30
          ? "text-amber-500"
          : "text-red-500";
  const verdict =
    pct === null
      ? null
      : pct >= 45
        ? "Above historical average"
        : pct >= 30
          ? "Around historical average"
          : "Below historical average";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3 sm:px-8">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-md border border-primary/40 bg-primary/15 text-primary">
              <Database className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">
                MYH Data Pipeline
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Christofer Lindholm
              </div>
            </div>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-32 pt-12 sm:px-8">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-primary">
            <BrainCircuit className="h-3 w-3" />
            Random Forest · 9 983 training records
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Approval <span className="text-primary">Predictor</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Fill in the details of a YH application. The model estimates the
            probability it would be approved based on 8 years of MYH decisions
            (2018–2025).
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* ── Form ───────────────────────────────────────────────── */}
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
                  <Select
                    value={form.lan}
                    onValueChange={(v) => updateForm({ lan: v })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LAN_OPTIONS.map((lan) => (
                        <SelectItem key={lan} value={lan} className="text-sm">
                          {lan}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Utbildningsområde</Label>
                  <Select
                    value={form.utbildningsomrade}
                    onValueChange={(v) => updateForm({ utbildningsomrade: v })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AREA_OPTIONS.map((area) => (
                        <SelectItem key={area} value={area} className="text-sm">
                          {area}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Studieform</Label>
                  <Select
                    value={form.studieform}
                    onValueChange={(v) =>
                      updateForm({ studieform: v, is_distance: v === "Distans" })
                    }
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bunden" className="text-sm">
                        Bunden
                      </SelectItem>
                      <SelectItem value="Distans" className="text-sm">
                        Distans
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Huvudmannatyp</Label>
                  <Select
                    value={form.huvudmannatyp}
                    onValueChange={(v) => updateForm({ huvudmannatyp: v })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Privat" className="text-sm">
                        Privat
                      </SelectItem>
                      <SelectItem value="Kommun" className="text-sm">
                        Kommun
                      </SelectItem>
                      <SelectItem value="Region" className="text-sm">
                        Region
                      </SelectItem>
                      <SelectItem value="Statlig" className="text-sm">
                        Statlig
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Application year</Label>
                  <Input
                    type="number"
                    min={2018}
                    max={2030}
                    value={form.source_year}
                    onChange={(e) =>
                      updateForm({ source_year: Number(e.target.value) })
                    }
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">YH-poäng (program size)</Label>
                  <Input
                    type="number"
                    min={50}
                    max={2000}
                    step={50}
                    value={form.yh_poang}
                    onChange={(e) =>
                      updateForm({ yh_poang: Number(e.target.value) })
                    }
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Studietakt (%)</Label>
                  <Input
                    type="number"
                    min={25}
                    max={100}
                    step={25}
                    value={form.studietakt_procent}
                    onChange={(e) =>
                      updateForm({ studietakt_procent: Number(e.target.value) })
                    }
                    className="h-9 text-sm"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                  <Label className="cursor-pointer text-xs">
                    Multiple municipalities
                  </Label>
                  <Switch
                    checked={form.has_multiple_municipalities}
                    onCheckedChange={(v) =>
                      updateForm({ has_multiple_municipalities: v })
                    }
                  />
                </div>
              </div>

              <Button
                onClick={() => mutate()}
                disabled={isPending}
                className="mt-6 w-full"
              >
                {isPending ? "Predicting…" : "Predict approval probability"}
              </Button>
            </CardContent>
          </Card>

          {/* ── Result ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            <Card
              className={`border transition-colors ${data ? "border-primary/40" : "border-border"}`}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Result</CardTitle>
              </CardHeader>
              <CardContent>
                {!data && !isPending && !isError && (
                  <p className="text-sm text-muted-foreground">
                    Fill in the details and click Predict.
                  </p>
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
                    <span>
                      {error instanceof Error
                        ? error.message
                        : "Prediction failed."}
                    </span>
                  </div>
                )}
                {data && pct !== null && (
                  <div className="space-y-4">
                    <div>
                      <div
                        className={`text-5xl font-bold tabular-nums ${verdictColor}`}
                      >
                        {pct}%
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {verdict}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                        <span>0 %</span>
                        <span>50 %</span>
                        <span>100 %</span>
                      </div>
                    </div>
                    <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      <span className="font-medium">Rejection:</span>{" "}
                      {Math.round(data.rejection_probability * 100)} %
                      &nbsp;·&nbsp;
                      <span className="font-medium">Model:</span>{" "}
                      {data.model_name}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="pt-4">
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">
                    How it works:
                  </span>{" "}
                  A Random Forest model trained on 9,983 MYH applications
                  (2018–2025) predicts based on region, education area, study
                  form, operator type, program size, and year.
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Limitation:
                  </span>{" "}
                  The model reflects historical patterns only. MYH's actual
                  decisions also weigh program quality, employer demand, and
                  regional need, none of which are in the dataset. Historical
                  average approval rate: ~36%.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
