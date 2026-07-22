import { describe, it, expect } from "vitest";
import {
  buildInvoiceChain,
  type ChainableInvoice,
} from "./invoiceChainUtils";

// ─── Segédváltozók ─────────────────────────────────────
const invoiceA: ChainableInvoice = { id: "A", parent_invoice_id: null };
const invoiceB: ChainableInvoice = { id: "B", parent_invoice_id: "A" };
const invoiceC: ChainableInvoice = { id: "C", parent_invoice_id: "B" };

describe("buildInvoiceChain", () => {
  // ─── 1. Alapeset ───────────────────────────────────
  it("magányos számla — lánc hossza 1", () => {
    const standalone: ChainableInvoice = { id: "X", parent_invoice_id: null };
    const result = buildInvoiceChain([standalone], standalone);

    expect(result.chain).toHaveLength(1);
    expect(result.chain[0].id).toBe("X");
    expect(result.missingIds).toHaveLength(0);
  });

  // ─── 2. Lineáris lánc (A → B → C) ─────────────────
  describe("lineáris lánc: A → B → C", () => {
    const allInvoices = [invoiceA, invoiceB, invoiceC];

    it("A-ból indulva mind a hármat megtalálja", () => {
      const result = buildInvoiceChain(allInvoices, invoiceA);
      const ids = result.chain.map((i) => i.id);

      expect(ids).toHaveLength(3);
      expect(ids).toContain("A");
      expect(ids).toContain("B");
      expect(ids).toContain("C");
    });

    it("B-ből indulva mind a hármat megtalálja", () => {
      const result = buildInvoiceChain(allInvoices, invoiceB);
      const ids = result.chain.map((i) => i.id);

      expect(ids).toHaveLength(3);
      expect(ids).toContain("A");
      expect(ids).toContain("B");
      expect(ids).toContain("C");
    });

    it("C-ből indulva mind a hármat megtalálja", () => {
      const result = buildInvoiceChain(allInvoices, invoiceC);
      const ids = result.chain.map((i) => i.id);

      expect(ids).toHaveLength(3);
      expect(ids).toContain("A");
      expect(ids).toContain("B");
      expect(ids).toContain("C");
    });

    it("a sorrend szülő → gyerek irányú (A, B, C)", () => {
      const result = buildInvoiceChain(allInvoices, invoiceC);
      const ids = result.chain.map((i) => i.id);

      expect(ids).toEqual(["A", "B", "C"]);
    });
  });

  // ─── 2b. Háromtagú számlaláncolat (Díjbekérő → Előlegszámla → Végszámla) ───
  describe("háromtagú számlaláncolat (Díjbekérő → Előlegszámla → Végszámla)", () => {
    const proforma: ChainableInvoice = { id: "proforma-1", parent_invoice_id: null };
    const eloleg: ChainableInvoice = { id: "eloleg-1", parent_invoice_id: "proforma-1" };
    const veg: ChainableInvoice = { id: "veg-1", parent_invoice_id: "eloleg-1" };
    const all = [proforma, eloleg, veg];

    it("végszámlából kiindulva a teljes láncot visszaadja szülő -> gyerek sorrendben", () => {
      const result = buildInvoiceChain(all, veg);
      const ids = result.chain.map((i) => i.id);
      expect(ids).toEqual(["proforma-1", "eloleg-1", "veg-1"]);
    });
  });

  // ─── 3. Megszakadt lánc ────────────────────────────
  describe("megszakadt lánc", () => {
    it("hiányzó szülő esetén jelzi a missingIds-ben", () => {
      // B hivatkozik A-ra, de A nincs a listában
      const result = buildInvoiceChain([invoiceB, invoiceC], invoiceC);

      expect(result.missingIds).toContain("A");
      // B és C azért megvan
      const ids = result.chain.map((i) => i.id);
      expect(ids).toContain("B");
      expect(ids).toContain("C");
    });

    it("nem omlik össze, ha a hivatkozott számla nincs a tömbben", () => {
      const orphan: ChainableInvoice = {
        id: "orphan",
        parent_invoice_id: "nonexistent-id",
      };
      const result = buildInvoiceChain([orphan], orphan);

      expect(result.chain).toHaveLength(1);
      expect(result.chain[0].id).toBe("orphan");
      expect(result.missingIds).toEqual(["nonexistent-id"]);
    });
  });

  // ─── 4. Körkörös hivatkozás védelem ────────────────
  describe("körkörös hivatkozás védelem", () => {
    it("A ↔ B körkörös hivatkozás nem okoz végtelen ciklust", () => {
      const circA: ChainableInvoice = { id: "circA", parent_invoice_id: "circB" };
      const circB: ChainableInvoice = { id: "circB", parent_invoice_id: "circA" };
      const all = [circA, circB];

      // Ez nem szabad, hogy végtelen ciklusba kerüljön
      const result = buildInvoiceChain(all, circA);
      const ids = result.chain.map((i) => i.id);

      expect(ids).toContain("circA");
      expect(ids).toContain("circB");
      expect(ids.length).toBeLessThanOrEqual(2);
    });

    it("háromtagú kör (A → B → C → A) nem okoz végtelen ciklust", () => {
      const cA: ChainableInvoice = { id: "cA", parent_invoice_id: "cC" };
      const cB: ChainableInvoice = { id: "cB", parent_invoice_id: "cA" };
      const cC: ChainableInvoice = { id: "cC", parent_invoice_id: "cB" };
      const all = [cA, cB, cC];

      const result = buildInvoiceChain(all, cA);
      const ids = result.chain.map((i) => i.id);

      expect(ids).toHaveLength(3);
      expect(ids).toContain("cA");
      expect(ids).toContain("cB");
      expect(ids).toContain("cC");
    });
  });
});
