import type { JalWattSettings } from "./types";

const hourCurve = (values: number[]) => values;

export const DEFAULT_SETTINGS: JalWattSettings = {
  seed: 290114,
  city: "Bangalore",
  jobsPerDay: 5000,
  mix: { easy: 50, medium: 30, hard: 20 },
  deferrablePct: 40,
  privacyPinnedPct: 15,
  roomKW: 150,
  rackKW: 50,
  energyWh: { small: 0.3, medium: 1.5, large: 6 },
  cooling: {
    evaporative: { pue: 1.5, wue: 1.8 },
    liquid: { pue: 1.15, wue: 0.1 },
    dry: { pue: 1.2, wue: 0 },
  },
  selectedCooling: "liquid",
  ambientTempC: hourCurve([23, 22, 22, 21, 21, 22, 24, 27, 30, 32, 34, 35, 36, 36, 35, 34, 32, 30, 28, 27, 26, 25, 24, 23]),
  tariffINR: hourCurve([6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 6.5, 6.5, 6.5]),
  gridCO2KgPerKWh: hourCurve(Array.from({ length: 24 }, () => 0.7)),
  deadlineHours: 6,
};