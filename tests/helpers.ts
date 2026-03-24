import { type Page, expect } from "@playwright/test";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Env loading from .env.local ───────────────────────
function loadEnvLocal(): Record<string, string> {
  const envPath = resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) return {};

  const content = fs.readFileSync(envPath, "utf-8");
  const vars: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

const envLocal = loadEnvLocal();

export const TEST_EMAIL =
  process.env.PLAYWRIGHT_TEST_EMAIL ?? envLocal.PLAYWRIGHT_TEST_EMAIL ?? "";
export const TEST_PASSWORD =
  process.env.PLAYWRIGHT_TEST_PASSWORD ?? envLocal.PLAYWRIGHT_TEST_PASSWORD ?? "";

// ─── Validation ────────────────────────────────────────
if (!TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error(
    "❌ PLAYWRIGHT_TEST_EMAIL és PLAYWRIGHT_TEST_PASSWORD szükséges!\n" +
      "Állítsd be a .env.local fájlban vagy környezeti változóként.\n" +
      'Példa .env.local:\n  PLAYWRIGHT_TEST_EMAIL=te@email.com\n  PLAYWRIGHT_TEST_PASSWORD=jelszavad'
  );
}

// ─── Stable Login Helper ───────────────────────────────
/**
 * Bejelentkezés az app-ba stabil, nyelvfüggetlen locatorokkal.
 * Vár a Dashboard betöltődésére a folytatás előtt.
 */
export async function login(page: Page) {
  await page.goto("/auth");
  await page.waitForLoadState("networkidle");

  // Stabil, típus-alapú selectorok (nyelvfüggetlen)
  await page.locator('input[type="email"]').fill(TEST_EMAIL);
  await page.locator('input[type="password"]').fill(TEST_PASSWORD);

  // Submit
  await page.locator('button[type="submit"]').filter({ hasText: /bejelentkezés|sign in/i }).click();

  // Vár a sikeres belépésre — nem /auth URL + sidebar elem megjelenése
  await page.waitForURL((url) => !url.pathname.includes("/auth"), {
    timeout: 15_000,
  });

  // Vár a loading spinner eltűnésére és a Dashboard megjelenésére
  await waitForAppReady(page);
  await expect(page.getByRole("link", { name: "Irányítópult" })).toBeVisible({ timeout: 10_000 });
}

// ─── Loading spinner wait ──────────────────────────────
/**
 * Vár, amíg a full-page loading spinner eltűnik.
 */
export async function waitForAppReady(page: Page) {
  // A LoadingSpinner egy fixed overlay z-[9999]-cel
  const spinner = page.locator(".fixed.inset-0.z-\\[9999\\]");
  // Ha látható, várjuk meg amíg eltűnik
  await spinner.waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
}

// ─── Sidebar navigation helper ─────────────────────────
/**
 * Navigál egy sidebar menüponton keresztül. Használja a getByRole('link')
 * selectort a strict mode violation elkerüléséhez.
 */
export async function navigateTo(page: Page, linkName: string) {
  await waitForAppReady(page);
  await page.getByRole("link", { name: linkName }).click();
  await page.waitForLoadState("networkidle");
  await waitForAppReady(page);
}
