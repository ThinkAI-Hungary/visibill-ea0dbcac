import { describe, it, expect } from "vitest";
import { getPreviousMonthRange } from "./dateUtils";

describe("getPreviousMonthRange", () => {
  it("alapeset: 2026-03-12 → 2026. február", () => {
    const result = getPreviousMonthRange(new Date(2026, 2, 12)); // March = 2
    expect(result).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("évváltás: 2026-01-15 → 2025. december", () => {
    const result = getPreviousMonthRange(new Date(2026, 0, 15)); // January = 0
    expect(result).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  });

  it("szökőév: 2024-03-10 → 2024. február (29 nap)", () => {
    const result = getPreviousMonthRange(new Date(2024, 2, 10)); // March = 2
    expect(result).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });
});
