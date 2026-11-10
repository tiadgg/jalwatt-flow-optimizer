import type { JalWattSettings, SimulationResult } from "./types";

/** Problem-statement success targets. */
export const JUDGE_TARGETS = { maxPUE: 1.2, maxWUE: 0.2, minSavingsPct: 20, maxSavingsPct: 30 } as const;

/** Conservative judging scenario; energy weights remain the user's measured assumptions. */
export function judgeScenario(current: JalWattSettings): JalWattSettings {
  return {
    ...current,
    jobsPerDay: 5000,
    baselineMix: { small: 10, medium: 30, large: 60 },
    escalationRatePct: 25,
    deferrablePct: 40,
    privacyPinnedPct: 15,
    deadlineHours: 6,
    selectedCooling: "liquid",
    cooling: { ...current.cooling, liquid: { pue: 1.15, wue: 0.1 } },
    telemetry: null,
  };
}

export function bestCaseScenario(current: JalWattSettings): JalWattSettings {
  return {
    ...current,
    baselineMix: { small: 0, medium: 0, large: 100 },
    escalationRatePct: 10,
  };
}

export interface JudgeCheck {
  label: string;
  target: string;
  value: string;
  met: boolean;
}

export function evaluateJudgeTargets(settings: JalWattSettings, result: SimulationResult): JudgeCheck[] {
  const cooling = settings.cooling[settings.selectedCooling];
  const g = result.guarantees;
  return [
    { label: "Power usage effectiveness", target: `PUE < ${JUDGE_TARGETS.maxPUE}`, value: cooling.pue.toFixed(2), met: cooling.pue < JUDGE_TARGETS.maxPUE },
    { label: "Water usage effectiveness", target: `WUE < ${JUDGE_TARGETS.maxWUE} L/kWh`, value: `${cooling.wue.toFixed(2)} L/kWh`, met: cooling.wue < JUDGE_TARGETS.maxWUE },
    {
      label: "Energy saving vs baseline",
      target: `${JUDGE_TARGETS.minSavingsPct}–${JUDGE_TARGETS.maxSavingsPct}%`,
      value: `${result.savingsPct.toFixed(1)}%`,
      met: result.savingsPct >= JUDGE_TARGETS.minSavingsPct && result.savingsPct <= JUDGE_TARGETS.maxSavingsPct,
    },
    { label: "SLA violations", target: "0", value: String(result.jalwatt.slaViolations), met: result.jalwatt.slaViolations === 0 },
    { label: "Privacy-pinned jobs kept local", target: "0 moved", value: `${g.pinnedMoved} of ${g.pinnedJobs.toLocaleString("en-IN")} moved`, met: g.pinnedMoved === 0 },
    { label: "Urgent jobs never delayed", target: "0 delayed", value: `${g.urgentDelayed} of ${g.urgentJobs.toLocaleString("en-IN")} delayed`, met: g.urgentDelayed === 0 },
    { label: "Water saved per day", target: "> 0 L", value: `${(result.baseline.waterL - result.jalwatt.waterL).toFixed(1)} L`, met: result.baseline.waterL - result.jalwatt.waterL > 0 },
  ];
}
