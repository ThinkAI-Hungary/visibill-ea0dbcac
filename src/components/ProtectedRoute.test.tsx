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

vi.mock("@/contexts/DateRangeContext", () => ({
  useDateRange: vi.fn().mockReturnValue({
    dateFromFormatted: "2026-01-01",
    dateToFormatted: "2026-12-31",
  }),
}));

vi.mock("@/lib/navigation", () => ({
  extractPageSegment: vi.fn().mockReturnValue("/dashboard"),
  generateScopedPath: vi.fn().mockReturnValue("/c/company-123/2026-01-01/2026-12-31/working-time"),
}));

import { useUserRole } from "@/hooks/useUserRole";
import { extractPageSegment } from "@/lib/navigation";

const mockedUseUserRole = vi.mocked(useUserRole);
const mockedExtractPageSegment = vi.mocked(extractPageSegment);

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedExtractPageSegment.mockReturnValue("/dashboard");
  });

  it("lerendereli a children-t ha a user admin", () => {
    mockedUseUserRole.mockReturnValue({
      isEmployee: false,
      isAdmin: true,
      role: "admin",
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Védett tartalom</div>
        </ProtectedRoute>
      </MemoryRouter>
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
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="working-time">Munkaidő</div>
        </ProtectedRoute>
      </MemoryRouter>
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

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Védett tartalom</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    // Employee should NOT see the protected content (redirected via <Navigate>)
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });
});
