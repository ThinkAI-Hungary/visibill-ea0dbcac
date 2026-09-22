import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderEaisybillLegacyAndFallbackRoutes } from "@/routes/eaisybillRoutes";

// Helper component to observe current location
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

const mockCompanies = [
  { id: "comp-test-123", name: "Test Cég Kft.", owner_id: "user-1" },
];

vi.mock("@/contexts/CompanyContext", () => ({
  useCompany: () => ({
    companies: mockCompanies,
    selectedCompany: mockCompanies[0],
    setSelectedCompany: vi.fn(),
    refreshCompanies: vi.fn(),
    loading: false,
    isInitialLoading: false,
    registrationSource: "eaisybill",
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
    isPasswordRecovery: false,
    clearPasswordRecovery: vi.fn(),
  }),
}));

vi.mock("@/hooks/useHasEaisybillAccess", () => ({
  useHasEaisybillAccess: () => ({
    hasAccess: true,
    isLoading: false,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { role: "user" }, error: null }),
        }),
      }),
    }),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "hu", changeLanguage: vi.fn() },
  }),
}));

describe("Dashboard Legacy Redirects", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("redirects /dashboard to scoped company dashboard", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            {renderEaisybillLegacyAndFallbackRoutes()}
            <Route path="/:companyId/:dateRange" element={<LocationDisplay />} />
            <Route path="*" element={<div data-testid="not-found">Not Found</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Should redirect to the scoped path, not hit NotFound
    const locationDisplay = await screen.findByTestId("location-display");
    expect(locationDisplay.textContent).toBe("/comp-test-123/2026-01-01_2026-12-31");
    expect(screen.queryByTestId("not-found")).toBeNull();
  });

  it("redirects /hr/dashboard to Croatian scoped company dashboard", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/hr/dashboard"]}>
          <Routes>
            {renderEaisybillLegacyAndFallbackRoutes()}
            <Route path="/hr/:companyId/:dateRange" element={<LocationDisplay />} />
            <Route path="*" element={<div data-testid="not-found">Not Found</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const locationDisplay = await screen.findByTestId("location-display");
    expect(locationDisplay.textContent).toBe("/hr/comp-test-123/2026-01-01_2026-12-31");
    expect(screen.queryByTestId("not-found")).toBeNull();
  });
});
