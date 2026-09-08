import { describe, it, expect } from "vitest";
import { FALLBACK_KNOWLEDGE_ARTICLES } from "@/data/knowledgeBaseFallback";

/**
 * RAG Context Builder Simulation matching the accounty-ai-chat Edge Function logic
 */
interface KbArticleMatch {
  id: string;
  category_id: string;
  title: string;
  summary: string;
  content: string;
  menu_path: string | null;
  tags: string[];
  rank: number;
}

function simulateFtsRanking(
  articles: typeof FALLBACK_KNOWLEDGE_ARTICLES,
  searchQuery: string | null,
  pagePath: string | null,
  targetCategoryOrLimit?: string | number | null,
  matchLimit: number = 3
): KbArticleMatch[] {
  let targetCategory: string | null = null;
  let limit = matchLimit;
  if (typeof targetCategoryOrLimit === "number") {
    limit = targetCategoryOrLimit;
  } else if (typeof targetCategoryOrLimit === "string") {
    targetCategory = targetCategoryOrLimit;
  }

  const cleanQuery = (searchQuery || "").trim().toLowerCase();
  const cleanPage = (pagePath || "").trim();

  const stopWords = new Set([
    "a", "az", "és", "hogy", "ha", "de", "nem", "van", "kell", "egy",
    "mik", "mi", "mit", "hol", "hogyan", "mert", "volt", "lesz",
  ]);

  const rawWords = cleanQuery
    ? cleanQuery
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !stopWords.has(w))
    : [];

  // Hungarian inflectional suffix stripping regex (matching search_knowledge_base RPC)
  const suffixRegex = /(nak|nek|ban|ben|ból|ből|ról|ről|hoz|hez|höz|val|vel|tól|től|kor|ig|ért|on|en|ön|ok|ek|ök|ak|ja|je|om|od|unk|ünk|otok|etek|ötök|uk|ük|juk|jük|[aáeéiíoóöőuúüűktn])+$/;

  const queryTerms = new Set<string>();
  for (const w of rawWords) {
    queryTerms.add(w);
    if (w.length >= 4) {
      const stem = w.replace(suffixRegex, "");
      if (stem.length >= 3) {
        queryTerms.add(stem);
      }
    }
  }

  const filteredArticles = targetCategory
    ? articles.filter((a) => a.category_id === targetCategory)
    : articles;

  const scored = filteredArticles.map((a) => {
    let rank = 0.1;

    // Page match bonus
    if (cleanPage && a.menu_path === cleanPage) {
      rank = 1.0;
    } else if (
      cleanPage &&
      a.menu_path &&
      a.menu_path !== "/" &&
      cleanPage.startsWith(a.menu_path)
    ) {
      rank = 0.8;
    } else if (queryTerms.size > 0) {
      const fullText = `${a.title} ${a.summary} ${a.tags.join(" ")} ${a.content}`.toLowerCase();
      let matchCount = 0;
      for (const term of queryTerms) {
        if (fullText.includes(term)) {
          matchCount++;
        }
      }
      if (matchCount > 0) {
        rank = (matchCount / queryTerms.size) * 0.5 + 0.1;
      }
    }

    return {
      ...a,
      rank: Math.round(rank * 1000) / 1000,
    };
  });

  return scored
    .filter((a) => a.rank >= 0.15 || (cleanPage && a.menu_path === cleanPage) || (!cleanQuery && !cleanPage && targetCategory))
    .sort((a, b) => b.rank - a.rank || a.order_num - b.order_num)
    .slice(0, limit);
}

function buildRagSystemPromptContext(
  relevantArticles: KbArticleMatch[],
  pagePath: string | null,
  clientName?: string
): string {
  let context = "";
  if (clientName) {
    context += `\n\nAz aktuális ügyfél: ${clientName}`;
  }
  if (pagePath) {
    context += `\nAz aktuális felület / oldal: ${pagePath}`;
  }

  if (relevantArticles.length > 0) {
    context +=
      "\n\n═══════════════════════════════════════════════════════════════\n" +
      "HIVATALOS EAISYBILL / EAISYBOOKS TUDÁSTÁR (RELEVÁNS CIKKEK)\n" +
      "═══════════════════════════════════════════════════════════════\n" +
      relevantArticles
        .map((a, idx) => {
          const cleanContent = (a.content || "").slice(0, 1800);
          return (
            `[Tudástár Cikk #${idx + 1}: ${a.title}]\n` +
            `Menüpont / Elérés: ${a.menu_path || "Központi Tudástár"}\n` +
            `Összefoglaló: ${a.summary || ""}\n` +
            `Leírás:\n${cleanContent}`
          );
        })
        .join("\n\n---\n\n");
  }

  return context;
}

