export const LITRES_PER_PERSON_PER_DAY = 135;
export const HOUSEHOLD_SIZE = 4;

export const HOUSEHOLD_DAILY_WATER_L = LITRES_PER_PERSON_PER_DAY * HOUSEHOLD_SIZE;

export function toHouseholdDailyWaterEquivalents(waterLitres: number): number {
  return waterLitres / HOUSEHOLD_DAILY_WATER_L;
}
