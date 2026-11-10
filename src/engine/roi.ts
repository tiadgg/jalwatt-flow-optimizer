import type { CoolingPreset, JalWattSettings } from "./types";

export interface CoolingImpact {
  pue: number;
  wue: number;
  facilityKWh: number;
  waterL: number;
  co2Kg: number;
  costINR: number;
}

export function calculateCoolingImpact(
  itKWhByHour: number[],
  settings: Pick<JalWattSettings, "cooling" | "tariffINR" | "gridCO2KgPerKWh">,
  preset: CoolingPreset,
): CoolingImpact {
  const profile = settings.cooling[preset];
  let facilityKWh = 0;
  let co2Kg = 0;
  let costINR = 0;
  itKWhByHour.forEach((itKWh, hour) => {
    const facility = itKWh * profile.pue;
    facilityKWh += facility;
    co2Kg += facility * (settings.gridCO2KgPerKWh[hour] ?? 0);
    costINR += facility * (settings.tariffINR[hour] ?? 0);
  });
  return {
    pue: profile.pue,
    wue: profile.wue,
    facilityKWh,
    waterL: itKWhByHour.reduce((sum, value) => sum + value, 0) * profile.wue,
    co2Kg,
    costINR,
  };
}

export function calculateCoolingPayback(
  capexINRPerKW: number,
  roomKW: number,
  baselineCostPerDay: number,
  coolingCostPerDay: number,
) {
  const dailySavingsINR = Math.max(0, baselineCostPerDay - coolingCostPerDay);
  const capexINR = capexINRPerKW * roomKW;
  const annualSavingsINR = dailySavingsINR * 365;
  return {
    capexINR,
    dailySavingsINR,
    annualSavingsINR,
    paybackMonths: dailySavingsINR > 0 ? capexINR / (dailySavingsINR * 30) : null,
  };
}

export function calculateSaasBenefit(monthlySavingsINR: number, monthlyFeeINR: number) {
  const netBenefitINR = monthlySavingsINR - monthlyFeeINR;
  return {
    netBenefitINR,
    feeCoverage: monthlyFeeINR > 0 ? monthlySavingsINR / monthlyFeeINR : null,
    breaksEvenInFirstMonth: netBenefitINR >= 0,
  };
}