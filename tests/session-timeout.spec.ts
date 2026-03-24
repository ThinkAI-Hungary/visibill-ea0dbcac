import { test, expect } from "@playwright/test";
import { login, waitForAppReady } from "./helpers";

/**
 * Session Timeout E2E tesztek.
 *
 * A useSessionGuard hook logikája:
 *   - 28 perc inaktivitás → IdleWarningModal megjelenik
 *   - 120 másodperc visszaszámlálás → automatikus kijelentkezés
 *   - 4 óra abszolút limit → azonnali kijelentkezés
 *
 * Storage key: visibill_last_active
 */

const STORAGE_KEY = "visibill_last_active";

// ─── Helper: set lastActive to N minutes ago ───────────
async function setLastActiveMinutesAgo(page: import("@playwright/test").Page, minutes: number) {
  await page.evaluate(
    ({ key, minutes }) => {
      const msAgo = Date.now() - minutes * 60 * 1000;
      localStorage.setItem(key, msAgo.toString());
    },
    { key: STORAGE_KEY, minutes }
  );
}

// ─── Helper: trigger the modal by faking idle + reload ─────────
// 28 perc 5 mp = épp túl a 28 perces warning küszöbön,
// de ~115 mp countdown marad (bőven elég a reload + interakció idejére).
async function triggerIdleModal(page: import("@playwright/test").Page) {
  await page.evaluate((key) => {
    const msAgo = Date.now() - (28 * 60 + 5) * 1000; // 28m 5s ago
    localStorage.setItem(key, msAgo.toString());
  }, STORAGE_KEY);
  await page.reload();
  await page.waitForLoadState("networkidle");
  // Vár a modal megjelenésére
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible({ timeout: 15_000 });
  return modal;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test.describe("Session Timeout — Inaktivitás", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await waitForAppReady(page);
  });

  // ────────────────────────────────────────────────────────
  // 1. MODAL MEGJELENÉSE
  // ────────────────────────────────────────────────────────
  test("Modal megjelenik 28+ perc inaktivitás után", async ({ page }) => {
    await test.step("1. lastActive → 29 perccel ezelőttre + reload", async () => {
      await setLastActiveMinutesAgo(page, 29);
      await page.reload();
      await page.waitForLoadState("networkidle");
    });

    await test.step("2. Modal megjelenik az 'Inaktivitás észlelve' címmel", async () => {
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible({ timeout: 15_000 });
      await expect(modal.getByText("Inaktivitás észlelve")).toBeVisible();
    });

    await test.step("3. Visszaszámláló jelenik meg (MM:SS formátum)", async () => {
      const modal = page.locator('[role="dialog"]');
      // A countdown a modal description-ben van, "01:xx" formátumban
      const countdownText = await modal.textContent();
      expect(countdownText).toMatch(/\d{2}:\d{2}/);
    });

    await test.step("4. Háttér el van mosva (backdrop-blur)", async () => {
      // A DialogOverlay kap backdrop-blur-md osztályt
      const overlay = page.locator("[data-radix-dialog-overlay], .backdrop-blur-md");
      await expect(overlay.first()).toBeVisible();
    });

    await test.step("5. Háttérre kattintás NEM zárja be a modalt", async () => {
      // Kattintás a modal melletti területre
      await page.mouse.click(10, 10);
      await page.waitForTimeout(500);
      const modal = page.locator('[role="dialog"]');
      // A modal TOVÁBBRA IS látható kell legyen
      await expect(modal).toBeVisible();
    });

    await test.step("6. ESC billentyű NEM zárja be a modalt", async () => {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
    });

    await test.step("7. Screenshot a modal állapotáról", async () => {
      await expect(page).toHaveScreenshot("session-timeout-modal.png", {
        maxDiffPixelRatio: 0.05,
      });
    });
  });

  // ────────────────────────────────────────────────────────
  // 2. "IGEN, MARADOK" — BEJELENTKEZVE MARADÁS
  // ────────────────────────────────────────────────────────
  // FONTOS: Ez a teszt NEM használ page.reload()-ot, mert a stayActive()
  // belsőleg supabase.auth.refreshSession()-t hív, ami reload után
  // "Refresh Token Already Used" hibát okozhat → silent signout.
  // Helyette: localStorage manipuláció + szintetikus mousemove event
  // → az idle handler újraértékeli a lastActive-ot → modal megjelenik.
  test("'Igen, maradok' gomb frissíti a session-t és elrejti a modalt", async ({ page }) => {
    await test.step("1. Modal triggerelése (reload nélkül)", async () => {
      // A mousemove activityHandler felülírná a lastActive-ot Date.now()-val,
      // ezért StorageEvent-et használunk: a storageHandler CSAK startIdleTimer()-t
      // hív (nem touchActivityThrottled-ot), így a stale érték megmarad.
      await page.evaluate((key) => {
        const msAgo = Date.now() - (28 * 60 + 5) * 1000;
        localStorage.setItem(key, msAgo.toString());
        window.dispatchEvent(new StorageEvent("storage", {
          key: key,
          newValue: msAgo.toString(),
          oldValue: null,
          storageArea: localStorage,
        }));
      }, STORAGE_KEY);
    });

    await test.step("2. Modal megjelenik", async () => {
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible({ timeout: 15_000 });
      await expect(modal.getByText("Inaktivitás észlelve")).toBeVisible();
    });

    const timestampBefore = Date.now();

    await test.step("3. 'Igen, maradok' gomb kattintás", async () => {
      await page.getByRole("button", { name: /igen.*maradok/i }).click();
    });

    await test.step("4. Modal eltűnik", async () => {
      const modal = page.locator('[role="dialog"]');
      await expect(modal).not.toBeVisible({ timeout: 5_000 });
    });

    await test.step("5. localStorage lastActive frissült a jelenlegi időre", async () => {
      const storedValue = await page.evaluate((key) => {
        return parseInt(localStorage.getItem(key) || "0", 10);
      }, STORAGE_KEY);

      const diff = Math.abs(storedValue - timestampBefore);
      expect(diff).toBeLessThan(5000);
    });

    await test.step("6. Dashboard továbbra is elérhető", async () => {
      await waitForAppReady(page);
      expect(page.url()).not.toContain("/auth");
      await expect(page.getByRole("link", { name: "Irányítópult" })).toBeVisible({ timeout: 10_000 });
    });
  });

  // ────────────────────────────────────────────────────────
  // 3. MANUÁLIS KIJELENTKEZÉS A MODALBÓL
  // ────────────────────────────────────────────────────────
  test("'Kijelentkezés' gomb átirányít /auth-ra", async ({ page }) => {
    await test.step("1. Modal triggerelése", async () => {
      await triggerIdleModal(page);
    });

    await test.step("2. 'Kijelentkezés' gomb kattintás", async () => {
      await page.getByRole("button", { name: /kijelentkezés/i }).click();
    });

    await test.step("3. Átirányítás /auth-ra", async () => {
      await page.waitForURL(/\/auth/, { timeout: 15_000 });
      expect(page.url()).toContain("/auth");
    });
  });

  // ────────────────────────────────────────────────────────
  // 4. AUTOMATIKUS LEJÁRAT (Visszaszámláló vége)
  // ────────────────────────────────────────────────────────
  test("Automatikus kijelentkezés a visszaszámláló végén", async ({ page }) => {
    await test.step("1. lastActive → 29 perc 50 mp ezelőttre (csak ~10 mp marad)", async () => {
      // 29 perc 50 mp = 1790 mp → a 120 mp countdown-ból ~10 mp maradt
      // (28 perc warning + 120 sec = 30 perc total = 1800 sec)
      // Ha 1790 sec ago → 1800-1790 = 10 sec marad
      await page.evaluate((key) => {
        const msAgo = Date.now() - (29 * 60 + 50) * 1000;
        localStorage.setItem(key, msAgo.toString());
      }, STORAGE_KEY);
    });

    await test.step("2. Reload — modal megjelenik alacsony visszaszámlálóval", async () => {
      await page.reload();
      await page.waitForLoadState("networkidle");
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible({ timeout: 15_000 });
    });

    await test.step("3. Visszaszámláló lejár → automatikus kijelentkezés", async () => {
      // Vár maximum 20 másodpercet az /auth-ra navigálásra
      // (a countdown ~10 mp volt, + némi buffer)
      await page.waitForURL(/\/auth/, { timeout: 20_000 });
      expect(page.url()).toContain("/auth");
    });
  });

  // ── Takarítás ──
  test.afterEach(async ({ page }) => {
    await page.evaluate((key) => {
      localStorage.removeItem(key);
    }, STORAGE_KEY);
  });
});
