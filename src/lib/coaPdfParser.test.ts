import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

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

// Integration parsing function similar to parsePdfChartOfAccounts but using local node pdfjsLib
const parsePdfFile = async (filePath: string): Promise<any[]> => {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const rows: any[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];
    
    // Group text items by y coordinate with 3px tolerance
    const tolerance = 3;
    const yGroups: { y: number; items: any[] }[] = [];
    
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = item.transform[5];
      let group = yGroups.find(g => Math.abs(g.y - y) <= tolerance);
      if (!group) {
        group = { y, items: [] };
        yGroups.push(group);
      }
      group.items.push(item);
    }
    
    // Sort groups from top to bottom (y descending)
    yGroups.sort((a, b) => b.y - a.y);
    
    for (const group of yGroups) {
      // Sort items within the same line from left to right (x ascending)
      group.items.sort((a, b) => a.transform[4] - b.transform[4]);
      
      const lineText = group.items.map(item => item.str).join(" ").trim();
      if (!lineText) continue;

      const parsed = matchCoaLine(lineText);
      if (parsed) {
        rows.push({
          gl_number: parsed.glNumber,
          short_name: parsed.name
        });
      }
    }
  }

  return rows;
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

  it("should parse the actual számlatükör.pdf and retrieve all accounts", async () => {
    const pdfPath = path.resolve(__dirname, "../../tests/docs/számlatükör.pdf");
    expect(fs.existsSync(pdfPath)).toBe(true);

    const parsedAccounts = await parsePdfFile(pdfPath);
    
    // Check that we retrieved accounts
    expect(parsedAccounts.length).toBeGreaterThan(50);

    // Verify presence of specific key accounts from the PDF
    const findAccount = (num: string) => parsedAccounts.find(a => a.gl_number === num);

    expect(findAccount("1")).toBeDefined();
    expect(findAccount("16")).toBeDefined();
    expect(findAccount("1611")).toBeDefined();
    expect(findAccount("311")).toBeDefined();
    expect(findAccount("3841")).toBeDefined(); // ERSTE Bank HUF 937
    expect(findAccount("453")).toBeDefined(); // Vevőtől kapott előlegek
    expect(findAccount("5111")).toBeDefined(); // Vásárolt anyagok
    expect(findAccount("5271")).toBeDefined(); // Posta költségek
    expect(findAccount("92")).toBeDefined(); // EXPORTÉRTÉKESÍTÉS ÁRBEVÉTELE
    expect(findAccount("9211")).toBeDefined(); // Külföldinek értékesített...
    expect(findAccount("979")).toBeDefined(); // Egyéb pénzügyi bevételek

    // Verify name matches
    expect(findAccount("92").short_name).toBe("EXPORTÉRTÉKESÍTÉS ÁRBEVÉTELE");

    // Verify name matches
    expect(findAccount("1611").short_name).toBe("Befejezetlen beruházások 200e alatt");
    expect(findAccount("3841").short_name).toBe("ERSTE Bank HUF 937");
    expect(findAccount("5271").short_name).toBe("Posta költségek");

    // Verify that NO header/footer lines are present as accounts
    const hasBudapest = parsedAccounts.some(a => a.short_name.toLowerCase().includes("budapest"));
    const hasMagnum = parsedAccounts.some(a => a.short_name.toLowerCase().includes("magnum"));
    const hasLapszam = parsedAccounts.some(a => a.short_name.toLowerCase().includes("lapszám"));
    const hasKeszult = parsedAccounts.some(a => a.short_name.toLowerCase().includes("készült"));

    expect(hasBudapest).toBe(false);
    expect(hasMagnum).toBe(false);
    expect(hasLapszam).toBe(false);
    expect(hasKeszult).toBe(false);

    console.log(`Parsed ${parsedAccounts.length} accounts successfully from számlatükör.pdf!`);
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
