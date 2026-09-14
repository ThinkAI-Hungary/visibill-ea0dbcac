import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { PageHeader } from "@/components/ui/page-header";
import {
  getAccountyBreadcrumbs,
  normalizeBreadcrumbItem,
} from "@/hooks/useAccountyBreadcrumbs";
import { AccountyShellContext, createDefaultAccountyShellContext } from "@/pages/Accounty/AccountyShellContext";

describe("Hierarchical Breadcrumbs — getAccountyBreadcrumbs pure resolver", () => {
  const dummyClient = {
    id: "11111111-2222-3333-4444-555555555555",
    companyId: "11111111-2222-3333-4444-555555555555",
    name: "Példa Kft.",
    taxNumber: "12345678-2-42",
    status: "Rendben" as const,
    unprocessedCount: 0,
    missingCount: 0,
    deadlineDate: null,
    progress: 100,
    assignedToMe: true,
    isPrimary: true,
    accountantRole: "senior" as const,
    ownerId: "user-1",
    isMainAccountant: true,
  };

  const mockShell = {
    ...createDefaultAccountyShellContext(),
    selectedClientId: dummyClient.id,
    selectedClient: dummyClient,
    allClients: [dummyClient],
    currentDateRange: "2026-01-01_2026-12-31",
  };

  it("resolves portfolio root path correctly", () => {
    const res = getAccountyBreadcrumbs("/eaisybooks");
    expect(res.breadcrumbs).toHaveLength(2);
    expect(res.breadcrumbs[0]).toEqual({ label: "eaisyBooks", href: "/eaisybooks", active: false });
    expect(res.breadcrumbs[1]).toEqual({ label: "Portfólió Menedzsment", active: true, href: undefined });
  });

  it("resolves missing invoices portfolio page", () => {
    const res = getAccountyBreadcrumbs("/eaisybooks/missing-invoices");
    expect(res.breadcrumbs).toHaveLength(3);
    expect(res.breadcrumbs[0].label).toBe("eaisyBooks");
    expect(res.breadcrumbs[1].label).toBe("Portfólió");
    expect(res.breadcrumbs[1].href).toBe("/eaisybooks");
    expect(res.breadcrumbs[2].label).toBe("Hiányzó számlák");
    expect(res.breadcrumbs[2].active).toBe(true);
  });

  it("resolves admin tax parameters route", () => {
    const res = getAccountyBreadcrumbs("/eaisybooks/admin/tax-parameters");
    expect(res.breadcrumbs).toHaveLength(3);
    expect(res.breadcrumbs[0].label).toBe("eaisyBooks");
    expect(res.breadcrumbs[1].label).toBe("Törzsadatok");
    expect(res.breadcrumbs[2].label).toBe("Adómértékek és küszöbök");
    expect(res.breadcrumbs[2].active).toBe(true);
  });

  it("resolves client-scoped invoices route with company name", () => {
    const res = getAccountyBreadcrumbs(
      "/eaisybooks/11111111-2222-3333-4444-555555555555/2026-01-01_2026-12-31/invoices",
      mockShell
    );
    expect(res.breadcrumbs).toHaveLength(3);
    expect(res.breadcrumbs[0].label).toBe("eaisyBooks");
    expect(res.breadcrumbs[1].label).toBe("Példa Kft.");
    expect(res.breadcrumbs[1].href).toBe("/eaisybooks/11111111-2222-3333-4444-555555555555/2026-01-01_2026-12-31/overview");
    expect(res.breadcrumbs[2].label).toBe("Számlák");
    expect(res.breadcrumbs[2].active).toBe(true);
  });

  it("resolves deep client payroll route", () => {
    const res = getAccountyBreadcrumbs(
      "/eaisybooks/11111111-2222-3333-4444-555555555555/2026-01-01_2026-12-31/payroll/employees",
      mockShell
    );
    expect(res.breadcrumbs).toHaveLength(4);
    expect(res.breadcrumbs[0].label).toBe("eaisyBooks");
    expect(res.breadcrumbs[1].label).toBe("Példa Kft.");
    expect(res.breadcrumbs[2].label).toBe("Bérszámfejtés");
    expect(res.breadcrumbs[2].href).toBe("/eaisybooks/11111111-2222-3333-4444-555555555555/2026-01-01_2026-12-31/payroll");
    expect(res.breadcrumbs[3].label).toBe("Foglalkoztatottak");
    expect(res.breadcrumbs[3].active).toBe(true);
  });

  it("resolves deep client EV cashbook route", () => {
    const res = getAccountyBreadcrumbs(
      "/eaisybooks/11111111-2222-3333-4444-555555555555/2026-01-01_2026-12-31/ev/cashbook",
      mockShell
    );
    expect(res.breadcrumbs).toHaveLength(4);
    expect(res.breadcrumbs[0].label).toBe("eaisyBooks");
    expect(res.breadcrumbs[1].label).toBe("Példa Kft.");
    expect(res.breadcrumbs[2].label).toBe("Egyéni vállalkozás");
    expect(res.breadcrumbs[2].href).toBe("/eaisybooks/11111111-2222-3333-4444-555555555555/2026-01-01_2026-12-31/ev");
    expect(res.breadcrumbs[3].label).toBe("Pénztárkönyv");
    expect(res.breadcrumbs[3].active).toBe(true);
  });

  it("supports appending custom deep items e.g. monthly cycle", () => {
    const res = getAccountyBreadcrumbs(
      "/eaisybooks/11111111-2222-3333-4444-555555555555/2026-01-01_2026-12-31/payroll",
      mockShell,
      { append: [{ label: "2026. Január" }] }
    );
    expect(res.breadcrumbs).toHaveLength(4);
    expect(res.breadcrumbs[0].label).toBe("eaisyBooks");
    expect(res.breadcrumbs[1].label).toBe("Példa Kft.");
    expect(res.breadcrumbs[2].label).toBe("Bérszámfejtés");
    expect(res.breadcrumbs[3].label).toBe("2026. Január");
    expect(res.breadcrumbs[3].active).toBe(true);
  });

  it("supports explicit full override items", () => {
    const res = getAccountyBreadcrumbs("/eaisybooks/anything", mockShell, {
      items: [
        { label: "eaisyBooks", href: "/eaisybooks" },
        { label: "Egyedi Gyökér" },
      ],
    });
    expect(res.breadcrumbs).toHaveLength(2);
    expect(res.breadcrumbs[0].label).toBe("eaisyBooks");
    expect(res.breadcrumbs[1].label).toBe("Egyedi Gyökér");
    expect(res.breadcrumbs[1].active).toBe(true);
  });

  it("returns empty breadcrumbs for non-eaisybooks paths", () => {
    const res = getAccountyBreadcrumbs("/invoices", mockShell);
    expect(res.breadcrumbs).toHaveLength(0);
  });
});

