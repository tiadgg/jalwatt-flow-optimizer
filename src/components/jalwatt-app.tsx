import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  BatteryCharging,
  ChevronDown,
  CircleHelp,
  Cloud,
  Cpu,
  Download,
  Droplets,
  Gauge,
  Leaf,
  Menu,
  Network,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Thermometer,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSettings } from "@/context/settings-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_SETTINGS, type CoolingPreset } from "@/engine";
import { toHouseholdDailyWaterEquivalents } from "@/lib/dashboard-metrics";

const sections = [
  { label: "Dashboard", icon: BarChart3 },
  { label: "Simulator", icon: SlidersHorizontal },
  { label: "Scheduler", icon: Activity },
  { label: "Cooling & ROI", icon: Droplets },
  { label: "Stress Test", icon: Gauge },
  { label: "Data & City", icon: Network },
  { label: "Report", icon: Download },
  { label: "Assumptions", icon: CircleHelp },
] as const;

type Section = (typeof sections)[number]["label"];
const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
const energy = (value: number) => `${value.toFixed(2)} kWh`;
const formatCompact = (value: number) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);

function Metric({
  label,
  value,
  unit,
  savingsPct,
  icon: Icon,
  tone = "text-primary",
}: {
  label: string;
  value: string;
  unit: string;
  savingsPct: number;
  icon: typeof Zap;
  tone?: string;
}) {
  return (
    <div className="metric-panel min-w-0 border border-border bg-card px-4 py-4 sm:px-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className={`size-4 shrink-0 ${tone}`} aria-hidden="true" />
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold tabular-nums tracking-normal sm:text-3xl">{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
      <div className="mt-3">
        <span className="inline-flex items-center gap-1 rounded-sm bg-primary/10 px-2 py-1 text-[10px] font-medium tabular-nums text-primary">
          <ArrowDownRight className="size-3" />
          {`${Math.max(0, savingsPct).toFixed(1)}% saved`}
        </span>
      </div>
    </div>
  );
}

function AssumptionTag() {
  return <span className="inline-flex shrink-0 items-center border border-border px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">Assumption</span>;
}

function SliderField({
  label,
  value,
  suffix,
  min = 0,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="grid gap-3 text-sm text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs">{label}</label>
        <div className="flex items-center gap-2"><AssumptionTag /><output className="min-w-16 text-right font-mono text-sm tabular-nums text-foreground">{value.toLocaleString("en-IN")}{suffix ? ` ${suffix}` : ""}</output></div>
      </div>
      <Slider aria-label={label} min={min} max={max} step={step} value={[value]} onValueChange={(values) => { const next = values[0]; if (next !== undefined) onChange(next); }} />
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground"><span>{min.toLocaleString("en-IN")}{suffix ? ` ${suffix}` : ""}</span><span>{max.toLocaleString("en-IN")}{suffix ? ` ${suffix}` : ""}</span></div>
    </div>
  );
}

function PanelHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-6">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</div>
      <h2 className="mt-2 text-xl font-semibold tracking-normal sm:text-2xl">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function JalWattApp() {
  const { settings, updateSettings, updateHour, result } = useSettings();
  const [active, setActive] = useState<Section>("Dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [simulatedJobs, setSimulatedJobs] = useState<number | null>(null);

  const displayed = useMemo(() => {
    if (simulatedJobs === null || simulatedJobs === settings.jobsPerDay) return result;
    return { ...result, jalwatt: result.jalwatt };
  }, [result, simulatedJobs, settings.jobsPerDay]);

  const chooseSection = (label: Section) => {
    setActive(label);
    setMobileNavOpen(false);
  };

  const exportReport = () => {
    const lines = [
      "JalWatt simulation report",
      `City,${settings.city}`,
      `Jobs per day,${settings.jobsPerDay}`,
      `Cooling,${settings.selectedCooling}`,
      "Metric,Baseline,JalWatt",
      `IT energy (kWh),${result.baseline.itKWh.toFixed(3)},${result.jalwatt.itKWh.toFixed(3)}`,
      `Facility energy (kWh),${result.baseline.facilityKWh.toFixed(3)},${result.jalwatt.facilityKWh.toFixed(3)}`,
      `Water (L),${result.baseline.waterL.toFixed(3)},${result.jalwatt.waterL.toFixed(3)}`,
      `CO2 (kg),${result.baseline.co2Kg.toFixed(3)},${result.jalwatt.co2Kg.toFixed(3)}`,
      `Cost (INR),${result.baseline.costINR.toFixed(2)},${result.jalwatt.costINR.toFixed(2)}`,
      `Energy savings (%),,${result.savingsPct.toFixed(2)}`,
      `SLA violations,,${result.jalwatt.slaViolations}`,
    ].join("\n");
    const blob = new Blob([lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "jalwatt-simulation-report.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const selectedCooling = settings.cooling[settings.selectedCooling];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-sidebar-border px-5">
          <div className="grid size-9 place-items-center border border-primary/30 bg-primary/10 text-primary">
            <Droplets className="size-5" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-normal">JalWatt</div>
            <div className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Intelligence for infrastructure</div>
          </div>
        </div>
        <div className="px-4 pt-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Workspace</div>
        <nav className="grid gap-1 px-3 pt-3" aria-label="Main navigation">
          {sections.map(({ label, icon: Icon }) => (
            <Button
              key={label}
              variant="ghost"
              onClick={() => chooseSection(label)}
              aria-current={active === label ? "page" : undefined}
              className={`h-10 justify-start rounded-sm px-3 text-sm ${active === label ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:text-sidebar-foreground"}`}
            >
              <Icon className="size-4" />
              {label}
              {label === "Dashboard" && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
            </Button>
          ))}
        </nav>
        <div className="mt-auto border-t border-sidebar-border p-4">
          <div className="flex items-center gap-2 text-xs font-medium"><span className="size-2 rounded-full bg-primary" /> Simulation ready</div>
          <div className="mt-1 pl-4 text-[10px] text-muted-foreground">Seed {settings.seed} · client-side</div>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-60">
        <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Toggle navigation" onClick={() => setMobileNavOpen((open) => !open)}>
              <Menu className="size-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>Infrastructure</span><span>/</span><span className="truncate text-foreground">{active}</span></div>
              <h1 className="mt-1 truncate text-base font-semibold sm:text-lg">{active === "Dashboard" ? "Water & energy operations" : active}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="hidden items-center gap-2 border-r border-border pr-4 text-xs text-muted-foreground sm:flex"><span className="size-1.5 rounded-full bg-primary" /> Live model</div>
            <Select value={settings.city} onValueChange={(city) => updateSettings({ city })}>
              <SelectTrigger aria-label="Select city" className="h-9 w-[130px] border-0 bg-secondary/70 text-xs sm:w-[155px]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Bangalore">Bangalore, IN</SelectItem><SelectItem value="Chennai">Chennai, IN</SelectItem><SelectItem value="Mumbai">Mumbai, IN</SelectItem><SelectItem value="Hyderabad">Hyderabad, IN</SelectItem></SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportReport} className="hidden h-9 sm:inline-flex"><Download className="size-4" /> Export</Button>
          </div>
        </header>

        {mobileNavOpen && <nav className="grid grid-cols-2 gap-1 border-b border-border bg-sidebar p-3 sm:grid-cols-4 lg:hidden" aria-label="Mobile navigation">{sections.map(({ label, icon: Icon }) => <Button key={label} variant="ghost" size="sm" onClick={() => chooseSection(label)} className={active === label ? "bg-sidebar-accent text-sidebar-accent-foreground" : "justify-start"}><Icon className="size-4" />{label}</Button>)}</nav>}

        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {active === "Dashboard" && <DashboardView {...{ settings, result, selectedCooling, chooseSection }} />}
          {active === "Simulator" && <SimulatorView {...{ settings, updateSettings }} />}
          {active === "Scheduler" && <SchedulerView {...{ settings, updateSettings, result }} />}
          {active === "Cooling & ROI" && <CoolingView {...{ settings, updateSettings, result, selectedCooling }} />}
          {active === "Stress Test" && <StressView {...{ settings, updateSettings, simulatedJobs, setSimulatedJobs }} />}
          {active === "Data & City" && <DataView {...{ settings, updateHour, updateSettings }} />}
          {active === "Report" && <ReportView {...{ result, exportReport, settings }} />}
          {active === "Assumptions" && <AssumptionsView />}
          <footer className="mt-10 flex flex-col justify-between gap-2 border-t border-border py-4 text-[11px] text-muted-foreground sm:flex-row sm:items-center">
            <span>JalWatt · deterministic workload simulation · {settings.city}</span>
            <span>All values are modelled estimates, not operational telemetry.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function DashboardView({ settings, result, selectedCooling, chooseSection }: {
  settings: ReturnType<typeof useSettings>["settings"];
  result: ReturnType<typeof useSettings>["result"];
  selectedCooling: ReturnType<typeof useSettings>["settings"]["cooling"][CoolingPreset];
  chooseSection: (section: Section) => void;
}) {
  const [comparison, setComparison] = useState<"baseline" | "jalwatt">("jalwatt");
  const baseline = result.baseline;
  const optimized = result.jalwatt;
  const current = comparison === "baseline" ? baseline : optimized;
  const waterSaved = baseline.waterL - optimized.waterL;
  const baselineCooling = settings.cooling.evaporative;
  const householdLine = result.hourlyProfile.map((hour) => {
    const hourWaterSaved = (hour.baselineKWh / baselineCooling.pue) * baselineCooling.wue -
      (hour.jalwattKWh / selectedCooling.pue) * selectedCooling.wue;
    return { hour: hour.hour, households: toHouseholdDailyWaterEquivalents(hourWaterSaved) };
  }).reduce<{ hour: number; households: number }[]>((points, point) => {
    const prior = points[points.length - 1]?.households ?? 0;
    points.push({ hour: point.hour, households: prior + point.households });
    return points;
  }, []);
  const savingsPercent = (base: number, optimizedValue: number) => base > 0 ? ((base - optimizedValue) / base) * 100 : 0;
  const averageWatts = (itKWh: number) => settings.jobsPerDay > 0 ? (itKWh * 1000) / settings.jobsPerDay : 0;
  const metrics = [
    { label: "Energy", value: current.facilityKWh.toFixed(1), unit: "kWh / day", savings: savingsPercent(baseline.facilityKWh, optimized.facilityKWh), icon: Zap, tone: "text-primary" },
    { label: "Water", value: current.waterL.toFixed(1), unit: "litres / day", savings: savingsPercent(baseline.waterL, optimized.waterL), icon: Droplets, tone: "text-chart-2" },
    { label: "CO₂", value: current.co2Kg.toFixed(1), unit: "kg / day", savings: savingsPercent(baseline.co2Kg, optimized.co2Kg), icon: Leaf, tone: "text-chart-3" },
    { label: "Cost", value: money(current.costINR), unit: "INR / day", savings: savingsPercent(baseline.costINR, optimized.costINR), icon: BatteryCharging, tone: "text-chart-4" },
    { label: "Watts per task", value: averageWatts(current.itKWh).toFixed(2), unit: "W / task", savings: savingsPercent(averageWatts(baseline.itKWh), averageWatts(optimized.itKWh)), icon: Cpu, tone: "text-chart-5" },
    { label: "SLA violations", value: current.slaViolations.toLocaleString("en-IN"), unit: "per day", savings: savingsPercent(baseline.slaViolations, optimized.slaViolations), icon: ShieldCheck, tone: "text-primary" },
  ];
  const totalHouseholds = toHouseholdDailyWaterEquivalents(waterSaved);

  return <>
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary"><span className="size-1.5 rounded-full bg-primary" /> Daily scenario · {settings.city}</div><h2 className="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">Operational overview</h2><p className="mt-1 text-sm text-muted-foreground">Daily resource use and schedule impact for agentic AI compute.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Compare scenario" className="inline-flex border border-border bg-card p-1">
          <Button variant={comparison === "baseline" ? "secondary" : "ghost"} size="sm" aria-pressed={comparison === "baseline"} onClick={() => setComparison("baseline")} className="h-8 rounded-sm px-3 text-xs">Baseline</Button>
          <Button variant={comparison === "jalwatt" ? "secondary" : "ghost"} size="sm" aria-pressed={comparison === "jalwatt"} onClick={() => setComparison("jalwatt")} className="h-8 rounded-sm px-3 text-xs">JalWatt</Button>
        </div>
        <span className="border border-border bg-card px-3 py-2 font-mono text-xs text-muted-foreground">{settings.jobsPerDay.toLocaleString("en-IN")} jobs / day</span>
      </div>
    </div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {metrics.map(({ label, value, unit, savings, icon, tone }) => <Metric key={label} label={label} value={value} unit={unit} savingsPct={savings} icon={icon} tone={tone} />)}
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
      <section className="border border-border bg-card p-4 sm:p-5" aria-label="Grouped hourly facility energy comparison">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-semibold">Hourly facility energy</div><div className="mt-1 text-xs text-muted-foreground">Baseline vs JalWatt · grouped kWh by hour</div></div><div className="flex gap-4 text-[11px]"><span className="flex items-center gap-2 text-muted-foreground"><i className="size-2 bg-chart-2" />Baseline</span><span className="flex items-center gap-2 text-primary"><i className="size-2 bg-primary" />JalWatt</span></div></div>
        <div className="mt-5 h-[270px] w-full">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={result.hourlyProfile} margin={{ top: 8, right: 8, left: -15, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="hour" tickFormatter={(hour) => `${String(hour).padStart(2, "0")}`} tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={11} interval={2} />
            <YAxis tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={11} width={48} />
            <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: "4px", color: "var(--color-foreground)" }} labelFormatter={(hour) => `${String(hour).padStart(2, "0")}:00`} formatter={(value, name) => [`${Number(value).toFixed(3)} kWh`, name === "baselineKWh" ? "Baseline" : "JalWatt"]} />
            <Bar dataKey="baselineKWh" name="Baseline" fill="var(--color-chart-2)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="jalwattKWh" name="JalWatt" fill="var(--color-chart-1)" radius={[2, 2, 0, 0]} />
          </BarChart></ResponsiveContainer>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground"><span>24-hour forecast</span><span className="font-mono text-foreground">{settings.deadlineHours}h flexible window</span></div>
      </section>
      <section className="border border-border bg-card p-4 sm:p-5" aria-label="Household water equivalence">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-semibold">Water saved, in households</div><div className="mt-1 text-xs text-muted-foreground">Cumulative daily water savings</div></div><div className="font-mono text-lg tabular-nums text-primary">{totalHouseholds.toFixed(2)} <span className="text-xs font-sans text-muted-foreground">households</span></div></div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground"><span>Equivalent to daily water use · 135 L/person/day</span><AssumptionTag /><span>4 people/household</span><AssumptionTag /></div>
        <div className="mt-5 h-[235px] w-full">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={householdLine} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="hour" tickFormatter={(hour) => `${String(hour).padStart(2, "0")}`} tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={11} interval={3} />
            <YAxis tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={11} width={48} />
            <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: "4px", color: "var(--color-foreground)" }} labelFormatter={(hour) => `${String(hour).padStart(2, "0")}:00`} formatter={(value) => [`${Number(value).toFixed(3)} households`, "Daily water equivalent"]} />
            <Line type="monotone" dataKey="households" name="Households" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart></ResponsiveContainer>
        </div>
        <div className="border-t border-border pt-3 text-[11px] leading-5 text-muted-foreground">Equivalent to {totalHouseholds.toFixed(2)} households’ daily water use.</div>
      </section>
      <section className="border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between"><div><div className="text-sm font-semibold">Scenario health</div><div className="mt-1 text-xs text-muted-foreground">Current operating profile</div></div><ShieldCheck className="size-4 text-primary" /></div>
        <div className="mt-5 grid gap-0 divide-y divide-border">
          <div className="flex items-center justify-between py-3"><span className="flex items-center gap-2 text-xs text-muted-foreground"><Cpu className="size-3.5" /> IT energy</span><span className="font-mono text-sm">{energy(result.jalwatt.itKWh)}</span></div>
          <div className="flex items-center justify-between py-3"><span className="flex items-center gap-2 text-xs text-muted-foreground"><Thermometer className="size-3.5" /> Cooling profile</span><span className="font-mono text-sm capitalize">{settings.selectedCooling} · {selectedCooling.pue.toFixed(2)} PUE</span></div>
          <div className="flex items-center justify-between py-3"><span className="flex items-center gap-2 text-xs text-muted-foreground"><Cloud className="size-3.5" /> CO₂ intensity</span><span className="font-mono text-sm">0.70 kg / kWh</span></div>
          <div className="flex items-center justify-between py-3"><span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" /> SLA violations</span><span className="inline-flex items-center gap-1.5 font-mono text-sm text-primary"><span className="size-1.5 rounded-full bg-primary" />{result.jalwatt.slaViolations}</span></div>
        </div>
        <div className="mt-4 border border-primary/20 bg-primary/5 p-3"><div className="text-xs font-medium text-primary">Efficiency signal</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Right-sizing, workload timing and {settings.selectedCooling} cooling reduce facility load together.</p></div>
      </section>
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <section className="border border-border bg-card p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold">Decision log</div><div className="mt-1 text-xs text-muted-foreground">Why JalWatt made these choices</div></div><Button variant="ghost" size="sm" onClick={() => chooseSection("Scheduler")} className="text-xs text-primary">Scheduler <ArrowRight className="size-3.5" /></Button></div>
        <div className="mt-3 divide-y divide-border">{result.decisionLog.slice(0, 4).map((item) => <div key={item.jobGroup} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><div className="text-xs font-medium">{item.jobGroup}</div><div className="mt-1 text-xs leading-5 text-muted-foreground">{item.reason}</div></div><div className="text-right text-[11px] text-primary">{item.action}<div className="mt-1 font-mono text-muted-foreground">{money(item.savedINR)} est.</div></div></div>)}</div>
      </section>
      <section className="border border-border bg-card p-4 sm:p-5"><div className="text-sm font-semibold">Workload mix</div><div className="mt-1 text-xs text-muted-foreground">Task volume routed by model tier</div>
        <div className="mt-6 flex h-3 overflow-hidden bg-secondary"><div className="h-full bg-primary" style={{ width: `${settings.mix.easy}%` }} /><div className="h-full bg-chart-2" style={{ width: `${settings.mix.medium}%` }} /><div className="h-full bg-chart-3" style={{ width: `${settings.mix.hard}%` }} /></div>
        <div className="mt-5 grid grid-cols-3 gap-2">{[{ name: "Easy", value: settings.mix.easy, color: "bg-primary", model: "Small" }, { name: "Medium", value: settings.mix.medium, color: "bg-chart-2", model: "Medium" }, { name: "Hard", value: settings.mix.hard, color: "bg-chart-3", model: "Large" }].map((item) => <div key={item.name}><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><i className={`size-2 ${item.color}`} />{item.name}</div><div className="mt-1 font-mono text-lg">{item.value}%</div><div className="text-[10px] text-muted-foreground">{item.model} model</div></div>)}</div>
        <Button variant="outline" onClick={() => chooseSection("Simulator")} className="mt-6 w-full"><SlidersHorizontal className="size-4" /> Adjust workload mix</Button>
      </section>
    </div>
  </>;
}

function SimulatorView({ settings, updateSettings }: { settings: ReturnType<typeof useSettings>["settings"]; updateSettings: ReturnType<typeof useSettings>["updateSettings"] }) {
  return <><PanelHeading eyebrow="Scenario controls" title="Workload simulator" description="Tune your daily workload and model routing assumptions." />
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="border border-border bg-card p-5"><div className="mb-5 text-sm font-semibold">Workload profile</div><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Jobs per day" value={settings.jobsPerDay} suffix="tasks" max={1000000} onChange={(jobsPerDay) => updateSettings({ jobsPerDay })} /><NumberField label="Easy task share" value={settings.mix.easy} suffix="%" max={100} onChange={(easy) => updateSettings({ mix: { ...settings.mix, easy } })} /><NumberField label="Medium task share" value={settings.mix.medium} suffix="%" max={100} onChange={(medium) => updateSettings({ mix: { ...settings.mix, medium } })} /><NumberField label="Hard task share" value={settings.mix.hard} suffix="%" max={100} onChange={(hard) => updateSettings({ mix: { ...settings.mix, hard } })} /></div><p className="mt-4 text-xs text-muted-foreground">Mix total: {settings.mix.easy + settings.mix.medium + settings.mix.hard}% · Shares are normalized by the simulator.</p></section>
      <section className="border border-border bg-card p-5"><div className="mb-5 text-sm font-semibold">Scheduling constraints</div><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Deferrable jobs" value={settings.deferrablePct} suffix="%" max={100} onChange={(deferrablePct) => updateSettings({ deferrablePct })} /><NumberField label="Privacy-pinned jobs" value={settings.privacyPinnedPct} suffix="%" max={100} onChange={(privacyPinnedPct) => updateSettings({ privacyPinnedPct })} /><NumberField label="Maximum delay" value={settings.deadlineHours} suffix="hours" max={23} onChange={(deadlineHours) => updateSettings({ deadlineHours })} /><NumberField label="Random seed" value={settings.seed} suffix="seed" max={2147483647} onChange={(seed) => updateSettings({ seed })} /></div><div className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">Pinned jobs run locally at arrival. Urgent jobs are never delayed.</div></section>
      <section className="border border-border bg-card p-5"><div className="mb-5 text-sm font-semibold">Task energy · Wh per task</div><div className="grid gap-4 sm:grid-cols-3"><NumberField label="Small model" value={settings.energyWh.small} suffix="Wh" step={0.1} onChange={(small) => updateSettings({ energyWh: { ...settings.energyWh, small } })} /><NumberField label="Medium model" value={settings.energyWh.medium} suffix="Wh" step={0.1} onChange={(medium) => updateSettings({ energyWh: { ...settings.energyWh, medium } })} /><NumberField label="Large model" value={settings.energyWh.large} suffix="Wh" step={0.1} onChange={(large) => updateSettings({ energyWh: { ...settings.energyWh, large } })} /></div></section>
      <section className="border border-border bg-card p-5"><div className="mb-5 text-sm font-semibold">Compute capacity</div><div className="grid gap-4 sm:grid-cols-2"><NumberField label="Room capacity" value={settings.roomKW} suffix="kW" step={5} onChange={(roomKW) => updateSettings({ roomKW })} /><NumberField label="Rack capacity" value={settings.rackKW} suffix="kW" step={5} onChange={(rackKW) => updateSettings({ rackKW })} /></div><div className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">Capacity assumptions are included for planning; utilization limits are not enforced in this model.</div></section>
    </div>
  </>;
}

function SchedulerView({ settings, updateSettings, result }: { settings: ReturnType<typeof useSettings>["settings"]; updateSettings: ReturnType<typeof useSettings>["updateSettings"]; result: ReturnType<typeof useSettings>["result"] }) {
  return <><PanelHeading eyebrow="Queue policy" title="Flexible workload scheduler" description="Move eligible work into favorable windows without delaying urgent or privacy-sensitive tasks." />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="border border-border bg-card p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-semibold">24-hour operating window</div><div className="mt-1 text-xs text-muted-foreground">Hourly tariff, temperature and planned facility energy</div></div><div className="font-mono text-xs text-primary">{settings.deadlineHours}h maximum delay</div></div>
        <div className="mt-5 grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-12 xl:grid-cols-12">{result.hourlyProfile.map((hour) => <div key={hour.hour} className="min-w-0 border border-border bg-background p-2 text-center"><div className="text-[10px] text-muted-foreground">{String(hour.hour).padStart(2, "0")}</div><div className="mt-3 flex h-20 items-end justify-center"><div className="w-full bg-primary/70" style={{ height: `${Math.max(8, Math.min(100, hour.jalwattKWh / Math.max(0.001, ...result.hourlyProfile.map((item) => item.jalwattKWh)) * 100))}%` }} /></div><div className="mt-2 font-mono text-[10px]">₹{hour.tariffINR.toFixed(1)}</div><div className="mt-1 text-[9px] text-muted-foreground">{hour.ambientTempC}°</div></div>)}</div>
        <div className="mt-5 flex flex-wrap gap-4 text-[11px] text-muted-foreground"><span className="flex items-center gap-2"><i className="size-2 bg-primary/70" />Planned facility load</span><span>₹ / kWh · tariff</span><span>°C · ambient</span></div>
      </section>
      <section className="border border-border bg-card p-5"><div className="text-sm font-semibold">Policy settings</div><div className="mt-5 grid gap-4"><NumberField label="Flexible work share" value={settings.deferrablePct} suffix="%" max={100} onChange={(deferrablePct) => updateSettings({ deferrablePct })} /><NumberField label="Privacy-pinned share" value={settings.privacyPinnedPct} suffix="%" max={100} onChange={(privacyPinnedPct) => updateSettings({ privacyPinnedPct })} /><NumberField label="Deadline window" value={settings.deadlineHours} suffix="hours" max={23} onChange={(deadlineHours) => updateSettings({ deadlineHours })} /></div><div className="mt-5 border-t border-border pt-4"><div className="text-xs font-medium text-primary">Active guarantees</div><div className="mt-3 grid gap-2 text-xs text-muted-foreground"><div className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-primary" />Privacy-pinned work stays local</div><div className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-primary" />Urgent work runs at arrival</div><div className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-primary" />SLA violations: {result.jalwatt.slaViolations}</div></div></div></section>
    </div>
    <section className="mt-5 border border-border bg-card p-5"><div className="text-sm font-semibold">Scheduler decisions</div><div className="mt-3 divide-y divide-border">{result.decisionLog.filter((item) => item.jobGroup.includes("workload")).map((item) => <div key={item.jobGroup} className="flex flex-wrap justify-between gap-3 py-3"><div><div className="text-xs font-medium">{item.jobGroup}</div><div className="mt-1 text-xs text-muted-foreground">{item.reason}</div></div><div className="text-xs text-primary">{item.action}</div></div>)}</div></section>
  </>;
}

function CoolingView({ settings, updateSettings, result, selectedCooling }: { settings: ReturnType<typeof useSettings>["settings"]; updateSettings: ReturnType<typeof useSettings>["updateSettings"]; result: ReturnType<typeof useSettings>["result"]; selectedCooling: ReturnType<typeof useSettings>["settings"]["cooling"][CoolingPreset] }) {
  const options: { id: CoolingPreset; name: string; detail: string }[] = [{ id: "evaporative", name: "Evaporative", detail: "Higher water use · baseline" }, { id: "liquid", name: "Liquid cooling", detail: "Low water · high efficiency" }, { id: "dry", name: "Dry cooling", detail: "Zero process water" }];
  return <><PanelHeading eyebrow="Cooling strategy" title="Cooling & resource impact" description="Compare water use, facility energy and carbon under alternative cooling approaches." />
    <div className="grid gap-4 md:grid-cols-3">{options.map((option) => { const profile = settings.cooling[option.id]; const facility = result.jalwatt.itKWh * profile.pue; const water = result.jalwatt.itKWh * profile.wue; return <button key={option.id} onClick={() => updateSettings({ selectedCooling: option.id })} className={`min-h-44 border p-5 text-left transition-colors ${settings.selectedCooling === option.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/40"}`}><div className="flex items-start justify-between"><div className="text-sm font-semibold">{option.name}</div>{settings.selectedCooling === option.id && <span className="size-2 rounded-full bg-primary" />}</div><div className="mt-1 text-xs text-muted-foreground">{option.detail}</div><div className="mt-6 grid grid-cols-2 gap-3"><div><div className="text-[10px] text-muted-foreground">PUE</div><div className="mt-1 font-mono text-xl">{profile.pue.toFixed(2)}</div></div><div><div className="text-[10px] text-muted-foreground">WUE</div><div className="mt-1 font-mono text-xl">{profile.wue.toFixed(2)}<span className="ml-1 text-xs">L/kWh</span></div></div><div><div className="text-[10px] text-muted-foreground">Facility energy</div><div className="mt-1 font-mono text-sm">{facility.toFixed(2)} kWh</div></div><div><div className="text-[10px] text-muted-foreground">Water</div><div className="mt-1 font-mono text-sm">{water.toFixed(2)} L</div></div></div></button>; })}</div>
    <div className="mt-5 grid gap-5 xl:grid-cols-2"><section className="border border-border bg-card p-5"><div className="text-sm font-semibold">Selected strategy · {settings.selectedCooling}</div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="border border-border p-3"><div className="text-[10px] text-muted-foreground">Facility energy</div><div className="mt-2 font-mono text-lg">{result.jalwatt.facilityKWh.toFixed(2)}</div><div className="text-[10px] text-muted-foreground">kWh / day</div></div><div className="border border-border p-3"><div className="text-[10px] text-muted-foreground">Water use</div><div className="mt-2 font-mono text-lg">{result.jalwatt.waterL.toFixed(2)}</div><div className="text-[10px] text-muted-foreground">L / day</div></div><div className="border border-border p-3"><div className="text-[10px] text-muted-foreground">Carbon</div><div className="mt-2 font-mono text-lg">{result.jalwatt.co2Kg.toFixed(2)}</div><div className="text-[10px] text-muted-foreground">kg CO₂ / day</div></div><div className="border border-border p-3"><div className="text-[10px] text-muted-foreground">Energy cost</div><div className="mt-2 font-mono text-lg">{money(result.jalwatt.costINR)}</div><div className="text-[10px] text-muted-foreground">INR / day</div></div></div></section><section className="border border-border bg-card p-5"><div className="text-sm font-semibold">Indicative annual impact</div><div className="mt-1 text-xs text-muted-foreground">Daily scenario × 365 days</div><div className="mt-5 grid grid-cols-2 gap-4"><div><div className="text-xs text-muted-foreground">Water avoided</div><div className="mt-1 font-mono text-2xl text-primary">{Math.max(0, (result.baseline.waterL - result.jalwatt.waterL) * 365).toLocaleString("en-IN", { maximumFractionDigits: 0 })}<span className="ml-1 text-xs">L</span></div></div><div><div className="text-xs text-muted-foreground">Cost avoided</div><div className="mt-1 font-mono text-2xl text-primary">{money(Math.max(0, (result.baseline.costINR - result.jalwatt.costINR) * 365))}</div></div></div><div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><Droplets className="size-4 text-chart-2" />Cooling water: {selectedCooling.wue.toFixed(2)} L per IT kWh</div></section></div>
  </>;
}

function StressView({ settings, updateSettings, simulatedJobs, setSimulatedJobs }: { settings: ReturnType<typeof useSettings>["settings"]; updateSettings: ReturnType<typeof useSettings>["updateSettings"]; simulatedJobs: number | null; setSimulatedJobs: (jobs: number | null) => void }) {
  const levels = [5000, 10000, 25000, 50000, 100000];
  const run = (jobs: number) => { updateSettings({ jobsPerDay: jobs }); setSimulatedJobs(jobs); };
  return <><PanelHeading eyebrow="Capacity planning" title="Stress test" description="Scale task volume to understand resource growth under the current workload mix." />
    <section className="border border-border bg-card p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="text-sm font-semibold">Workload scale</div><div className="mt-1 text-xs text-muted-foreground">Select a daily job volume to recalculate the scenario.</div></div><div className="flex items-center gap-2"><Input aria-label="Custom job volume" type="number" value={simulatedJobs ?? settings.jobsPerDay} min={0} max={1000000} onChange={(event) => setSimulatedJobs(Number(event.target.value))} className="w-36 font-mono" /><Button onClick={() => updateSettings({ jobsPerDay: simulatedJobs ?? settings.jobsPerDay })}><Play className="size-4" />Run scenario</Button></div></div><div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">{levels.map((jobs) => <Button key={jobs} variant={settings.jobsPerDay === jobs ? "default" : "outline"} onClick={() => run(jobs)} className="font-mono">{formatCompact(jobs)} / day</Button>)}</div></section>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Facility energy", value: `${(settings.jobsPerDay ? settings.jobsPerDay / 5000 : 0 * 1).toFixed(1)}× scaling`, unit: "relative to default" }, { label: "Room capacity", value: `${settings.roomKW}`, unit: "kW configured" }, { label: "Rack capacity", value: `${settings.rackKW}`, unit: "kW configured" }, { label: "SLA violations", value: "0", unit: "guaranteed in model" }].map((item) => <div key={item.label} className="border border-border bg-card p-4"><div className="text-xs text-muted-foreground">{item.label}</div><div className="mt-3 font-mono text-2xl">{item.value}</div><div className="mt-1 text-[10px] text-muted-foreground">{item.unit}</div></div>)}</div>
    <div className="mt-5 border border-border bg-card p-5"><div className="text-sm font-semibold">Model boundary</div><p className="mt-2 max-w-3xl text-xs leading-6 text-muted-foreground">Room and rack capacity are recorded as scenario assumptions, but the supplied model does not define a capacity threshold or queue-overflow rule. This stress test reports resource scaling without inventing overload or SLA behavior.</p></div>
  </>;
}

function DataView({ settings, updateHour, updateSettings }: { settings: ReturnType<typeof useSettings>["settings"]; updateHour: ReturnType<typeof useSettings>["updateHour"]; updateSettings: ReturnType<typeof useSettings>["updateSettings"] }) {
  return <><PanelHeading eyebrow="Local parameters" title="Data & city profile" description="Adjust the hourly assumptions used for scheduling, cost and emissions." />
    <div className="mb-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_260px]"><section className="border border-border bg-card p-5"><label className="grid max-w-sm gap-2 text-sm text-muted-foreground">City profile<Select value={settings.city} onValueChange={(city) => updateSettings({ city })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Bangalore">Bangalore</SelectItem><SelectItem value="Chennai">Chennai</SelectItem><SelectItem value="Mumbai">Mumbai</SelectItem><SelectItem value="Hyderabad">Hyderabad</SelectItem></SelectContent></Select></label><div className="mt-4 text-xs text-muted-foreground">Hourly values are editable local scenario inputs. Changing the city label does not automatically replace Bangalore’s supplied data.</div></section><div className="border border-border bg-card p-5"><div className="text-xs text-muted-foreground">Active city</div><div className="mt-2 text-xl font-semibold">{settings.city}</div><div className="mt-1 text-xs text-primary">India · local profile</div></div></div>
    <section className="border border-border bg-card p-4 sm:p-5"><div className="flex flex-wrap justify-between gap-3"><div><div className="text-sm font-semibold">Hourly inputs · 24 values</div><div className="mt-1 text-xs text-muted-foreground">Edit values in place. Updates recalculate immediately.</div></div><div className="flex items-center gap-2 text-[10px] text-muted-foreground"><span>Temperature °C</span><span>Tariff ₹/kWh</span></div></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead><tr className="border-b border-border text-muted-foreground"><th className="pb-3 font-medium">Hour</th><th className="pb-3 font-medium">Ambient temperature °C</th><th className="pb-3 font-medium">Tariff INR / kWh</th><th className="pb-3 font-medium">Grid CO₂ kg / kWh</th></tr></thead><tbody>{settings.ambientTempC.map((temperature, hour) => <tr key={hour} className="border-b border-border/60"><td className="py-1.5 font-mono text-muted-foreground">{String(hour).padStart(2, "0")}:00</td><td className="py-1.5"><Input aria-label={`Temperature hour ${hour}`} type="number" step="0.1" value={temperature} onChange={(event) => updateHour("ambientTempC", hour, Number(event.target.value))} className="h-8 w-32 font-mono" /></td><td className="py-1.5"><Input aria-label={`Tariff hour ${hour}`} type="number" step="0.1" value={settings.tariffINR[hour]} onChange={(event) => updateHour("tariffINR", hour, Number(event.target.value))} className="h-8 w-32 font-mono" /></td><td className="py-1.5"><Input aria-label={`Grid carbon hour ${hour}`} type="number" step="0.01" value={settings.gridCO2KgPerKWh[hour]} onChange={(event) => updateHour("gridCO2KgPerKWh", hour, Number(event.target.value))} className="h-8 w-32 font-mono" /></td></tr>)}</tbody></table></div>
    </section>
  </>;
}

function ReportView({ result, exportReport, settings }: { result: ReturnType<typeof useSettings>["result"]; exportReport: () => void; settings: ReturnType<typeof useSettings>["settings"] }) {
  return <><PanelHeading eyebrow="Scenario export" title="Simulation report" description="Compare modeled daily resource use and download the current run." />
    <section className="border border-border bg-card p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="text-sm font-semibold">{settings.city} · {settings.jobsPerDay.toLocaleString("en-IN")} jobs / day</div><div className="mt-1 text-xs text-muted-foreground">Seed {settings.seed} · {settings.selectedCooling} cooling</div></div><Button onClick={exportReport}><Download className="size-4" />Download CSV</Button></div>
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="pb-3 font-medium">Resource</th><th className="pb-3 text-right font-medium">Baseline</th><th className="pb-3 text-right font-medium">JalWatt</th><th className="pb-3 text-right font-medium">Change</th></tr></thead><tbody>{[{ label: "IT energy", baseline: result.baseline.itKWh, jalwatt: result.jalwatt.itKWh, unit: "kWh" }, { label: "Facility energy", baseline: result.baseline.facilityKWh, jalwatt: result.jalwatt.facilityKWh, unit: "kWh" }, { label: "Water use", baseline: result.baseline.waterL, jalwatt: result.jalwatt.waterL, unit: "L" }, { label: "Carbon emissions", baseline: result.baseline.co2Kg, jalwatt: result.jalwatt.co2Kg, unit: "kg CO₂" }, { label: "Energy cost", baseline: result.baseline.costINR, jalwatt: result.jalwatt.costINR, unit: "INR" }].map((item) => <tr key={item.label} className="border-b border-border/60"><td className="py-4">{item.label}</td><td className="py-4 text-right font-mono text-muted-foreground">{item.baseline.toFixed(2)} <span className="text-[10px]">{item.unit}</span></td><td className="py-4 text-right font-mono">{item.jalwatt.toFixed(2)} <span className="text-[10px] text-muted-foreground">{item.unit}</span></td><td className="py-4 text-right font-mono text-primary">{item.baseline > 0 ? ((item.baseline - item.jalwatt) / item.baseline * 100).toFixed(1) : "0.0"}%</td></tr>)}</tbody></table></div>
      <div className="mt-5 flex flex-wrap gap-6 border-t border-border pt-4 text-xs"><span className="text-muted-foreground">Facility energy savings <strong className="ml-1 font-mono text-primary">{result.savingsPct.toFixed(2)}%</strong></span><span className="text-muted-foreground">SLA violations <strong className="ml-1 font-mono text-primary">{result.jalwatt.slaViolations}</strong></span></div>
    </section>
    <section className="mt-5 border border-border bg-card p-5"><div className="text-sm font-semibold">Decision trace</div><div className="mt-3 divide-y divide-border">{result.decisionLog.map((item) => <div key={item.jobGroup} className="grid gap-2 py-3 sm:grid-cols-[180px_1fr_160px]"><span className="text-xs font-medium">{item.jobGroup}</span><span className="text-xs text-muted-foreground">{item.reason}</span><span className="text-xs text-primary sm:text-right">{item.action}</span></div>)}</div></section>
  </>;
}

function AssumptionsView() {
  const rows = [
    ["Work volume", "5,000 tasks per day; mix is sampled from 50% easy, 30% medium, 20% hard."],
    ["Task energy", "Small 0.3 Wh; medium 1.5 Wh; large 6 Wh per task."],
    ["Classification", "Privacy-pinned work stays local and runs at arrival; deferrable work uses the configured share; remaining jobs are urgent."],
    ["Scheduling", "Flexible tasks choose the lowest combined score (tariff + 0.08 × ambient temperature) from arrival through the deadline window."],
    ["Cooling", "Baseline uses evaporative cooling (PUE 1.5, WUE 1.8); JalWatt uses the selected cooling preset."],
    ["Resource formulas", "Facility kWh = IT kWh × PUE. Water L = IT kWh × WUE. CO₂ = facility kWh × hourly grid factor. Cost = hourly facility kWh × tariff."],
    ["Reproducibility", "A seeded pseudo-random generator assigns task tiers, arrival hours and scheduling tie-breaks."],
    ["Capacity", "Room and rack kW are retained as planning inputs; no capacity exceedance or queueing behavior is modeled."],
    ["SLA", "All jobs complete within their allowed window; the simulation reports zero SLA violations."],
  ];
  return <><PanelHeading eyebrow="Model documentation" title="Assumptions & methodology" description="The rules and boundaries behind every estimate." /><section className="max-w-4xl border border-border bg-card px-5"><div className="divide-y divide-border">{rows.map(([title, detail]) => <div key={title} className="grid gap-2 py-4 sm:grid-cols-[180px_1fr]"><div className="text-xs font-semibold">{title}</div><p className="text-xs leading-5 text-muted-foreground">{detail}</p></div>)}</div></section><div className="mt-5 max-w-4xl border border-chart-3/30 bg-chart-3/5 p-4 text-xs leading-5 text-muted-foreground"><span className="font-medium text-chart-3">Important:</span> Model estimates are illustrative and do not represent measured facility performance or guaranteed utility savings.</div></>;
}
