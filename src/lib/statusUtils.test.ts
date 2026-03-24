import { describe, it, expect } from "vitest";
import { computePaymentStatus } from "./statusUtils";

describe("computePaymentStatus", () => {
  it("'Nyitott' ha transactionId === null", () => {
    expect(computePaymentStatus(null)).toBe("Nyitott");
  });

  it("'Nyitott' ha transactionId === undefined", () => {
    expect(computePaymentStatus(undefined)).toBe("Nyitott");
  });

  it("'Kifizetve' ha van valódi UUID", () => {
    expect(computePaymentStatus("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(
      "Kifizetve"
    );
  });

  it("'Nyitott' ha transactionId üres string", () => {
    expect(computePaymentStatus("")).toBe("Nyitott");
  });
});
