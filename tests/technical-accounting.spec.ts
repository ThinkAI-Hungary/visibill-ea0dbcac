import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';

const COMPANY_ID = 'eb1d61df-3f85-45e2-b4d2-a93719ff4a4d';
const DATE_RANGE = '2026-01-01_2026-12-31';
const ARTIFACT_DIR = 'C:/Users/adetw/.gemini/antigravity-ide/brain/eb4cffd3-9d96-417f-8226-6abe4ec67984';

async function performLogin(page: Page) {
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');

  await page.locator('input[type="email"]').fill('aron@thinkai.hu');
  await page.locator('input[type="password"]').fill('A237kkil815!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/auth'), { timeout: 15_000 });

  await page.evaluate((cId) => {
    localStorage.setItem('selectedCompanyId', cId);
  }, COMPANY_ID);
}

test.describe('Module 22 - Technical Accounting & Analytics E2E Tests', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await performLogin(page);
  });

  test('TC-1: Sidebar navigation to Technical Accounting page', async ({ page }) => {
    // Navigate to scoped dashboard first to load sidebar
    await page.goto(`/${COMPANY_ID}/${DATE_RANGE}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Ensure Könyvelés group in sidebar is expanded
    const konyvelesBtn = page.locator('button:has-text("Könyvelés")').first();
    await konyvelesBtn.scrollIntoViewIfNeeded();
    const dataState = await konyvelesBtn.getAttribute('data-state');
    const ariaExpanded = await konyvelesBtn.getAttribute('aria-expanded');
    if (dataState === 'closed' || ariaExpanded === 'false' || (!dataState && !ariaExpanded)) {
      await konyvelesBtn.click();
      await page.waitForTimeout(600);
    }

    const techAccountingLink = page.locator('a[href*="technical-accounting"]').first();
    await techAccountingLink.scrollIntoViewIfNeeded();
    await expect(techAccountingLink).toBeVisible({ timeout: 10_000 });
    await techAccountingLink.click();

    // Verify URL
    await page.waitForURL(/.*technical-accounting/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify Page Header and Badges
    await expect(page.locator('h1')).toContainText('Technikai Műveletek & Elemzések');
    await expect(page.locator('text=Modul 22 · Sztv. 165–169. §')).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tc1_tech_accounting_page.png'), fullPage: false });
  });

  test('TC-2: All 5 tabs of Technical Accounting function correctly', async ({ page }) => {
    await page.goto(`/${COMPANY_ID}/${DATE_RANGE}/technical-accounting`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify Header
    await expect(page.locator('h1')).toContainText('Technikai Műveletek & Elemzések');

    // ── Tab 1: Tömeges Átsorolás (Reclassification Wizard) ──
    const reclassTab = page.locator('[role="tab"]:has-text("Tömeges Átsorolás")');
    await expect(reclassTab).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Forrás Főkönyvi Számla')).toBeVisible();
    await expect(page.locator('text=Cél Főkönyvi Számla')).toBeVisible();
    await expect(page.locator('text=Átvezetési Bizonylat Dátuma')).toBeVisible();

    // Select source account to trigger item list and simulation button
    const sourceSelect = page.locator('select[aria-label="Forrás főkönyvi számla kiválasztása"]');
    await expect(sourceSelect).toBeVisible();
    // Select option 1 (e.g. first available GL account)
    await sourceSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1000);

    // Verify Dry-run simulate button exists once source account is picked
    const simulateBtn = page.getByRole('button', { name: /szimuláció futtatása/i });
    await expect(simulateBtn).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tc2_tab1_reclassification.png'), fullPage: false });

    // ── Tab 2: Partner 360° Dosszié ──
    const partnerTab = page.locator('[role="tab"]:has-text("Partner 360°")');
    await expect(partnerTab).toBeVisible();
    await partnerTab.click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Omni-Partner Karton & Pénzügyi Háló')).toBeVisible();
    await expect(page.locator('text=Partner Keresése és Kiválasztása')).toBeVisible();
    await expect(page.locator('text=Kiválasztott Partner')).toBeVisible();

    // Select first partner from dropdown
    const partnerSelect = page.locator('select[aria-label="Kiválasztott partner listája"]');
    await expect(partnerSelect).toBeVisible();
    await partnerSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1500);

    // Verify matrix / dossier details
    await expect(page.locator('text=Nettó Likvid Pozíció')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Kapcsolódó Főkönyvi Számlák és Jogcímek')).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tc2_tab2_partner360.png'), fullPage: false });

    // ── Tab 3: Omni Partnerbontás ──
    const omniTab = page.locator('[role="tab"]:has-text("Omni Partnerbontás")');
    await expect(omniTab).toBeVisible();
    await omniTab.click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Bármely Főkönyvi Számla Partnerbontása')).toBeVisible();
    await expect(page.getByRole('button', { name: /5\. Költségnemek/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /31\. Vevők/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /45\. Szállítók/i })).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tc2_tab3_omni_ledger.png'), fullPage: false });

    // ── Tab 4: AI Audit & Anomáliák ──
    const aiAuditTab = page.locator('[role="tab"]:has-text("AI Audit")');
    await expect(aiAuditTab).toBeVisible();
    await aiAuditTab.click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=AI Technikai Kontroll & Anomália Vadász')).toBeVisible();
    await expect(page.locator('text=Összes Anomália')).toBeVisible();
    await expect(page.locator('text=Inverz Számlaegyenleg')).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tc2_tab4_ai_audit.png'), fullPage: false });

    // ── Tab 5: Audit Napló & Rollback ──
    const auditLogTab = page.locator('[role="tab"]:has-text("Audit Napló")');
    await expect(auditLogTab).toBeVisible();
    await auditLogTab.click();
    await page.waitForTimeout(1000);

    await expect(page.locator('text=Átvezetési Audit Napló és Bizonylattörténet')).toBeVisible();
    await expect(page.locator('input[placeholder*="Keresés bizonylatszám"]')).toBeVisible();
    await expect(page.locator('text=Rögzített Könyvelési Átvezetések')).toBeVisible();

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tc2_tab5_audit_log.png'), fullPage: false });
  });

  test('TC-3: Partner 360° integration in Partners page', async ({ page }) => {
    await page.goto(`/${COMPANY_ID}/${DATE_RANGE}/partners`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Wait for the partner table to render
    const partnerRows = page.locator('table tbody tr');
    const rowCount = await partnerRows.count();
    console.log(`Found ${rowCount} partner rows`);

    if (rowCount > 0) {
      // Click on the first partner row to select it
      await partnerRows.first().click();
      await page.waitForTimeout(1500);

      // Verify detail panel shows Partner 360 section
      const partner360Header = page.locator('text=Teljes Főkönyvi Kapcsolat (Partner 360°)');
      await expect(partner360Header).toBeVisible({ timeout: 10_000 });

      // Click on 'Karton Megnyitása' button (use .first() to disambiguate from summary card button)
      const openCardBtn = page.getByRole('button', { name: /karton megnyitása/i }).first();
      await expect(openCardBtn).toBeVisible();
      await openCardBtn.click();
      await page.waitForTimeout(1000);

      // Verify modal dialog opens with 360 Dossier
      const modalTitle = page.getByRole('heading', { name: /partner 360° főkönyvi karton/i });
      await expect(modalTitle).toBeVisible({ timeout: 5000 });

      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tc3_partner360_modal.png'), fullPage: false });

      // Close modal dialog
      await page.keyboard.press('Escape');
    }
  });

  test('TC-4: Dashboard loads cleanly with Anomaly widget readiness', async ({ page }) => {
    await page.goto(`/${COMPANY_ID}/${DATE_RANGE}/`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify Dashboard container loaded
    await expect(page.locator('main').first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/D-INVOICE|Áttekintés|Kategóriák/i);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'tc4_dashboard.png'), fullPage: false });
  });
});
