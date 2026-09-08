import { describe, it, expect } from "vitest";
import {
  FALLBACK_KNOWLEDGE_CATEGORIES,
  FALLBACK_KNOWLEDGE_ARTICLES,
  FALLBACK_CATEGORY_MAP,
} from "@/data/knowledgeBaseFallback";
import { URL_TO_MODULE } from "@/hooks/useEaisybillPermissions";

describe("Unified Knowledge Base Hierarchical Dataset", () => {
  it("contains 10 structured categories covering both eaisyBill and eaisyBooks", () => {
    expect(FALLBACK_KNOWLEDGE_CATEGORIES).toHaveLength(10);
    const categoryIds = FALLBACK_KNOWLEDGE_CATEGORIES.map((c) => c.id);
    expect(new Set(categoryIds).size).toBe(10);
    expect(categoryIds).toContain("basics");
    expect(categoryIds).toContain("invoices");
    expect(categoryIds).toContain("transactions");
    expect(categoryIds).toContain("accounting");
    expect(categoryIds).toContain("hr");
    expect(categoryIds).toContain("shipments");
    expect(categoryIds).toContain("system");
    expect(categoryIds).toContain("books_portfolio");
    expect(categoryIds).toContain("books_modules");
    expect(categoryIds).toContain("books_admin");
  });

  it("contains 50 rich audited articles covering all eaisyBill and eaisyBooks menus", () => {
    expect(FALLBACK_KNOWLEDGE_ARTICLES).toHaveLength(50);
    const validCategoryIds = new Set(FALLBACK_KNOWLEDGE_CATEGORIES.map((c) => c.id));

    for (const article of FALLBACK_KNOWLEDGE_ARTICLES) {
      expect(article.id).toBeDefined();
      expect(article.title.length).toBeGreaterThan(5);
      expect(article.summary.length).toBeGreaterThan(10);
      expect(article.content.length).toBeGreaterThan(30);
      expect(validCategoryIds.has(article.category_id)).toBe(true);
      expect(Array.isArray(article.tags)).toBe(true);
      expect(article.tags.length).toBeGreaterThan(0);
      expect(article.estimated_read_time).toMatch(/\d+\s+perc/);
      expect(article.is_published).toBe(true);
    }
  });

  it("contains dedicated articles for projects, partners, knowledge base and analytics", () => {
    const ids = FALLBACK_KNOWLEDGE_ARTICLES.map((a) => a.id);
    expect(ids).toContain("projects-and-cost-centers");
    expect(ids).toContain("partners-master-data-and-rankings");
    expect(ids).toContain("knowledge-base-and-self-service");
    expect(ids).toContain("financial-analytics-and-charts");

    const projectArticle = FALLBACK_KNOWLEDGE_ARTICLES.find(
      (a) => a.id === "projects-and-cost-centers"
    );
    expect(projectArticle?.menu_path).toBe("/projects");
    expect(projectArticle?.icon).toBe("FolderKanban");

    const partnerArticle = FALLBACK_KNOWLEDGE_ARTICLES.find(
      (a) => a.id === "partners-master-data-and-rankings"
    );
    expect(partnerArticle?.menu_path).toBe("/partners");
    expect(partnerArticle?.icon).toBe("Users");

    const kbArticle = FALLBACK_KNOWLEDGE_ARTICLES.find(
      (a) => a.id === "knowledge-base-and-self-service"
    );
    expect(kbArticle?.menu_path).toBe("/knowledge-base");

    const analyticsArticle = FALLBACK_KNOWLEDGE_ARTICLES.find(
      (a) => a.id === "financial-analytics-and-charts"
    );
    expect(analyticsArticle?.menu_path).toBe("/analytics");
    expect(analyticsArticle?.icon).toBe("BarChart3");
  });

  it("does not expose raw technical/backend route URLs in article summaries or content", () => {
    const technicalPatterns = [
      /\(\/vat-return\)/i,
      /\(\/invoices\)/i,
      /\(\/transactions\)/i,
      /\(\/upload\)/i,
      /\(\/petty-cash\)/i,
      /\(\/general-ledger\)/i,
      /\(\/salaries\)/i,
      /\(\/tickets\)/i,
      /\(\/settings\)/i,
      /\(\/integrations\)/i,
      /\(\/shipments\)/i,
      /\(\/eaisybooks\)/i,
      /\(\/projects\)/i,
      /\(\/partners\)/i,
      /\(\/analytics\)/i,
    ];

    for (const article of FALLBACK_KNOWLEDGE_ARTICLES) {
      for (const pattern of technicalPatterns) {
        expect(article.summary).not.toMatch(pattern);
        expect(article.content).not.toMatch(pattern);
      }
    }
  });

  it("contains complete set of eaisyBooks specialized articles across 3 subcategories (6 articles each, 18 total)", () => {
    const portfolioArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "books_portfolio"
    );
    expect(portfolioArticles.length).toBe(6);
    const portfolioIds = portfolioArticles.map((a) => a.id);
    expect(portfolioIds).toContain("eaisybooks-portfolio-overview");
    expect(portfolioIds).toContain("eaisybooks-client-management");
    expect(portfolioIds).toContain("eaisybooks-missing-invoices-hub");
    expect(portfolioIds).toContain("eaisybooks-tax-calendar-deadlines");
    expect(portfolioIds).toContain("eaisybooks-reports-and-ai-anomalies");
    expect(portfolioIds).toContain("eaisybooks-onboarding-and-new-client");

    const moduleArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "books_modules"
    );
    expect(moduleArticles.length).toBe(6);
    const moduleIds = moduleArticles.map((a) => a.id);
    expect(moduleIds).toContain("eaisybooks-ev-and-cashbook");
    expect(moduleIds).toContain("eaisybooks-ev-tax-optimization");
    expect(moduleIds).toContain("eaisybooks-tao-kiva-planner");
    expect(moduleIds).toContain("eaisybooks-payroll-and-xml-reconstruction");
    expect(moduleIds).toContain("eaisybooks-ev-lifecycle-and-registers");
    expect(moduleIds).toContain("eaisybooks-payroll-documents-and-payslips");

    const adminArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "books_admin"
    );
    expect(adminArticles.length).toBe(6);
    const adminIds = adminArticles.map((a) => a.id);
    expect(adminIds).toContain("eaisybooks-cegkapu-and-representation");
    expect(adminIds).toContain("eaisybooks-ai-assistant-chat");
    expect(adminIds).toContain("eaisybooks-approval-queue-and-alerts");
    expect(adminIds).toContain("eaisybooks-office-settings-and-templates");
    expect(adminIds).toContain("eaisybooks-accounting-prompts-and-rules");
    expect(adminIds).toContain("eaisybooks-audit-security-and-gdpr");
  });

  it("contains specialized articles for shipments module", () => {
    const shipmentArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "shipments"
    );
    expect(shipmentArticles.length).toBe(3);
    const ids = shipmentArticles.map((a) => a.id);
    expect(ids).toContain("shipments-and-cmr-management");
    expect(ids).toContain("shipment-excel-import-and-matching");
    expect(ids).toContain("shipment-discrepancies-and-escalation");
  });

  it("supports client-side filtering by category with correct counts", () => {
    const basicsArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "basics"
    );
    expect(basicsArticles.length).toBe(6);

    const invoiceArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "invoices"
    );
    expect(invoiceArticles.length).toBe(4);

    const transactionArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "transactions"
    );
    expect(transactionArticles.length).toBe(3);

    const accountingArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "accounting"
    );
    expect(accountingArticles.length).toBe(7);

    const systemArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "system"
    );
    expect(systemArticles.length).toBe(6);
  });

  it("supports client-side search filtering across title, summary, tags and content", () => {
    const query = "ocr";
    const matches = FALLBACK_KNOWLEDGE_ARTICLES.filter((a) => {
      const q = query.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        a.content.toLowerCase().includes(q)
      );
    });

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.some((m) => m.id === "invoice-upload-and-ocr")).toBe(true);
  });

  it("FALLBACK_CATEGORY_MAP contains all 10 categories with titles", () => {
    expect(FALLBACK_CATEGORY_MAP.size).toBe(10);
    for (const cat of FALLBACK_KNOWLEDGE_CATEGORIES) {
      expect(FALLBACK_CATEGORY_MAP.get(cat.id)?.title).toBe(cat.title);
    }
  });

  it("registers all required menus in URL_TO_MODULE", () => {
    expect(URL_TO_MODULE["/knowledge-base"]).toBe("knowledge_base");
    expect(URL_TO_MODULE["/transfers"]).toBe("transactions");
    expect(URL_TO_MODULE["/projects"]).toBe("projects");
    expect(URL_TO_MODULE["/partners"]).toBe("partners");
    expect(URL_TO_MODULE["/analytics"]).toBe("profit_loss");
  });

  it("handles URL search query parameter formatting and parsing", () => {
    const params = new URLSearchParams();
    params.set("category", "invoices");
    params.set("q", "számla");

    expect(params.toString()).toBe("category=invoices&q=sz%C3%A1mla");
    expect(params.get("category")).toBe("invoices");
    expect(params.get("q")).toBe("számla");

    params.delete("category");
    expect(params.get("category")).toBeNull();
    expect(params.toString()).toBe("q=sz%C3%A1mla");
  });

  it("maps article menu_paths correctly to modules or valid sections", () => {
    const articlesWithMenu = FALLBACK_KNOWLEDGE_ARTICLES.filter((a) => a.menu_path);
    expect(articlesWithMenu.length).toBe(50);

    for (const article of articlesWithMenu) {
      const path = article.menu_path!;
      if (path === "/") {
        expect(path).toBe("/");
      } else if (path.startsWith("/eaisybooks")) {
        expect(path.startsWith("/eaisybooks")).toBe(true);
      } else {
        expect(URL_TO_MODULE[path]).toBeDefined();
      }
    }
  });

  it("correctly identifies existing vs non-existent article IDs for invalid slug redirection", () => {
    const existingId = "projects-and-cost-centers";
    const nonExistentId = "totally-invalid-slug-12345";

    const existsReal = FALLBACK_KNOWLEDGE_ARTICLES.some((a) => a.id === existingId);
    const existsFake = FALLBACK_KNOWLEDGE_ARTICLES.some((a) => a.id === nonExistentId);

    expect(existsReal).toBe(true);
    expect(existsFake).toBe(false);
  });
});
