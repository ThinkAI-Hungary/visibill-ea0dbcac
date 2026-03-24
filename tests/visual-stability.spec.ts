import { test, expect } from "@playwright/test";
import { login, navigateTo, waitForAppReady } from "./helpers";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe("Visual Stability", () => {
  test("Dark/Light mode váltás FOUC nélkül", async ({ page }) => {
    await test.step("1. Bejelentkezés", async () => {
      await login(page);
    });

    await test.step("2. Aktuális téma detektálása", async () => {
      const isDark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      );
      await page.evaluate((dark) => {
        (window as any).__initialTheme = dark ? "dark" : "light";
      }, isDark);
    });

    await test.step("3. Téma váltás gomb kattintás", async () => {
      const themeButton = page.locator(
        'button:has(svg.lucide-sun), button:has(svg.lucide-moon)'
      ).first();
      await themeButton.click();
    });

    await test.step("4. 'no-transitions' osztály eltűnt (FOUC védelem)", async () => {
      await page.waitForTimeout(200);
      const hasNoTransitions = await page.evaluate(() =>
        document.body.classList.contains("no-transitions")
      );
      expect(hasNoTransitions).toBe(false);
    });

    await test.step("5. Téma tényleg változott", async () => {
      const currentTheme = await page.evaluate(() =>
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      );
      const initialTheme = await page.evaluate(() => (window as any).__initialTheme);
      expect(currentTheme).not.toEqual(initialTheme);
    });

    await test.step("6. Screenshot: nincs fehér villanás", async () => {
      await expect(page).toHaveScreenshot("theme-switch-result.png", {
        maxDiffPixelRatio: 0.05,
      });
    });

    await test.step("7. Visszaváltás az eredeti témára", async () => {
      const themeButton = page.locator(
        'button:has(svg.lucide-sun), button:has(svg.lucide-moon)'
      ).first();
      await themeButton.click();
      await page.waitForTimeout(200);
      const finalTheme = await page.evaluate(() =>
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      );
      const initialTheme = await page.evaluate(() => (window as any).__initialTheme);
      expect(finalTheme).toEqual(initialTheme);
    });
  });

  test("Sidebar persistence: navigáció nem remountolja a sidebar-t", async ({ page }) => {
    await test.step("1. Bejelentkezés és Dashboard betöltése", async () => {
      await login(page);
    });

    await test.step("2. Sidebar elem megjelölése data-attribute-tal", async () => {
      await page.evaluate(() => {
        const sidebar = document.querySelector("[data-sidebar]") as HTMLElement;
        if (sidebar) {
          sidebar.setAttribute("data-e2e-mount-id", "sidebar-original-mount");
        }
      });
      const marker = page.locator('[data-e2e-mount-id="sidebar-original-mount"]');
      await expect(marker).toBeVisible();
    });

    await test.step("3. Navigáció: Számlák oldalra", async () => {
      await navigateTo(page, "Számlák");
    });

    await test.step("4. ASSERT: Sidebar DOM elem NEM remountolódott", async () => {
      const marker = page.locator('[data-e2e-mount-id="sidebar-original-mount"]');
      await expect(marker).toBeVisible();
      await expect(page.getByRole("link", { name: "Irányítópult" })).toBeVisible();
    });

    await test.step("5. Navigáció: Tranzakciók oldalra", async () => {
      await navigateTo(page, "Tranzakciók");
    });

    await test.step("6. ASSERT: Sidebar TOVÁBBRA IS ugyanaz a DOM elem", async () => {
      const marker = page.locator('[data-e2e-mount-id="sidebar-original-mount"]');
      await expect(marker).toBeVisible();
      await expect(page).toHaveScreenshot("sidebar-persistent-after-nav.png", {
        maxDiffPixelRatio: 0.05,
      });
    });

    await test.step("7. Navigáció vissza: Irányítópult", async () => {
      await navigateTo(page, "Irányítópult");
      const marker = page.locator('[data-e2e-mount-id="sidebar-original-mount"]');
      await expect(marker).toBeVisible();
    });
  });
});
