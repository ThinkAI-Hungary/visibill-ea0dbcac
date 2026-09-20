import { describe, it, expect } from "vitest";

interface HistoricalInvoice {
  supplier_name: string | null;
  category_id: string | null;
}

/**
 * Pure helper implementing the partner history majority-vote categorization algorithm
 * matching the logic in Postgres `public.get_company_partner_majority_categories`
 * and Edge Function `auto-categorize-invoices`.
 */
export function resolvePartnerMajorityCategory(
  supplierName: string | null,
  history: HistoricalInvoice[],
  validCategoryIds?: Set<string>
): string | null {
  if (!supplierName || !supplierName.trim()) {
    return null;
  }

  const normTarget = supplierName.trim().toLowerCase();

  // Aggregate category counts for the normalized partner
  const countsByCat = new Map<string, number>();

  for (const inv of history) {
    if (!inv.supplier_name || !inv.category_id) continue;
    if (inv.supplier_name.trim().toLowerCase() !== normTarget) continue;
    if (validCategoryIds && !validCategoryIds.has(inv.category_id)) continue;

    countsByCat.set(inv.category_id, (countsByCat.get(inv.category_id) || 0) + 1);
  }

  if (countsByCat.size === 0) {
    return null; // No history for this partner -> defer to AI
  }

  // Sort descending by count
  const sorted = Array.from(countsByCat.entries()).sort((a, b) => b[1] - a[1]);
  const [topCategory, topCount] = sorted[0];
  const secondCount = sorted.length > 1 ? sorted[1][1] : 0;

  // Strict majority rule: top count must strictly exceed second count
  if (topCount > secondCount) {
    return topCategory;
  }

  // Tie (holtverseny) -> return null so AI can evaluate line items & amounts
  return null;
}

