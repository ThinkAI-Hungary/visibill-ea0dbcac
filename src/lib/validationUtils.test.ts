import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  isValidAmount,
  isNotBlank,
  isValidTaxId,
  parseTaxNumber,
  isGroupVatMember,
  isGroupVatEntity,
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

// ─── ADÓSZÁM PARSE & NORMALIZÁLÁS (1. VAKFOLT) ──────────
describe("parseTaxNumber", () => {
  it("helyesen bontja a standard kötőjeles adószámot", () => {
    const res = parseTaxNumber("13086905-2-08");
    expect(res.base).toBe("13086905");
    expect(res.vat).toBe("2");
    expect(res.county).toBe("08");
    expect(res.fullFormatted).toBe("13086905-2-08");
  });

  it("helyesen bontja és formázza az egybefüggő 11 jegyű adószámot", () => {
    const res = parseTaxNumber("13086905208");
    expect(res.base).toBe("13086905");
    expect(res.vat).toBe("2");
    expect(res.county).toBe("08");
    expect(res.fullFormatted).toBe("13086905-2-08");
  });

  it("kezeli a szóközökkel ellátott vagy szabálytalanul tagolt adószámot", () => {
    const res = parseTaxNumber(" 13086905 - 2 - 08 ");
    expect(res.base).toBe("13086905");
    expect(res.vat).toBe("2");
    expect(res.county).toBe("08");
    expect(res.fullFormatted).toBe("13086905-2-08");
  });

  it("kezeli a csak 8 számjegyű törzsszámot", () => {
    const res = parseTaxNumber("13086905");
    expect(res.base).toBe("13086905");
    expect(res.vat).toBe("");
    expect(res.county).toBe("");
    expect(res.fullFormatted).toBe("13086905");
  });

  it("kezeli az üres, null és undefined bemenetet", () => {
    expect(parseTaxNumber("")).toEqual({ raw: "", base: "", vat: "", county: "", fullFormatted: "" });
    expect(parseTaxNumber(null)).toEqual({ raw: "", base: "", vat: "", county: "", fullFormatted: "" });
    expect(parseTaxNumber(undefined)).toEqual({ raw: "", base: "", vat: "", county: "", fullFormatted: "" });
  });
});

// ─── CSOPORTOS ÁFA (GROUP VAT) ──────────────────────────
describe("isGroupVatMember", () => {
  it("felismeri a csoportos áfa-tagot kötőjeles formátumból (4-es áfakód)", () => {
    expect(isGroupVatMember("23108594-4-15")).toBe(true);
    expect(isGroupVatMember("12345678-4-42")).toBe(true);
  });

  it("felismeri a csoportos áfa-tagot 11 jegyű egybefüggő formátumból", () => {
    expect(isGroupVatMember("23108594415")).toBe(true);
  });

  it("elutasítja a normál (2-es), AAM (1-es) vagy EVA (3-as) áfakódokat", () => {
    expect(isGroupVatMember("13086905-2-08")).toBe(false);
    expect(isGroupVatMember("12345678-1-42")).toBe(false);
    expect(isGroupVatMember("12345678-3-42")).toBe(false);
  });

  it("elutasítja a magát a csoportot jelölő (5-ös) áfakódot", () => {
    expect(isGroupVatMember("17781234-5-42")).toBe(false);
  });

  it("kezeli az üres vagy hibás bemeneteket", () => {
    expect(isGroupVatMember("")).toBe(false);
    expect(isGroupVatMember(null)).toBe(false);
    expect(isGroupVatMember(undefined)).toBe(false);
    expect(isGroupVatMember("12345678")).toBe(false);
  });
});

describe("isGroupVatEntity", () => {
  it("felismeri a csoportazonosító számot (5-ös áfakód)", () => {
    expect(isGroupVatEntity("17781234-5-42")).toBe(true);
    expect(isGroupVatEntity("17781234542")).toBe(true);
  });

  it("elutasítja a tagi (4-es) és egyéb kódokat", () => {
    expect(isGroupVatEntity("23108594-4-15")).toBe(false);
    expect(isGroupVatEntity("13086905-2-08")).toBe(false);
  });
});


