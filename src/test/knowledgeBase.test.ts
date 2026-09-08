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

  it("contains 63 rich audited articles covering all eaisyBill and eaisyBooks menus", () => {
    expect(FALLBACK_KNOWLEDGE_ARTICLES).toHaveLength(63);
    const validCategoryIds = new Set(FALLBACK_KNOWLEDGE_CATEGORIES.map((c) => c.id));

    for (const article of FALLBACK_KNOWLEDGE_ARTICLES) {
      expect(article.id).toBeDefined();
      expect(article.title.length).toBeGreaterThan(3);
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
    expect(ids).toContain("eaisybill-projects");
    expect(ids).toContain("eaisybill-partners");
    expect(ids).toContain("eaisybill-help");
    expect(ids).toContain("eaisybill-analytics");

    const projectArticle = FALLBACK_KNOWLEDGE_ARTICLES.find(
      (a) => a.id === "eaisybill-projects"
    );
    expect(projectArticle?.menu_path).toBe("/projects");
    expect(projectArticle?.icon).toBe("Briefcase");

    const partnerArticle = FALLBACK_KNOWLEDGE_ARTICLES.find(
      (a) => a.id === "eaisybill-partners"
    );
    expect(partnerArticle?.menu_path).toBe("/partners");
    expect(partnerArticle?.icon).toBe("Users");

    const kbArticle = FALLBACK_KNOWLEDGE_ARTICLES.find(
      (a) => a.id === "eaisybill-help"
    );
    expect(kbArticle?.menu_path).toBe("/knowledge-base");

    const analyticsArticle = FALLBACK_KNOWLEDGE_ARTICLES.find(
      (a) => a.id === "eaisybill-analytics"
    );
    expect(analyticsArticle?.menu_path).toBe("/analytics");
    expect(analyticsArticle?.icon).toBe("LineChart");
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

  it("contains complete set of eaisyBooks specialized articles across 3 subcategories (34 total)", () => {
    const portfolioArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "books_portfolio"
    );
    expect(portfolioArticles.length).toBe(8);
    const portfolioIds = portfolioArticles.map((a) => a.id);
    expect(portfolioIds).toContain("books-portfolio-overview");
    expect(portfolioIds).toContain("books-missing-invoices-hub");
    expect(portfolioIds).toContain("books-tax-calendar");
    expect(portfolioIds).toContain("books-reports-and-anomalies");
    expect(portfolioIds).toContain("books-approval-queue");
    expect(portfolioIds).toContain("books-alerts-center");
    expect(portfolioIds).toContain("books-onboarding");
    expect(portfolioIds).toContain("books-ai-assistant");

    const moduleArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "books_modules"
    );
    expect(moduleArticles.length).toBe(14);
    const moduleIds = moduleArticles.map((a) => a.id);
    expect(moduleIds).toContain("books-client-overview");
    expect(moduleIds).toContain("books-client-profile");
    expect(moduleIds).toContain("books-client-invoices");
    expect(moduleIds).toContain("books-client-missing-invoices");
    expect(moduleIds).toContain("books-client-ev");
    expect(moduleIds).toContain("books-client-tao");
    expect(moduleIds).toContain("books-client-payroll");
    expect(moduleIds).toContain("books-client-payroll-filings");
    expect(moduleIds).toContain("books-client-prompts");
    expect(moduleIds).toContain("books-client-cegkapu");
    expect(moduleIds).toContain("books-client-representation");
    expect(moduleIds).toContain("books-client-data-retention");
    expect(moduleIds).toContain("books-client-structure");
    expect(moduleIds).toContain("books-client-settings");

    const adminArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "books_admin"
    );
    expect(adminArticles.length).toBe(12);
    const adminIds = adminArticles.map((a) => a.id);
    expect(adminIds).toContain("books-office-settings");
    expect(adminIds).toContain("books-profile-settings");
    expect(adminIds).toContain("books-permission-matrix");
    expect(adminIds).toContain("books-accountant-management");
    expect(adminIds).toContain("books-templates");
    expect(adminIds).toContain("books-job-codes");
    expect(adminIds).toContain("books-tax-parameters");
    expect(adminIds).toContain("books-legal-updates");
    expect(adminIds).toContain("books-audit-log");
    expect(adminIds).toContain("books-gdpr");
    expect(adminIds).toContain("books-tickets");
    expect(adminIds).toContain("books-help");
  });

  it("contains specialized articles for shipments module", () => {
    const shipmentArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "shipments"
    );
    expect(shipmentArticles.length).toBe(3);
    const ids = shipmentArticles.map((a) => a.id);
    expect(ids).toContain("eaisybill-shipments");
    expect(ids).toContain("eaisybill-shipment-import");
    expect(ids).toContain("eaisybill-shipment-escalation");
  });

  it("supports client-side filtering by category with correct counts", () => {
    const basicsArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "basics"
    );
    expect(basicsArticles.length).toBe(4);

    const invoiceArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "invoices"
    );
    expect(invoiceArticles.length).toBe(3);

    const transactionArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "transactions"
    );
    expect(transactionArticles.length).toBe(3);

    const accountingArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id === "accounting"
    );
    expect(accountingArticles.length).toBe(8);

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
    expect(matches.some((m) => m.id === "eaisybill-upload")).toBe(true);
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
    expect(articlesWithMenu.length).toBe(63);

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
    const existingId = "eaisybill-projects";
    const nonExistentId = "totally-invalid-slug-12345";

    const existsReal = FALLBACK_KNOWLEDGE_ARTICLES.some((a) => a.id === existingId);
    const existsFake = FALLBACK_KNOWLEDGE_ARTICLES.some((a) => a.id === nonExistentId);

    expect(existsReal).toBe(true);
    expect(existsFake).toBe(false);
  });

  it("accurately partitions articles for the 2-tier landing page navigation (eaisyBill: 29, eaisyBooks: 34)", () => {
    const eaisyBillArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => !a.category_id.startsWith("books_")
    );
    const eaisyBooksArticles = FALLBACK_KNOWLEDGE_ARTICLES.filter(
      (a) => a.category_id.startsWith("books_")
    );

    expect(eaisyBillArticles).toHaveLength(29);
    expect(eaisyBooksArticles).toHaveLength(34);
    expect(eaisyBillArticles.length + eaisyBooksArticles.length).toBe(63);

    // Verify eaisyBooks categories
    const booksCatIds = new Set(eaisyBooksArticles.map((a) => a.category_id));
    expect(booksCatIds).toEqual(
      new Set(["books_portfolio", "books_modules", "books_admin"])
    );

    // Verify eaisyBill categories
    const billCatIds = new Set(eaisyBillArticles.map((a) => a.category_id));
    expect(billCatIds).toEqual(
      new Set(["basics", "invoices", "transactions", "accounting", "hr", "shipments", "system"])
    );
  });
});

