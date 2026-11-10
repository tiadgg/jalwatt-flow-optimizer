export { DEFAULT_SETTINGS } from "./defaults";
export { runSimulation } from "./simulation";
export type {
  CityName,
  CityProfile,
  CoolingPreset,
  DecisionLogItem,
  FieldQuote,
  HourlyProfile,
  JalWattSettings,
  RunTotals,
  SimulationResult,
  TaskTier,
  TelemetryRow,
  WaterStressLevel,
  WorkloadGuarantees,
} from "./types";
export { applyCityProfile, CITY_NAMES, CITY_PROFILE_DEFAULTS, WATER_STRESS_MULTIPLIERS, waterWeightedImpact } from "./cities";
export { calculateCoolingImpact, calculateCoolingPayback, calculateSaasBenefit } from "./roi";export { findPeakWindow, PEAK_TEST, runPeakLoad, type PeakCriterion, type PeakLoadResult, type PeakStep } from "./peak";
export { bestCaseScenario, evaluateJudgeTargets, JUDGE_TARGETS, judgeScenario, type JudgeCheck } from "./judge";
export type { LeverSavings } from "./types";
