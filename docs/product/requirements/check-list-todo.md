# Könyvelőprogram Követelmény- és Fejlesztési Teendőlista (TODO Backlog)

**Forrás:** `docs/product/requirements/MI_konyveloprogram_minimum_csekklista.xlsx` & `docs/product/requirements/check-list.md`  
**Vizsgált rendszerek:** Eaisybill & eaisyBooks (Accounty ERP)  
**Dokumentum célja:** Az ellenőrzőlistából szűrt **összes hiányzó (97 tétel)** és **részben kész (221 tétel)** funkció teljes körű, strukturált implementációs jegyzéke.  
**Státusz dátuma:** 2026-09-27  

---

## 1. Vezetői Összefoglaló (Executive Summary & KPIs)

A könyvelőirodai követelménylista 1146 tétele közül az audit **828 tételt (72.3%)** talált teljesen megvalósítottnak. A fennmaradó **318 tétel (27.7%)** képezi a termékfejlesztési teendőlistát (backlog).

### 📊 Teendők Megoszlása

- 📋 **Összes teendő (TODO tételszám):** **318 tétel**
- 🟡 **Részben kész funkciók:** **221 tétel** (69.5% a teendőkből) – Az adatbázis-táblák, háttér RPC-k vagy részfolyamatok már léteznek, de dedikált felhasználói felület, finomhangolás vagy kiegészítő mezők szükségesek.
- ❌ **Hiányzó funkciók:** **97 tétel** (30.5% a teendőkből) – Teljesen új komponensek, adatbázis-struktúrák és logikák bevezetése szükséges (kiemelten: belső számlázómotor és szerződéses számlázás).

---

## 2. Fejlesztési Prioritási Mátrix (Epic & Sprint Bontás)

| Prioritási Szint | Témakörök | Teendők száma | Fő Fókuszterület & Elvárt Eredmény |
| :--- | :--- | :---: | :--- |
| 🔴 **P1 – Kritikus / Sürgős** | 38, 39 | **59 tétel** (55 hiányzik, 4 részben) | **Saját Számlázómotor és Szerződéses Számlázás:** Beépített számlatömbök (`számlatömb kód, sorszám-előtag, szigorú számozás`), előleg-, végszámla-, helyesbítő számlák kiállítása, NAV Online Számla `ManageInvoice 3.0` outbound adatszolgáltatás, valamint ismétlődő szerződéses számlázás. |
| 🟠 **P2 – Magas** | 02, 06, 07, 23, 27 | **82 tétel** (16 hiányzik, 66 részben) | **Strukturált Törzsadatok & Számviteli Zárási Varázslók:** Cég- és partnercímek szétbontása szabványos mezőkre (közterület neve, jellege, házszám, épület, lépcsőház, emelet, ajtó, HRSZ); partnerek 1:N bankszámlatörzse; `AccrualsPage.tsx` felület megépítése az `accrual_entries` RPC-khez; Dec 31-i év végi automatikus devizaátértékelő varázsló. |
| 🟡 **P3 – Normál** | 01, 03, 04, 05, 08, 09, 10, 11, 12, 13, 14, 15, 18, 20, 22, 24, 25, 28, 34 | **126 tétel** (26 hiányzik, 100 részben) | **Számviteli Finomhangolások & Törzsadat-bővítések:** Cég- és partnerkódok, naptáritól eltérő üzleti év lezárás, százalékos kulcsos költségfelosztási sablonok, speciális áfakódok, folyószámla és pénztári zárási finomítások, KIVA áttérési leltár. |
| ⚪ **P4 – Speciális / Bővítmény** | 35, 41 | **51 tétel** (0 hiányzik, 51 részben) | **Specializált Szervezetek & Rendszermigráció:** Civil és nonprofit szervezetek alap- vs. vállalkozási tevékenység analitikája és 1%-os kimutatás; natív SUP ERP közvetlen adatkonverter varázsló. |

---

## 3. Témakörönkénti Teendő-Összesítő Mátrix (28 Érintett Témakör)

| # | Témakör Neve | Összes teendő | 🟡 Részben kész | ❌ Hiányzik | Prioritás | Fő felelős komponensek |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **01** | 01. Cégtörzs – azonosítás | **14** | 8 | 6 | 🟡 P3 – Normál | `companies` tábla, `BusinessSection.tsx`, `CompanySettingsPage.tsx` |
| **02** | 02. Cégtörzs – címek | **13** | 6 | 7 | 🟠 P2 – Magas | `companies`, `company_locations`, `CompanySettingsPage.tsx` |
| **03** | 03. Adózás és számviteli beállítások | **15** | 14 | 1 | 🟡 P3 – Normál | `accounty_tax_profiles`, `companies`, `AccountingPolicySection.tsx`, `TaoSetupWizardPage.tsx` |
| **04** | 04. Üzleti év és végelszámolás | **11** | 5 | 6 | 🟡 P3 – Normál | `accounting_periods`, `companies`, `FiscalYearSettings.tsx` |
| **05** | 05. Partnertörzs – alapadatok | **14** | 10 | 4 | 🟡 P3 – Normál | `partners`, `PartnerFormDialog.tsx`, `PartnersPage.tsx` |
| **06** | 06. Partnertörzs – cím és kapcsolattartás | **22** | 15 | 7 | 🟠 P2 – Magas | `partners`, `partner_addresses`, `PartnerFormDialog.tsx`, `PartnersPage.tsx` |
| **07** | 07. Partnertörzs – bankszámlák | **13** | 11 | 2 | 🟠 P2 – Magas | `partner_bank_accounts` (új tábla), `PartnerFormDialog.tsx`, `PartnersPage.tsx` |
| **08** | 08. Törzsadatok – ellenőrzés és módosítás | **6** | 4 | 2 | 🟡 P3 – Normál | `partners`, `gl_accounts`, `AuditLogViewer.tsx`, `MergePartnersModal.tsx` |
| **09** | 09. Számlatükör | **14** | 11 | 3 | 🟡 P3 – Normál | `gl_accounts`, `chart_of_accounts_presets`, `ChartOfAccountsPage.tsx` |
| **10** | 10. Naplótörzs | **3** | 3 | 0 | 🟡 P3 – Normál | `acc_journals`, `JournalsPage.tsx`, `JournalEntryForm.tsx` |
| **11** | 11. Saját bank- és pénztártörzs | **2** | 2 | 0 | 🟡 P3 – Normál | `bank_accounts`, `cash_desks`, `BankSettings.tsx`, `PettyCashPage.tsx` |
| **12** | 12. Deviza- és árfolyamtörzs | **1** | 1 | 0 | 🟡 P3 – Normál | `exchange_rates`, `ExchangeRates.tsx`, MNB szinkron |
| **13** | 13. Gyűjtőtörzsek és költségfelosztás | **12** | 8 | 4 | 🟡 P3 – Normál | `cost_centers`, `projects`, `acc_journal_lines`, `CostCentersPage.tsx` |
| **14** | 14. Áfakódtörzs | **1** | 1 | 0 | 🟡 P3 – Normál | `vat_codes`, `VatCodesSettings.tsx`, `VatReturnPage.tsx` |
| **15** | 15. Fizetési módok és kontírsablonok | **1** | 1 | 0 | 🟡 P3 – Normál | `payment_methods`, `accounting_templates`, `SettingsPage.tsx` |
| **18** | 18. Könyvelés – bizonylatsor | **1** | 1 | 0 | 🟡 P3 – Normál | `acc_journal_lines`, `JournalEntryForm.tsx` |
| **20** | 20. Könyvelés – számlák és folyószámla | **3** | 3 | 0 | 🟡 P3 – Normál | `invoices`, `transactions`, `accounty_partner_subledgers`, `PartnerSubledgerPage.tsx` |
| **22** | 22. Pénztár – bizonylat és működés | **2** | 2 | 0 | 🟡 P3 – Normál | `petty_cash_transactions`, `PettyCashPage.tsx` |
| **23** | 23. Deviza – értékelés és különbözetek | **11** | 11 | 0 | 🟠 P2 – Magas | `ExchangeRates.tsx`, `acc_journal_entries`, `FxRevaluationWizardPage.tsx` (új) |
| **24** | 24. Áfa – ügyletfajták | **7** | 7 | 0 | 🟡 P3 – Normál | `vat_codes`, `invoices`, `VatReturnPage.tsx` |
| **25** | 25. Áfa – időzítés és korrekció | **5** | 5 | 0 | 🟡 P3 – Normál | `invoices`, `acc_journal_lines`, `VatReturnPage.tsx` |
| **27** | 27. Elhatárolások – adatok | **23** | 23 | 0 | 🟠 P2 – Magas | `accrual_entries` tábla, `AccrualsPage.tsx` (új felület), RPC: `book_accrual_entry` |
| **28** | 28. Számviteli zárás és nyitás | **3** | 3 | 0 | 🟡 P3 – Normál | `accounting_periods`, `YearEndClosingWizardPage.tsx` |
| **34** | 34. Tárgyi eszköz – KIVA és áttérés | **11** | 11 | 0 | 🟡 P3 – Normál | `fixed_assets`, `FixedAssetsPage.tsx`, `AssetCardPage.tsx` |
| **35** | 35. Civil és nonprofit – analitikák | **28** | 28 | 0 | ⚪ P4 – Speciális / Bővítmény | `accounty_civil_*`, `OrgCivilPage.tsx`, `CivilReportWizard.tsx` |
| **38** | 38. Saját számlázó – törzsek | **39** | 4 | 35 | 🔴 P1 – Kritikus / Sürgős | `invoice_series`, `invoices`, `InvoiceCreatePage.tsx` (új), `ManageInvoice30` beküldő worker |
| **39** | 39. Szerződéses számlázás | **20** | 0 | 20 | 🔴 P1 – Kritikus / Sürgős | `billing_contracts`, `billing_contract_items`, `ContractsPage.tsx` (új), cron generátor |
| **41** | 41. SUP-adatok átvétele | **23** | 23 | 0 | ⚪ P4 – Speciális / Bővítmény | `UploadAuditXmlModal.tsx`, `SupDataImportPage.tsx` (új adatkonverter) |

---

## 4. Részletes Tételes Teendőjegyzék (Mind a 318 Tétel)

> [!IMPORTANT]
> Az alábbi táblázatokban **minden egyes tételnél** külön feltüntetésre került:
> - **Mi van kész jelenleg:** a termelési kódbázisban és adatbázisban fizikailag létező elemek (táblák, oszlopok, RPC-k, meglévő felületek).
> - **Mivel kell kiegészíteni:** a könyvelői elfogadáshoz minimálisan szükséges fejlesztési, módosítási vagy új funkció-tervezési lépések.

### 01. Cégtörzs – azonosítás

