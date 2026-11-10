import { describe, expect, it } from "vitest";
import { parseJobVolume } from "@/lib/stress-scenario";

describe("parseJobVolume", () => {
  it("accepts a typed volume, including commas", () => {
    expect(parseJobVolume("42000")).toEqual({ ok: true, jobs: 42000 });
    expect(parseJobVolume("1,00,000")).toEqual({ ok: true, jobs: 100000 });
  });
  it("rejects empty, zero and over-limit volumes instead of silently running", () => {
    expect(parseJobVolume("").ok).toBe(false);
    expect(parseJobVolume("0").ok).toBe(false);
    expect(parseJobVolume("1000001").ok).toBe(false);
  });
});
