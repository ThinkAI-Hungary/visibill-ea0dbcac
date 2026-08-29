import { describe, it, expect } from "vitest";

// The matching logic we implemented in UploadChartOfAccountsModal.tsx
const matchCoaLine = (lineText: string) => {
  const match = lineText.match(/^\s*(\d[\d.-]*)\s+(.+)$/);
  if (!match) return null;

  const glNumber = match[1].trim();
  const name = match[2].trim();

  // Skip address lines, postal codes, footers
  const nameLower = name.toLowerCase();

  // Helper to check if a word is standalone (not part of a larger Hungarian word)
  const hasStandaloneWord = (text: string, word: string) => {
    const regex = new RegExp(`(?:^|[^a-záéíóöőúüű])${word}(?:[^a-záéíóöőúüű]|$)`, 'i');
    return regex.test(text);
  };

  if (
    nameLower.includes("budapest") || 
    hasStandaloneWord(nameLower, "utca") || 
    hasStandaloneWord(nameLower, "út") || 
    hasStandaloneWord(nameLower, "tér") || 
    hasStandaloneWord(nameLower, "tere") || 
    nameLower.includes("kft.") || 
    nameLower.includes("bt.") || 
    nameLower.includes("adószám") ||
    nameLower.includes("lapszám") ||
    nameLower.includes("üzleti év") ||
    nameLower.includes("készült:") ||
    nameLower.includes("ügyviteli")
  ) {
    return null;
  }

  return { glNumber, name };
};

describe("coaPdfParser matching & junk filtering logic", () => {
  it("should match standard Hungarian GL numbers and account names", () => {
    expect(matchCoaLine("1 BEFEKTETETT ESZKÖZÖK")).toEqual({
      glNumber: "1",
      name: "BEFEKTETETT ESZKÖZÖK",
    });

    expect(matchCoaLine("16 BERUHÁZÁSOK, FELÚJÍTÁSOK")).toEqual({
      glNumber: "16",
      name: "BERUHÁZÁSOK, FELÚJÍTÁSOK",
    });

    expect(matchCoaLine("1611 Befejezetlen beruházások 200e alatt")).toEqual({
      glNumber: "1611",
      name: "Befejezetlen beruházások 200e alatt",
    });

    expect(matchCoaLine("511 Vásárolt anyagok költségei")).toEqual({
      glNumber: "511",
      name: "Vásárolt anyagok költségei",
    });
  });

  it("should skip header/footer or address line layouts", () => {
    expect(matchCoaLine("VICTORIA Music Kft. 1024 Budapest Fény UNKOWN 15.; Üzleti év: 2026")).toBeNull();
    expect(matchCoaLine("Készült: 2026.07.21. 11:25 Lapszám: 2 / 1")).toBeNull();
    expect(matchCoaLine("Ez a jelentés a Magnum Ügyviteli Rendszer programmal készült.")).toBeNull();
    expect(matchCoaLine("Főkönyvi számla Megnevezés")).toBeNull();
    expect(matchCoaLine("S Z Á M L A T Ü K Ö R")).toBeNull();
  });
});

import { fixCharacterEncoding } from "./utils";

describe("fixCharacterEncoding helper", () => {
  it("should correctly restore Hungarian accents from question marks", () => {
    expect(fixCharacterEncoding("Besorolatlan t?telek (Elt?r? sablonb?l)")).toBe(
      "Besorolatlan tételek (Eltérő sablonból)"
    );

    expect(fixCharacterEncoding("BESOROLATLAN T?TELEK (ELT?R? SABLONB?L)")).toBe(
      "BESOROLATLAN TÉTELEK (ELTÉRŐ SABLONBÓL)"
    );

    expect(fixCharacterEncoding("Other standard text")).toBe("Other standard text");
    expect(fixCharacterEncoding("")).toBe("");
    expect(fixCharacterEncoding(null)).toBe("");
  });
});
