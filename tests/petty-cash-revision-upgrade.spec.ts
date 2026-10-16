import { test, expect } from "@playwright/test";
import * as path from "path";

test.describe("Házipénztár Revise & Upgrade - E2E Browser Test (Teszt Kft.)", () => {
  const companyId = "377d28cb-edc9-48a7-b261-bcd9c91d81a1"; // Teszt Kft
  const dateRange = "2026-01-01_2026-12-31";
  const artifactDir = "C:/Users/adetw/.gemini/antigravity-ide/brain/deaf1b16-b3ff-4952-ab8b-304acf85ff3e";

  test("Teljes Házipénztár 4.1 & 4.2 operatív és kontroll folyamat Teszt Kft-vel", async ({ page }) => {
    test.setTimeout(120_000);

    // ── 1. Bejelentkezés ───────────────────────────────────────────
    console.log("1. Lépés: Bejelentkezés aron@thinkai.hu fiókkal...");
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    await page.locator('input[type="email"]').fill("aron@thinkai.hu");
    await page.locator('input[type="password"]').fill("A237kkil815!");
    await page.locator('button[type="submit"]').filter({ hasText: /bejelentkezés|sign in/i }).click();

    await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 20_000 });
    console.log("Sikeres bejelentkezés! URL:", page.url());

    // Spinner overlay megvárása
    const spinner = page.locator(".fixed.inset-0.z-\\[9999\\]");
    await spinner.waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});

    // ── 2. Teszt Kft kiválasztása & Scoped Navigáció ──────────────────
    console.log("2. Lépés: Teszt Kft beállítása és navigáció...");
    await page.evaluate((id) => {
      localStorage.setItem("selectedCompanyId", id);
    }, companyId);

    const targetUrl = `/${companyId}/${dateRange}/petty-cash`;
    console.log(`Navigáció a Házipénztárra: ${targetUrl}`);
    await page.goto(targetUrl);
    await page.waitForLoadState("networkidle");
    await spinner.waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Ellenőrizzük, hogy betöltődött a Házipénztár oldal
    await expect(page.locator("body")).toContainText(/Házipénztár/i, { timeout: 15_000 });
    console.log("Házipénztár oldal sikeresen megnyitva!");

    await page.screenshot({ path: path.join(artifactDir, "e2e_01_petty_cash_page.png"), fullPage: false });

    // ── 3. Új tétel rögzítése: Kontírozási sablonok & Digitális aláírás ────
    console.log("3. Lépés: Manuális tétel rögzítése modal tesztelése...");
    const newEntryBtn = page.locator('button:has-text("Manuális tétel"), button:has-text("Új tétel")').first();
    await expect(newEntryBtn).toBeVisible({ timeout: 10_000 });
    await newEntryBtn.click();
    await page.waitForTimeout(1000);

    const manualDialog = page.getByRole("dialog", { name: /Manuális pénztári tétel|Kézi pénztári tétel/i });
    await expect(manualDialog).toBeVisible({ timeout: 5000 });

    // Forrásbizonylat & Kontírozási sablon & Főkönyvi ellenszámla ellenőrzése
    await expect(manualDialog).toContainText(/Forrásbizonylat \(Sztv\. 165\. §\)/i);
    await expect(manualDialog).toContainText(/Főkönyvi ellenszámla/i);
    await expect(manualDialog).toContainText(/Kontírozási sablon/i);

    // Bevétel / Kiadás váltás tesztelése és kontírszám ellenőrzése
    const expenseBtn = manualDialog.locator('button:has-text("Kiadás")');
    const incomeBtn = manualDialog.locator('button:has-text("Bevétel")');

    await expenseBtn.click();
    await page.waitForTimeout(300);
    const contraInput = manualDialog.locator('input#contra-account');
    await expect(contraInput).toHaveValue('454');

    await incomeBtn.click();
    await page.waitForTimeout(300);
    await expect(contraInput).toHaveValue('311');

    // Forrásbizonylat jellegének ellenőrzése
    const sourceDocTypeSelect = manualDialog.locator('#source-doc-type');
    await expect(sourceDocTypeSelect).toBeVisible();

    // Digitális aláírás gomb tesztelése
    const signBtn = manualDialog.locator('button:has-text("Aláírás rögzítése")');
    await expect(signBtn).toBeVisible();
    await signBtn.click();
    await page.waitForTimeout(1000);

    // SignatureDialog ellenőrzése (Digitális Aláírás a Bizonylathoz)
    const signDialog = page.getByRole('dialog', { name: /Digitális Aláírás/i });
    await expect(signDialog).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(artifactDir, "e2e_02_signature_dialog.png"), fullPage: false });

    // Bezárjuk az aláírás dialógust
    const closeSignBtn = signDialog.locator('button:has-text("Mégse")');
    await closeSignBtn.click();
    await page.waitForTimeout(500);

    // Kézi felvitel modal bezárása
    const cancelManualBtn = manualDialog.locator('button[data-action="cancel"], button:has-text("Mégse")').first();
    await cancelManualBtn.click();
    await page.waitForTimeout(500);
    console.log("Manuális tétel & Kontírozási sablon & Digitális aláírás sikeresen ellenőrizve!");

    // ── 4. Partner limitek & NAV 40 Bejelentő (Art. 114. §) ────────────
    console.log("4. Lépés: Partner limitek (Art. 114. §) és NAV 40 bejelentő tesztelése...");
    const partnerLimitsTab = page.locator('[data-state][value="partner-limits"], button[role="tab"]:has-text("1,5M Kp. Limit")').first();
    await expect(partnerLimitsTab).toBeVisible({ timeout: 10_000 });
    await partnerLimitsTab.click();
    await page.waitForTimeout(1500);

    // Ellenőrizzük a határérték túllépési riasztási sávot
    await expect(page.locator("body")).toContainText(/meghaladta a havi 1,5M Ft törvényi limitet/i, { timeout: 10_000 });
    await expect(page.locator("body")).toContainText(/Hajtás Pajtás Kft\./i);

    // NAV 40 Adatlap Előkészítés gomb ellenőrzése és megnyitása
    const nav40Btn = page.locator('button:has-text("NAV 40 Adatlap Előkészítés")').first();
    await expect(nav40Btn).toBeVisible({ timeout: 5000 });
    await expect(nav40Btn).toBeEnabled();
    await nav40Btn.click();
    await page.waitForTimeout(1000);

    // Nav40PreviewDialog ellenőrzése
    const nav40Modal = page.getByRole('dialog', { name: /NAV 40/i });
    await expect(nav40Modal).toBeVisible({ timeout: 5000 });
    await expect(nav40Modal).toContainText(/Art\. 114\. §/i);
    await expect(nav40Modal).toContainText(/Hajtás Pajtás Kft\./i);
    await expect(nav40Modal).toContainText(/Másolás vágólapra/i);

    await page.screenshot({ path: path.join(artifactDir, "e2e_03_nav40_preview.png"), fullPage: false });

    // Bezárás
    const closeNav40 = nav40Modal.locator('button:has-text("Bezárás")');
    await closeNav40.click();
    await page.waitForTimeout(500);
    console.log("NAV 40 Bejelentő modal és 1,5M Ft limit figyelő sikeresen ellenőrizve!");

    // ── 5. Pénztárzárás és Leltáreltérés Varázsló ────────────────────────
    console.log("5. Lépés: Időszaki Pénztárzárás Varázsló tesztelése...");
    // Navigálunk a Pénztárjelentések fülre
    const reportsTab = page.locator('[data-state][value="reports"], button[role="tab"]:has-text("Pénztárjelentések")').first();
    await expect(reportsTab).toBeVisible({ timeout: 5000 });
    await reportsTab.click();
    await page.waitForTimeout(1000);

    const closingWizardBtn = page.locator('button:has-text("Új időszaki zárás indítása"), button:has-text("Első zárás indítása most")').first();
    await expect(closingWizardBtn).toBeVisible({ timeout: 5000 });
    await closingWizardBtn.click();
    await page.waitForTimeout(1000);

    const closingDialog = page.getByRole('dialog', { name: /Időszaki Pénztárzárás Varázsló/i });
    await expect(closingDialog).toBeVisible({ timeout: 5000 });
    await expect(closingDialog).toContainText(/1\. Ellenőrzés/i);
    await expect(closingDialog).toContainText(/2\. Címletjegyzék/i);
    await expect(closingDialog).toContainText(/3\. Jegyzőkönyv/i);
    await expect(closingDialog).toContainText(/Könyv szerinti záró/i);

    await page.screenshot({ path: path.join(artifactDir, "e2e_04_closing_wizard.png"), fullPage: false });

    // Tovább lépés a 2. Lépésre (Címletjegyzék)
    const nextBtn = closingDialog.locator('button:has-text("Tovább")');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      await expect(closingDialog).toContainText(/Címlet/i);
    }

    // Bezárjuk a zárási ablakot
    const cancelClose = closingDialog.locator('button:has-text("Mégse")').first();
    if (await cancelClose.isVisible()) {
      await cancelClose.click();
    }
    console.log("Pénztárzárás varázsló sikeresen megnyitva és ellenőrizve!");

    console.log("✅ Minden Házipénztár E2E teszt sikeresen lefutott a Teszt Kft-vel!");
  });
});
