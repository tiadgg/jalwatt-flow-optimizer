import { CITY_NAMES, JUDGE_TARGETS, PEAK_TEST, WATER_STRESS_MULTIPLIERS, type JalWattSettings } from "@/engine";
import { HOUSEHOLD_SIZE, LITRES_PER_PERSON_PER_DAY } from "@/lib/dashboard-metrics";

export type AssumptionStatus = "Assumption" | "To verify";

export interface AssumptionRow {
  group: string;
  name: string;
  value: string;
  status: AssumptionStatus;
  note: string;
}

const range = (values: number[], digits = 1) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? min.toFixed(digits) : `${min.toFixed(digits)}–${max.toFixed(digits)}`;
};

/** Every constant the model uses, with its current value. "To verify" = must be checked against real data. */
export function buildAssumptionRows(settings: JalWattSettings): AssumptionRow[] {
  const c = settings.cooling;
  return [
    { group: "Workload", name: "Jobs per day", value: settings.telemetry ? "From your telemetry" : settings.jobsPerDay.toLocaleString("en-IN"), status: "Assumption", note: "Scenario input; replace with measured volume." },
    { group: "Workload", name: "Task mix easy / medium / hard", value: `${settings.mix.easy} / ${settings.mix.medium} / ${settings.mix.hard} %`, status: "To verify", note: "Needs classification of a real agentic workload." },
    { group: "Workload", name: "Deferrable share", value: `${settings.deferrablePct}%`, status: "To verify", note: "Share of jobs that tolerate delay." },
    { group: "Workload", name: "Privacy-pinned share", value: `${settings.privacyPinnedPct}%`, status: "To verify", note: "Jobs that must stay local and run on arrival." },
    { group: "Workload", name: "Deadline window", value: `${settings.deadlineHours} hours`, status: "Assumption", note: "Maximum delay for deferrable jobs." },
    { group: "Workload", name: "Random seed", value: String(settings.seed), status: "Assumption", note: "Makes every run reproducible." },
    { group: "Energy", name: "Small model energy", value: `${settings.energyWh.small} Wh / task`, status: "To verify", note: "Measure with GPU/PDU telemetry." },
    { group: "Energy", name: "Medium model energy", value: `${settings.energyWh.medium} Wh / task`, status: "To verify", note: "Measure with GPU/PDU telemetry." },
    { group: "Energy", name: "Large model energy", value: `${settings.energyWh.large} Wh / task`, status: "To verify", note: "Measure with GPU/PDU telemetry." },
    { group: "Capacity", name: "Room capacity", value: `${settings.roomKW} kW`, status: "Assumption", note: "Planning input." },
    { group: "Capacity", name: "Rack max power", value: `${settings.rackKW} kW`, status: "Assumption", note: "Used at full load in the peak test." },
    { group: "Cooling", name: "Evaporative PUE / WUE (baseline)", value: `${c.evaporative.pue} / ${c.evaporative.wue} L/kWh`, status: "To verify", note: "Typical published range; confirm on site." },
    { group: "Cooling", name: "Liquid closed-loop PUE / WUE", value: `${c.liquid.pue} / ${c.liquid.wue} L/kWh`, status: "To verify", note: "Vendor-typical; confirm with a pilot." },
    { group: "Cooling", name: "Dry exchanger PUE / WUE", value: `${c.dry.pue} / ${c.dry.wue} L/kWh`, status: "To verify", note: "Vendor-typical; confirm with a pilot." },
    { group: "Grid & climate", name: "Hourly tariff", value: `₹${range(settings.tariffINR)} / kWh`, status: "To verify", note: "Check the applicable commercial tariff." },
    { group: "Grid & climate", name: "Grid CO₂ factor", value: `${range(settings.gridCO2KgPerKWh, 2)} kg / kWh`, status: "To verify", note: "Check the regional grid emission factor." },
    { group: "Grid & climate", name: "Hourly ambient temperature", value: `${range(settings.ambientTempC)} °C`, status: settings.telemetry ? "Assumption" : "To verify", note: settings.telemetry ? "From your telemetry." : "Typical-day curve; replace with local weather." },
    { group: "Scheduling", name: "Temperature weight in hour score", value: "0.08 per °C", status: "Assumption", note: "Score = tariff + 0.08 × ambient °C." },
    { group: "City", name: "City tariff, carbon and water stress", value: `${CITY_NAMES.length} cities, illustrative`, status: "To verify", note: "Illustrative defaults on the Data & City page." },
    { group: "City", name: "Water-stress multipliers", value: Object.entries(WATER_STRESS_MULTIPLIERS).map(([level, value]) => `${level} ${value}×`).join(" · "), status: "Assumption", note: "Weights litres saved by local scarcity." },
    { group: "Impact", name: "Water per person per day", value: `${LITRES_PER_PERSON_PER_DAY} L`, status: "Assumption", note: "Household equivalence on the Dashboard." },
    { group: "Impact", name: "People per household", value: String(HOUSEHOLD_SIZE), status: "Assumption", note: "Household equivalence on the Dashboard." },
    { group: "ROI", name: "Liquid cooling capex", value: `₹${settings.capexINRPerKW.liquid.toLocaleString("en-IN")} / kW`, status: "To verify", note: "Get vendor quotes." },
    { group: "ROI", name: "Dry cooling capex", value: `₹${settings.capexINRPerKW.dry.toLocaleString("en-IN")} / kW`, status: "To verify", note: "Get vendor quotes." },
    { group: "ROI", name: "SaaS fee", value: `₹${settings.saasFeePer100KW.toLocaleString("en-IN")} / 100 kW / month`, status: "Assumption", note: "Pricing hypothesis." },
    { group: "Peak test", name: "Peak duration and load", value: `${PEAK_TEST.durationHours} h at ${PEAK_TEST.loadMultiplier}× jobs, rack at max kW`, status: "Assumption", note: "Hottest 4-hour window of the day." },
    { group: "Peak test", name: "Cooling design margin", value: `${PEAK_TEST.coolingDesignMargin}× rack kW`, status: "To verify", note: "Confirm installed cooling capacity per rack." },
    { group: "Peak test", name: "Cooling derate", value: `${PEAK_TEST.deratePctPerC}% per °C above ${PEAK_TEST.derateAboveC} °C`, status: "To verify", note: "Check equipment datasheets." },
    { group: "Peak test", name: "PUE rise with heat", value: `${PEAK_TEST.pueRisePerC * 100}% per °C above ${PEAK_TEST.pueRiseAboveC} °C`, status: "Assumption", note: "Drives the watts-per-task curve." },
    { group: "Peak test", name: "Throttle and pass thresholds", value: `throttle < ${PEAK_TEST.throttleBelowHeadroomPct}% · pass ≥ ${PEAK_TEST.passMinHeadroomPct}% headroom`, status: "Assumption", note: "Thermal headroom criteria." },
    { group: "Targets", name: "Problem-statement targets", value: `PUE < ${JUDGE_TARGETS.maxPUE} · WUE < ${JUDGE_TARGETS.maxWUE} · ${JUDGE_TARGETS.minSavingsPct}–${JUDGE_TARGETS.maxSavingsPct}% energy saving`, status: "Assumption", note: "Used by Judge Mode." },
  ];
}
