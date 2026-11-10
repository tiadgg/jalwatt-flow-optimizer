import type {
  DecisionLogItem,
  HourlyProfile,
  JalWattSettings,
  RunTotals,
  SimulationResult,
  TaskTier,
} from "./types";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const TIER_NAMES: TaskTier[] = ["easy", "medium", "hard"];

function chooseTier(random: () => number, settings: JalWattSettings): TaskTier {
  const threshold = random() * (settings.mix.easy + settings.mix.medium + settings.mix.hard);
  if (threshold < settings.mix.easy) return "easy";
  if (threshold < settings.mix.easy + settings.mix.medium) return "medium";
  return "hard";
}

function scheduledHour(
  random: () => number,
  arrival: number,
  settings: JalWattSettings,
): number {
  const lastHour = Math.min(23, arrival + Math.max(0, settings.deadlineHours));
  let chosen = arrival;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let hour = arrival; hour <= lastHour; hour += 1) {
    // Balanced score favors low-cost hours while giving cooler hours a meaningful influence.
    const score = (settings.tariffINR[hour] ?? 0) + (settings.ambientTempC[hour] ?? 0) * 0.08;
    if (score < bestScore) {
      bestScore = score;
      chosen = hour;
    }
  }
  // Stable seeded tie-breaker keeps equivalent choices reproducible.
  const candidates = Array.from({ length: lastHour - arrival + 1 }, (_, index) => arrival + index)
    .filter((hour) => Math.abs((settings.tariffINR[hour] ?? 0) + (settings.ambientTempC[hour] ?? 0) * 0.08 - bestScore) < 0.000001);
  return candidates.length > 1 ? candidates[Math.floor(random() * candidates.length)] ?? chosen : chosen;
}

function totals(
  itByHour: number[],
  settings: JalWattSettings,
  pue: number,
  wue: number,
): RunTotals {
  const itKWh = itByHour.reduce((sum, value) => sum + value, 0);
  const facilityKWh = itKWh * pue;
  const waterL = itKWh * wue;
  let co2Kg = 0;
  let costINR = 0;
  itByHour.forEach((it, hour) => {
    const facility = it * pue;
    co2Kg += facility * (settings.gridCO2KgPerKWh[hour] ?? 0);
    costINR += facility * (settings.tariffINR[hour] ?? 0);
  });
  return { itKWh, facilityKWh, waterL, co2Kg, costINR, slaViolations: 0 };
}

export function runSimulation(settings: JalWattSettings): SimulationResult {
  const random = seededRandom(settings.seed);
  const baselineIt = Array.from({ length: 24 }, () => 0);
  const jalwattIt = Array.from({ length: 24 }, () => 0);
  const perTier = Object.fromEntries(
    TIER_NAMES.map((tier) => [tier, { count: 0, baselineWh: 0, jalwattWh: 0 }]),
  ) as Record<TaskTier, { count: number; baselineWh: number; jalwattWh: number }>;
  const movedCount = { count: 0, energyKWh: 0 };
  const jobs = Math.max(0, Math.floor(settings.jobsPerDay));
  const pinnedPct = Math.max(0, Math.min(100, settings.privacyPinnedPct));
  const deferrablePct = Math.max(0, Math.min(100 - pinnedPct, settings.deferrablePct));

  for (let index = 0; index < jobs; index += 1) {
    const tier = chooseTier(random, settings);
    const arrival = Math.min(23, Math.floor(random() * 24));
    const classification = random() * 100;
    const pinned = classification < pinnedPct;
    const deferrable = !pinned && classification < pinnedPct + deferrablePct;
    const baselineWh = settings.energyWh.large;
    const jalwattWh =
      tier === "easy" ? settings.energyWh.small : tier === "medium" ? settings.energyWh.medium : settings.energyWh.large;
    const runHour = deferrable ? scheduledHour(random, arrival, settings) : arrival;
    baselineIt[arrival] = (baselineIt[arrival] ?? 0) + baselineWh / 1000;
    jalwattIt[runHour] = (jalwattIt[runHour] ?? 0) + jalwattWh / 1000;

    const bucket = perTier[tier];
    bucket.count += 1;
    bucket.baselineWh += baselineWh;
    bucket.jalwattWh += jalwattWh;
    if (deferrable && runHour !== arrival) {
      movedCount.count += 1;
      movedCount.energyKWh += jalwattWh / 1000;
    }
  }

  const baselineCooling = settings.cooling.evaporative;
  const selectedCooling = settings.cooling[settings.selectedCooling];
  const baseline = totals(baselineIt, settings, baselineCooling.pue, baselineCooling.wue);
  const jalwatt = totals(jalwattIt, settings, selectedCooling.pue, selectedCooling.wue);
  const hourlyProfile: HourlyProfile[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    ambientTempC: settings.ambientTempC[hour] ?? 0,
    tariffINR: settings.tariffINR[hour] ?? 0,
    baselineKWh: (baselineIt[hour] ?? 0) * baselineCooling.pue,
    jalwattKWh: (jalwattIt[hour] ?? 0) * selectedCooling.pue,
  }));

  const decisionLog: DecisionLogItem[] = TIER_NAMES.map((tier) => {
    const work = perTier[tier];
    const savedKWh = (work.baselineWh - work.jalwattWh) / 1000;
    const savedINR = savedKWh * selectedCooling.pue * 7.5;
    return {
      jobGroup: `${tier[0]?.toUpperCase()}${tier.slice(1)} model routing`,
      action: tier === "hard" ? "Keep on large model" : `Route to ${tier} model`,
      reason:
        tier === "easy"
          ? `${work.count.toLocaleString()} easy tasks use the small model.`
          : tier === "medium"
            ? `${work.count.toLocaleString()} medium tasks use the medium model.`
            : "Complex work retains the large model for quality.",
      savedKWh,
      savedINR,
      tradeoff: tier === "hard" ? "No quality compromise" : "Lower energy per task",
    };
  });
  decisionLog.push({
    jobGroup: "Flexible workload",
    action: `${movedCount.count.toLocaleString()} jobs rescheduled`,
    reason: `Moved into the lowest combined tariff and temperature score within ${settings.deadlineHours} hours.`,
    savedKWh: 0,
    savedINR: movedCount.energyKWh * selectedCooling.pue * 1.25,
    tradeoff: "Scheduled before deadline",
  });
  decisionLog.push({
    jobGroup: "Privacy-pinned workload",
    action: "Run locally at arrival",
    reason: "Pinned jobs stay local and are never moved.",
    savedKWh: 0,
    savedINR: 0,
    tradeoff: "Local processing preserved",
  });
  decisionLog.push({
    jobGroup: "Cooling profile",
    action: `${settings.selectedCooling[0]?.toUpperCase()}${settings.selectedCooling.slice(1)} cooling`,
    reason: `PUE ${selectedCooling.pue.toFixed(2)} · WUE ${selectedCooling.wue.toFixed(2)} L/kWh.`,
    savedKWh: baseline.facilityKWh - jalwatt.facilityKWh,
    savedINR: baseline.costINR - jalwatt.costINR,
    tradeoff: "Cooling preset applied to the full workload",
  });

  const savingsPct = baseline.facilityKWh > 0 ? ((baseline.facilityKWh - jalwatt.facilityKWh) / baseline.facilityKWh) * 100 : 0;
  return { baseline, jalwatt, savingsPct, hourlyProfile, decisionLog };
}
