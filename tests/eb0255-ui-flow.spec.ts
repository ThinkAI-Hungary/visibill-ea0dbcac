import { test, expect } from "@playwright/test";
import { login } from "./helpers";
import * as path from "path";

test.describe("EB-0255 E2E Browser Testing - Chart of Accounts & Subledger", () => {
  const artifactDir = "C:/Users/adetw/.gemini/antigravity-ide/brain/078d6f39-0932-47b5-89af-c7208a4987ed";

  test("Verifies full UI workflow for EB-0255", async ({ page }) => {
    test.setTimeout(90_000);
    // 1. Login
    console.log("Step 1: Logging in...");
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="email"]').fill("aron@thinkai.hu");
    await page.locator('input[type="password"]').fill("A237kkil815!");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 15_000 });
    console.log("Logged in successfully! Current URL:", page.url());
    
    // Set selected company to Kolos Transport Kft.
    await page.evaluate(() => {
      localStorage.setItem('selectedCompanyId', 'b16df0ae-27fb-42df-bb9c-0d03122d1d5c');
    });
    await page.waitForTimeout(1000);

    // 2. Navigate to scoped /general-ledger
    const companyId = "b16df0ae-27fb-42df-bb9c-0d03122d1d5c";
    const dateRange = "2026-01-01_2026-12-31";
    console.log(`Step 2: Navigating to /${companyId}/${dateRange}/general-ledger...`);
    await page.goto(`/${companyId}/${dateRange}/general-ledger`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(4000);

    // Verify page title / heading
    await expect(page.locator("body")).toContainText(/Főkönyvi kivonat|Számlatükör|Főkönyv/i);

    // Verify tree items rendered
    const groupBadge = page.locator('text="Csoport"').first();
    await expect(groupBadge).toBeVisible({ timeout: 15_000 });
    console.log("Verified 'Csoport' badge is rendered on group accounts!");

    // Capture General Ledger screenshot
    await page.screenshot({ path: path.join(artifactDir, "eb0255_01_general_ledger.png"), fullPage: false });

    // Step 3: Open Copy Chart of Accounts Modal from Toolbar ("Sablonok kezelése" dropdown)
    console.log("Step 3: Opening CopyChartOfAccountsModal from 'Sablonok kezelése'...");
    const coaSettingsBtn = page.locator('button:has-text("Sablonok kezelése"), button:has-text("Kezelés")').first();
    await expect(coaSettingsBtn).toBeVisible({ timeout: 5000 });
    await coaSettingsBtn.click();
    await page.waitForTimeout(500);

    const copyMenuItem = page.locator('[role="menuitem"]:has-text("másolása másik cégből")').first();
    await expect(copyMenuItem).toBeVisible({ timeout: 5000 });
    await copyMenuItem.click();
    await page.waitForTimeout(1000);

    const copyModal = page.locator('[role="dialog"]');
    await expect(copyModal).toBeVisible();
    await expect(copyModal).toContainText(/Számlatükör Másolása Másik Cégből/i);
    await expect(copyModal).toContainText(/Egyetlen aktív számlatükör szabály/i);
    await expect(copyModal).toContainText(/1-kattintásos átmásolás/i);
    console.log("Verified CopyChartOfAccountsModal opened with 1-click cloning UI and rules!");

    // Capture Copy Modal screenshot
    await page.screenshot({ path: path.join(artifactDir, "eb0255_02_copy_coa_modal.png") });

    const cancelCopyBtn = copyModal.locator('button:has-text("Mégse")').first();
    await cancelCopyBtn.click();
    await page.waitForTimeout(500);

    // Step 4: Open 'Új főkönyvi szám' modal to verify shared form fields
    console.log("Step 4: Opening 'Új főkönyvi szám' modal to verify GlAccountFormFields...");
    const addAccountBtn = page.locator('button:has-text("Új főkönyvi szám")').first();
    await expect(addAccountBtn).toBeVisible({ timeout: 5000 });
    await addAccountBtn.click();
    await page.waitForTimeout(1000);

    const addModal = page.locator('[role="dialog"]');
    await expect(addModal).toBeVisible();
    await expect(addModal).toContainText(/Számla jellege/i);
    await expect(addModal).toContainText(/Könyvelési számla/i);
    await expect(addModal).toContainText(/Csoportszámla/i);
    await expect(addModal).toContainText(/Folyószámla és analitika típus/i);
    await expect(addModal).toContainText(/Nyitott tételek kezelése/i);
    console.log("Verified shared GlAccountFormFields rendered with Group vs Detail and Subledger types!");

    // Capture Add Account Modal screenshot
    await page.screenshot({ path: path.join(artifactDir, "eb0255_03_add_account_modal.png") });

    const cancelAddBtn = addModal.locator('button:has-text("Mégse")').first();
    await cancelAddBtn.click();
    await page.waitForTimeout(500);

    // Step 5: Navigate to Subledger (/subledger)
    console.log(`Step 5: Navigating to /${companyId}/${dateRange}/subledger...`);
    await page.goto(`/${companyId}/${dateRange}/subledger`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(4000);

    // Verify subledger page elements
    await expect(page.locator("body")).toContainText(/Folyószámla|Nyitott tételek/i);
    await page.screenshot({ path: path.join(artifactDir, "eb0255_04_subledger_page.png") });

    // Step 6: Navigate to Journals (/journals)
    console.log(`Step 6: Navigating to /${companyId}/${dateRange}/journals...`);
    await page.goto(`/${companyId}/${dateRange}/journals`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(4000);

    const newJournalBtn = page.locator('button:has-text("Új vegyes bizonylat"), button:has-text("Új bizonylat")').first();
    if (await newJournalBtn.isVisible()) {
      await newJournalBtn.click();
      await page.waitForTimeout(1000);

      const journalModal = page.locator('[role="dialog"]');
      if (await journalModal.isVisible()) {
        await page.screenshot({ path: path.join(artifactDir, "eb0255_05_manual_journal_modal.png") });
        const closeJournalBtn = journalModal.locator('button:has-text("Mégse"), button[aria-label="Close"]').first();
        if (await closeJournalBtn.isVisible()) {
          await closeJournalBtn.click();
        }
      }
    }

    console.log("EB-0255 UI E2E test completed successfully!");
  });
});
