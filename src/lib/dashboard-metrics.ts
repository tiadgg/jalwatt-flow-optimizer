const LITRES_PER_PERSON_PER_DAY = 135;
const PEOPLE_PER_HOUSEHOLD = 4;

export const HOUSEHOLD_DAILY_WATER_L = LITRES_PER_PERSON_PER_DAY * PEOPLE_PER_HOUSEHOLD;

export function toHouseholdDailyWaterEquivalents(waterLitres: number): number {
  return waterLitres / HOUSEHOLD_DAILY_WATER_L;
}
