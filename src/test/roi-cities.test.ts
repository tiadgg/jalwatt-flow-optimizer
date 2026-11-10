import { describe, expect, it } from "vitest";
import {
  applyCityProfile,
  calculateCoolingPayback,
  calculateSaasBenefit,
  DEFAULT_SETTINGS,
  waterWeightedImpact,
} from "@/engine";

describe("cooling ROI", () => {
  it("defaults capex to 25000 INR/kW liquid and 18000 INR/kW dry", () => {
    expect(DEFAULT_SETTINGS.capexINRPerKW).toEqual({ liquid: 25000, dry: 18000 });
  });

  it("computes annual savings and payback months from capex x room kW", () => {
    const result = calculateCoolingPayback(25000, 150, 1000, 600);
    expect(result.capexINR).toBe(3_750_000);
    expect(result.annualSavingsINR).toBe(146_000);
    expect(result.paybackMonths).toBeCloseTo(3_750_000 / 12_000, 6);
  });

  it("has no payback when cooling does not save money", () => {
    expect(calculateCoolingPayback(18000, 150, 500, 600).paybackMonths).toBeNull();
  });
});

describe("SaaS pricing", () => {
  it("defaults to 15000 INR per 100 kW and reports net benefit", () => {
    expect(DEFAULT_SETTINGS.saasFeePer100KW).toBe(15000);
    const fee = (DEFAULT_SETTINGS.saasFeePer100KW * 150) / 100;
    expect(calculateSaasBenefit(30000, fee).netBenefitINR).toBe(7500);
    expect(calculateSaasBenefit(10000, fee).breaksEvenInFirstMonth).toBe(false);
  });
});

describe("city profiles", () => {
  it("switching city applies that city's tariff and grid carbon to every hour", () => {
    const next = applyCityProfile(DEFAULT_SETTINGS, "Mumbai");
    const mumbai = DEFAULT_SETTINGS.cityProfiles.Mumbai;
    expect(next.city).toBe("Mumbai");
    expect(next.tariffINR).toHaveLength(24);
    expect(next.tariffINR.every((v) => v === mumbai.tariffINR)).toBe(true);
    expect(next.gridCO2KgPerKWh.every((v) => v === mumbai.gridCO2KgPerKWh)).toBe(true);
  });

  it("weights water saved by the stress multiplier", () => {
    expect(waterWeightedImpact(100, "Low")).toBe(75);
    expect(waterWeightedImpact(100, "Med")).toBe(100);
    expect(waterWeightedImpact(100, "High")).toBe(150);
    expect(waterWeightedImpact(100, "Extreme")).toBe(200);
  });
});
