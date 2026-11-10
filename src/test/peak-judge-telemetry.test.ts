import { describe, expect, it } from "vitest";
import { bestCaseScenario, DEFAULT_SETTINGS, evaluateJudgeTargets, judgeScenario, PEAK_TEST, runPeakLoad, runSimulation } from "@/engine";
import { buildSampleTelemetryCsv, parseTelemetryCsv } from "@/lib/telemetry-csv";

describe("peak load test", () => {
  it("runs 4 hours at 2x jobs with the rack held at max kW", () => {
    const result = runSimulation(DEFAULT_SETTINGS);
    const peak = runPeakLoad(DEFAULT_SETTINGS, result);
    expect(peak.steps).toHaveLength(PEAK_TEST.durationHours * PEAK_TEST.stepsPerHour);
    expect(peak.steps.every((step) => step.itKW === DEFAULT_SETTINGS.rackKW)).toBe(true);
    const firstHour = peak.steps[0]!.hour;
    expect(peak.steps[0]!.jobs * 4).toBeCloseTo(result.hourlyProfile[firstHour]!.baselineJobs * 2, 6);
  });

  it("reports overload when the 2x workload exceeds the 50 kW rack", () => {
    const peak = runPeakLoad(DEFAULT_SETTINGS, runSimulation(DEFAULT_SETTINGS));
    expect(peak.serverCrashes).toBe(0);
    expect(peak.slaViolations).toBeGreaterThan(0);
    expect(peak.throttlingEvents).toBe(0);
    expect(peak.pass).toBe(false);
  });

  it("fails when ambient heat erodes thermal headroom", () => {
    const hot = { ...DEFAULT_SETTINGS, ambientTempC: DEFAULT_SETTINGS.ambientTempC.map(() => 55) };
    const peak = runPeakLoad(hot, runSimulation(hot));
    expect(peak.throttlingEvents).toBeGreaterThan(0);
    expect(peak.pass).toBe(false);
  });
});

describe("Judge Mode preset", () => {
  it("uses the requested conservative assumptions and marks only met targets", () => {
    const settings = judgeScenario(DEFAULT_SETTINGS);
    const result = runSimulation(settings);
    const checks = evaluateJudgeTargets(settings, result);
    expect(settings.cooling[settings.selectedCooling].pue).toBeLessThan(1.2);
    expect(settings.cooling[settings.selectedCooling].wue).toBeLessThan(0.2);
    expect(settings.escalationRatePct).toBe(25);
    expect(settings.baselineMix).toEqual({ small: 10, medium: 30, large: 60 });
    expect(result.savingsPct).toBeGreaterThan(30);
    expect(result.jalwatt.slaViolations).toBe(0);
    expect(checks.find((check) => check.label === "Energy saving vs baseline")?.met).toBe(false);
    expect(checks.find((check) => check.label === "Power usage effectiveness")?.met).toBe(true);
    expect(checks.find((check) => check.label === "Water usage effectiveness")?.met).toBe(true);
    expect(checks.every((check) => check.met === (check.label === "Energy saving vs baseline" ? false : true))).toBe(true);
  });

  it("sets the best case to 10% escalation and a 100% large-model baseline", () => {
    const conservative = judgeScenario(DEFAULT_SETTINGS);
    const bestCase = bestCaseScenario(conservative);
    expect(bestCase.escalationRatePct).toBe(10);
    expect(bestCase.baselineMix).toEqual({ small: 0, medium: 0, large: 100 });
    expect(runSimulation(bestCase).savingsPct).toBeGreaterThan(runSimulation(conservative).savingsPct);
  });
});

describe("telemetry CSV", () => {
  it("parses the sample with hour, itKW, ambientC, jobs into 24 rows", () => {
    const parsed = parseTelemetryCsv(buildSampleTelemetryCsv(DEFAULT_SETTINGS.ambientTempC));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.rows).toHaveLength(24);
  });

  it("rejects files missing a required column or an hour", () => {
    expect(parseTelemetryCsv("hour,itKW,jobs\n0,1,2").ok).toBe(false);
    const rows = ["hour,itKW,ambientC,jobs", ...Array.from({ length: 23 }, (_, h) => `${h},10,25,100`)];
    const result = parseTelemetryCsv(rows.join("\n"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("23");
  });

  it("uses measured IT kWh as the baseline and the uploaded job counts", () => {
    const rows = Array.from({ length: 24 }, (_, hour) => ({ hour, itKW: 10, ambientC: 25, jobs: 100 }));
    const result = runSimulation({ ...DEFAULT_SETTINGS, telemetry: rows });
    expect(result.baseline.itKWh).toBeCloseTo(240, 6);
    expect(result.guarantees.totalJobs).toBe(2400);
    expect(result.jalwatt.itKWh).toBeLessThan(result.baseline.itKWh);
    expect(result.jalwatt.slaViolations).toBe(0);
  });
});
