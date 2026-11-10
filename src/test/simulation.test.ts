import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, runSimulation } from "@/engine";

describe("runSimulation", () => {
  it("calculates the baseline from 5,000 large-model jobs and evaporative cooling", () => {
    const result = runSimulation(DEFAULT_SETTINGS);

    expect(result.baseline.itKWh).toBeCloseTo(30, 8);
    expect(result.baseline.facilityKWh).toBeCloseTo(45, 8);
    expect(result.baseline.waterL).toBeCloseTo(54, 8);
    expect(result.baseline.co2Kg).toBeCloseTo(31.5, 8);
  });

  it("is reproducible for the same seed and has no SLA violations", () => {
    const first = runSimulation(DEFAULT_SETTINGS);
    const second = runSimulation(DEFAULT_SETTINGS);

    expect(first).toEqual(second);
    expect(first.jalwatt.slaViolations).toBe(0);
  });

  it("does not move work when no jobs are deferrable", () => {
    const settings = { ...DEFAULT_SETTINGS, deferrablePct: 0, privacyPinnedPct: 100 };
    const result = runSimulation(settings);

    expect(result.hourlyProfile.reduce((sum, hour) => sum + hour.jalwattKWh, 0)).toBeCloseTo(
      result.jalwatt.facilityKWh,
      8,
    );
    expect(result.decisionLog.find((item) => item.jobGroup === "Privacy-pinned workload")?.action).toBe(
      "Run locally at arrival",
    );
  });
});