describe("Hierarchical Breadcrumbs — PageHeader Component Rendering", () => {
  it("renders explicit breadcrumbs with links, active state, and '/' separator", () => {
    render(
      <MemoryRouter>
        <PageHeader
          breadcrumbs={[
            { label: "eaisyBooks", href: "/eaisybooks" },
            { label: "Portfólió Menedzsment" },
          ]}
          title="Portfólió Áttekintés"
          description="Központi vezérlőpult"
        />
      </MemoryRouter>
    );

    // Title & description
    expect(screen.getByText("Portfólió Áttekintés")).toBeDefined();
    expect(screen.getByText("Központi vezérlőpult")).toBeDefined();

    // Breadcrumb navigation
    const nav = screen.getByRole("navigation", { name: "Útvonal" });
    expect(nav).toBeDefined();

    // First item is a clickable link
    const link = screen.getByRole("link", { name: "eaisyBooks" });
    expect(link.getAttribute("href")).toBe("/eaisybooks");

    // Leaf item is styled as active text
    const leaf = screen.getByText("Portfólió Menedzsment");
    expect(leaf.tagName).toBe("SPAN");
    expect(leaf.getAttribute("aria-current")).toBe("page");

    // Separator '/' is present
    expect(screen.getByText("/")).toBeDefined();
  });

  it("retains backwards compatibility with companyName and breadcrumb props", () => {
    render(
      <MemoryRouter>
        <PageHeader
          companyName="Teszt Vállalkozás Zrt."
          breadcrumb="ÁFA Bevallás"
          title="2665 Nyomtatvány"
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Teszt Vállalkozás Zrt.")).toBeDefined();
    expect(screen.getByText("ÁFA Bevallás")).toBeDefined();
    expect(screen.getByText("2665 Nyomtatvány")).toBeDefined();
    expect(screen.getByText("/")).toBeDefined();
  });

  it("automatically resolves breadcrumbs when rendered inside Accounty context without explicit breadcrumbs", () => {
    const mockShell = {
      ...createDefaultAccountyShellContext(),
      pathname: "/eaisybooks/reports",
    };

    render(
      <MemoryRouter initialEntries={["/eaisybooks/reports"]}>
        <AccountyShellContext.Provider value={mockShell}>
          <PageHeader
            title="Riportok"
            description="Átfogó kimutatások"
          />
        </AccountyShellContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Riportok" })).toBeDefined();
    expect(screen.getAllByText("Riportok")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "eaisyBooks" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Portfólió" })).toBeDefined();
  });

  it("renders safely without Router when no breadcrumbs with links are rendered", () => {
    render(
      <PageHeader
        title="Egyszerű fejléc"
        description="Leírás"
      />
    );
    expect(screen.getByText("Egyszerű fejléc")).toBeDefined();
  });
});
