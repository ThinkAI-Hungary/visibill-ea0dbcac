import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import React from "react";
import CompanySelector from "@/components/CompanySelector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Mock dependencies ─────────────────────────────────────
const mockCompanies = [
  { id: "comp-alpha-123", name: "Alpha Cég Kft.", owner_id: "user-1" },
  { id: "comp-beta-456", name: "Beta Vállalat Zrt.", owner_id: "user-1" },
];

let mockSelectedCompany: any = null;

vi.mock("@/contexts/CompanyContext", () => ({
  useCompany: () => ({
    companies: mockCompanies,
    selectedCompany: mockSelectedCompany,
    setSelectedCompany: vi.fn(),
    refreshCompanies: vi.fn(),
    loading: false,
    isInitialLoading: false,
  }),
}));

vi.mock("@/contexts/DateRangeContext", () => ({
  useDateRange: () => ({
    dateFromFormatted: "2026-01-01",
    dateToFormatted: "2026-12-31",
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("eaisyBooks to eaisyBill Transition — CompanySelector", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    mockSelectedCompany = null;
    vi.clearAllMocks();
  });

  it("resolves and displays the correct company immediately from the route parameter even if selectedCompany is null", () => {
    // Scenario: user navigates from eaisybooks to /comp-beta-456/2026-01-01_2026-12-31/
    // selectedCompany in CompanyContext is still null during the first render tick
    mockSelectedCompany = null;

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/comp-beta-456/2026-01-01_2026-12-31/"]}>
          <Routes>
            <Route path="/:companyId/:dateRange/*" element={<CompanySelector />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // The Select should NOT be empty or placeholder — it must show "Beta Vállalat Zrt."
    expect(screen.getByText("Beta Vállalat Zrt.")).toBeDefined();
    expect(screen.queryByText("company_selector.choose_company")).toBeNull();
  });

  it("resolves and displays the URL company immediately even if selectedCompany is set to a different company", () => {
    // Scenario: CompanyContext has Alpha (cached), but user navigated to Beta from Books
    mockSelectedCompany = mockCompanies[0]; // Alpha Cég Kft.

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/comp-beta-456/2026-01-01_2026-12-31/"]}>
          <Routes>
            <Route path="/:companyId/:dateRange/*" element={<CompanySelector />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Should immediately display the target company from the URL (Beta), not the stale cached one (Alpha)
    expect(screen.getByText("Beta Vállalat Zrt.")).toBeDefined();
  });
});