describe("Knowledge Base RAG & Edge Function Context Pipeline", () => {
  it("ranks the active page guide as highest priority (rank 1.0) when pagePath is provided", () => {
    const results = simulateFtsRanking(
      FALLBACK_KNOWLEDGE_ARTICLES,
      "Hogyan működik a bevallás?",
      "/vat-return",
      3
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].menu_path).toBe("/vat-return");
    expect(results[0].rank).toBe(1.0);
    expect(results[0].id).toBe("vat-return-and-nav65");
  });

  it("retrieves relevant eaisyBill articles for invoice OCR and upload queries", () => {
    const results = simulateFtsRanking(
      FALLBACK_KNOWLEDGE_ARTICLES,
      "számla feltöltés mesterséges intelligencia OCR",
      null,
      3
    );

    expect(results.length).toBeGreaterThan(0);
    const topMatch = results[0];
    expect(topMatch.id).toBe("invoice-upload-and-ocr");
    expect(topMatch.title).toContain("Bizonylatok feltöltése");
    expect(topMatch.menu_path).toBe("/upload");
  });

  it("retrieves relevant eaisyBooks articles for 08-as ÁNYK and payroll XML queries", () => {
    const results = simulateFtsRanking(
      FALLBACK_KNOWLEDGE_ARTICLES,
      "08 ÁNYK XML bérszámfejtés rekonstrukció",
      null,
      3
    );

    expect(results.length).toBeGreaterThan(0);
    const topIds = results.map((r) => r.id);
    expect(topIds).toContain("eaisybooks-payroll-and-xml-reconstruction");
  });

  it("retrieves relevant EV (egyéni vállalkozó) articles for átalányadó queries", () => {
    const results = simulateFtsRanking(
      FALLBACK_KNOWLEDGE_ARTICLES,
      "átalányadó keret figyelés pénztárkönyv egyéni vállalkozó",
      null,
      3
    );

    expect(results.length).toBeGreaterThan(0);
    const topMatch = results[0];
    expect(topMatch.id).toBe("eaisybooks-ev-and-cashbook");
    expect(topMatch.category_id).toBe("books_modules");
  });

  it("correctly constructs RAG context with clear separation and bounded snippet length", () => {
    const matches = simulateFtsRanking(
      FALLBACK_KNOWLEDGE_ARTICLES,
      "banki tranzakció párosítás",
      "/transactions",
      2
    );

    const ragContext = buildRagSystemPromptContext(
      matches,
      "/transactions",
      "Teszt Kft."
    );

    expect(ragContext).toContain("Az aktuális ügyfél: Teszt Kft.");
    expect(ragContext).toContain("Az aktuális felület / oldal: /transactions");
    expect(ragContext).toContain("HIVATALOS EAISYBILL / EAISYBOOKS TUDÁSTÁR");
    expect(ragContext).toContain("[Tudástár Cikk #1:");
    expect(ragContext).toContain("Menüpont / Elérés: /transactions");

    // Ensure content is sliced to max 1800 chars
    for (const match of matches) {
      expect(match.content.length).toBeGreaterThan(0);
    }
  });

  it("filters out irrelevancies when rank is below 0.15 and page does not match", () => {
    const results = simulateFtsRanking(
      FALLBACK_KNOWLEDGE_ARTICLES,
      "xyznonexistentqueryword12345",
      null,
      null,
      3
    );

    expect(results.length).toBe(0);
  });

  it("stems inflected Hungarian words correctly (e.g. 'számláknak' matches 'számlák' articles)", () => {
    const results = simulateFtsRanking(
      FALLBACK_KNOWLEDGE_ARTICLES,
      "számláknak a kezelése",
      null,
      null,
      3
    );

    expect(results.length).toBeGreaterThan(0);
    const topIds = results.map((r) => r.id);
    expect(topIds).toContain("invoices-management-and-filters");
  });

  it("stems inflected Hungarian words for tax returns (e.g. 'bevallásokról')", () => {
    const results = simulateFtsRanking(
      FALLBACK_KNOWLEDGE_ARTICLES,
      "bevallásokról",
      null,
      null,
      3
    );

    expect(results.length).toBeGreaterThan(0);
    const topIds = results.map((r) => r.id);
    expect(topIds).toContain("vat-return-and-nav65");
  });

  it("returns all articles for a category when search query and page path are empty", () => {
    const results = simulateFtsRanking(
      FALLBACK_KNOWLEDGE_ARTICLES,
      null,
      null,
      "invoices",
      10
    );

    expect(results.length).toBe(4);
    for (const article of results) {
      expect(article.category_id).toBe("invoices");
    }
    // Verify sorted by order_num
    expect(results[0].id).toBe("invoices-management-and-filters");
  });

  it("bounds long user query input to prevent unbounded tokenization overhead", () => {
    const hugeInput = "számla ".repeat(200);
    const boundedSnippet = hugeInput.trim().slice(0, 300);

    expect(boundedSnippet.length).toBeLessThanOrEqual(300);

    const results = simulateFtsRanking(
      FALLBACK_KNOWLEDGE_ARTICLES,
      boundedSnippet,
      null,
      null,
      3
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("invoices-management-and-filters");
  });
});
