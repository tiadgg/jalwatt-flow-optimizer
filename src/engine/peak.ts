import type { JalWattSettings, SimulationResult } from "./types";

/** Peak-load stress test constants. Planning assumptions, not measured hardware limits. */
export const PEAK_TEST = {
  durationHours: 4,
  loadMultiplier: 2,
  stepsPerHour: 4,
  /** Cooling capacity provisioned per rack, as a multiple of rack max kW. */
  coolingDesignMargin: 1.25,
  /** Cooling capacity lost per °C of ambient above `derateAboveC`, in %. */
  deratePctPerC: 1,
  derateAboveC: 35,
  /** Effective PUE rises by this fraction per °C above `pueRiseAboveC`. */
  pueRisePerC: 0.005,
  pueRiseAboveC: 25,
  /** Below this thermal headroom the rack throttles. */
  throttleBelowHeadroomPct: 5,
  /** Minimum headroom required to PASS. */
  passMinHeadroomPct: 10,
} as const;

export interface PeakStep {
  label: string;
  hour: number;
  ambientC: number;
  jobs: number;
  itKW: number;
  coolingCapacityKW: number;
  headroomPct: number;
  jalwattWattsPerTask: number;
  baselineWattsPerTask: number;
  throttled: boolean;
  crashed: boolean;
  overflowJobs: number;
}

export interface PeakCriterion {
  label: string;
  target: string;
  value: string;
  met: boolean;
}

export interface PeakLoadResult {
  startHour: number;
  steps: PeakStep[];
  serverCrashes: number;
  slaViolations: number;
  throttlingEvents: number;
  minHeadroomPct: number;
  peakJobsPerHour: number;
  criteria: PeakCriterion[];
  pass: boolean;
}

/** Start hour of the hottest consecutive window (no wrap past midnight). */
export function findPeakWindow(ambientC: number[], hours: number = PEAK_TEST.durationHours): number {
  let bestStart = 0;
  let bestSum = Number.NEGATIVE_INFINITY;
  for (let start = 0; start <= 24 - hours; start += 1) {
    let sum = 0;
    for (let offset = 0; offset < hours; offset += 1) sum += ambientC[start + offset] ?? 0;
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = start;
    }
  }
  return bestStart;
}

export function runPeakLoad(settings: JalWattSettings, result: SimulationResult): PeakLoadResult {
  const startHour = findPeakWindow(settings.ambientTempC);
  const totalJobs = Math.max(1, result.guarantees.totalJobs);
  const jalwattItWh = (result.jalwatt.itKWh * 1000) / totalJobs;
  const baselineItWh = (result.baseline.itKWh * 1000) / totalJobs;
  const pue = settings.cooling[settings.selectedCooling].pue;
  const baselinePue = settings.cooling.evaporative.pue;
  const rackKW = Math.max(0, settings.rackKW);
  const steps: PeakStep[] = [];
  const stepCount = PEAK_TEST.durationHours * PEAK_TEST.stepsPerHour;
  let peakJobsPerHour = 0;

  for (let index = 0; index < stepCount; index += 1) {
    const hour = startHour + Math.floor(index / PEAK_TEST.stepsPerHour);
    const fraction = (index % PEAK_TEST.stepsPerHour) / PEAK_TEST.stepsPerHour;
    const now = settings.ambientTempC[hour] ?? 0;
    const next = settings.ambientTempC[Math.min(23, hour + 1)] ?? now;
    const ambientC = now + (next - now) * fraction;
    const jobsPerHour = (result.hourlyProfile[hour]?.baselineJobs ?? 0) * PEAK_TEST.loadMultiplier;
    peakJobsPerHour = Math.max(peakJobsPerHour, jobsPerHour);
    const jobs = jobsPerHour / PEAK_TEST.stepsPerHour;
    const derate = 1 - (PEAK_TEST.deratePctPerC / 100) * Math.max(0, ambientC - PEAK_TEST.derateAboveC);
    const coolingCapacityKW = rackKW * PEAK_TEST.coolingDesignMargin * Math.max(0, derate);
    const headroomPct = coolingCapacityKW > 0 ? ((coolingCapacityKW - rackKW) / coolingCapacityKW) * 100 : 0;
    const pueFactor = 1 + PEAK_TEST.pueRisePerC * Math.max(0, ambientC - PEAK_TEST.pueRiseAboveC);
    // Energy the rack can deliver in one step at max kW, divided by per-job IT energy.
    const capacityJobs = jalwattItWh > 0 ? (rackKW * 1000) / PEAK_TEST.stepsPerHour / jalwattItWh : Number.POSITIVE_INFINITY;
    const minute = (index % PEAK_TEST.stepsPerHour) * (60 / PEAK_TEST.stepsPerHour);
    steps.push({
      label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      hour,
      ambientC,
      jobs,
      itKW: rackKW,
      coolingCapacityKW,
      headroomPct,
      jalwattWattsPerTask: jalwattItWh * pue * pueFactor,
      baselineWattsPerTask: baselineItWh * baselinePue * pueFactor,
      throttled: headroomPct < PEAK_TEST.throttleBelowHeadroomPct,
      crashed: headroomPct < 0,
      overflowJobs: Math.max(0, Math.ceil(jobs - capacityJobs)),
    });
  }

  const serverCrashes = steps.filter((step) => step.crashed).length;
  const throttlingEvents = steps.filter((step) => step.throttled).length;
  const slaViolations = steps.reduce((sum, step) => sum + step.overflowJobs, 0) + result.jalwatt.slaViolations;
  const minHeadroomPct = steps.reduce((min, step) => Math.min(min, step.headroomPct), Number.POSITIVE_INFINITY);
  const criteria: PeakCriterion[] = [
    { label: "Server crashes", target: "= 0", value: String(serverCrashes), met: serverCrashes === 0 },
    { label: "SLA violations", target: "= 0", value: String(slaViolations), met: slaViolations === 0 },
    { label: "Throttling events", target: "= 0", value: String(throttlingEvents), met: throttlingEvents === 0 },
    {
      label: "Minimum thermal headroom",
      target: `≥ ${PEAK_TEST.passMinHeadroomPct}%`,
      value: `${minHeadroomPct.toFixed(1)}%`,
      met: minHeadroomPct >= PEAK_TEST.passMinHeadroomPct,
    },
  ];
  return {
    startHour,
    steps,
    serverCrashes,
    slaViolations,
    throttlingEvents,
    minHeadroomPct,
    peakJobsPerHour,
    criteria,
    pass: criteria.every((criterion) => criterion.met),
  };
}
