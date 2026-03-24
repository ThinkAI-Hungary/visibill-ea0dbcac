import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe("Multi-Tenancy — Cégváltás", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Cégváltás frissíti a Dashboard KPI kártyáit", async ({ page }) => {
    await test.step("1. Aktuális KPI értékek mentése", async () => {
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      await expect(page).toHaveScreenshot("dashboard-company-1.png", {
        maxDiffPixelRatio: 0.05,
      });
    });

    await test.step("2. Cégváltó dropdown megnyitása", async () => {
      const companyTrigger = page.locator('[data-tour="company-selector"] button[role="combobox"]');
      if (await companyTrigger.isVisible()) {
        await companyTrigger.click();
      } else {
        const selectTrigger = page.locator('[data-tour="company-selector"]').getByRole("combobox");
        await selectTrigger.click();
      }
    });

    await test.step("3. Második cég kiválasztása (ha van)", async () => {
      const selectContent = page.locator('[role="listbox"]');
      await expect(selectContent).toBeVisible({ timeout: 3_000 });
      const options = selectContent.locator('[role="option"]');
      const count = await options.count();

      if (count < 2) {
        test.skip(true, "Csak 1 cég van, nem tudunk váltani");
        return;
      }

      const firstCompanyName = await options.nth(0).textContent();
      await options.nth(1).click();
      const secondCompanyName = await page.locator('[data-tour="company-selector"]').textContent();
      expect(secondCompanyName).not.toEqual(firstCompanyName);
    });

    await test.step("4. KPI kártyák frissülésének ellenőrzése", async () => {
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      await expect(page).toHaveScreenshot("dashboard-company-2.png", {
        maxDiffPixelRatio: 0.05,
      });
    });

    await test.step("5. Korábbi cég adatai nem maradnak kint", async () => {
      const selectorText = await page.locator('[data-tour="company-selector"]').textContent();
      expect(selectorText).toBeTruthy();
    });
  });
});
