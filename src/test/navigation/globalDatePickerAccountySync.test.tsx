import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useParams, useLocation } from "react-router-dom";
import React from "react";
import { DateRangeProvider, useDateRange } from "@/contexts/DateRangeContext";
import { GlobalDatePicker } from "@/components/GlobalDatePicker";
import AccountyScopedLayout from "@/pages/Accounty/AccountyScopedLayout";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock dependencies
const mockClients = [
  { id: "client-abc-123", companyId: "client-abc-123", name: "Mandala Fogadó Kft." },
];

vi.mock("@/hooks/accounty", () => ({
  useAccountyClients: () => ({
    data: mockClients,
    isLoading: false,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-123" },
  }),
}));

vi.mock("@/pages/Accounty/AccountyShellContext", () => ({
  useAccountyShell: () => ({
    setSelectedClientId: vi.fn(),
  }),
  useAccountyShellOptional: () => null,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => opts?.defaultValue || key,
    i18n: { language: 'hu', changeLanguage: vi.fn() },
  }),
}));

function DummyChild() {
  const { dateRange } = useParams<{ dateRange: string }>();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const location = useLocation();

  return (
    <div>
      <div data-testid="url-daterange">{dateRange}</div>
      <div data-testid="url-path">{location.pathname}</div>
      <div data-testid="context-from">{dateFromFormatted}</div>
      <div data-testid="context-to">{dateToFormatted}</div>
    </div>
  );
}

describe("GlobalDatePicker and AccountyScopedLayout Bidirectional Sync", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("updates URL and does not roll back when preset button is clicked", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <DateRangeProvider>
            <MemoryRouter initialEntries={["/eaisybooks/client-abc-123/2026-08-01_2026-08-31/payroll"]}>
              <div data-testid="topbar">
                <GlobalDatePicker />
              </div>
              <Routes>
                <Route path="/eaisybooks/:companyId/:dateRange" element={<AccountyScopedLayout />}>
                  <Route path="payroll" element={<DummyChild />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </DateRangeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );

    // Initial state: URL is August 2026
    expect(screen.getByTestId("url-daterange").textContent).toBe("2026-08-01_2026-08-31");

    // Click "Ez az év" preset button
    const thisYearBtn = screen.getByText("Ez az év");
    await act(async () => {
      fireEvent.click(thisYearBtn);
    });

    const currentYear = new Date().getFullYear();
    const expectedFrom = `${currentYear}-01-01`;
    const expectedTo = `${currentYear}-12-31`;
    const expectedRange = `${expectedFrom}_${expectedTo}`;

    // Verify context updated
    expect(screen.getByTestId("context-from").textContent).toBe(expectedFrom);
    expect(screen.getByTestId("context-to").textContent).toBe(expectedTo);

    // Verify URL synced without being reverted back to August!
    expect(screen.getByTestId("url-daterange").textContent).toBe(expectedRange);
    expect(screen.getByTestId("url-path").textContent).toBe(`/eaisybooks/client-abc-123/${expectedRange}/payroll`);
  });

  it("updates date range when month selector dropdown is changed", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <DateRangeProvider>
            <MemoryRouter initialEntries={["/eaisybooks/client-abc-123/2026-08-01_2026-08-31/payroll"]}>
              <GlobalDatePicker />
              <Routes>
                <Route path="/eaisybooks/:companyId/:dateRange" element={<AccountyScopedLayout />}>
                  <Route path="payroll" element={<DummyChild />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </DateRangeProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );

    // Initial check: Month selector should be August (idx 7)
    const select = screen.getByRole("combobox", { name: "Hónap választása" }) as HTMLSelectElement;
    expect(select.value).toBe("7");

    // Change to September (idx 8)
    await act(async () => {
      fireEvent.change(select, { target: { value: "8" } });
    });

    expect(screen.getByTestId("context-from").textContent).toBe("2026-09-01");
    expect(screen.getByTestId("context-to").textContent).toBe("2026-09-30");
    expect(screen.getByTestId("url-daterange").textContent).toBe("2026-09-01_2026-09-30");
  });
});
