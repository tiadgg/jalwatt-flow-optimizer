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
  WaterStressLevel,
} from "./types";
export { applyCityProfile, CITY_NAMES, CITY_PROFILE_DEFAULTS, WATER_STRESS_MULTIPLIERS, waterWeightedImpact } from "./cities";
export { calculateCoolingImpact, calculateCoolingPayback, calculateSaasBenefit } from "./roi";