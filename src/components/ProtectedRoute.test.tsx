import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

// Mock dependencies
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: vi.fn().mockReturnValue({
    isEmployee: false,
    isAdmin: true,
    role: "admin",
  }),
}));

vi.mock("@/contexts/CompanyContext", () => ({
  useCompany: vi.fn().mockReturnValue({
    selectedCompany: { id: "company-123", name: "Test Co" },
  }),
}));

vi.mock("@/hooks/useEaisybillPermissions", () => ({
  useEaisybillPermissions: vi.fn().mockReturnValue({
    canAccess: vi.fn().mockReturnValue(true),
    canWrite: vi.fn().mockReturnValue(true),
    isLoading: false,
  }),
  URL_TO_MODULE: {
    "/dashboard": "dashboard",
    "/working-time": "working_time",
  },
}));

vi.mock("@/contexts/DateRangeContext", () => ({
  useDateRange: vi.fn().mockReturnValue({
    dateFromFormatted: "2026-01-01",
    dateToFormatted: "2026-12-31",
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: "user-123", email: "test@example.com" },
  }),
}));

vi.mock("@/lib/navigation", () => ({
  extractPageSegment: vi.fn().mockReturnValue("/dashboard"),
  generateScopedPath: vi.fn().mockReturnValue("/c/company-123/2026-01-01/2026-12-31/working-time"),
}));

import { useUserRole } from "@/hooks/useUserRole";
import { extractPageSegment } from "@/lib/navigation";
import { useEaisybillPermissions } from "@/hooks/useEaisybillPermissions";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockedUseUserRole = vi.mocked(useUserRole);
const mockedExtractPageSegment = vi.mocked(extractPageSegment);
const mockedUseEaisybillPermissions = vi.mocked(useEaisybillPermissions);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

// Seed mock profile query response to avoid pending state
queryClient.setQueryData(['profile-check', 'user-123'], {
  status: 'complete',
  role: 'member',
});

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExtractPageSegment.mockReturnValue("/dashboard");
    mockedUseEaisybillPermissions.mockReturnValue({
      canAccess: vi.fn().mockReturnValue(true),
      canWrite: vi.fn().mockReturnValue(true),
      isLoading: false,
      role: null,
      isAdmin: false,
      getPermission: vi.fn(),
      visibleModules: [],
    });
  });

  it("lerendereli a children-t ha a user admin", () => {
    mockedUseUserRole.mockReturnValue({
      isEmployee: false,
      isAdmin: true,
      role: "admin",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProtectedRoute>
            <div data-testid="protected-content">Védett tartalom</div>
          </ProtectedRoute>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.getByText("Védett tartalom")).toBeInTheDocument();
  });

  it("lerendereli a working-time oldalt employee-nak", () => {
    mockedUseUserRole.mockReturnValue({
      isEmployee: true,
      isAdmin: false,
      role: "employee",
    });
    mockedExtractPageSegment.mockReturnValue("/working-time");

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProtectedRoute>
            <div data-testid="working-time">Munkaidő</div>
          </ProtectedRoute>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByTestId("working-time")).toBeInTheDocument();
  });

  it("átirányítja az employee-t tiltott oldalról", () => {
    mockedUseUserRole.mockReturnValue({
      isEmployee: true,
      isAdmin: false,
      role: "employee",
    });
    mockedExtractPageSegment.mockReturnValue("/dashboard");
    mockedUseEaisybillPermissions.mockReturnValue({
      canAccess: vi.fn().mockReturnValue(false),
      canWrite: vi.fn().mockReturnValue(false),
      isLoading: false,
      role: "employee",
      isAdmin: false,
      getPermission: vi.fn(),
      visibleModules: [],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ProtectedRoute>
            <div data-testid="protected-content">Védett tartalom</div>
          </ProtectedRoute>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Employee should NOT see the protected content (redirected via <Navigate>)
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });
});
