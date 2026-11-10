import type { CityName, CityProfile, JalWattSettings, WaterStressLevel } from "./types";

export const CITY_NAMES: CityName[] = ["Bangalore", "Chennai", "Pune", "Mumbai", "Hyderabad"];

export const WATER_STRESS_MULTIPLIERS: Record<WaterStressLevel, number> = {
  Low: 0.75,
  Med: 1,
  High: 1.5,
  Extreme: 2,
};

// Illustrative starting values for planning, not measured utility data.
export const CITY_PROFILE_DEFAULTS: Record<CityName, CityProfile> = {
  Bangalore: { waterStress: "High", tariffINR: 8.5, gridCO2KgPerKWh: 0.7 },
  Chennai: { waterStress: "Extreme", tariffINR: 8.2, gridCO2KgPerKWh: 0.74 },
  Pune: { waterStress: "Med", tariffINR: 8, gridCO2KgPerKWh: 0.69 },
  Mumbai: { waterStress: "High", tariffINR: 9.2, gridCO2KgPerKWh: 0.68 },
  Hyderabad: { waterStress: "High", tariffINR: 7.8, gridCO2KgPerKWh: 0.72 },
};

export function applyCityProfile(settings: JalWattSettings, city: CityName): JalWattSettings {
  const profile = settings.cityProfiles[city];
  if (!profile) return { ...settings, city };
  const length = Math.max(1, settings.ambientTempC.length);
  return {
    ...settings,
    city,
    tariffINR: Array.from({ length }, () => profile.tariffINR),
    gridCO2KgPerKWh: Array.from({ length }, () => profile.gridCO2KgPerKWh),
  };
}

export function waterWeightedImpact(litresSaved: number, level: WaterStressLevel): number {
  return litresSaved * WATER_STRESS_MULTIPLIERS[level];
}