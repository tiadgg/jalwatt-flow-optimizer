export type CoolingPreset = "evaporative" | "liquid" | "dry";
export type TaskTier = "easy" | "medium" | "hard";
export type CityName = "Bangalore" | "Chennai" | "Pune" | "Mumbai" | "Hyderabad";
export type WaterStressLevel = "Low" | "Med" | "High" | "Extreme";

export interface CityProfile {
  waterStress: WaterStressLevel;
  tariffINR: number;
  gridCO2KgPerKWh: number;
}

export interface FieldQuote {
  name: string;
  role: string;
  quote: string;
}

export interface CoolingProfile {
  pue: number;
  wue: number;
}

export interface JalWattSettings {
  seed: number;
  city: CityName;
  cityProfiles: Record<CityName, CityProfile>;
  capexINRPerKW: { liquid: number; dry: number };
  saasFeePer100KW: number;
  fieldVoices: FieldQuote[];
  jobsPerDay: number;
  mix: Record<TaskTier, number>;
  deferrablePct: number;
  privacyPinnedPct: number;
  roomKW: number;
  rackKW: number;
  energyWh: { small: number; medium: number; large: number };
  cooling: Record<CoolingPreset, CoolingProfile>;
  selectedCooling: CoolingPreset;
  ambientTempC: number[];
  tariffINR: number[];
  gridCO2KgPerKWh: number[];
  deadlineHours: number;
}

export interface RunTotals {
  itKWh: number;
  facilityKWh: number;
  waterL: number;
  co2Kg: number;
  costINR: number;
  slaViolations: number;
}

export interface HourlyProfile {
  hour: number;
  ambientTempC: number;
  tariffINR: number;
  baselineJobs: number;
  jalwattJobs: number;
  baselineKWh: number;
  jalwattKWh: number;
}

export interface DecisionLogItem {
  jobGroup: string;
  action: string;
  reason: string;
  savedKWh: number;
  savedINR: number;
  tradeoff: string;
}

export interface SimulationResult {
  baseline: RunTotals;
  jalwatt: RunTotals;
  savingsPct: number;
  hourlyProfile: HourlyProfile[];
  decisionLog: DecisionLogItem[];
}