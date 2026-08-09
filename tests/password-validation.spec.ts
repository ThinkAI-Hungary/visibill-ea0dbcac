import { test, expect } from "@playwright/test";

test.describe("Registration Password Validation", () => {
  test("Felkiáltójel (!) speciális karakter elfogadása regisztrációnál", async ({ page }) => {
    // 1. Navigáció az auth oldalra
    await page.goto("/auth");

    // 2. Váltás a Regisztráció fülre
    const signupTab = page.getByRole("button", { name: "Regisztráció", exact: true });
    await signupTab.click();

    // 3. Mezők kitöltése
    await page.locator("#signup-name").fill("Teszt Elek");
    await page.locator("#signup-email").fill("teszt.elek@example.com");

    // Jelszó megadása felkiáltójellel (!)
    const passwordInput = page.locator("#signup-password");
    await passwordInput.fill("Aa1234!");

    // 4. Ellenőrzés: A speciális karakter indikátor aktív (zöld)
    const specialIndicator = page.locator("span", { hasText: "Speciális (._?@>!#$~%^&*()+-=)" });
    await expect(specialIndicator).toBeVisible();
    
    // A zöld szín osztályának megléte (text-emerald-600 vagy dark:text-emerald-400)
    await expect(specialIndicator).toHaveClass(/text-emerald-600|text-emerald-400/);

    // 5. Jelszó megerősítés megadása
    await page.locator("#signup-confirm-password").fill("Aa1234!");

    // 6. Ellenőrzés: A regisztrációs gomb engedélyezett
    const submitBtn = page.locator('button[type="submit"]').filter({ hasText: "Regisztráció" });
    await expect(submitBtn).toBeEnabled();
  });

  test("Jelszó érvénytelenítése ha nincs benne speciális karakter", async ({ page }) => {
    await page.goto("/auth");
    const signupTab = page.getByRole("button", { name: "Regisztráció", exact: true });
    await signupTab.click();

    await page.locator("#signup-name").fill("Teszt Elek");
    await page.locator("#signup-email").fill("teszt.elek@example.com");

    // Jelszó speciális karakter nélkül
    await page.locator("#signup-password").fill("Aa1234");
    await page.locator("#signup-confirm-password").fill("Aa1234");

    const specialIndicator = page.locator("span", { hasText: "Speciális (._?@>!#$~%^&*()+-=)" });
    await expect(specialIndicator).toBeVisible();
    
    // Nem szabad zöldnek lennie, hanem a muted szín (text-muted-foreground) kell hogy rajta legyen
    await expect(specialIndicator).toHaveClass(/text-muted-foreground/);

    const submitBtn = page.locator('button[type="submit"]').filter({ hasText: "Regisztráció" });
    await expect(submitBtn).toBeDisabled();
  });
});