- **Érintett Epic:** Törzsadatok és cégbeállítások finomhangolása
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `companies` tábla, `BusinessSection.tsx`, `CompanySettingsPage.tsx`
- **Teendők ebben a témakörben:** **14 tétel** (🟡 8 részben kész, ❌ 6 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K01.03` | Könyvelt szervezet – rögzíthető adat: Rövidített név. | 🟡 **Részben kész** | `companies.name` mezőből automatikus monogram és rövidítés készül | Külön `short_name` oszlop és beviteli mező bevezetése szükséges a `companies` táblába. | P3 |
| `K01.04` | Könyvelt szervezet – rögzíthető adat: Jogi forma: gazdasági társaság, egyesület vagy alapítvány. | 🟡 **Részben kész** | Moduláris felosztás: EV (`accounty_ev_client_settings`), Társasház (`accounty_condo_*`), Civil (`OrgCivilPage`) | Egységes `legal_form` enum mező felvétele a `companies` táblára (gazdasági társaság, egyesület, alapítvány). | P3 |
| `K01.05` | Könyvelt szervezet – rögzíthető adat: Nonprofit gazdasági társaság jelölése. | 🟡 **Részben kész** | Civil modul (`OrgCivilPage`) és P-073 | A `companies` táblán külön `is_nonprofit` boolean jelölő mező felvétele szükséges. | P3 |
| `K01.06` | Könyvelt szervezet – rögzíthető adat: Közhasznú jogállás jelölése. | 🟡 **Részben kész** | Civil és nonprofit modul (`OrgCivilPage`) | Dedikált `is_public_benefit` (közhasznú jogállás) kapcsoló bevezetése a cégtörzsbe. | P3 |
| `K01.07` | Könyvelt szervezet – rögzíthető adat: Közhasznú jogállás kezdőnapja. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | `public_benefit_start_date` dátummező hozzáadása a cégbeállításokhoz. | P3 |
| `K01.08` | Könyvelt szervezet – rögzíthető adat: Közhasznú jogállás megszűnésének napja. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | `public_benefit_end_date` dátummező hozzáadása a cégbeállításokhoz. | P3 |
| `K01.10` | Könyvelt szervezet – rögzíthető adat: Közösségi adószám. | 🟡 **Részben kész** | Magyar adószámból automatikus HU előtag generálás VIES/NAV szinkronhoz; partnereknél `eu_tax_number` | A `companies` táblán külön `eu_tax_number` mező biztosítása az egyedi közösségi adószámhoz. | P3 |
| `K01.11` | Könyvelt szervezet – rögzíthető adat: Cégjegyzékszám gazdasági társaságnál. | 🟡 **Részben kész** | `accounty_nav_representations.registration_number` tárolja a cégképviseletnél | A `companies` alaptáblában dedikált `registration_number` (Cégjegyzékszám: 01-09-XXXXXX) mező rögzítése. | P3 |
| `K01.12` | Könyvelt szervezet – rögzíthető adat: Bírósági nyilvántartási szám civil szervezetnél. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | `court_registration_number` (bírósági nyilvántartási szám) mező felvétele civil szervezetekhez. | P3 |
| `K01.13` | Könyvelt szervezet – rögzíthető adat: Statisztikai számjel. | 🟡 **Részben kész** | Az adószám első 8 jegye (törzsszám) kinyerhető | 17 jegyű KSH statisztikai számjel mező (`statistical_code`) rögzítése. | P3 |
| `K01.15` | Könyvelt szervezet – rögzíthető adat: Alapítás dátuma. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | `incorporation_date` (alapítás dátuma) mező hozzáadása a cégtörzshöz. | P3 |
| `K01.19` | Könyvelt szervezet – rögzíthető adat: Kapcsolattartási telefonszám. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | `phone` mező hozzáadása a `companies` táblához és a cégbeállítások űrlaphoz. | P3 |
| `K01.23` | Könyvelt szervezet – rögzíthető adat: Inaktív ügyfél jelölése. | 🟡 **Részben kész** | `accounty_assignments.kanban_status` (archived, inactive) | Közvetlen `is_active` boolean oszlop és inaktiválási workflow kialakítása a `companies` táblán. | P3 |
| `K01.24` | A nonprofit jelölés és a közhasznú jogállás egymástól függetlenül beállítható legyen. | ❌ **Hiányzik** | Civil modulban van funkció, de nem független kapcsolók a cégtörzsben | Két független kapcsoló (Nonprofit gazdasági társaság vs Közhasznú jogállás) beépítése a cégbeállításokba. | P3 |

### 02. Cégtörzs – címek

- **Érintett Epic:** Strukturált címkezelés és telephely-nyilvántartás
- **Prioritási szint:** 🟠 P2 – Magas
- **Érintett technikai réteg:** `companies`, `company_locations`, `CompanySettingsPage.tsx`
- **Teendők ebben a témakörben:** **13 tétel** (🟡 6 részben kész, ❌ 7 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K02.02` | Szervezeti cím – rögzíthető adat: Országkód. | 🟡 **Részben kész** | `companies.address` és `company_locations.address` egybefüggő szövegként tárolja a címet | Strukturált címmezők bevezetése szükséges: országkód, irányítószám, település, közterület neve, jellege, házszám (Országkód.). | P2 |
| `K02.03` | Szervezeti cím – rögzíthető adat: Irányítószám. | 🟡 **Részben kész** | `companies.address` és `company_locations.address` egybefüggő szövegként tárolja a címet | Strukturált címmezők bevezetése szükséges: országkód, irányítószám, település, közterület neve, jellege, házszám (Irányítószám.). | P2 |
| `K02.04` | Szervezeti cím – rögzíthető adat: Település. | 🟡 **Részben kész** | `companies.address` és `company_locations.address` egybefüggő szövegként tárolja a címet | Strukturált címmezők bevezetése szükséges: országkód, irányítószám, település, közterület neve, jellege, házszám (Település.). | P2 |
| `K02.05` | Szervezeti cím – rögzíthető adat: Közterület neve. | 🟡 **Részben kész** | `companies.address` és `company_locations.address` egybefüggő szövegként tárolja a címet | Strukturált címmezők bevezetése szükséges: országkód, irányítószám, település, közterület neve, jellege, házszám (Közterület neve.). | P2 |
| `K02.06` | Szervezeti cím – rögzíthető adat: Közterület jellege. | 🟡 **Részben kész** | `companies.address` és `company_locations.address` egybefüggő szövegként tárolja a címet | Strukturált címmezők bevezetése szükséges: országkód, irányítószám, település, közterület neve, jellege, házszám (Közterület jellege.). | P2 |
| `K02.07` | Szervezeti cím – rögzíthető adat: Házszám. | 🟡 **Részben kész** | `companies.address` és `company_locations.address` egybefüggő szövegként tárolja a címet | Strukturált címmezők bevezetése szükséges: országkód, irányítószám, település, közterület neve, jellege, házszám (Házszám.). | P2 |
| `K02.08` | Szervezeti cím – rögzíthető adat: Épület. | ❌ **Hiányzik** | A szöveges cím nem tartalmaz dedikált strukturált bontást | Finom címmező hozzáadása szükséges: Épület.. | P2 |
| `K02.09` | Szervezeti cím – rögzíthető adat: Lépcsőház. | ❌ **Hiányzik** | A szöveges cím nem tartalmaz dedikált strukturált bontást | Finom címmező hozzáadása szükséges: Lépcsőház.. | P2 |
| `K02.10` | Szervezeti cím – rögzíthető adat: Emelet. | ❌ **Hiányzik** | A szöveges cím nem tartalmaz dedikált strukturált bontást | Finom címmező hozzáadása szükséges: Emelet.. | P2 |
| `K02.11` | Szervezeti cím – rögzíthető adat: Ajtó. | ❌ **Hiányzik** | A szöveges cím nem tartalmaz dedikált strukturált bontást | Finom címmező hozzáadása szükséges: Ajtó.. | P2 |
| `K02.12` | Szervezeti cím – rögzíthető adat: Helyrajzi szám. | ❌ **Hiányzik** | Csak a tárgyi eszköz ingatlankartonon van HRSZ | Telephelycímekhez `parcel_number` (helyrajzi szám) mező biztosítása. | P2 |
| `K02.13` | Szervezeti cím – rögzíthető adat: Cím érvényességének kezdete. | ❌ **Hiányzik** | Nincs cím érvényességi idő nyilvántartás | `valid_from` és `valid_to` érvényességi dátummezők felvétele a `company_locations` táblába. | P2 |
| `K02.14` | Szervezeti cím – rögzíthető adat: Cím érvényességének vége. | ❌ **Hiányzik** | Nincs cím érvényességi idő nyilvántartás | `valid_from` és `valid_to` érvényességi dátummezők felvétele a `company_locations` táblába. | P2 |

### 03. Adózás és számviteli beállítások

- **Érintett Epic:** Adózási profilok és számviteli politika beállításai
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `accounty_tax_profiles`, `companies`, `AccountingPolicySection.tsx`, `TaoSetupWizardPage.tsx`
- **Teendők ebben a témakörben:** **15 tétel** (🟡 14 részben kész, ❌ 1 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K03.02` | Cégbeállítás – rögzíthető adat: Eredményadózási mód kezdőnapja. | 🟡 **Részben kész** | `accounty_tax_profiles`, `TaoBusinessYearPage.tsx` | Dedikált kezdő- és zárónap mezők felvétele a társasági adózási módhoz. | P3 |
| `K03.03` | Cégbeállítás – rögzíthető adat: Eredményadózási mód zárónapja. | 🟡 **Részben kész** | `accounty_tax_profiles`, `TaoBusinessYearPage.tsx` | Dedikált kezdő- és zárónap mezők felvétele a társasági adózási módhoz. | P3 |
| `K03.06` | Cégbeállítás – rögzíthető adat: Áfastátusz érvényességének vége. | 🟡 **Részben kész** | `companies.vat_regime` tárolja az aktuális státuszt | `vat_regime_effective_to` mező hozzáadása. | P3 |
| `K03.08` | Cégbeállítás – rögzíthető adat: Áfagyakoriság-váltás hatálynapja. | 🟡 **Részben kész** | `accounty_tax_profiles` tárolja az aktuális gyakoriságot | Áfagyakoriság-váltás hatálynapjának naplózása historikus táblában. | P3 |
| `K03.11` | Cégbeállítás – rögzíthető adat: Saját pénzforgalmi áfa zárónapja. | 🟡 **Részben kész** | `companies` tábla | Pénzforgalmi áfa zárónap mező hozzáadása. | P3 |
| `K03.13` | Cégbeállítás – rögzíthető adat: Számviteli árfolyamtípus. | 🟡 **Részben kész** | `daily_exchange_rates` MNB középárfolyamot tárol | Egyedi hitelintézeti vételi/eladási árfolyamtípus választó beépítése. | P3 |
| `K03.14` | Cégbeállítás – rögzíthető adat: Számviteli árfolyamválasztás hatálynapja. | 🟡 **Részben kész** | `company_fx_settings` | Árfolyamválasztás hatálynap mező rögzítése. | P3 |
| `K03.15` | Cégbeállítás – rögzíthető adat: Áfaárfolyam forrása, a számviteli forrástól függetlenül. | 🟡 **Részben kész** | MNB árfolyam motor elérhető számlákon és áfaanalitikában | Különálló áfaárfolyam-forrás választó kialakítása a számviteli forrástól függetlenül. | P3 |
| `K03.16` | Cégbeállítás – rögzíthető adat: Áfaárfolyam-választás hatálynapja. | ❌ **Hiányzik** | Nincs rögzítve | Áfaárfolyam-választás hatálynap mező hozzáadása. | P3 |
| `K03.18` | Cégbeállítás – rögzíthető adat: Eredménykimutatás eljárása: összköltség vagy forgalmi költség. | 🟡 **Részben kész** | `pnl_structure`, `pnl_mapping` (összköltségi eljárás kész, P-060, A-151) | Forgalmi költség eljárású eredménykimutatás séma és leképezés kidolgozása. | P3 |
| `K03.19` | Cégbeállítás – rögzíthető adat: Költségkönyvelés rendje: csak 5-ös, illetve 6–7-es számlaosztályt is használó. | 🟡 **Részben kész** | `chart_of_accounts_presets` (5-ös és 6-7-es számlák léteznek a sablonokban) | Cégszintű ellenőrző kapcsoló beállítása a költségkönyvelés rendjére. | P3 |
| `K03.21` | Cégbeállítás – rögzíthető adat: Készpénzes kerekítési különbözet bevételi főkönyvi száma. | 🟡 **Részben kész** | `petty_cash_registers` kerekítési modul (5 Ft-os készpénzes kerekítés) | Cégszintű alapértelmezett kerekítési bevételi (96) és ráfordítási (86) főkönyvi szám beállítás. | P3 |
| `K03.22` | Cégbeállítás – rögzíthető adat: Készpénzes kerekítési különbözet ráfordítási főkönyvi száma. | 🟡 **Részben kész** | `petty_cash_registers` kerekítési modul (5 Ft-os készpénzes kerekítés) | Cégszintű alapértelmezett kerekítési bevételi (96) és ráfordítási (86) főkönyvi szám beállítás. | P3 |
| `K03.26` | KIVA-alany cégnél a naptáritól eltérő üzleti év beállítását a program tiltsa. | 🟡 **Részben kész** | `TaoBusinessYearPage.tsx` | Szigorú UI/DB tiltó validáció aktiválása KIVA-alany esetén naptáritól eltérő üzleti évre. | P3 |
| `K03.27` | Civil szervezetnél ne lehessen pusztán a nonprofit jelölés alapján KIVA-státuszt beállítani. | 🟡 **Részben kész** | Civil modul és TAO modul szétválasztva | Civil szervezetnél KIVA választás tiltása a setup wizardban. | P3 |

### 04. Üzleti év és végelszámolás

- **Érintett Epic:** Üzleti év, naptáritól eltérő üzleti év és végelszámolási zárás
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `accounting_periods`, `companies`, `FiscalYearSettings.tsx`
- **Teendők ebben a témakörben:** **11 tétel** (🟡 5 részben kész, ❌ 6 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K04.04` | Üzleti időszak – rögzíthető adat: Mérlegfordulónap. | 🟡 **Részben kész** | `annual_reports` tábla tartalmazza a mérlegfordulónapot és a mérlegkészítés napját | Az általános `acc_accounting_periods` időszaktáblába is bevezetendő a mérlegkészítési nap. | P3 |
| `K04.05` | Üzleti időszak – rögzíthető adat: Mérlegkészítés napja. | 🟡 **Részben kész** | `annual_reports` tábla tartalmazza a mérlegfordulónapot és a mérlegkészítés napját | Az általános `acc_accounting_periods` időszaktáblába is bevezetendő a mérlegkészítési nap. | P3 |
| `K04.06` | Üzleti időszak – rögzíthető adat: Időszak típusa: normál, tört vagy végelszámolási. | 🟡 **Részben kész** | Normál és tört hónapok szűrhetők | Időszak típus mező (`period_type`: normal, broken, liquidation) rögzítése. | P3 |
| `K04.07` | Üzleti időszak – rögzíthető adat: Végelszámolás kezdőnapja. | ❌ **Hiányzik** | Nincs a modulban | Végelszámolási adatok felvétele: Végelszámolás kezdőnapja.. | P3 |
| `K04.08` | Üzleti időszak – rögzíthető adat: Végelszámolás befejezésének napja. | ❌ **Hiányzik** | Nincs a modulban | Végelszámolási adatok felvétele: Végelszámolás befejezésének napja.. | P3 |
| `K04.09` | Üzleti időszak – rögzíthető adat: Végelszámoló neve. | ❌ **Hiányzik** | Nincs a modulban | Végelszámolási adatok felvétele: Végelszámoló neve.. | P3 |
| `K04.12` | Engedélyezett szervezeti és adózási formánál naptáritól eltérő üzleti év létrehozható legyen. | 🟡 **Részben kész** | `dateRange` tetszőleges intervallumot enged | Naptáritól eltérő üzleti év havi bontási logikájának optimalizálása. | P3 |
| `K04.14` | Az üzleti év hónapjai a megadott kezdőnaptól képződjenek. | 🟡 **Részben kész** | Hónapok leképezése a naptári évre épül | Kezdőnaptól számított gördülő 12 hónapos ciklusok támogatása. | P3 |
| `K04.18` | Végelszámolás előtt külön tevékenységet lezáró időszak legyen nyitható. | ❌ **Hiányzik** | Végelszámolási speciális időszakok | Tevékenységet lezáró, végelszámolási és befejező időszakok specifikus zárási varázslója. | P3 |
| `K04.19` | Végelszámolás közbeni üzleti évek külön zárhatók legyenek. | ❌ **Hiányzik** | Végelszámolási speciális időszakok | Tevékenységet lezáró, végelszámolási és befejező időszakok specifikus zárási varázslója. | P3 |
| `K04.20` | Végelszámolás befejezésekor külön lezáró időszak legyen kezelhető. | ❌ **Hiányzik** | Végelszámolási speciális időszakok | Tevékenységet lezáró, végelszámolási és befejező időszakok specifikus zárási varázslója. | P3 |

### 05. Partnertörzs – alapadatok

- **Érintett Epic:** Partner master data, VIES és NAV szinkron kiegészítések
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `partners`, `PartnerFormDialog.tsx`, `PartnersPage.tsx`
- **Teendők ebben a témakörben:** **14 tétel** (🟡 10 részben kész, ❌ 4 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K05.03` | Partner – rögzíthető adat: Rövid név. | 🟡 **Részben kész** | `custom_monogram` mező létezik, automatikus monogram generálás van | Dedikált `short_name` (rövid név) mező felvétele a `partners` táblába. | P3 |
| `K05.04` | Partner – rögzíthető adat: Partner típusa: szervezet vagy magánszemély. | 🟡 **Részben kész** | Adószámból automatikusan detektált (cég adószám vs magánszemély adóazonosító jel) | Explicit partner típus radio/select mező a partner űrlapon. | P3 |
| `K05.07` | Partner – rögzíthető adat: Egyéb folyószámla-partner jelölése. | 🟡 **Részben kész** | `partner_type` egyéb kategóriával kiegészíthető | Egyéb folyószámla partner (pl. munkavállaló, tag) típus felvétele az enumba. | P3 |
| `K05.11` | Partner – rögzíthető adat: Adóilletőség országkódja. | 🟡 **Részben kész** | Közösségi adószám előtagjából (pl. DE, AT) kinyerhető | Külön `country_code` oszlop rögzítése a partnereknél. | P3 |
| `K05.12` | Partner – rögzíthető adat: Cégjegyzékszám, ha rendelkezésre áll. | ❌ **Hiányzik** | Nincs a partnertörzsben | Partner nyilvántartási szám (Cégjegyzékszám, ha rendelkezésre áll.) mező felvétele. | P3 |
| `K05.13` | Partner – rögzíthető adat: Civil nyilvántartási szám, ha rendelkezésre áll. | ❌ **Hiányzik** | Nincs a partnertörzsben | Partner nyilvántartási szám (Civil nyilvántartási szám, ha rendelkezésre áll.) mező felvétele. | P3 |
| `K05.15` | Partner – rögzíthető adat: Pénzforgalmi áfa alkalmazásának jelölése. | 🟡 **Részben kész** | A bejövő számlán az AI és NAV OSA jelzi a pénzforgalmi áfát | A `partners` törzsben dedikált `is_cash_accounting` jelölő kapcsoló rögzítése. | P3 |
| `K05.16` | Partner – rögzíthető adat: Partner pénzforgalmi áfastátuszának kezdőnapja. | ❌ **Hiányzik** | Nincs a partnertörzsben | Partner pénzforgalmi áfastátusz kezdő- és zárónap mezők felvétele. | P3 |
| `K05.17` | Partner – rögzíthető adat: Partner pénzforgalmi áfastátuszának zárónapja. | ❌ **Hiányzik** | Nincs a partnertörzsben | Partner pénzforgalmi áfastátusz kezdő- és zárónap mezők felvétele. | P3 |
| `K05.21` | Partner – rögzíthető adat: Alapértelmezett fizetési mód. | 🟡 **Részben kész** | Számla OCR és korábbi előzmények alapján az AI javaslatot tesz | Partnertörzs szintű alapértelmezett beállítás mező (Alapértelmezett fizetési mód.) hozzáadása. | P3 |
| `K05.22` | Partner – rögzíthető adat: Alapértelmezett fizetési határidő napokban. | 🟡 **Részben kész** | Számla OCR és korábbi előzmények alapján az AI javaslatot tesz | Partnertörzs szintű alapértelmezett beállítás mező (Alapértelmezett fizetési határidő napokban.) hozzáadása. | P3 |
| `K05.23` | Partner – rögzíthető adat: Alapértelmezett számlázási devizanem. | 🟡 **Részben kész** | Számla OCR és korábbi előzmények alapján az AI javaslatot tesz | Partnertörzs szintű alapértelmezett beállítás mező (Alapértelmezett számlázási devizanem.) hozzáadása. | P3 |
| `K05.27` | Partner – rögzíthető adat: Partnercsoport kódja. | 🟡 **Részben kész** | `partners.parent_partner_id`, cégcsoport hierarchia P-124 | Partnercsoport kód törzsadat bővítése. | P3 |
| `K05.30` | Partner – rögzíthető adat: Aktív vagy inaktív állapot. | 🟡 **Részben kész** | `exclude_from_accounting` kapcsoló létezik a partnereknél | Általános `is_active` inaktiválási állapot kapcsoló bevezetése a partnertörzsbe. | P3 |

### 06. Partnertörzs – cím és kapcsolattartás

- **Érintett Epic:** Strukturált partnercímek és több kapcsolattartó
- **Prioritási szint:** 🟠 P2 – Magas
- **Érintett technikai réteg:** `partners`, `partner_addresses`, `PartnerFormDialog.tsx`, `PartnersPage.tsx`
- **Teendők ebben a témakörben:** **22 tétel** (🟡 15 részben kész, ❌ 7 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K06.01` | Partnercím vagy kapcsolattartó – rögzíthető adat: Cím típusa: székhely, számlázási, levelezési vagy szállítási. | 🟡 **Részben kész** | Számlázási címként jelenik meg a partner címe | Címtípus választó (székhely, számlázási, levelezési, szállítási) bevezetése. | P2 |
| `K06.02` | Partnercím vagy kapcsolattartó – rögzíthető adat: Országkód. | 🟡 **Részben kész** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Országkód.. | P2 |
| `K06.03` | Partnercím vagy kapcsolattartó – rögzíthető adat: Irányítószám. | 🟡 **Részben kész** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Irányítószám.. | P2 |
| `K06.04` | Partnercím vagy kapcsolattartó – rögzíthető adat: Település. | 🟡 **Részben kész** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Település.. | P2 |
| `K06.05` | Partnercím vagy kapcsolattartó – rögzíthető adat: Közterület neve. | 🟡 **Részben kész** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Közterület neve.. | P2 |
| `K06.06` | Partnercím vagy kapcsolattartó – rögzíthető adat: Közterület jellege. | 🟡 **Részben kész** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Közterület jellege.. | P2 |
| `K06.07` | Partnercím vagy kapcsolattartó – rögzíthető adat: Házszám. | 🟡 **Részben kész** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Házszám.. | P2 |
| `K06.08` | Partnercím vagy kapcsolattartó – rögzíthető adat: Épület. | 🟡 **Részben kész** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Épület.. | P2 |
| `K06.09` | Partnercím vagy kapcsolattartó – rögzíthető adat: Lépcsőház. | 🟡 **Részben kész** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Lépcsőház.. | P2 |
| `K06.10` | Partnercím vagy kapcsolattartó – rögzíthető adat: Emelet. | 🟡 **Részben kész** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Emelet.. | P2 |
| `K06.11` | Partnercím vagy kapcsolattartó – rögzíthető adat: Ajtó. | 🟡 **Részben kész** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Ajtó.. | P2 |
| `K06.12` | Partnercím vagy kapcsolattartó – rögzíthető adat: Helyrajzi szám. | 🟡 **Részben kész** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Helyrajzi szám.. | P2 |
| `K06.13` | Partnercím vagy kapcsolattartó – rögzíthető adat: Kapcsolattartó neve. | ❌ **Hiányzik** | Nincs a partnertörzsben | Kapcsolattartói mező (Kapcsolattartó neve.) felvétele. | P2 |
| `K06.14` | Partnercím vagy kapcsolattartó – rögzíthető adat: Kapcsolattartó beosztása. | ❌ **Hiányzik** | Nincs a partnertörzsben | Kapcsolattartói mező (Kapcsolattartó beosztása.) felvétele. | P2 |
| `K06.15` | Partnercím vagy kapcsolattartó – rögzíthető adat: Kapcsolattartó e-mail-címe. | 🟡 **Részben kész** | `partners.email` mező létezik; KintlevoPage kezeli a felszólító emailt | Külön dedikált e-számla fogadó és fizetési felszólító email mezők rögzítése. | P2 |
| `K06.16` | Partnercím vagy kapcsolattartó – rögzíthető adat: Kapcsolattartó telefonszáma. | ❌ **Hiányzik** | Nincs a partnertörzsben | Kapcsolattartói mező (Kapcsolattartó telefonszáma.) felvétele. | P2 |
| `K06.17` | Partnercím vagy kapcsolattartó – rögzíthető adat: Elektronikus számla fogadására kijelölt e-mail-cím. | 🟡 **Részben kész** | `partners.email` mező létezik; KintlevoPage kezeli a felszólító emailt | Külön dedikált e-számla fogadó és fizetési felszólító email mezők rögzítése. | P2 |
| `K06.18` | Partnercím vagy kapcsolattartó – rögzíthető adat: Fizetési felszólítás címzettjének e-mail-címe. | 🟡 **Részben kész** | `partners.email` mező létezik; KintlevoPage kezeli a felszólító emailt | Külön dedikált e-számla fogadó és fizetési felszólító email mezők rögzítése. | P2 |
| `K06.19` | Partnerhez több cím rögzíthető legyen. | ❌ **Hiányzik** | Jelenleg 1 cím és 1 email tartozik egy partnerhez | 1:N partnercímek és 1:N partner kapcsolattartók relációs altábla létrehozása. | P2 |
| `K06.20` | Partnerhez több kapcsolattartó rögzíthető legyen. | ❌ **Hiányzik** | Jelenleg 1 cím és 1 email tartozik egy partnerhez | 1:N partnercímek és 1:N partner kapcsolattartók relációs altábla létrehozása. | P2 |
| `K06.21` | Partnerenként kijelölhető legyen az alapértelmezett számlázási cím. | ❌ **Hiányzik** | Nincs többcímű / több kapcsolattartós struktúra | Alapértelmezett számlázási cím és kapcsolattartó kijelölés megvalósítása. | P2 |
| `K06.22` | Partnerenként kijelölhető legyen az alapértelmezett kapcsolattartó. | ❌ **Hiányzik** | Nincs többcímű / több kapcsolattartós struktúra | Alapértelmezett számlázási cím és kapcsolattartó kijelölés megvalósítása. | P2 |

### 07. Partnertörzs – bankszámlák

- **Érintett Epic:** Partner 1:N bankszámlatörzs és alapértelmezett számlaszám
- **Prioritási szint:** 🟠 P2 – Magas
- **Érintett technikai réteg:** `partner_bank_accounts` (új tábla), `PartnerFormDialog.tsx`, `PartnersPage.tsx`
- **Teendők ebben a témakörben:** **13 tétel** (🟡 11 részben kész, ❌ 2 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K07.01` | Partner bankszámlája – rögzíthető adat: Bankszámla tulajdonosának neve. | 🟡 **Részben kész** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Bankszámla tulajdonosának neve.) létrehozása. | P2 |
| `K07.02` | Partner bankszámlája – rögzíthető adat: Belföldi bankszámlaszám. | 🟡 **Részben kész** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Belföldi bankszámlaszám.) létrehozása. | P2 |
| `K07.03` | Partner bankszámlája – rögzíthető adat: IBAN. | 🟡 **Részben kész** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (IBAN.) létrehozása. | P2 |
| `K07.04` | Partner bankszámlája – rögzíthető adat: SWIFT/BIC-kód. | 🟡 **Részben kész** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (SWIFT/BIC-kód.) létrehozása. | P2 |
| `K07.05` | Partner bankszámlája – rögzíthető adat: Bank neve. | 🟡 **Részben kész** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Bank neve.) létrehozása. | P2 |
| `K07.06` | Partner bankszámlája – rögzíthető adat: Bank országkódja. | 🟡 **Részben kész** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Bank országkódja.) létrehozása. | P2 |
| `K07.07` | Partner bankszámlája – rögzíthető adat: Számla devizaneme. | 🟡 **Részben kész** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Számla devizaneme.) létrehozása. | P2 |
| `K07.08` | Partner bankszámlája – rögzíthető adat: Alapértelmezett bankszámla jelölése. | 🟡 **Részben kész** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Alapértelmezett bankszámla jelölése.) létrehozása. | P2 |
| `K07.09` | Partner bankszámlája – rögzíthető adat: Bankszámla érvényességének kezdete. | 🟡 **Részben kész** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Bankszámla érvényességének kezdete.) létrehozása. | P2 |
| `K07.10` | Partner bankszámlája – rögzíthető adat: Bankszámla érvényességének vége. | 🟡 **Részben kész** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Bankszámla érvényességének vége.) létrehozása. | P2 |
| `K07.11` | Egy partnerhez több bankszámlaszám rögzíthető legyen. | ❌ **Hiányzik** | Nincs 1:N partnertörzs bankszámla altábla | Egy partnerhez több bankszámlaszám rögzítésének biztosítása. | P2 |
| `K07.14` | Más partnernél már szereplő bankszámlaszám felvitelekor figyelmeztetés jelenjen meg. | ❌ **Hiányzik** | Nincs keresztellenőrzés | Figyelmeztetés megjelenítése, ha a rögzített bankszámlaszám már szerepel másik partnernél. | P2 |
| `K07.15` | Számlán felismert, a partnertörzstől eltérő bankszámlaszám külön jóváhagyást igényeljen a törzs frissítése előtt. | 🟡 **Részben kész** | Tranzakció- és számlapárosító dialógusban látható az eltérés | Partner törzsfrissítési jóváhagyó gomb és folyamat kialakítása új bankszámlaszám detektálásakor. | P2 |

### 08. Törzsadatok – ellenőrzés és módosítás

- **Érintett Epic:** Törzsadat-audit és összevonási mechanizmusok
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `partners`, `gl_accounts`, `AuditLogViewer.tsx`, `MergePartnersModal.tsx`
- **Teendők ebben a témakörben:** **6 tétel** (🟡 4 részben kész, ❌ 2 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K08.05` | A közösségi adószám VIES-ellenőrzésének eredménye tárolható legyen. | 🟡 **Részben kész** | VIES ellenőrzési modul elérhető | VIES lekérdezési válasz JSON és státusz auditált eltárolása a partnernél. | P3 |
| `K08.06` | Az adószámellenőrzés időpontja visszakereshető legyen. | 🟡 **Részben kész** | `last_nav_sync_at` tárolódik | Partner szintű adószám-ellenőrzési időbélyeg naplózása. | P3 |
| `K08.09` | Hasonló nevű, adószám nélküli partnereknél jelenjen meg duplikációs figyelmeztetés. | 🟡 **Részben kész** | Hasonló nevek fuzzy egyezés vizsgálata | Duplikációs figyelmeztető banner megjelenítése adószám nélküli hasonló nevű partnereknél. | P3 |
| `K08.10` | Partnerösszevonás előtt megtekinthető legyen az érintett bizonylatok listája. | ❌ **Hiányzik** | Nincs partnerösszevonó modul | Partnerösszevonás előtti bizonylatlista előnézet és összevonás utáni audit azonosító kapcsolat megőrzése. | P3 |
| `K08.11` | Partnerösszevonás után az eredeti partnerazonosítók kapcsolata maradjon visszakereshető. | ❌ **Hiányzik** | Nincs partnerösszevonó modul | Partnerösszevonás előtti bizonylatlista előnézet és összevonás utáni audit azonosító kapcsolat megőrzése. | P3 |
| `K08.21` | Inaktív törzsadat új bizonylaton ne legyen választható, korábbi bizonylaton megmaradjon. | 🟡 **Részben kész** | Dropdown szűrők | Inaktív törzsadat letiltása új bizonylat felvitelekor a választólistákban. | P3 |

### 09. Számlatükör

- **Érintett Epic:** Számlatükör mélyítés, gyűjtő- és részletező számlák
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `gl_accounts`, `chart_of_accounts_presets`, `ChartOfAccountsPage.tsx`
- **Teendők ebben a témakörben:** **14 tétel** (🟡 11 részben kész, ❌ 3 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K09.04` | Főkönyvi számla – rögzíthető adat: Könyvelhető vagy csak összesítő jelleg. | 🟡 **Részben kész** | Főkönyvi fa nézet a felületen | Explicit `is_synthetic` (csak összesítő, közvetlenül nem könyvelhető) jelölő bevezetése. | P3 |
| `K09.07` | Főkönyvi számla – rögzíthető adat: Folyószámla-vezetés előírása. | 🟡 **Részben kész** | 311 és 454 automatikusan folyószámlás és partnerköteles | Főkönyvi számlánkénti `is_partner_required` és `is_subledger` kapcsoló beállítása. | P3 |
| `K09.08` | Főkönyvi számla – rögzíthető adat: Partner megadásának kötelezettsége. | 🟡 **Részben kész** | 311 és 454 automatikusan folyószámlás és partnerköteles | Főkönyvi számlánkénti `is_partner_required` és `is_subledger` kapcsoló beállítása. | P3 |
| `K09.10` | Főkönyvi számla – rögzíthető adat: Költséghely megadásának kötelezettsége. | 🟡 **Részben kész** | `acc_journal_lines` támogatja a költséghelyet, munkaszámot, projektet | Főkönyvi számlán kötelezővé tehető gyűjtőkitöltési szabály konfigurálása. | P3 |
| `K09.11` | Főkönyvi számla – rögzíthető adat: Munkaszám megadásának kötelezettsége. | 🟡 **Részben kész** | `acc_journal_lines` támogatja a költséghelyet, munkaszámot, projektet | Főkönyvi számlán kötelezővé tehető gyűjtőkitöltési szabály konfigurálása. | P3 |
| `K09.12` | Főkönyvi számla – rögzíthető adat: Projekt megadásának kötelezettsége. | 🟡 **Részben kész** | `acc_journal_lines` támogatja a költséghelyet, munkaszámot, projektet | Főkönyvi számlán kötelezővé tehető gyűjtőkitöltési szabály konfigurálása. | P3 |
| `K09.13` | Főkönyvi számla – rögzíthető adat: Tevékenység megadásának kötelezettsége. | 🟡 **Részben kész** | `acc_journal_lines` támogatja a költséghelyet, munkaszámot, projektet | Főkönyvi számlán kötelezővé tehető gyűjtőkitöltési szabály konfigurálása. | P3 |
| `K09.14` | Főkönyvi számla – rögzíthető adat: Alapértelmezett áfakód. | 🟡 **Részben kész** | AI és kontírsablonok (`invoice_item_rules`) rendelnek áfakódot | Alapértelmezett áfakód mező felvétele a `gl_accounts` táblába. | P3 |
| `K09.17` | Főkönyvi számla – rögzíthető adat: Következő évi nyitó főkönyvi szám eltérő számlatükör esetén. | ❌ **Hiányzik** | Nincs a számlatükörben | Következő évi nyitó főkönyvi szám leképezés mező eltérő számlatükrök kezeléséhez. | P3 |
| `K09.18` | Főkönyvi számla – rögzíthető adat: Másodlagos vagy külső rendszerbeli főkönyvi kód. | 🟡 **Részben kész** | `gl_audit_accounts` tárolja az importált külső kódokat | Másodlagos főkönyvi kód mező felvétele a törzsbe. | P3 |
| `K09.19` | Főkönyvi számla – rögzíthető adat: Érvényesség kezdete. | ❌ **Hiányzik** | Nincs érvényességi idő a számlatükörben | `valid_from` és `valid_to` mezők hozzáadása a `gl_accounts` táblához. | P3 |
| `K09.20` | Főkönyvi számla – rögzíthető adat: Érvényesség vége. | ❌ **Hiányzik** | Nincs érvényességi idő a számlatükörben | `valid_from` és `valid_to` mezők hozzáadása a `gl_accounts` táblához. | P3 |
| `K09.21` | Összesítő főkönyvi számra közvetlen tétel ne legyen könyvelhető. | 🟡 **Részben kész** | Gyermekkel rendelkező számlák szűrése | Közvetlen könyvelés tiltása szintetikus szülő számlákra. | P3 |
| `K09.25` | Előírt gyűjtő hiánya esetén a főkönyvi tétel ne legyen véglegesíthető. | 🟡 **Részben kész** | Bizonylatsor szinten figyelmeztetés | Kötelező gyűjtő hiánya esetén végleges könyvelés blokkolása. | P3 |

### 10. Naplótörzs

- **Érintett Epic:** Egyedi felhasználói naplók és devizanem-kötöttségek
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `acc_journals`, `JournalsPage.tsx`, `JournalEntryForm.tsx`
- **Teendők ebben a témakörben:** **3 tétel** (🟡 3 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K10.05` | Könyvelési napló – rögzíthető adat: Alapértelmezett ellenszámla. | 🟡 **Részben kész** | Sablonokból ajánlott | Alapértelmezett ellenszámla mező a naplótörzsben. | P3 |
| `K10.13` | Könyvelési napló – rögzíthető adat: Naplóra engedélyezett felhasználók. | 🟡 **Részben kész** | Cégszintű és moduláris jogosultságok (`accounty_module_permissions`) | Naplószintű felhasználói hozzáférés-korlátozás kialakítása. | P3 |
| `K10.14` | Könyvelési napló – rögzíthető adat: Napló lezárásának dátuma. | 🟡 **Részben kész** | `acc_accounting_periods` havi/éves időszakzárás | Naplónkénti egyedi zárási dátum megadása. | P3 |

### 11. Saját bank- és pénztártörzs

- **Érintett Epic:** Bank- és valutapénztár technikai beállítások
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `bank_accounts`, `cash_desks`, `BankSettings.tsx`, `PettyCashPage.tsx`
- **Teendők ebben a témakörben:** **2 tétel** (🟡 2 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K11.14` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Devizakészlet kivezetési módszere: súlyozott átlagárfolyam vagy FIFO. | 🟡 **Részben kész** | Súlyozott átlagárfolyamos készletértékelés | FIFO módszer választható opcióként való implementálása. | P3 |
| `K11.15` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Pénztárért felelős felhasználó pénztárnál. | 🟡 **Részben kész** | `petty_cash_registers` | Pénztáros / felelős személy mező rögzítése a pénztártörzsben. | P3 |

### 12. Deviza- és árfolyamtörzs

- **Érintett Epic:** Keresztárfolyamok és egyedi banki árfolyamok
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `exchange_rates`, `ExchangeRates.tsx`, MNB szinkron
- **Teendők ebben a témakörben:** **1 tétel** (🟡 1 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K12.09` | Deviza vagy árfolyamrekord – rögzíthető adat: Kézi árfolyam indoklása. | 🟡 **Részben kész** | `acc_journal_headers.justification` | Kézi árfolyam indoklás kötelezővé tétele manuális árfolyam-felülbírálásnál. | P3 |

### 13. Gyűjtőtörzsek és költségfelosztás

- **Érintett Epic:** Százalékos kulcsos költségfelosztási sablonok
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `cost_centers`, `projects`, `acc_journal_lines`, `CostCentersPage.tsx`
- **Teendők ebben a témakörben:** **12 tétel** (🟡 8 részben kész, ❌ 4 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K13.07` | Gyűjtőérték – rögzíthető adat: Felelős személy. | 🟡 **Részben kész** | Projekt felelősök kezelése | Költséghely felelős személy mező rögzítése. | P3 |
| `K13.08` | Gyűjtőérték – rögzíthető adat: Tevékenység besorolása: alapcél szerinti, közhasznú vagy vállalkozási. | 🟡 **Részben kész** | Civil modulban megvan a tevékenységi felosztás | Alapcél / közhasznú / vállalkozási kategória általános gyűjtőbe vezetése. | P3 |
| `K13.09` | Gyűjtőérték – rögzíthető adat: Felosztási sablon azonosítója. | ❌ **Hiányzik** | Nincs felosztási sablon modul | Százalékos és arányos költségfelosztási sablontörzs kidolgozása. | P3 |
| `K13.10` | Gyűjtőérték – rögzíthető adat: Felosztási sablonban szereplő célgyűjtő. | ❌ **Hiányzik** | Nincs felosztási sablon modul | Százalékos és arányos költségfelosztási sablontörzs kidolgozása. | P3 |
| `K13.11` | Gyűjtőérték – rögzíthető adat: Célgyűjtőre jutó százalék. | ❌ **Hiányzik** | Nincs felosztási sablon modul | Százalékos és arányos költségfelosztási sablontörzs kidolgozása. | P3 |
| `K13.12` | Gyűjtőérték – rögzíthető adat: Felosztási sablon hatálynapja. | ❌ **Hiányzik** | Nincs felosztási sablon modul | Százalékos és arányos költségfelosztási sablontörzs kidolgozása. | P3 |
| `K13.17` | Egy tétel összege több azonos típusú gyűjtő között százalékosan felosztható legyen. | 🟡 **Részben kész** | Kézzel több sorra bontható a könyvelési tétel tetszőleges összeggel | Automatikus százalékos és összeg szerinti felosztó funkció megvalósítása 100%-os ellenőrzéssel. | P3 |
| `K13.18` | Egy tétel összege több azonos típusú gyűjtő között forintösszeggel felosztható legyen. | 🟡 **Részben kész** | Kézzel több sorra bontható a könyvelési tétel tetszőleges összeggel | Automatikus százalékos és összeg szerinti felosztó funkció megvalósítása 100%-os ellenőrzéssel. | P3 |
| `K13.19` | Százalékos felosztásnál a teljes felosztásnak 100%-ot kell adnia. | 🟡 **Részben kész** | Kézzel több sorra bontható a könyvelési tétel tetszőleges összeggel | Automatikus százalékos és összeg szerinti felosztó funkció megvalósítása 100%-os ellenőrzéssel. | P3 |
| `K13.20` | Összeg szerinti felosztásnál a részösszegeknek a tétel összegével kell egyezniük. | 🟡 **Részben kész** | Kézzel több sorra bontható a könyvelési tétel tetszőleges összeggel | Automatikus százalékos és összeg szerinti felosztó funkció megvalósítása 100%-os ellenőrzéssel. | P3 |
| `K13.21` | Felosztási kerekítési maradék kijelölt gyűjtőre kerüljön. | 🟡 **Részben kész** | Kézzel több sorra bontható a könyvelési tétel tetszőleges összeggel | Automatikus százalékos és összeg szerinti felosztó funkció megvalósítása 100%-os ellenőrzéssel. | P3 |
| `K13.23` | Hiányzó gyűjtővel rögzített tételek külön listázhatók legyenek. | 🟡 **Részben kész** | GL szűrőkben szűrhető az üres költséghely | Dedikált „Gyűjtő nélküli tételek” audit nézet kialakítása. | P3 |

### 14. Áfakódtörzs

- **Érintett Epic:** Speciális margin és különbözeti áfakódok
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `vat_codes`, `VatCodesSettings.tsx`, `VatReturnPage.tsx`
- **Teendők ebben a témakörben:** **1 tétel** (🟡 1 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K14.29` | Érvényességi időn kívüli áfakód használatakor tételszintű hiba jelenjen meg. | 🟡 **Részben kész** | `vat_codes` érvényességi dátumok | Érvényességi időn kívüli kód blokkolása mentéskor. | P3 |

### 15. Fizetési módok és kontírsablonok

- **Érintett Epic:** Összetett kontírsablonok és fizetési feltételek
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `payment_methods`, `accounting_templates`, `SettingsPage.tsx`
- **Teendők ebben a témakörben:** **1 tétel** (🟡 1 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K15.16` | Több sorból álló kontírsablon menthető legyen. | 🟡 **Részben kész** | Bontott tételek könyvelhetők | Többsoros kontírsablon definíció mentésének támogatása. | P3 |

### 18. Könyvelés – bizonylatsor

- **Érintett Epic:** Bizonylatsor szövegezési és mértékegység kiegészítések
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `acc_journal_lines`, `JournalEntryForm.tsx`
- **Teendők ebben a témakörben:** **1 tétel** (🟡 1 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K18.31` | Gyűjtőmásolás több kijelölt bizonylatsorra alkalmazható legyen. | 🟡 **Részben kész** | Sorok duplikálása elérhető | Csoportos gyűjtőkód-másolás kijelölt sorokra. | P3 |

### 20. Könyvelés – számlák és folyószámla

- **Érintett Epic:** Részfizetések és folyószámla-egyeztető kimutatások
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `invoices`, `transactions`, `accounty_partner_subledgers`, `PartnerSubledgerPage.tsx`
- **Teendők ebben a témakörben:** **3 tétel** (🟡 3 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K20.19` | Vevő–szállító kompenzáció kontírozott javaslatként előállítható legyen. | 🟡 **Részben kész** | Vevő-szállító összevezetés kézzel kontírozható | Automatikus kompenzációs jegyzőkönyv és megállapodás csatoló varázsló. | P3 |
| `K20.20` | Kompenzációhoz megállapodás csatolható legyen. | 🟡 **Részben kész** | Vevő-szállító összevezetés kézzel kontírozható | Automatikus kompenzációs jegyzőkönyv és megállapodás csatoló varázsló. | P3 |
| `K20.28` | Késedelmi kamat számítható legyen dátumhoz kötött kamatlábbal. | 🟡 **Részben kész** | Késedelmi kamat kalkulációs logika | Automatikus késedelmi kamatterhelő számla / levél előállítása. | P3 |

### 22. Pénztár – bizonylat és működés

- **Érintett Epic:** Címletjegyzék és pénztári zárási protokoll
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `petty_cash_transactions`, `PettyCashPage.tsx`
- **Teendők ebben a témakörben:** **2 tétel** (🟡 2 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K22.24` | Címletenként darabszám rögzíthető legyen pénztárzáráskor. | 🟡 **Részben kész** | Pénztáregyenleg egyeztetés | Címletjegyzék (címletenkénti darabszám) rögzítő felület hozzáadása a pénztárzáráshoz. | P3 |
| `K22.25` | Címletjegyzék összege és pénztáregyenleg eltérése jelenjen meg. | 🟡 **Részben kész** | Pénztáregyenleg egyeztetés | Címletjegyzék (címletenkénti darabszám) rögzítő felület hozzáadása a pénztárzáráshoz. | P3 |

### 23. Deviza – értékelés és különbözetek

- **Érintett Epic:** Év végi automatikus devizaátértékelő varázsló
- **Prioritási szint:** 🟠 P2 – Magas
- **Érintett technikai réteg:** `ExchangeRates.tsx`, `acc_journal_entries`, `FxRevaluationWizardPage.tsx` (új)
- **Teendők ebben a témakörben:** **11 tétel** (🟡 11 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K23.10` | Év végi devizaátértékeléshez kiválasztható legyen a fordulónap. | 🟡 **Részben kész** | `ExchangeRates.tsx`, fordulónapi MNB árfolyamok elérhetők | Év végi devizaátértékelő automatikus futtató varázsló nyitott követelésekre, tartozásokra és devizakészletekre. | P2 |
| `K23.11` | Év végi devizaátértékelés a nyitott devizás követelésekre kiszámítható legyen. | 🟡 **Részben kész** | `ExchangeRates.tsx`, fordulónapi MNB árfolyamok elérhetők | Év végi devizaátértékelő automatikus futtató varázsló nyitott követelésekre, tartozásokra és devizakészletekre. | P2 |
| `K23.12` | Év végi devizaátértékelés a nyitott devizás tartozásokra kiszámítható legyen. | 🟡 **Részben kész** | `ExchangeRates.tsx`, fordulónapi MNB árfolyamok elérhetők | Év végi devizaátértékelő automatikus futtató varázsló nyitott követelésekre, tartozásokra és devizakészletekre. | P2 |
| `K23.13` | Év végi devizaátértékelés a devizabankok készletére kiszámítható legyen. | 🟡 **Részben kész** | `ExchangeRates.tsx`, fordulónapi MNB árfolyamok elérhetők | Év végi devizaátértékelő automatikus futtató varázsló nyitott követelésekre, tartozásokra és devizakészletekre. | P2 |
| `K23.14` | Év végi devizaátértékelés a valutapénztárak készletére kiszámítható legyen. | 🟡 **Részben kész** | `ExchangeRates.tsx`, fordulónapi MNB árfolyamok elérhetők | Év végi devizaátértékelő automatikus futtató varázsló nyitott követelésekre, tartozásokra és devizakészletekre. | P2 |
| `K23.15` | Évközi átértékelés kijelölt időpontra előkészíthető legyen. | 🟡 **Részben kész** | `ExchangeRates.tsx`, fordulónapi MNB árfolyamok elérhetők | Év végi devizaátértékelő automatikus futtató varázsló nyitott követelésekre, tartozásokra és devizakészletekre. | P2 |
| `K23.16` | Átértékelés következő időszaki visszaforgatása külön jóváhagyható javaslat legyen. | 🟡 **Részben kész** | `ExchangeRates.tsx`, fordulónapi MNB árfolyamok elérhetők | Év végi devizaátértékelő automatikus futtató varázsló nyitott követelésekre, tartozásokra és devizakészletekre. | P2 |
| `K23.17` | Árfolyamnyereség és árfolyamveszteség eltérő főkönyvi számra előkészíthető legyen. | 🟡 **Részben kész** | 976/876 főkönyvi számlák a számlatükörben | Árfolyamnyereség/veszteség külön jóváhagyású feladási workflow finomítása. | P2 |
| `K23.18` | Visszamenőleges banktétel-javítás mutassa meg a későbbi átlagárfolyamokra gyakorolt hatást. | 🟡 **Részben kész** | 976/876 főkönyvi számlák a számlatükörben | Árfolyamnyereség/veszteség külön jóváhagyású feladási workflow finomítása. | P2 |
| `K23.19` | Újraszámítás könyvelt különbözetei külön jóváhagyásra váró korrekcióként jelenjenek meg. | 🟡 **Részben kész** | 976/876 főkönyvi számlák a számlatükörben | Árfolyamnyereség/veszteség külön jóváhagyású feladási workflow finomítása. | P2 |
| `K23.20` | Ugyanazon értékelési futás ne legyen kétszer feladható. | 🟡 **Részben kész** | 976/876 főkönyvi számlák a számlatükörben | Árfolyamnyereség/veszteség külön jóváhagyású feladási workflow finomítása. | P2 |

### 24. Áfa – ügyletfajták

- **Érintett Epic:** Több telephelyes és mezőgazdasági kompenzációs áfaügyletek
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `vat_codes`, `invoices`, `VatReturnPage.tsx`
- **Teendők ebben a témakörben:** **7 tétel** (🟡 7 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K24.17` | Importhoz vámhatározat azonosítója rögzíthető legyen. | 🟡 **Részben kész** | Import számlák és vámhatározat áfa kezelhető | Dedikált vámhatározat azonosító és vámjogi képviselő mezők beépítése az import áfakódokhoz. | P3 |
| `K24.18` | Importhoz vámhatározat dokumentuma csatolható legyen. | 🟡 **Részben kész** | Import számlák és vámhatározat áfa kezelhető | Dedikált vámhatározat azonosító és vámjogi képviselő mezők beépítése az import áfakódokhoz. | P3 |
| `K24.19` | Importhoz vámhatóság által megállapított áfa rögzíthető legyen. | 🟡 **Részben kész** | Import számlák és vámhatározat áfa kezelhető | Dedikált vámhatározat azonosító és vámjogi képviselő mezők beépítése az import áfakódokhoz. | P3 |
| `K24.20` | Importhoz önadózással megállapított áfa rögzíthető legyen. | 🟡 **Részben kész** | Import számlák és vámhatározat áfa kezelhető | Dedikált vámhatározat azonosító és vámjogi képviselő mezők beépítése az import áfakódokhoz. | P3 |
| `K24.21` | Közvetett vámjogi képviselővel elszámolt importáfa külön jelölhető legyen. | 🟡 **Részben kész** | Import számlák és vámhatározat áfa kezelhető | Dedikált vámhatározat azonosító és vámjogi képviselő mezők beépítése az import áfakódokhoz. | P3 |
| `K24.22` | Különbözeti adózású értékesítés beszerzéshez kapcsolható legyen az árrés meghatározásához. | 🟡 **Részben kész** | Különbözeti áfa kódok | Árrés szerinti adóalap automatikus összekapcsolása a beszerzési számlával. | P3 |
| `K24.23` | Különbözeti adózásnál a számított adóalap és áfa külön tárolódjon. | 🟡 **Részben kész** | Különbözeti áfa kódok | Árrés szerinti adóalap automatikus összekapcsolása a beszerzési számlával. | P3 |

### 25. Áfa – időzítés és korrekció

- **Érintett Epic:** Pénzforgalmi áfa és időszakon átnyúló korrekciók
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `invoices`, `acc_journal_lines`, `VatReturnPage.tsx`
- **Teendők ebben a témakörben:** **5 tétel** (🟡 5 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K25.23` | Eszköz áfakorrekciójához figyelési időszak kezdete rögzíthető legyen. | 🟡 **Részben kész** | Tárgyi eszköz modulban az áfa adatok megvannak | Tárgyi eszköz 5/20 éves áfakorrekciós figyelési automatizmusa. | P3 |
| `K25.24` | Eszköz áfakorrekciójához figyelési időszak hossza rögzíthető legyen. | 🟡 **Részben kész** | Tárgyi eszköz modulban az áfa adatok megvannak | Tárgyi eszköz 5/20 éves áfakorrekciós figyelési automatizmusa. | P3 |
| `K25.25` | Eszköz áfakorrekciójához eredetileg levont áfa rögzíthető legyen. | 🟡 **Részben kész** | Tárgyi eszköz modulban az áfa adatok megvannak | Tárgyi eszköz 5/20 éves áfakorrekciós figyelési automatizmusa. | P3 |
| `K25.26` | Eszköz áfakorrekciójához éves használati vagy levonási hányad rögzíthető legyen. | 🟡 **Részben kész** | Tárgyi eszköz modulban az áfa adatok megvannak | Tárgyi eszköz 5/20 éves áfakorrekciós figyelési automatizmusa. | P3 |
| `K25.27` | Eszköz áfakorrekciójához éves kiigazítási összeg számítható legyen. | 🟡 **Részben kész** | Tárgyi eszköz modulban az áfa adatok megvannak | Tárgyi eszköz 5/20 éves áfakorrekciós figyelési automatizmusa. | P3 |

### 27. Elhatárolások – adatok

- **Érintett Epic:** Időbeli elhatárolások felülete és feloldási varázsló
- **Prioritási szint:** 🟠 P2 – Magas
- **Érintett technikai réteg:** `accrual_entries` tábla, `AccrualsPage.tsx` (új felület), RPC: `book_accrual_entry`
- **Teendők ebben a témakörben:** **23 tétel** (🟡 23 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K27.01` | Elhatárolás – rögzíthető adat: Egyedi elhatárolásazonosító. | 🟡 **Részben kész** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. | P2 |
| `K27.02` | Elhatárolás – rögzíthető adat: Kapcsolódó bizonylat. | 🟡 **Részben kész** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. | P2 |
| `K27.03` | Elhatárolás – rögzíthető adat: Partner. | 🟡 **Részben kész** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. | P2 |
| `K27.04` | Elhatárolás – rögzíthető adat: Típus: aktív költség, aktív bevétel, passzív költség vagy passzív bevétel. | 🟡 **Részben kész** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. | P2 |
| `K27.05` | Elhatárolás – rögzíthető adat: Elhatárolandó forintösszeg. | 🟡 **Részben kész** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. | P2 |
| `K27.06` | Elhatárolás – rögzíthető adat: Elhatárolási időszak kezdete. | 🟡 **Részben kész** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. | P2 |
| `K27.07` | Elhatárolás – rögzíthető adat: Elhatárolási időszak vége. | 🟡 **Részben kész** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. | P2 |
| `K27.08` | Elhatárolás – rögzíthető adat: Felosztási mód: naparányos, havi egyenlő vagy kézi ütemezés. | 🟡 **Részben kész** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. | P2 |
| `K27.09` | Elhatárolás – rögzíthető adat: Elhatárolás főkönyvi száma. | 🟡 **Részben kész** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. | P2 |
| `K27.10` | Elhatárolás – rögzíthető adat: Feloldás főkönyvi száma. | 🟡 **Részben kész** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. | P2 |
| `K27.11` | Elhatárolás – rögzíthető adat: Költséghely-kapcsolat. | 🟡 **Részben kész** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. | P2 |
| `K27.12` | Elhatárolás – rögzíthető adat: Projektkapcsolat. | 🟡 **Részben kész** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. | P2 |
| `K27.13` | Elhatárolás – rögzíthető adat: Már feladott összeg. | 🟡 **Részben kész** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. | P2 |
| `K27.14` | Elhatárolás – rögzíthető adat: Még feloldandó összeg. | 🟡 **Részben kész** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. | P2 |
| `K27.15` | Elhatárolási ütemezés számítható legyen a teljes időszakra. | 🟡 **Részben kész** | Ütemezési motor és főkönyvi feladás logikája | Frontend jóváhagyó panel az elhatárolások havi és éves feloldásához. | P2 |
| `K27.16` | Elhatárolás havi feloldása jóváhagyásra előkészíthető legyen. | 🟡 **Részben kész** | Ütemezési motor és főkönyvi feladás logikája | Frontend jóváhagyó panel az elhatárolások havi és éves feloldásához. | P2 |
| `K27.17` | Elhatárolás éves feloldása jóváhagyásra előkészíthető legyen. | 🟡 **Részben kész** | Ütemezési motor és főkönyvi feladás logikája | Frontend jóváhagyó panel az elhatárolások havi és éves feloldásához. | P2 |
| `K27.18` | Egy elhatárolási részlet ne legyen kétszer feladható. | 🟡 **Részben kész** | Ütemezési motor és főkönyvi feladás logikája | Frontend jóváhagyó panel az elhatárolások havi és éves feloldásához. | P2 |
| `K27.19` | Elhatárolás módosításakor a már feladott rész és a hátralévő rész külön jelenjen meg. | 🟡 **Részben kész** | Ütemezési motor és főkönyvi feladás logikája | Frontend jóváhagyó panel az elhatárolások havi és éves feloldásához. | P2 |
| `K27.20` | Elhatárolás maradéka következő üzleti évre átvihető legyen. | 🟡 **Részben kész** | Ütemezési motor és főkönyvi feladás logikája | Frontend jóváhagyó panel az elhatárolások havi és éves feloldásához. | P2 |
| `K27.21` | Elhatárolási analitika összege egyeztethető legyen a kapcsolódó főkönyvi számlával. | 🟡 **Részben kész** | Ütemezési motor és főkönyvi feladás logikája | Frontend jóváhagyó panel az elhatárolások havi és éves feloldásához. | P2 |
| `K27.22` | Eszköztámogatás halasztott bevétele eszközkartonhoz kapcsolható legyen. | 🟡 **Részben kész** | `development_reserves`, `fixed_assets` | Eszköztámogatás halasztott bevételének automatikus feloldása az ÉCS-vel párhuzamosan. | P2 |
| `K27.23` | Eszköztámogatás feloldási javaslata az elszámolt értékcsökkenéshez kapcsolódjon. | 🟡 **Részben kész** | `development_reserves`, `fixed_assets` | Eszköztámogatás halasztott bevételének automatikus feloldása az ÉCS-vel párhuzamosan. | P2 |

### 28. Számviteli zárás és nyitás

- **Érintett Epic:** Év végi mérlegzárás és nyitási napló automatizálás
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `accounting_periods`, `YearEndClosingWizardPage.tsx`
- **Teendők ebben a témakörben:** **3 tétel** (🟡 3 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K28.22` | Végelszámolás előtti tevékenységzáró adatok külön kimutathatók legyenek. | 🟡 **Részben kész** | Beszámoló és évzárás adatok | Végelszámolás előtti és közbeni speciális beszámolási időszakok kimutatása. | P3 |
| `K28.23` | Végelszámolás közbeni beszámolási időszakok adatai külön kimutathatók legyenek. | 🟡 **Részben kész** | Beszámoló és évzárás adatok | Végelszámolás előtti és közbeni speciális beszámolási időszakok kimutatása. | P3 |
| `K28.24` | Végelszámolást lezáró adatok külön kimutathatók legyenek. | 🟡 **Részben kész** | Beszámoló és évzárás adatok | Végelszámolás előtti és közbeni speciális beszámolási időszakok kimutatása. | P3 |

### 34. Tárgyi eszköz – KIVA és áttérés

- **Érintett Epic:** KIVA áttérési leltár és különbözeti nyilvántartás
- **Prioritási szint:** 🟡 P3 – Normál
- **Érintett technikai réteg:** `fixed_assets`, `FixedAssetsPage.tsx`, `AssetCardPage.tsx`
- **Teendők ebben a témakörben:** **11 tétel** (🟡 11 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K34.01` | Eszközönként tárolódjon, hogy KIVA előtt vagy KIVA alatt szerezték be, illetve állították elő. | 🟡 **Részben kész** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. | P3 |
| `K34.02` | Eszközönként megőrződjön a KIVA-ba belépés dátuma. | 🟡 **Részben kész** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. | P3 |
| `K34.03` | Eszközönként megőrződjön a KIVA-ból kilépés dátuma. | 🟡 **Részben kész** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. | P3 |
| `K34.04` | KIVA előtti eszköznél rögzíthető legyen a belépés előtti TAO szerinti számított nyilvántartási érték. | 🟡 **Részben kész** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. | P3 |
| `K34.05` | KIVA előtti eszköznél külön összesüljön a KIVA alatt elszámolt számviteli ÉCS. | 🟡 **Részben kész** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. | P3 |
| `K34.06` | KIVA előtti eszköz számított nyilvántartási értéke csökkenjen a KIVA alatt elszámolt számviteli ÉCS-vel a Katv. 28. § (8) szerint. | 🟡 **Részben kész** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. | P3 |
| `K34.07` | A KIVA alatti adózási értékváltozás ne keletkeztessen második főkönyvi ÉCS-költséget. | 🟡 **Részben kész** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. | P3 |
| `K34.08` | KIVA alatt megszerzett vagy előállított eszköznél jelölhető legyen a kilépés utáni TAO-ÉCS-levonás kizárása a Katv. 28. § (4) szerint. | 🟡 **Részben kész** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. | P3 |
| `K34.09` | KIVA-ból kilépéskor eszközönként áttérési kimutatás készülhessen. | 🟡 **Részben kész** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. | P3 |
| `K34.10` | KIVA-ból kilépéskor a számviteli ÉCS-terv változatlanul folytatható legyen. | 🟡 **Részben kész** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. | P3 |
| `K34.11` | Adózási áttérés a korábbi eszközmozgásokat ne írja felül. | 🟡 **Részben kész** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. | P3 |

### 35. Civil és nonprofit – analitikák

- **Érintett Epic:** Alaptevékenység vs vállalkozási tevékenység analitika és 1% kimutatás
- **Prioritási szint:** ⚪ P4 – Speciális / Bővítmény
- **Érintett technikai réteg:** `accounty_civil_*`, `OrgCivilPage.tsx`, `CivilReportWizard.tsx`
- **Teendők ebben a témakörben:** **28 tétel** (🟡 28 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K35.01` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Alapcél szerinti tevékenység kódja. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.02` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Vállalkozási tevékenység kódja. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.03` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Közhasznú tevékenység kódja. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.04` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogató partnerazonosítója. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.05` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatási szerződés azonosítója. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.06` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatás célja. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.07` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatási időszak kezdete. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.08` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatási időszak vége. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.09` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatás megítélt összege. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.10` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatás beérkezett összege. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.11` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatás elszámolási határideje. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.12` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatás visszafizetendő összege. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.13` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Költségfelosztás alapja. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.14` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Költségfelosztás arányszáma. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.15` | Alapcél szerinti bevétel a vállalkozási bevételtől elkülöníthető legyen. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.16` | Alapcél szerinti költség a vállalkozási költségtől elkülöníthető legyen. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.17` | Közhasznú tevékenység az alapcél szerinti tevékenységen belül külön jelölhető legyen. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.18` | Közös költség dokumentált arányszám alapján felosztható legyen. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.19` | Tagdíjbevétel külön jogcímen könyvelhető legyen. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.20` | Adománybevétel külön jogcímen könyvelhető legyen. | 🟡 **Részben kész** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. | P4 |
| `K35.21` | Pályázati támogatás külön jogcímen könyvelhető legyen. | 🟡 **Részben kész** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. | P4 |
| `K35.22` | Személyi jövedelemadó 1%-os felajánlás külön jogcímen könyvelhető legyen. | 🟡 **Részben kész** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. | P4 |
| `K35.23` | Támogatási szerződéshez elszámolt költségek tételesen kigyűjthetők legyenek. | 🟡 **Részben kész** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. | P4 |
| `K35.24` | Civil mérleg előállítható legyen. | 🟡 **Részben kész** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. | P4 |
| `K35.25` | Civil eredménykimutatás előállítható legyen. | 🟡 **Részben kész** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. | P4 |
| `K35.26` | Közhasznúsági melléklethez számviteli adatok kigyűjthetők legyenek. | 🟡 **Részben kész** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. | P4 |
| `K35.27` | Közhasznúsági melléklet nem könyvelésből származó adatai kézzel kiegészíthetők legyenek. | 🟡 **Részben kész** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. | P4 |
| `K35.28` | Nonprofit gazdasági társaság beszámolósablonja ne automatikusan a civil szervezeti sablon legyen. | 🟡 **Részben kész** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. | P4 |

### 38. Saját számlázó – törzsek

- **Érintett Epic:** Beépített számlatömbös számlázómotor és NAV Online Számla 3.0 adatszolgáltatás
- **Prioritási szint:** 🔴 P1 – Kritikus / Sürgős
- **Érintett technikai réteg:** `invoice_series`, `invoices`, `InvoiceCreatePage.tsx` (új), `ManageInvoice30` beküldő worker
- **Teendők ebben a témakörben:** **39 tétel** (🟡 4 részben kész, ❌ 35 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K38.01` | Számlázási törzsadat – rögzíthető adat: Számlatömb kódja. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.02` | Számlázási törzsadat – rögzíthető adat: Számlatömb neve. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.03` | Számlázási törzsadat – rögzíthető adat: Számlatömb sorszám-előtagja. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.04` | Számlázási törzsadat – rögzíthető adat: Számlatömb következő sorszáma. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.05` | Számlázási törzsadat – rögzíthető adat: Számlatömb alapértelmezett devizaneme. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.06` | Számlázási törzsadat – rögzíthető adat: Számlatömb alapértelmezett nyelve. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.07` | Számlázási törzsadat – rögzíthető adat: Számlán megjelenő saját bankszámla. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.08` | Számlázási törzsadat – rögzíthető adat: Számlán megjelenő céglogó. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.09` | Számlázási törzsadat – rögzíthető adat: Szolgáltatás vagy cikk kódja. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.10` | Számlázási törzsadat – rögzíthető adat: Szolgáltatás vagy cikk megnevezése. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.11` | Számlázási törzsadat – rögzíthető adat: Szolgáltatás vagy cikk idegen nyelvű megnevezése. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.12` | Számlázási törzsadat – rögzíthető adat: Mértékegység. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.13` | Számlázási törzsadat – rögzíthető adat: Alapértelmezett nettó egységár. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.14` | Számlázási törzsadat – rögzíthető adat: Egységár devizaneme. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.15` | Számlázási törzsadat – rögzíthető adat: Alapértelmezett számlázási áfakód. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.16` | Számlázási törzsadat – rögzíthető adat: Alapértelmezett árbevételi főkönyvi szám. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.17` | Számlázási törzsadat – rögzíthető adat: NAV-termékazonosító típusa, ha szükséges. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.18` | Számlázási törzsadat – rögzíthető adat: NAV-termékazonosító értéke, ha szükséges. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. | P1 |
| `K38.19` | Szolgáltatásszámlázás készletnyilvántartás használata nélkül működjön. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.20` | Forintos számla kiállítható legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.21` | Devizás számla kiállítható legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.22` | Számlasorhoz mennyiség rögzíthető legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.23` | Számlasorhoz egységár rögzíthető legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.24` | Számlasorhoz engedmény rögzíthető legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.25` | Előlegszámla kiállítható legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.26` | Végszámlán az előleg beszámítható legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.27` | Helyesbítő számla az eredeti számlához kapcsolva kiállítható legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.28` | Sztornószámla az eredeti számlához kapcsolva kiállítható legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.29` | Díjbekérő ne hozzon létre főkönyvi vagy áfatételt. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.30` | Kiállított számla sorszáma ne legyen újra felhasználható. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.31` | Kiállított számla tartalma ne legyen közvetlenül felülírható. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.32` | Fordított adózás szövege megjelenjen a megfelelő számlán. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.33` | Pénzforgalmi elszámolás szövege megjelenjen a megfelelő számlán. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.34` | Adómentesség jogcíme megjelenjen a megfelelő számlán. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.35` | Kiállított számla könyvelési előkészítést hozzon létre könyvelői jóváhagyásra. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. | P1 |
| `K38.36` | NAV Online Számla adatszolgáltatás elindítható legyen. | 🟡 **Részben kész** | NAV Online Számla lekérdezés megvan, de ManageInvoice kiállított számla beküldés nincs | NAV Online Számla ManageInvoice 3.0 adatszolgáltatási beküldő modul kifejlesztése. | P1 |
| `K38.37` | NAV feldolgozási tranzakcióazonosító visszakereshető legyen. | 🟡 **Részben kész** | NAV Online Számla lekérdezés megvan, de ManageInvoice kiállított számla beküldés nincs | NAV Online Számla ManageInvoice 3.0 adatszolgáltatási beküldő modul kifejlesztése. | P1 |
| `K38.38` | NAV elutasítás esetén a hiba a számlához kapcsolva jelenjen meg. | 🟡 **Részben kész** | NAV Online Számla lekérdezés megvan, de ManageInvoice kiállított számla beküldés nincs | NAV Online Számla ManageInvoice 3.0 adatszolgáltatási beküldő modul kifejlesztése. | P1 |
| `K38.39` | Technikai újraküldés ne állítson ki új számlát. | 🟡 **Részben kész** | NAV Online Számla lekérdezés megvan, de ManageInvoice kiállított számla beküldés nincs | NAV Online Számla ManageInvoice 3.0 adatszolgáltatási beküldő modul kifejlesztése. | P1 |

### 39. Szerződéses számlázás

- **Érintett Epic:** Ismétlődő szerződéses számlázás és automatikus díjindexálás
- **Prioritási szint:** 🔴 P1 – Kritikus / Sürgős
- **Érintett technikai réteg:** `billing_contracts`, `billing_contract_items`, `ContractsPage.tsx` (új), cron generátor
- **Teendők ebben a témakörben:** **20 tétel** (🟡 0 részben kész, ❌ 20 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K39.01` | Számlázási szerződés – rögzíthető adat: Szerződésazonosító. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.02` | Számlázási szerződés – rögzíthető adat: Partner. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.03` | Számlázási szerződés – rögzíthető adat: Szerződés kezdőnapja. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.04` | Számlázási szerződés – rögzíthető adat: Szerződés zárónapja. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.05` | Számlázási szerződés – rögzíthető adat: Számlázás gyakorisága. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.06` | Számlázási szerződés – rögzíthető adat: Számlázandó szolgáltatás. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.07` | Számlázási szerződés – rögzíthető adat: Fix díj. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.08` | Számlázási szerződés – rögzíthető adat: Változó díj alapjául szolgáló mennyiség. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.09` | Számlázási szerződés – rögzíthető adat: Változó díj egységára. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.10` | Számlázási szerződés – rögzíthető adat: Díj devizaneme. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.11` | Számlázási szerződés – rögzíthető adat: Fizetési határidő napokban. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.12` | Számlázási szerződés – rögzíthető adat: Díjváltozás hatálynapja. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.13` | Számlázási szerződés – rögzíthető adat: Indexálási százalék. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.14` | Számlázási szerződés – rögzíthető adat: Elszámolási időszak kezdete. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.15` | Számlázási szerződés – rögzíthető adat: Elszámolási időszak vége. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.16` | Számlázási szerződés – rögzíthető adat: Számlázás szüneteltetésének jelölése. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.17` | Szerződésből ismétlődő számla előkészíthető legyen. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.18` | Ugyanazon szerződés azonos időszaka ne legyen figyelmeztetés nélkül újraszámlázható. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.19` | Szerződésdíj változása a korábbi számlák összegét ne módosítsa. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |
| `K39.20` | Számlázandó változó mennyiség az adott időszakra külön megadható legyen. | ❌ **Hiányzik** | Jelenleg nem támogatott funkció az adatmodellben és a felületen; külső eszközzel vagy manuálisan kiváltva. | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. | P1 |

### 41. SUP-adatok átvétele

- **Érintett Epic:** SUP ERP natív adatmigrációs konverter és analitika-átemelő
- **Prioritási szint:** ⚪ P4 – Speciális / Bővítmény
- **Érintett technikai réteg:** `UploadAuditXmlModal.tsx`, `SupDataImportPage.tsx` (új adatkonverter)
- **Teendők ebben a témakörben:** **23 tétel** (🟡 23 részben kész, ❌ 0 hiányzik)

| Kód | Követelmény / Elvárt működés | Státusz | Jelenlegi állapot (Mi van kész?) | Szükséges fejlesztés (Mivel kell kiegészíteni?) | Prioritás |
| :--- | :--- | :---: | :--- | :--- | :---: |
| `K41.01` | SUP-számlatükör főkönyvi számai importálhatók legyenek. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.02` | SUP-partnertörzs partnerkódjai megőrizhetők legyenek. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.03` | SUP-gyűjtőkódok megfeleltethetők legyenek az új rendszer gyűjtőinek. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.04` | SUP-nyitó főkönyvi egyenlegek átvehetők legyenek. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.05` | SUP-vevői nyitott tételek eredeti számlaszámmal átvehetők legyenek. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.06` | SUP-szállítói nyitott tételek eredeti számlaszámmal átvehetők legyenek. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.07` | SUP-devizás nyitott tételek devizaösszege átvehető legyen. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.08` | SUP-devizás nyitott tételek forintértéke átvehető legyen. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.09` | SUP-bankok nyitó egyenlege átvehető legyen. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.10` | SUP-pénztárak nyitó egyenlege átvehető legyen. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.11` | SUP-elhatárolások még fel nem oldott állománya átvehető legyen. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.12` | SUP-eszközkartonok azonosítói átvehetők legyenek. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.13` | SUP-eszközök számviteli bruttó értéke átvehető legyen. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.14` | SUP-eszközök számviteli halmozott ÉCS-je átvehető legyen. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.15` | SUP-eszközök TAO szerinti nyilvántartási értéke átvehető legyen. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.16` | SUP-eszközök számviteli leírási beállításai átvehetők legyenek. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.17` | SUP-eszközök TAO szerinti leírási beállításai átvehetők legyenek. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.18` | Átvett főkönyv és nyitott folyószámlák egyezősége ellenőrizhető legyen. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.19` | Átvett eszközanalitika és főkönyv egyezősége ellenőrizhető legyen. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.20` | Átvételi eltérés a forrásrekord azonosítójával jelenjen meg. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.21` | Nyitó adatátvétel könyvelői jóváhagyást igényeljen. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.22` | Korábbi könyvelési tételek eredeti bizonylatazonosítóval importálhatók legyenek, ha ilyen export rendelkezésre áll. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
| `K41.23` | Korábbi dokumentumkapcsolatok megőrizhetők legyenek, ha az export tartalmazza az azonosítókat. | 🟡 **Részben kész** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. | P4 |
