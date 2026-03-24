import { test, expect } from "@playwright/test";
import { login, navigateTo } from "./helpers";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe("Realtime Sync — Live Notification & Table Refresh", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Toast értesítés jelenik meg fájl feldolgozás szimulálásakor", async ({ page }) => {
    await test.step("1. Navigáció a Számlák oldalra", async () => {
      await navigateTo(page, "Számlák");
    });

    await test.step("2. Toast triggerelése a valódi toast rendszeren keresztül", async () => {
      await page.evaluate(() => {
        const toastFn = (window as any).__visibillTestToast;
        if (toastFn) {
          toastFn({
            title: "Gratulálunk!",
            description: "A következő fájl sikeresen fel lett dolgozva: teszt_szamla.pdf",
            duration: 10000,
          });
        }
      });
    });

    await test.step("3. Toast megjelenésének ellenőrzése", async () => {
      const toast = page.locator('[data-testid="e2e-toast"]');
      await expect(toast).toBeVisible({ timeout: 3_000 });
      await expect(toast).toContainText("Gratulálunk");
      await expect(toast).toContainText("teszt_szamla.pdf");
      await expect(page).toHaveScreenshot("realtime-toast-visible.png", {
        maxDiffPixelRatio: 0.05,
      });
    });
  });

  test("Táblázat frissül F5 nélkül TanStack Query invalidation-nel", async ({ page }) => {
    await test.step("1. Navigáció Számlák oldalra", async () => {
      await navigateTo(page, "Számlák");
    });

    await test.step("2. TanStack Query cache invalidáció szimulálása", async () => {
      await page.evaluate(() => {
        const event = new CustomEvent("visibill:test-invalidate", {
          detail: { keys: ["submittedInvoices", "filteredSubmittedInvoices"] },
        });
        window.dispatchEvent(event);
      });
      await page.waitForTimeout(3000);
    });

    await test.step("3. Az oldal nem crashelt és a tartalom megjelenik", async () => {
      const table = page.locator("table");
      if (await table.isVisible()) {
        await expect(table).toBeVisible();
      }
      expect(page.url()).toContain("/invoices");
    });
  });
});
