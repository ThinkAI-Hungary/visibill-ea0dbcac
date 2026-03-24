import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// ─── Helper: Trigger a REAL toast via the exposed window function ───
async function triggerToast(page: import("@playwright/test").Page, title: string, description: string) {
  await page.evaluate(
    ({ title, description }) => {
      const toastFn = (window as any).__visibillTestToast;
      if (toastFn) {
        toastFn({ title, description, duration: 15000 });
      } else {
        throw new Error("window.__visibillTestToast is not available — check use-toast.ts");
      }
    },
    { title, description }
  );
}

// ─── TESZTEK ───────────────────────────────────────────
test.describe("Toast Notification Stacking", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.waitForTimeout(500);
  });

  test("4 toast egymás FELETT jelenik meg, nem takarják el egymást", async ({ page }) => {
    await test.step("1. Triggerelj 4 egymást követő toastot", async () => {
      for (let i = 1; i <= 4; i++) {
        await triggerToast(page, `Feltöltés #${i} sikeres`, `fajl_${i}.pdf feldolgozva`);
        await page.waitForTimeout(400);
      }
    });

    await test.step("2. Mind a 4 toast megjelent", async () => {
      const toasts = page.locator('[data-testid="e2e-toast"]');
      await expect(toasts).toHaveCount(4, { timeout: 5_000 });
    });

    await test.step("3. Nem takarják el egymást (egyedi Y pozíciók)", async () => {
      const toasts = page.locator('[data-testid="e2e-toast"]');
      const boundingBoxes = await toasts.evaluateAll((elements) =>
        elements.map((el) => {
          const rect = el.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, height: rect.height };
        })
      );

      const tops = boundingBoxes.map((b) => Math.round(b.top));
      const uniqueTops = new Set(tops);
      expect(uniqueTops.size).toBe(4);

      // Rendezés top szerint, majd overlap ellenőrzés
      const sorted = [...boundingBoxes].sort((a, b) => a.top - b.top);
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].bottom).toBeLessThanOrEqual(sorted[i + 1].top + 16);
      }
    });
  });

  test("Delayed Trigger: 2 mp szünet után mind a 4 toast megjelenik és nem takarják el egymást", async ({ page }) => {
    await test.step("1. Első 2 toast gyorsan", async () => {
      await triggerToast(page, "Feltöltés #1 sikeres", "számla_001.pdf");
      await page.waitForTimeout(400);
      await triggerToast(page, "Feltöltés #2 sikeres", "számla_002.pdf");
    });

    await test.step("2. Várd meg a megjelenésüket", async () => {
      const toasts = page.locator('[data-testid="e2e-toast"]');
      await expect(toasts).toHaveCount(2, { timeout: 3_000 });
    });

    await test.step("3. Várakozz 2 másodpercet", async () => {
      await page.waitForTimeout(2000);
    });

    await test.step("4. Újabb 2 toast", async () => {
      await triggerToast(page, "Feltöltés #3 sikeres", "számla_003.pdf");
      await page.waitForTimeout(400);
      await triggerToast(page, "Feltöltés #4 sikeres", "számla_004.pdf");
    });

    await test.step("5. Összesen 4 toast, egyedi pozíciók, nincs overlap", async () => {
      const toasts = page.locator('[data-testid="e2e-toast"]');
      await expect(toasts).toHaveCount(4, { timeout: 3_000 });

      const boundingBoxes = await toasts.evaluateAll((elements) =>
        elements.map((el) => {
          const rect = el.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, height: rect.height };
        })
      );

      // Minden toastnak egyedi Y pozíciója legyen
      const tops = boundingBoxes.map((b) => Math.round(b.top));
      const uniqueTops = new Set(tops);
      expect(uniqueTops.size).toBe(4);

      // Rendezés top szerint, majd overlap ellenőrzés
      const sorted = [...boundingBoxes].sort((a, b) => a.top - b.top);
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].bottom).toBeLessThanOrEqual(sorted[i + 1].top + 16);
      }
    });
  });
});
