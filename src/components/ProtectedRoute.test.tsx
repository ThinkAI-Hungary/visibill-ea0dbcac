import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

// Mock dependencies
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn().mockReturnValue({
    data: "complete",
    isLoading: false,
  }),
  useQueryClient: vi.fn().mockReturnValue({ clear: vi.fn() }),
  QueryClientProvider: ({ children }: any) => children,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    auth: { onAuthStateChange: vi.fn(), getSession: vi.fn() },
  },
}));

vi.mock("@/components/ui/loading-spinner", () => ({
  LoadingSpinner: ({ message }: { message: string }) => (
    <div data-testid="loading">{message}</div>
  ),
}));

import { useAuth } from "@/contexts/AuthContext";
const mockedUseAuth = vi.mocked(useAuth);

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigál '/auth'-ra ha a user NULL", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: false,
      session: null,
      sessionGuard: {} as any,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      updatePassword: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Védett tartalom</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith("/auth");
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("lerendereli a children-t ha a user létezik", () => {
    mockedUseAuth.mockReturnValue({
      user: { id: "user-123", email: "test@example.com" } as any,
      loading: false,
      session: {} as any,
      sessionGuard: {} as any,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      updatePassword: vi.fn(),
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div data-testid="protected-content">Védett tartalom</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(mockNavigate).not.toHaveBeenCalledWith("/auth");
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.getByText("Védett tartalom")).toBeInTheDocument();
  });
});
