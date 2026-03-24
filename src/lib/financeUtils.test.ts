import { describe, it, expect } from "vitest";
import {
  calculateVatPosition,
  sumNetPayroll,
  convertCurrency,
} from "./financeUtils";

describe("calculateVatPosition", () => {
  it("pozitív ÁFA egyenleg (fizetendő > levonható)", () => {
    expect(calculateVatPosition(500_000, 300_000)).toBe(200_000);
  });

  it("negatív ÁFA egyenleg (visszaigényelhető)", () => {
    expect(calculateVatPosition(200_000, 450_000)).toBe(-250_000);
  });

  it("nulla egyenleg", () => {
    expect(calculateVatPosition(100_000, 100_000)).toBe(0);
  });
});

describe("sumNetPayroll", () => {
  it("szummázza a 'bér' típusú tételeket", () => {
    const items = [
      { type: "bér", amount: 350_000 },
      { type: "bér", amount: 420_000 },
      { type: "járulék", amount: 150_000 },
    ];
    expect(sumNetPayroll(items)).toBe(770_000);
  });

  it("üres tömb esetén 0-t ad", () => {
    expect(sumNetPayroll([])).toBe(0);
  });

  it("null/undefined amount értékeket 0-ként kezeli", () => {
    const items = [
      { type: "bér", amount: 300_000 },
      { type: "bér", amount: null },
      { type: "bér", amount: undefined },
    ];
    expect(sumNetPayroll(items)).toBe(300_000);
  });

  it("ha nincs 'bér' típus, 0-t ad", () => {
    const items = [
      { type: "járulék", amount: 150_000 },
      { type: "adó", amount: 80_000 },
    ];
    expect(sumNetPayroll(items)).toBe(0);
  });
});

describe("convertCurrency", () => {
  it("alap átváltás (EUR → HUF)", () => {
    expect(convertCurrency(100, 392.5)).toBe(39_250);
  });

  it("kerekítési pontosság — lebegőpontos hiba nélkül", () => {
    // 0.1 + 0.2 !== 0.3 a JS-ben, de a mi függvényünk kerekít
    expect(convertCurrency(0.1, 0.2)).toBe(0.02);
  });

  it("nulla összeg", () => {
    expect(convertCurrency(0, 392.5)).toBe(0);
  });

  it("nagy összeg pontos kerekítése", () => {
    expect(convertCurrency(999.99, 1.005)).toBe(1004.99);
  });
});
