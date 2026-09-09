import { describe, it, expect } from "vitest";
import {
  parseArticleSections,
  parseInlineFormatting,
} from "@/components/knowledge-base/KnowledgeArticleStructuredContent";
import { FALLBACK_KNOWLEDGE_ARTICLES } from "@/data/knowledgeBaseFallback";

describe("KnowledgeArticleStructuredContent Parser", () => {
  it("correctly parses inline formatting without throwing", () => {
    const res = parseInlineFormatting("Ez egy **félkövér** szöveg és `kód minta`.");
    expect(res).toBeDefined();
  });

  it("parses all 63 articles into structured sections with valid TOC and subfeatures", () => {
    for (const article of FALLBACK_KNOWLEDGE_ARTICLES) {
      const parsed = parseArticleSections(article.content, article.menu_path);

      // Section 1 checks
      expect(parsed.navSpec).toBeDefined();
      expect(parsed.navSpec.sidebarPosition.length).toBeGreaterThan(0);

      // Section 2 checks
      expect(parsed.purposeOverview).toBeDefined();
      expect(parsed.purposeOverview.intro.length).toBeGreaterThan(0);

      // Section 3 checks
      expect(parsed.subFeatures.length).toBeGreaterThan(0);
      for (const sub of parsed.subFeatures) {
        expect(sub.subIndex).toMatch(/^3\.\d+$/);
        expect(sub.title.length).toBeGreaterThan(0);
        expect(sub.hogyHivjak.length).toBeGreaterThan(0);
        expect(sub.mireValo.length).toBeGreaterThan(0);
        expect(sub.holTalalhato.length).toBeGreaterThan(0);
        expect(sub.steps.length).toBeGreaterThan(0);
      }

      // TOC checks
      expect(parsed.toc.length).toBe(parsed.subFeatures.length + 2);
      expect(parsed.toc[0].id).toBe("sec-navigation");
      expect(parsed.toc[1].id).toBe("sec-purpose");
    }
  });

  it("extracts exact subfeatures for eaisybill-petty-cash (Házipénztár)", () => {
    const pettyCash = FALLBACK_KNOWLEDGE_ARTICLES.find(
      (a) => a.id === "eaisybill-petty-cash"
    );
    expect(pettyCash).toBeDefined();

    const parsed = parseArticleSections(pettyCash!.content, pettyCash!.menu_path);
    expect(parsed.subFeatures).toHaveLength(5);

    const firstSub = parsed.subFeatures[0];
    expect(firstSub.subIndex).toBe("3.1");
    expect(firstSub.title).toBe("Új Pénztárbizonylat Kiállítása");
    expect(firstSub.hogyHivjak).toContain("Új bizonylat");
    expect(firstSub.steps.length).toBeGreaterThanOrEqual(5);
    expect(firstSub.eredmeny.length).toBeGreaterThan(0);
  });
});
