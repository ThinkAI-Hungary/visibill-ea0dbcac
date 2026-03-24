import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  isValidAmount,
  isNotBlank,
  isValidTaxId,
} from "./validationUtils";

// ─── EMAIL ─────────────────────────────────────────────
describe("isValidEmail", () => {
  it("elfogad helyes email-t", () => {
    expect(isValidEmail("teszt@example.com")).toBe(true);
  });

  it("elfogad subdomain-es email-t", () => {
    expect(isValidEmail("info@mail.company.hu")).toBe(true);
  });

  it("elutasít hiányzó @ jelet", () => {
    expect(isValidEmail("tesztexample.com")).toBe(false);
  });

  it("elutasít hiányzó pontot", () => {
    expect(isValidEmail("teszt@examplecom")).toBe(false);
  });

  it("elutasít üres stringet", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("elutasít szóközös email-t", () => {
    expect(isValidEmail("  ")).toBe(false);
  });
});

// ─── ÖSSZEG ────────────────────────────────────────────
describe("isValidAmount", () => {
  it("elfogad pozitív számot: 5000", () => {
    expect(isValidAmount(5000)).toBe(true);
  });

  it("elfogad tizedesjegyes számot: 99.5", () => {
    expect(isValidAmount(99.5)).toBe(true);
  });

  it("elutasít negatív számot: -100", () => {
    expect(isValidAmount(-100)).toBe(false);
  });

  it("elutasít nem-számot: 'abc'", () => {
    expect(isValidAmount("abc")).toBe(false);
  });

  it("elutasít nullát: 0", () => {
    expect(isValidAmount(0)).toBe(false);
  });

  it("elutasít üres stringet", () => {
    expect(isValidAmount("")).toBe(false);
  });

  it("elutasít null értéket", () => {
    expect(isValidAmount(null)).toBe(false);
  });

  it("elfogad string-ként megadott pozitív számot: '250'", () => {
    expect(isValidAmount("250")).toBe(true);
  });
});

// ─── SZÖVEG ────────────────────────────────────────────
describe("isNotBlank", () => {
  it("elfogad normál szöveget: 'Bakos Györgyi'", () => {
    expect(isNotBlank("Bakos Györgyi")).toBe(true);
  });

  it("elutasít csak szóközökből álló stringet", () => {
    expect(isNotBlank("   ")).toBe(false);
  });

  it("elutasít üres stringet", () => {
    expect(isNotBlank("")).toBe(false);
  });

  it("elutasít null-t", () => {
    expect(isNotBlank(null)).toBe(false);
  });

  it("elutasít undefined-t", () => {
    expect(isNotBlank(undefined)).toBe(false);
  });
});

// ─── ADÓSZÁM (bónusz) ─────────────────────────────────
describe("isValidTaxId", () => {
  it("elfogad kötőjeles formátumot: '12345678-1-42'", () => {
    expect(isValidTaxId("12345678-1-42")).toBe(true);
  });

  it("elfogad 11 jegyű egybefüggő számot", () => {
    expect(isValidTaxId("12345678142")).toBe(true);
  });

  it("elutasít túl rövid számot", () => {
    expect(isValidTaxId("12345")).toBe(false);
  });

  it("elutasít betűt tartalmazó értéket", () => {
    expect(isValidTaxId("1234567A-1-42")).toBe(false);
  });

  it("elutasít üres stringet", () => {
    expect(isValidTaxId("")).toBe(false);
  });
});
