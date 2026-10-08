import { test, expect } from "@playwright/test";
import * as path from "path";

test.describe("EB-0258 E2E Browser Testing - Default Fulfillment Date, Aggregated GL View & FX Bank Catalog", () => {
  const artifactDir = "C:/Users/adetw/.gemini/antigravity-ide/brain/8621332f-1330-4c2b-98de-f42250f7cc78";
  const companyId = "b16df0ae-27fb-42df-bb9c-0d03122d1d5c"; // Kolos Transport Kft.
  const dateRange = "2026-01-01_2026-12-31";

  test("Verifies full UI workflow for EB-0258", async ({ page }) => {
    test.setTimeout(90_000);

    // ── Step 1: Login ──
    console.log("Step 1: Logging in...");
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");

    // Check if redirected to login or already logged in
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill("aron@thinkai.hu");
      await page.locator('input[type="password"]').fill("A237kkil815!");
      await page.locator('button[type="submit"]').click();
      await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 15_000 });
      console.log("Logged in successfully! Current URL:", page.url());
    }

    // Set active company to Kolos Transport Kft.
    await page.evaluate((id) => {
      localStorage.setItem('selectedCompanyId', id);
    }, companyId);
    await page.waitForTimeout(1000);

    // ── Step 2: Navigate to Settings (BusinessSection) ──
    console.log(`Step 2: Navigating to /${companyId}/${dateRange}/settings?settings=business...`);
    await page.goto(`/${companyId}/${dateRange}/settings?settings=business`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Click the 'Cég' tab directly to ensure BusinessSection is active
    const businessTab = page.locator('button[role="tab"]:has-text("Cég")').first();
    if (await businessTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await businessTab.click();
      await page.waitForTimeout(1000);
    }

    // Verify BusinessSection loaded
    await expect(page.locator("body")).toContainText(/Cégprofil|Alapadatok|Főkönyvi és Könyvelési beállítások/i);

    // 1. Verify NAV lookup button next to tax number input
    console.log("Verifying NAV adószám lekérdezés button...");
    const navLookupBtn = page.locator('button:has-text("NAV adatok")').first();
    await expect(navLookupBtn).toBeVisible({ timeout: 10_000 });
    console.log("Verified 'NAV adatok' button is visible next to companyTaxNumber!");

    // 2. Verify Date Basis radio group: 'Teljesítés dátuma' listed first as default/recommended
    console.log("Verifying 'Teljesítés dátuma' radio option...");
    const dateBasisTeljesitesLabel = page.locator('label:has-text("Teljesítés dátuma")').first();
    await expect(dateBasisTeljesitesLabel).toBeVisible({ timeout: 10_000 });
    await expect(dateBasisTeljesitesLabel).toContainText(/Alapértelmezett \/ Ajánlott/i);

    // 3. Verify Aggregated GL View radio group: 'Összevont nézet' vs 'Tételes nézet'
    console.log("Verifying 'Összevont nézet' radio option...");
    const viewModeOsszevontLabel = page.locator('label:has-text("Összevont nézet")').first();
    await expect(viewModeOsszevontLabel).toBeVisible({ timeout: 10_000 });
    await expect(viewModeOsszevontLabel).toContainText(/Alapértelmezett \/ Ajánlott/i);

    const viewModeTetelesLabel = page.locator('label:has-text("Tételes nézet")').first();
    await expect(viewModeTetelesLabel).toBeVisible({ timeout: 10_000 });

    // 4. Verify FX Bank Catalog and Rate Type Selectors
    console.log("Verifying FX Bank Catalog and Rate Type Selectors...");
    await expect(page.locator('text="Devizaárfolyam és Pénzintézet Beállítások"')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text="Könyvelés bankja"')).toBeVisible();
    await expect(page.locator('text="Könyvelési árfolyam típusa"')).toBeVisible();
    await expect(page.locator('text="Év végi átértékelés bankja"')).toBeVisible();
    await expect(page.locator('text="Átértékelési árfolyam típusa"')).toBeVisible();

    // Scroll settings into view and take screenshot of BusinessSection
    await dateBasisTeljesitesLabel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const settingsScreenshotPath = path.join(artifactDir, "eb0258_01_settings_business_section.png");
    await page.screenshot({ path: settingsScreenshotPath, fullPage: false });
    console.log(`Captured Settings screenshot: ${settingsScreenshotPath}`);

    // Screenshot of NAV button and tax number area
    await navLookupBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const navScreenshotPath = path.join(artifactDir, "eb0258_04_settings_nav_taxpayer_lookup.png");
    await page.screenshot({ path: navScreenshotPath, fullPage: false });
    console.log(`Captured NAV button screenshot: ${navScreenshotPath}`);

    // Scroll to FX Bank section and open bank dropdown
    const fxBankHeading = page.locator('text="Devizaárfolyam és Pénzintézet Beállítások"').first();
    await fxBankHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    const fxBankTrigger = page.locator('button[role="combobox"]').filter({ hasText: /Magyar Nemzeti Bank|MNB|Bank/ }).first();
    if (await fxBankTrigger.isVisible().catch(() => false)) {
      await fxBankTrigger.click();
      await page.waitForTimeout(600);
      const fxScreenshotPath = path.join(artifactDir, "eb0258_03_settings_fx_banks_and_rates.png");
      await page.screenshot({ path: fxScreenshotPath, fullPage: false });
      console.log(`Captured FX Bank dropdown screenshot: ${fxScreenshotPath}`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // ── Step 3: Navigate to General Ledger (Főkönyvi Kivonat) ──
    console.log(`Step 3: Navigating to /${companyId}/${dateRange}/general-ledger...`);
    await page.goto(`/${companyId}/${dateRange}/general-ledger`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(4000);

    // Verify page title
    await expect(page.locator("body")).toContainText(/Főkönyvi kivonat/i);

    // Verify Date Basis toggle has 'Teljesítés' active
    console.log("Verifying General Ledger Date Basis toggle has 'Teljesítés' active...");
    const teljesitesToggleBtn = page.locator('button:has-text("Teljesítés")').first();
    await expect(teljesitesToggleBtn).toBeVisible({ timeout: 10_000 });
    
    // Check class or attribute indicating active state (bg-muted or shadow-xs or font-semibold)
    const toggleClass = await teljesitesToggleBtn.getAttribute("class");
    console.log("Teljesítés toggle class:", toggleClass);
    expect(toggleClass).toContain("bg-muted");

    // Verify table root accounts rendered and aggregated (Class 1, 2, 3, 4 etc.)
    console.log("Verifying GL table rendered aggregated classes...");
    await expect(page.locator('text=/Fők. szám|Megnevezés|Összesített Egyenleg/').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("body")).toContainText(/Eszközök|Befektetett|Forgóeszközök|Kötelezettségek|Források/i);

    // Test expanding an account class interactively
    console.log("Testing user click expansion on an account row...");
    const expandableRow = page.locator('div[role="button"], button').filter({ hasText: /1\.|Befektetett|Eszközök/ }).first();
    if (await expandableRow.isVisible().catch(() => false)) {
      await expandableRow.click();
      await page.waitForTimeout(500);
    }

    // Capture General Ledger screenshot
    const glScreenshotPath = path.join(artifactDir, "eb0258_02_general_ledger_fulfillment_and_aggregated.png");
    await page.screenshot({ path: glScreenshotPath, fullPage: false });
    console.log(`Captured General Ledger screenshot: ${glScreenshotPath}`);

    console.log("All EB-0258 browser verification steps completed successfully!");
  });
});
