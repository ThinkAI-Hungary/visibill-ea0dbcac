import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import React from "react";

// ─── Mount tracker ─────────────────────────────────────
const sidebarMountSpy = vi.fn();

// ─── Mock AppSidebar with a mount-tracking test double ─
vi.mock("@/components/AppSidebar", () => ({
  AppSidebar: function MockAppSidebar() {
    React.useEffect(() => {
      sidebarMountSpy();
    }, []);
    return (
      <nav data-testid="app-sidebar">
        <a href="/">Irányítópult</a>
        <a href="/invoices">Számlák</a>
      </nav>
    );
  },
}));

// ─── Mock contexts ─────────────────────────────────────
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-123", email: "test@visibill.hu" },
    loading: false,
    session: {},
    sessionGuard: {},
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    updatePassword: vi.fn(),
  }),
}));

vi.mock("@/contexts/CompanyContext", () => ({
  useCompany: () => ({
    selectedCompany: { id: "company-1", name: "Test Kft." },
    companies: [],
    isInitialLoading: false,
  }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    theme: "dark",
    setTheme: vi.fn(),
  }),
}));

// ─── Mock heavy UI dependencies ────────────────────────
vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: any) => <div>{children}</div>,
  Sidebar: ({ children }: any) => <div>{children}</div>,
  SidebarContent: ({ children }: any) => <div>{children}</div>,
  SidebarGroup: ({ children }: any) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: any) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: any) => <div>{children}</div>,
  SidebarMenu: ({ children }: any) => <div>{children}</div>,
  SidebarMenuItem: ({ children }: any) => <div>{children}</div>,
  SidebarMenuButton: ({ children }: any) => <div>{children}</div>,
  SidebarTrigger: () => <button>Toggle</button>,
  useSidebar: () => ({ state: "expanded" }),
}));

vi.mock("@/components/ui/loading-spinner", () => ({
  LoadingSpinner: ({ message }: any) => <div data-testid="loading">{message}</div>,
}));

vi.mock("@/components/ui/content-skeleton", () => ({
  ContentSkeleton: () => <div data-testid="content-skeleton">Loading...</div>,
}));

vi.mock("@/components/GlobalDatePicker", () => ({
  GlobalDatePicker: () => <div data-testid="global-date-picker" />,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    auth: { onAuthStateChange: vi.fn(), getSession: vi.fn() },
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn().mockReturnValue({ data: "complete", isLoading: false }),
  useQueryClient: vi.fn().mockReturnValue({ clear: vi.fn() }),
}));

// ─── Import real layout components (after mocks) ──────
import { AppLayout } from "@/components/AppLayout";

// ─── Helper: navigation trigger component ──────────────
function NavigateButton({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button data-testid="navigate-btn" onClick={() => navigate(to)}>
      Go to {to}
    </button>
  );
}

// ─── Pages ─────────────────────────────────────────────
function DashboardPage() {
  return <div data-testid="page-dashboard">Dashboard Content</div>;
}
function InvoicesPage() {
  return <div data-testid="page-invoices">Invoices Content</div>;
}

// ─── Test Suite ────────────────────────────────────────
describe("Layout Persistence — Sidebar stability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sidebarMountSpy.mockClear();
  });

  it("a Sidebar az 'Irányítópult' link a DOM-ban marad navigáció után", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route
            path="/*"
            element={
              <AppLayout>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <>
                        <DashboardPage />
                        <NavigateButton to="/invoices" />
                      </>
                    }
                  />
                  <Route path="/invoices" element={<InvoicesPage />} />
                </Routes>
              </AppLayout>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // 1. Sidebar megjelenik az "Irányítópult" linkkel
    expect(screen.getByTestId("app-sidebar")).toBeInTheDocument();
    expect(screen.getByText("Irányítópult")).toBeInTheDocument();

    // 2. Dashboard tartalom látható
    expect(screen.getByTestId("page-dashboard")).toBeInTheDocument();

    // 3. Navigáció a /invoices oldalra
    await act(async () => {
      screen.getByTestId("navigate-btn").click();
    });

    // 4. ASSERT: Sidebar továbbra is a DOM-ban van
    expect(screen.getByTestId("app-sidebar")).toBeInTheDocument();
    expect(screen.getByText("Irányítópult")).toBeInTheDocument();

    // 5. Az új oldal tartalma megjelent
    expect(screen.getByTestId("page-invoices")).toBeInTheDocument();

    // 6. SZIGORÚ ASSERT: A Sidebar useEffect mount logikája CSAK EGYSZER futott
    expect(sidebarMountSpy).toHaveBeenCalledTimes(1);
  });
});
