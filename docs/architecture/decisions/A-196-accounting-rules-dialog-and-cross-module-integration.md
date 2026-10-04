# A-196: Könyvelési Szabályok Modális és Keresztmodul Integrációja (ÁFA, Napló és Főkönyvi Szabálykezelő)

**Státusz:** ✅ Decided  
**Dátum:** 2026-10-04  
**Kategória:** Frontend Architektúra / Moduláris Komponensek / Szabálymotor  
**Kapcsolódó PRD:** [P-156: Könyvelési Szabályok Elérése az ÁFA Bevallás és Napló Alól](../../product/decisions/P-156-accounting-rules-integration-in-vat-and-journals.md)  
**Kapcsolódó korábbi döntések:** [A-144: Determinisztikus Számlatétel Szabály Motor](./A-144-deterministic-invoice-item-rules-engine.md), [A-177: Egységes Számlaszabály Kezelő Komponens és eaisyBooks Integráció](./A-177-unified-invoice-rules-component-and-eaisybooks-integration.md)

---

## 1. Architekturális Háttér

A determinisztikus számlatétel-szabályok (`invoice_item_rules`) és a cég AI prompt szabályai (`company_prompt_rules`) korábban az eaisyBooks modul lapjaként (`PromptsPage.tsx`) vagy a számlák táblázat modáljaként (`InvoiceRulesDialog.tsx`) voltak elérhetők. 

Szükségessé vált a szabálykezelés általánossá tétele:
1. Az ÁFA felület (`VatReturnContainer`) és a könyvelési napló (`JournalsPage`) közvetlenül elérhetővé tegye a szabályokat felugró modálként anélkül, hogy a felhasználót elnavigálná az aktív adatokról.
2. A prompt-szabályok logikája (`CompanyPromptRulesManager`) komponensként újrahasznosítható legyen mind beágyazott dialógusban (`asDialog`), mind önálló oldalon.
3. A bal oldali navigációs menüben (`AppSidebar`) közvetlen, gyorsítótárazott (prefetch) útvonal mutasson az új `/accounting-rules` oldalra.

---

## 2. Komponens és Adatfolyam Architektúra

### 2.1 Új Komponensek
1. `src/components/accounting/CompanyPromptRulesManager.tsx`:
   - Önállóan felel a `company_prompt_rules` lekérdezéséért, szűréséért, aktív állapot kapcsolásáért, szerkesztéséért és törléséért.
   - Tartalmazza a beépített AI prompt mintasablonokat (pl. Benzin ÁFA-levonási tilalom, reprezentációs költségek, devizás kerekítések).
   - Támogatja az `asDialog` és beágyazott konténer módot.
2. `src/components/accounting/AccountingRulesDialog.tsx`:
   - Konténer dialógus (`Dialog`, `DialogContent`), amely két külön lapfülön (`Tabs`) fogja össze az `InvoiceItemRulesManager`-t és a `CompanyPromptRulesManager`-t.
   - Párhuzamos TanStack Query-kkel azonnal lekéri a két szabálytípus darabszámát, és a lapfül címkék mellett kis badge-ekben jeleníti meg.
3. `src/pages/AccountingRulesPage.tsx`:
   - A dedikált `/accounting-rules` és `/accounting-rules/:tab` útvonalakat kiszolgáló oldal, amely a teljes ablakos kétlapfüles nézetet biztosítja.

### 2.2 Útvonalkezelés és Jogosultságok
- `src/routes/eaisybillRoutes.tsx`:
  - `accounting-rules/:tab?` regisztrálva a scoped útvonalak között (`/:companyId/:dateRange/accounting-rules`).
  - Hagyományos `prompts/:tab?` átirányítás biztosítva a visszafelé kompatibilitás érdekében.
- `src/hooks/useEaisybillPermissions.ts`:
  - Az `accounting-rules` és `prompts` modul a `journals` jogosultsági kategóriához (`MEMBER_MODULES`) lett hozzárendelve, garantálva, hogy minden könyvelő és tag zökkenőmentesen elérhesse.

### 2.3 Állapot és Dialógus Vezérlés a Fogyasztó Komponensekben
- Mind a `VatReturnContainer`, mind a `JournalsPage` helyi állapotot (`rulesDialogOpen`) tart fenn.
- A dialógus bezárásakor sem az ÁFA számítási cache, sem a napló szűrőfeltételei nem ürülnek ki, így a felhasználó megszakítás nélkül tudja folytatni munkáját.

---

## 3. Minőségbiztosítás és Tesztelés

- **Egységteszt (`src/test/accountingRulesIntegration.test.tsx`):**
  - Teszteli a dialógus megjelenését, a tabok helyes feliratát és a darabszám jelzőket.
  - Teszteli a determinisztikus számlaszabályok betöltését az 1-es tabon.
  - Teszteli az AI prompt könyvtár betöltését a 2-es tabon.
- **Böngészős E2E Hitelesítés (`browser_subagent`):**
  - Megvizsgálva az ÁFA oldalon a gomb működése és a dialógus.
  - Megvizsgálva a Napló oldalon a gomb működése és a dialógus.
  - Megvizsgálva a Sidebar „Könyvelési szabályok” menüpontja és az önálló oldal betöltése.
