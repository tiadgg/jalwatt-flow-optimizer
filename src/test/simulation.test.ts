import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, runSimulation } from "@/engine";

describe("runSimulation", () => {
  it("scales the baseline to room capacity and average utilization", () => {
    const result = runSimulation(DEFAULT_SETTINGS);

    expect(result.baseline.itKWh).toBeCloseTo(150 * 24 * 0.6, 8);
    expect(result.baseline.facilityKWh).toBeCloseTo(2160 * 1.5, 8);
    expect(result.baseline.waterL).toBeCloseTo(2160 * 1.8, 8);
    expect(result.baseline.waterL).toBeGreaterThan(1000);
    expect(result.baseline.co2Kg).toBeCloseTo(result.baseline.facilityKWh * 0.7, 8);
    expect(result.guarantees.totalJobs).toBe(5000);
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

  it("reports each lever independently and derives task energy from room load", () => {
    const result = runSimulation(DEFAULT_SETTINGS);
    expect(result.savingsByLever.routing).toBeDefined();
    expect(result.savingsByLever.timeShifting).toBeDefined();
    expect(result.savingsByLever.cooling).toBeDefined();
    expect(result.baseline.itKWh * 1000 / result.guarantees.totalJobs).toBeCloseTo(432, 6);
    expect(result.savingsByLever.cooling.waterL).toBeGreaterThan(1000);
  });

  it("charges escalation for both the routed model and its next-larger rerun", () => {
    const shared = {
      ...DEFAULT_SETTINGS,
      mix: { easy: 100, medium: 0, hard: 0 },
      baselineMix: { small: 0, medium: 0, large: 100 },
      deferrablePct: 0,
      privacyPinnedPct: 0,
      selectedCooling: "evaporative" as const,
    };
    const noEscalation = runSimulation({ ...shared, escalationRatePct: 0 });
    const allEscalate = runSimulation({ ...shared, escalationRatePct: 100 });
    expect(allEscalate.jalwatt.itKWh).toBeGreaterThan(noEscalation.jalwatt.itKWh);
  });
});