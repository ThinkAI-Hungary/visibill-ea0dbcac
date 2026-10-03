import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EaisyWorksSyncCard } from "@/components/tickets/EaisyWorksSyncCard";
import { createEaisyWorksTicket, getEaisyWorksConfig } from "@/services/eaisyworksService";
import type { Ticket } from "@/hooks/useTickets";

const mockRpc = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: () => ({
      update: (...args: any[]) => mockUpdate(...args),
    }),
  },
}));

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe("EaisyWorks Integration & Ticket Sync Tests", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const baseTicket: Ticket = {
    id: "ticket-1234-uuid",
    ticket_number: "EB-0042",
    type: "bug",
    category: "áfa",
    service: "eaisybill",
    message: "<p>Fizetési hiba lépett fel a 27%-os számláknál.</p>",
    status: "created",
    priority: "high",
    page_url: "https://app.eaisybill.hu/vat",
    company_name: "Teszt Kft.",
    company_id: "comp-123",
    user_email: "ugyfel@teszt.hu",
    user_name: "Kovács Péter",
    user_id: "user-456",
    created_at: "2026-10-03T12:00:00Z",
    updated_at: "2026-10-03T12:00:00Z",
    attachments: ["https://example.com/invoice.pdf"],
    comment_count: 0,
    latest_comment_at: null,
    has_unread: false,
  };

  describe("Service & Payload Generation", () => {
    it("returns configuration with default base URL", () => {
      const config = getEaisyWorksConfig();
      expect(config.baseUrl).toBeDefined();
      expect(config.baseUrl.startsWith("http")).toBe(true);
    });

    it("sends structured payload to EaisyWorks and links via RPC", async () => {
      // Mock fetch
      let interceptedBody: any = null;
      global.fetch = vi.fn(async (url: any, init: any) => {
        interceptedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            ticket: {
              id: "works-task-uuid-99",
              key: "PROJ-108",
            },
          }),
        } as any;
      });

      mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });

      // Temporarily ensure API key is present
      vi.stubEnv("VITE_EAISYWORKS_API_KEY", "ew_live_test_secret_key");

      const result = await createEaisyWorksTicket(baseTicket);

      expect(result.success).toBe(true);
      expect(result.ticketKey).toBe("PROJ-108");
      expect(result.ticketId).toBe("works-task-uuid-99");

      // Verify payload
      expect(interceptedBody).not.toBeNull();
      expect(interceptedBody.source_app).toBe("eaisybill");
      expect(interceptedBody.priority).toBe("high");
      expect(interceptedBody.external_id).toBe("EB-0042");
      expect(interceptedBody.reporter_name).toBe("Kovács Péter");
      expect(interceptedBody.reporter_email).toBe("ugyfel@teszt.hu");
      expect(interceptedBody.category_name).toBe("áfa");
      expect(interceptedBody.title).toContain("Hiba: Fizetési hiba lépett fel");
      expect(interceptedBody.title).not.toContain("[EB-0042]");
      expect(interceptedBody.description).toContain("Fizetési hiba lépett fel");
      expect(interceptedBody.extra_data.company_name).toBe("Teszt Kft.");

      // Verify RPC call
      expect(mockRpc).toHaveBeenCalledWith("link_eaisyworks_ticket", {
        p_ticket_id: "ticket-1234-uuid",
        p_works_id: "works-task-uuid-99",
        p_works_key: "PROJ-108",
      });

      vi.unstubAllEnvs();
    });

    it("maps critical priority to urgent", async () => {
      let interceptedBody: any = null;
      global.fetch = vi.fn(async (_url: any, init: any) => {
        interceptedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            ticket: { id: "works-id", key: "DEV-1" },
          }),
        } as any;
      });

      mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });
      vi.stubEnv("VITE_EAISYWORKS_API_KEY", "ew_live_test");

      const criticalTicket = { ...baseTicket, priority: "critical" };
      await createEaisyWorksTicket(criticalTicket);

      expect(interceptedBody.priority).toBe("urgent");
      vi.unstubAllEnvs();
    });

    it("returns error if API returns failure", async () => {
      global.fetch = vi.fn(async () => {
        return {
          ok: false,
          status: 400,
          json: async () => ({
            success: false,
            message: "Érvénytelen workspace azonosító",
          }),
        } as any;
      });

      vi.stubEnv("VITE_EAISYWORKS_API_KEY", "ew_live_test");
      const result = await createEaisyWorksTicket(baseTicket);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Érvénytelen workspace azonosító");
      vi.unstubAllEnvs();
    });
  });

  describe("UI Component (EaisyWorksSyncCard)", () => {
    it("renders creation button when ticket is not yet synced and user can manage", () => {
      const queryClient = new QueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <EaisyWorksSyncCard ticket={baseTicket} canManage={true} />
        </QueryClientProvider>
      );

      expect(screen.getByText("eaisyWorks")).toBeDefined();
      expect(screen.getByText("eaisyWorks hibajegy létrehozása")).toBeDefined();
    });

    it("renders permission notice for non-management users when unsynced", () => {
      const queryClient = new QueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <EaisyWorksSyncCard ticket={baseTicket} canManage={false} />
        </QueryClientProvider>
      );

      expect(screen.getByText(/Kizárólag Management jogosultsággal/i)).toBeDefined();
      expect(screen.queryByText("eaisyWorks hibajegy létrehozása")).toBeNull();
    });

    it("renders linked badge and open button when ticket is already synced", () => {
      const queryClient = new QueryClient();
      const syncedTicket: Ticket = {
        ...baseTicket,
        eaisyworks_ticket_key: "PROJ-108",
        eaisyworks_ticket_id: "works-id-108",
        eaisyworks_synced_at: "2026-10-03T12:30:00Z",
      };

      render(
        <QueryClientProvider client={queryClient}>
          <EaisyWorksSyncCard ticket={syncedTicket} canManage={true} />
        </QueryClientProvider>
      );

      expect(screen.getByText("PROJ-108")).toBeDefined();
      expect(screen.getByText("Megnyitás eaisyWorks-ben")).toBeDefined();
      expect(screen.getByText(/A hibajegy szinkronizálva lett/i)).toBeDefined();
      expect(screen.queryByText("eaisyWorks hibajegy létrehozása")).toBeNull();
    });
  });
});
