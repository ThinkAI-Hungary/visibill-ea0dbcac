import { test, expect } from '@playwright/test';

test.describe('Legal Documents & Registration Clickwrap Flow', () => {
  test('Static PDF files are accessible directly via HTTP 200', async ({ request }) => {
    const aszfRes = await request.get('/docs/aszf.pdf');
    expect(aszfRes.status()).toBe(200);
    expect(aszfRes.headers()['content-type']).toContain('application/pdf');

    const privacyRes = await request.get('/docs/adatkezelesi-tajekoztato.pdf');
    expect(privacyRes.status()).toBe(200);
    expect(privacyRes.headers()['content-type']).toContain('application/pdf');
  });

  test('Public /aszf and /adatvedelem pages render with embedded viewer and download links', async ({ page }) => {
    await page.goto('/aszf');
    await page.waitForLoadState('networkidle');

    // Title and active tab check
    await expect(page.locator('h1')).toContainText('Általános Szerződési Feltételek');
    const iframe = page.locator('iframe');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('src', /\/docs\/aszf\.pdf/);

    // Download button exists with valid download attribute
    const downloadBtn = page.locator('a:has-text("Letöltés (PDF)")');
    await expect(downloadBtn).toBeVisible();
    await expect(downloadBtn).toHaveAttribute('download', 'Visibill_ASZF.pdf');

    // Switch to Privacy tab
    await page.locator('button[role="tab"]:has-text("Adatkezelési tájékoztató")').click();
    await expect(page.locator('h1')).toContainText('Adatkezelési Tájékoztató');
    await expect(page.locator('iframe')).toHaveAttribute('src', /\/docs\/adatkezelesi-tajekoztato\.pdf/);

    // Navigate directly to /adatvedelem
    await page.goto('/adatvedelem');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Adatkezelési Tájékoztató');
  });

  test('Registration form enforces terms clickwrap consent', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    // Switch to signup tab
    await page.locator('button:has-text("Regisztráció")').first().click();

    // Fill in valid credentials
    await page.locator('input#signup-name').fill('Teszt Felhasználó');
    await page.locator('input#signup-email').fill('teszt.legal@visibill.hu');
    await page.locator('input#signup-password').fill('Teszt1234!');
    await page.locator('input#signup-confirm-password').fill('Teszt1234!');

    const submitBtn = page.locator('button[type="submit"]:has-text("Regisztráció")');
    const checkbox = page.locator('button#signup-accept-terms');

    // Scroll checkbox into view
    await checkbox.scrollIntoViewIfNeeded();

    // Button MUST be disabled when checkbox is unchecked
    await expect(submitBtn).toBeDisabled();

    // Save screenshot of registration with terms checkbox
    await page.screenshot({ path: 'C:/Users/adetw/.gemini/antigravity-ide/brain/078d6f39-0932-47b5-89af-c7208a4987ed/legal_01_signup_checkbox.png' });

    // Verify legal links inside the consent label
    const aszfLink = page.locator('label[for="signup-accept-terms"] a:has-text("Általános Szerződési Feltételeket")');
    await expect(aszfLink).toBeVisible();
    await expect(aszfLink).toHaveAttribute('target', '_blank');
    await expect(aszfLink).toHaveAttribute('href', '/aszf');

    const privacyLink = page.locator('label[for="signup-accept-terms"] a:has-text("Adatkezelési Tájékoztatót")');
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute('target', '_blank');
    await expect(privacyLink).toHaveAttribute('href', '/adatvedelem');

    // Click checkbox to accept terms
    await checkbox.click();

    // Button should now be enabled
    await expect(submitBtn).toBeEnabled();

    // Uncheck again -> button should become disabled
    await checkbox.click();
    await expect(submitBtn).toBeDisabled();
  });

  test('Capture /aszf page screenshot', async ({ page }) => {
    await page.goto('/aszf');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'C:/Users/adetw/.gemini/antigravity-ide/brain/078d6f39-0932-47b5-89af-c7208a4987ed/legal_02_aszf_viewer.png' });
  });
});
