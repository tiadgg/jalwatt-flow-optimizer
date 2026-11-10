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

/** One hour of uploaded server-room telemetry. */
export interface TelemetryRow {
  hour: number;
  itKW: number;
  ambientC: number;
  jobs: number;
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
  /** Uploaded hourly telemetry; when set it replaces the simulated arrival and IT-load profile. */
  telemetry: TelemetryRow[] | null;
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
  /** Jobs run on the small or medium model in this hour (JalWatt). */
  routedJobs: number;
  /** Deferrable jobs moved into this hour from an earlier arrival hour. */
  shiftedJobs: number;
  baselineWaterL: number;
  jalwattWaterL: number;
}

export interface DecisionLogItem {
  jobGroup: string;
  action: string;
  reason: string;
  savedKWh: number;
  savedINR: number;
  tradeoff: string;
}

export interface WorkloadGuarantees {
  totalJobs: number;
  pinnedJobs: number;
  urgentJobs: number;
  deferrableJobs: number;
  shiftedJobs: number;
  /** Privacy-pinned jobs that ran at a different hour than they arrived. Must be 0. */
  pinnedMoved: number;
  /** Urgent jobs that ran later than they arrived. Must be 0. */
  urgentDelayed: number;
  /** Deferrable jobs scheduled past their deadline. Must be 0. */
  deadlineMisses: number;
}

export interface SimulationResult {
  guarantees: WorkloadGuarantees;
  baseline: RunTotals;
  jalwatt: RunTotals;
  savingsPct: number;
  hourlyProfile: HourlyProfile[];
  decisionLog: DecisionLogItem[];
}