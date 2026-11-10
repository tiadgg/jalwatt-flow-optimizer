export const MAX_SCENARIO_JOBS = 1_000_000;

export type JobVolumeResult = { ok: true; jobs: number } | { ok: false; error: string };

/** Validates the job volume typed on the Stress Test page. */
export function parseJobVolume(input: string): JobVolumeResult {
  const trimmed = input.trim().replace(/,/g, "");
  if (trimmed === "") return { ok: false, error: "Enter a daily job volume." };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { ok: false, error: "Enter a number, e.g. 25000." };
  if (value < 1) return { ok: false, error: "Enter at least 1 job per day." };
  if (value > MAX_SCENARIO_JOBS) return { ok: false, error: `Maximum is ${MAX_SCENARIO_JOBS.toLocaleString("en-IN")} jobs per day.` };
  return { ok: true, jobs: Math.floor(value) };
}
