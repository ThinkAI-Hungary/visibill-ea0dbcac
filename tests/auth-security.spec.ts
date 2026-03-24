import { test, expect } from "@playwright/test";
import { login, TEST_EMAIL, TEST_PASSWORD, waitForAppReady } from "./helpers";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe("Auth Security", () => {
  test("Login folyamat: sikeres bejelentkezés és átirányítás", async ({ page }) => {
    await test.step("1. Navigáció az /auth oldalra", async () => {
      await page.goto("/auth");
      await expect(page).toHaveURL(/\/auth/);
    });

    await test.step("2. Bejelentkezési űrlap kitöltése", async () => {
      await page.locator('input[type="email"]').fill(TEST_EMAIL);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    });

    await test.step("3. Bejelentkezés gomb kattintás", async () => {
      await page.locator('button[type="submit"]').filter({ hasText: /bejelentkezés|sign in/i }).click();
    });

    await test.step("4. Átirányítás ellenőrzése (nem /auth)", async () => {
      await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 15_000 });
      expect(page.url()).not.toContain("/auth");
    });

    await test.step("5. Dashboard tartalom megjelenése", async () => {
      await waitForAppReady(page);
      await expect(page.getByRole("link", { name: "Irányítópult" })).toBeVisible({ timeout: 10_000 });
    });
  });

  test("Session Timeout: idle warning modal megjelenik és visszaszámlál", async ({ page }) => {
    await test.step("1. Bejelentkezés", async () => {
      await login(page);
    });

    await test.step("2. localStorage lastActive manipulálása (29 perc múltba)", async () => {
      await page.evaluate(() => {
        const STORAGE_KEY = "visibill_last_active";
        const twentyNineMinutesAgo = Date.now() - 29 * 60 * 1000;
        localStorage.setItem(STORAGE_KEY, twentyNineMinutesAgo.toString());
      });
    });

    await test.step("3. Újratöltés a manipulált lastActive-vel", async () => {
      await page.reload();
      await page.waitForLoadState("networkidle");
    });

    await test.step("4. Idle warning modal megjelenik (elmosott háttér)", async () => {
      const modal = page.locator('[role="dialog"], [role="alertdialog"]');
      await expect(modal).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveScreenshot("idle-warning-modal.png", {
        maxDiffPixelRatio: 0.05,
      });
    });

    await test.step("5. Visszaszámláló ellenőrzése", async () => {
      const countdownText = page.locator('[role="dialog"], [role="alertdialog"]');
      const initialText = await countdownText.textContent();
      expect(initialText).toBeTruthy();
      await page.waitForTimeout(3000);
      const laterText = await countdownText.textContent();
      expect(laterText).not.toEqual(initialText);
    });

    await test.step("6. 'Maradok' gomb visszaállítja a session-t", async () => {
      const stayButton = page.getByRole("button", { name: /marad|stay|aktív/i });
      if (await stayButton.isVisible()) {
        await stayButton.click();
        const modal = page.locator('[role="dialog"], [role="alertdialog"]');
        await expect(modal).not.toBeVisible({ timeout: 5_000 });
      }
    });
  });

  test("Session Timeout: auto-signout navigál /auth-ra", async ({ page }) => {
    await test.step("1. Bejelentkezés", async () => {
      await login(page);
    });

    await test.step("2. lastActive manipulálása (31 perc)", async () => {
      await page.evaluate(() => {
        const STORAGE_KEY = "visibill_last_active";
        const thirtyOneMinutesAgo = Date.now() - 31 * 60 * 1000;
        localStorage.setItem(STORAGE_KEY, thirtyOneMinutesAgo.toString());
      });
    });

    await test.step("3. Újratöltés → auto-signout → /auth", async () => {
      await page.reload();
      await page.waitForURL(/\/auth/, { timeout: 15_000 });
      expect(page.url()).toContain("/auth");
    });
  });
});