describe("Partner Historical Majority-Vote Auto-Categorization", () => {
  const IT_CAT_ID = "3ebd192c-3363-40a3-aaf2-a0f034c4f7d2";
  const MARKETING_CAT_ID = "7ba49ab4-0eeb-4301-9098-220d7ffb453a";
  const OFFICE_CAT_ID = "6d7c8243-d7ab-4ecd-8b8c-dc7de52269d3";

  it("assigns category directly when partner only has 1 historical category", () => {
    const history: HistoricalInvoice[] = [
      { supplier_name: "DigitalOcean LLC", category_id: IT_CAT_ID },
      { supplier_name: "digitalocean llc", category_id: IT_CAT_ID },
    ];

    const result = resolvePartnerMajorityCategory("DigitalOcean LLC", history);
    expect(result).toBe(IT_CAT_ID);
  });

  it("assigns category with strict majority when partner has multiple categories", () => {
    const history: HistoricalInvoice[] = [
      { supplier_name: "Google Cloud", category_id: IT_CAT_ID },
      { supplier_name: "Google Cloud", category_id: IT_CAT_ID },
      { supplier_name: "Google Cloud", category_id: IT_CAT_ID },
      { supplier_name: "Google Cloud", category_id: MARKETING_CAT_ID },
    ];

    // 3 IT vs 1 Marketing -> IT wins
    const result = resolvePartnerMajorityCategory("google cloud", history);
    expect(result).toBe(IT_CAT_ID);
  });

  it("returns null (defers to AI) when top categories are in a tie (holtverseny)", () => {
    const history: HistoricalInvoice[] = [
      { supplier_name: "Meta Platforms", category_id: MARKETING_CAT_ID },
      { supplier_name: "Meta Platforms", category_id: MARKETING_CAT_ID },
      { supplier_name: "Meta Platforms", category_id: IT_CAT_ID },
      { supplier_name: "Meta Platforms", category_id: IT_CAT_ID },
    ];

    // 2 Marketing vs 2 IT -> TIE -> null (AI must decide)
    const result = resolvePartnerMajorityCategory("Meta Platforms", history);
    expect(result).toBeNull();
  });

  it("returns null (defers to AI) when partner has zero historical invoices", () => {
    const history: HistoricalInvoice[] = [
      { supplier_name: "Existing Partner", category_id: IT_CAT_ID },
    ];

    const result = resolvePartnerMajorityCategory("Brand New Partner", history);
    expect(result).toBeNull();
  });

  it("handles whitespace, casing, and empty names safely", () => {
    const history: HistoricalInvoice[] = [
      { supplier_name: "  MVM Next Energiakereskedelmi Zrt.  ", category_id: OFFICE_CAT_ID },
    ];

    expect(resolvePartnerMajorityCategory("mvm next energiakereskedelmi zrt.", history)).toBe(OFFICE_CAT_ID);
    expect(resolvePartnerMajorityCategory("  MVM NEXT ENERGIAKERESKEDELMI ZRT.  ", history)).toBe(OFFICE_CAT_ID);
    expect(resolvePartnerMajorityCategory("", history)).toBeNull();
    expect(resolvePartnerMajorityCategory(null, history)).toBeNull();
  });

  it("ignores deleted/invalid category IDs not in validCategoryIds set", () => {
    const DELETED_CAT = "00000000-0000-0000-0000-000000000000";
    const history: HistoricalInvoice[] = [
      { supplier_name: "Adobe", category_id: DELETED_CAT },
      { supplier_name: "Adobe", category_id: IT_CAT_ID },
    ];

    const validIds = new Set([IT_CAT_ID, MARKETING_CAT_ID, OFFICE_CAT_ID]);
    const result = resolvePartnerMajorityCategory("Adobe", history, validIds);
    expect(result).toBe(IT_CAT_ID);
  });

  it("resolves category via 8-digit Hungarian tax core when partner name varies", () => {
    interface HistoricalTaxInvoice {
      supplier_name: string | null;
      tax_number: string | null;
      category_id: string | null;
    }

    const extractTaxCore = (raw: string | null | undefined): string | null => {
      if (!raw) return null;
      const digits = raw.replace(/[^0-9]/g, "");
      return digits.length >= 8 ? digits.slice(0, 8) : null;
    };

    const resolveWithTaxCore = (
      targetName: string | null,
      targetTax: string | null,
      history: HistoricalTaxInvoice[]
    ): string | null => {
      // 1. Try name first
      const nameMatch = resolvePartnerMajorityCategory(
        targetName,
        history.map(h => ({ supplier_name: h.supplier_name, category_id: h.category_id }))
      );
      if (nameMatch) return nameMatch;

      // 2. Fallback to 8-digit tax core
      const targetCore = extractTaxCore(targetTax);
      if (!targetCore) return null;

      const countsByCat = new Map<string, number>();
      for (const inv of history) {
        if (!inv.category_id) continue;
        const invCore = extractTaxCore(inv.tax_number);
        if (invCore === targetCore) {
          countsByCat.set(inv.category_id, (countsByCat.get(inv.category_id) || 0) + 1);
        }
      }

      if (countsByCat.size === 0) return null;
      const sorted = Array.from(countsByCat.entries()).sort((a, b) => b[1] - a[1]);
      const [topCat, topCnt] = sorted[0];
      const secondCnt = sorted.length > 1 ? sorted[1][1] : 0;
      return topCnt > secondCnt ? topCat : null;
    };

    const history: HistoricalTaxInvoice[] = [
      { supplier_name: "Telekom Magyarország Zrt.", tax_number: "10578801-2-42", category_id: IT_CAT_ID },
      { supplier_name: "Magyar Telekom Nyrt.", tax_number: "HU10578801", category_id: IT_CAT_ID },
      { supplier_name: "Telekom HU", tax_number: "10578801", category_id: MARKETING_CAT_ID },
    ];

    // Candidate has a completely new/different name variant ("T-Mobile Magyarorszag"), but same tax core
    const candidateName = "T-Mobile Magyarorszag Kft.";
    const candidateTax = "10578801-2-44";

    const resolved = resolveWithTaxCore(candidateName, candidateTax, history);
    expect(resolved).toBe(IT_CAT_ID); // 2 IT vs 1 Marketing -> IT wins via tax core!
  });
});

