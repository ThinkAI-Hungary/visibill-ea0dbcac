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
 * selectort a strict mode violation elkerüléséhez. Automatikusan kibontja
 * a szülő kategóriát, ha az össze van csukva.
 */
export async function navigateTo(page: Page, linkName: string) {
  await waitForAppReady(page);
  
  const link = page.getByRole("link", { name: linkName });
  const isLinkVisible = await link.isVisible();
  
  if (!isLinkVisible) {
    // Határozzuk meg a szülő csoport nevét a link neve alapján
    let parentGroup = "";
    if (["Számlák", "Kintlévőség", "Tranzakciók", "Házipénztár"].includes(linkName)) {
      parentGroup = "Pénzügyek";
    } else if (["Főkönyv", "Eredménykimutatás", "Mérleg", "Beszámoló", "ÁFA Bevallás"].includes(linkName)) {
      parentGroup = "Könyvelés";
    } else if (["Bérek/járulékok", "Munkaidő", "TENY"].includes(linkName)) {
      parentGroup = "HR & Eszközök";
    } else if (["Integrációk", "Árfolyamok"].includes(linkName)) {
      parentGroup = "Rendszer";
    } else if (["Irányítópult", "Kategóriák", "Projektek", "Partnertörzs"].includes(linkName)) {
      parentGroup = "Áttekintés";
    }

    if (parentGroup) {
      // Megkeressük a csoport kibontó gombját
      const groupTrigger = page.locator("button, [role='button']").filter({ hasText: new RegExp(`^${parentGroup}$`, "i") });
      if (await groupTrigger.isVisible()) {
        await groupTrigger.click();
        // Várjuk meg az animáció befejeződését
        await page.waitForTimeout(300);
      }
    }
  }

  await link.click();
  await page.waitForLoadState("networkidle");
  await waitForAppReady(page);
}

