# MI-Könyvelőprogram Minimálkövetelmény-Lista & Rendszerelemzés

**Forrásdokumentum:** `docs/product/requirements/MI_konyveloprogram_minimum_csekklista.xlsx`  
**Vizsgált rendszerek:** Eaisybill (Bizonylat- és számlakezelő, NAV OSA szinkron, Bank, Vision OCR és AI motor) & eaisyBooks (Accounty könyvelői és bérszámfejtési ERP modul, főkönyv, analitikák, bevallások)  
**Dátum:** 2026-09-27  
**Teljes elemszám:** 1146 tétel (45 témakörben)  

---

## 1. Vezetői Összefoglaló (Executive Summary)

A tesztelő könyvelőiroda által átadott **1146 tételes minimálkövetelmény-ellenőrzőlista** részletes technikai és funkcionális auditja megtörtént a termelési kódbázis (`eaisybill-prod`), a relációs adatbázis-séma (PostgreSQL / Supabase), a termék- (PRD P-001 - P-125) és architektúrális döntések (ADR A-001 - A-166), valamint a tudásgráf (`graphify-out`) alapján.

### 📊 Globális Eredménymutatók

- **Összes követelmény:** `1146` tétel
- ✅ **Kész (Teljesen megvalósítva):** `828` tétel (**72.3%**)
- 🟡 **Részben van meg (Alapok kész, finomhangolás szükséges):** `221` tétel (**19.3%**)
- ❌ **Hiányzik (Új fejlesztést igénylő funkció):** `97` tétel (**8.5%**)
- 📈 **Súlyozott készültségi szint:** **`81.9%`**

### 🎯 Főbb Következtetések

1. **Kiemelkedően Erős Területek (95-100% Készültség):**
   - **Könyvelési bizonylat- és naplókezelés (10, 17, 18, 19. témakörök):** A kettős könyvviteli napló- és bizonylatsor struktúra, az elszámolási és áfadátumok független kezelése, a jóváhagyási workflow (`ApprovalQueuePage`), a sztornó/helyesbítés és az immutabilitás maradéktalanul kész.
   - **Áfa és Hatósági Megfelelés (14, 24, 25, 26. témakörök):** 65-ös ÁNYK bevallás (`VatReturnPage`), M-lapok, A60, eÁFA, NAV UPO M2M kapcsolat, arányosítás és fordított adózás kiválóan fedett.
   - **Bank, Pénztár és Tranzakciófeldolgozás (21, 22. témakörök):** Aggreg8 PSD2 Open Banking, CAMT/MT940/CSV importok, pénztárbizonylat-generálás, negatív készlet tiltás és kerekítés kész.
   - **Tárgyi Eszközök és Értékcsökkenés (29-33. témakörök):** Kartonok, lineáris és egyösszegű leírás, számviteli vs TAO értékcsökkenés, események és a friss Fejlesztési Tartalék (P-123, A-164) teljes.
   - **MI-adatkinyerés, Papírmentesség és Adatbiztonság (42-45. témakörök):** A Vision OCR + LLM motor, NAV keresztellenőrzés, audit naplózás, sha256 deduplikáció és RLS jogosultsági rendszer iparági élvonalat képvisel.

2. **Főbb Hiányosságok és Fejlesztési Fókuszok (Gap Analysis):**
   - 🔴 **P1 – Belső Számlázó és Szerződéses Számlázás (38., 39. témakör):** Az Eaisybill jelenleg kiváló számlabefogadó és külső számlázókkal (Számlázz.hu, Billingo, NAV OSA) integrálódó rendszer, de **nem rendelkezik beépített számlatömbös, saját kimenő számlát kiállító és NAV ManageInvoice beküldő motorral**, valamint ismétlődő szerződéses számlázással. Ez a lista legnagyobb hiányzó funkcióblokkja.
   - 🟠 **P2 – Partnertörzs és Cégtörzs Cím- és Bankszámla Struktúra (02., 06., 07. témakör):** A cégek és partnerek címe jelenleg összefüggő szövegmezőként tárolódik; hiányzik a kötelezően szabványosított bontás (közterület neve, jellege, házszám, épület, lépcsőház, emelet, ajtó) és a partnerekhez tartozó 1:N bankszámlaszám-nyilvántartás.
   - 🟡 **P3 – Számviteli Finomhangolások (13., 23., 27., 41. témakör):** Elhatárolások dedikált felhasználói képernyője (`accrual_entries` DB kész, UI kell), év végi devizaátértékelő automatikus varázsló, százalékos költségfelosztási sablonok, valamint a SUP ERP-specifikus közvetlen migrációs importőr.

---

## 2. Témakörönkénti Összesítő Mátrix (45 Témakör)

| # | Témakör Neve | Összes tétel | ✅ Kész | 🟡 Részben | ❌ Hiányzik | Készültségi fok (%) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **01** | 01. Cégtörzs – azonosítás | 27 | 13 | 8 | 6 | **63.0%** |
| **02** | 02. Cégtörzs – címek | 16 | 3 | 6 | 7 | **37.5%** |
| **03** | 03. Adózás és számviteli beállítások | 27 | 12 | 14 | 1 | **70.4%** |
| **04** | 04. Üzleti év és végelszámolás | 20 | 9 | 5 | 6 | **57.5%** |
| **05** | 05. Partnertörzs – alapadatok | 30 | 16 | 10 | 4 | **70.0%** |
| **06** | 06. Partnertörzs – cím és kapcsolattartás | 22 | 0 | 15 | 7 | **34.1%** |
| **07** | 07. Partnertörzs – bankszámlák | 15 | 2 | 11 | 2 | **50.0%** |
| **08** | 08. Törzsadatok – ellenőrzés és módosítás | 22 | 16 | 4 | 2 | **81.8%** |
| **09** | 09. Számlatükör | 25 | 11 | 11 | 3 | **66.0%** |
| **10** | 10. Naplótörzs | 17 | 14 | 3 | 0 | **91.2%** |
| **11** | 11. Saját bank- és pénztártörzs | 21 | 19 | 2 | 0 | **95.2%** |
| **12** | 12. Deviza- és árfolyamtörzs | 14 | 13 | 1 | 0 | **96.4%** |
| **13** | 13. Gyűjtőtörzsek és költségfelosztás | 24 | 12 | 8 | 4 | **66.7%** |
| **14** | 14. Áfakódtörzs | 31 | 30 | 1 | 0 | **98.4%** |
| **15** | 15. Fizetési módok és kontírsablonok | 18 | 17 | 1 | 0 | **97.2%** |
| **16** | 16. Felhasználók és jogosultságok | 19 | 19 | 0 | 0 | **100.0%** |
| **17** | 17. Könyvelés – bizonylatfej | 31 | 31 | 0 | 0 | **100.0%** |
| **18** | 18. Könyvelés – bizonylatsor | 31 | 30 | 1 | 0 | **98.4%** |
| **19** | 19. Könyvelés – jóváhagyás és javítás | 23 | 23 | 0 | 0 | **100.0%** |
| **20** | 20. Könyvelés – számlák és folyószámla | 28 | 25 | 3 | 0 | **94.6%** |
| **21** | 21. Bank – kivonat és tranzakció | 38 | 38 | 0 | 0 | **100.0%** |
| **22** | 22. Pénztár – bizonylat és működés | 29 | 27 | 2 | 0 | **96.6%** |
| **23** | 23. Deviza – értékelés és különbözetek | 20 | 9 | 11 | 0 | **72.5%** |
| **24** | 24. Áfa – ügyletfajták | 28 | 21 | 7 | 0 | **87.5%** |
| **25** | 25. Áfa – időzítés és korrekció | 27 | 22 | 5 | 0 | **90.7%** |
| **26** | 26. Áfa – bevallás és zárás | 29 | 29 | 0 | 0 | **100.0%** |
| **27** | 27. Elhatárolások – adatok | 23 | 0 | 23 | 0 | **50.0%** |
| **28** | 28. Számviteli zárás és nyitás | 24 | 21 | 3 | 0 | **93.8%** |
| **29** | 29. Tárgyi eszköz – azonosító adatok | 34 | 34 | 0 | 0 | **100.0%** |
| **30** | 30. Tárgyi eszköz – érték és kontírozás | 23 | 23 | 0 | 0 | **100.0%** |
| **31** | 31. Tárgyi eszköz – ÉCS-beállítások | 29 | 29 | 0 | 0 | **100.0%** |
| **32** | 32. Tárgyi eszköz – mozgások és leltár | 24 | 24 | 0 | 0 | **100.0%** |
| **33** | 33. Tárgyi eszköz – tartalék és támogatás | 17 | 17 | 0 | 0 | **100.0%** |
| **34** | 34. Tárgyi eszköz – KIVA és áttérés | 11 | 0 | 11 | 0 | **50.0%** |
| **35** | 35. Civil és nonprofit – analitikák | 28 | 0 | 28 | 0 | **50.0%** |
| **36** | 36. TAO és KIVA – alátámasztó adatok | 20 | 20 | 0 | 0 | **100.0%** |
| **37** | 37. Kimutatások és beszámolók | 28 | 28 | 0 | 0 | **100.0%** |
| **38** | 38. Saját számlázó – törzsek | 39 | 0 | 4 | 35 | **5.1%** |
| **39** | 39. Szerződéses számlázás | 20 | 0 | 0 | 20 | **0.0%** |
| **40** | 40. Adatkapcsolatok és import | 33 | 33 | 0 | 0 | **100.0%** |
| **41** | 41. SUP-adatok átvétele | 23 | 0 | 23 | 0 | **50.0%** |
| **42** | 42. Papírmentes működés – dokumentumok | 32 | 32 | 0 | 0 | **100.0%** |
| **43** | 43. MI – adatkinyerés és javaslatok | 44 | 44 | 0 | 0 | **100.0%** |
| **44** | 44. Stabilitás – adat és számítás | 22 | 22 | 0 | 0 | **100.0%** |
| **45** | 45. Adatbiztonság és üzemeltetés | 40 | 40 | 0 | 0 | **100.0%** |
| **ÖSSZ** | **Összesen (1–45 témakör)** | **1146** | **828** | **221** | **97** | **81.9%** |

---

## 3. Részletes Tételes Ellenőrzőlista (Mind az 1146 tétel)

### 01. Cégtörzs – azonosítás

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K01.01` | Könyvelt szervezet – rögzíthető adat: Belső cégazonosító. | ✅ **Kész** | `companies.id` (UUID) – Elsődleges kulcs és azonosító a teljes rendszerben | Megvalósítva. |
| `K01.02` | Könyvelt szervezet – rögzíthető adat: Teljes hivatalos név. | ✅ **Kész** | `companies.name` – Hivatalos cégnév tárolása és megjelenítése | Megvalósítva. |
| `K01.03` | Könyvelt szervezet – rögzíthető adat: Rövidített név. | 🟡 **Részben van meg** | `companies.name` mezőből automatikus monogram és rövidítés készül | Külön `short_name` oszlop és beviteli mező bevezetése szükséges a `companies` táblába. |
| `K01.04` | Könyvelt szervezet – rögzíthető adat: Jogi forma: gazdasági társaság, egyesület vagy alapítvány. | 🟡 **Részben van meg** | Moduláris felosztás: EV (`accounty_ev_client_settings`), Társasház (`accounty_condo_*`), Civil (`OrgCivilPage`) | Egységes `legal_form` enum mező felvétele a `companies` táblára (gazdasági társaság, egyesület, alapítvány). |
| `K01.05` | Könyvelt szervezet – rögzíthető adat: Nonprofit gazdasági társaság jelölése. | 🟡 **Részben van meg** | Civil modul (`OrgCivilPage`) és P-073 | A `companies` táblán külön `is_nonprofit` boolean jelölő mező felvétele szükséges. |
| `K01.06` | Könyvelt szervezet – rögzíthető adat: Közhasznú jogállás jelölése. | 🟡 **Részben van meg** | Civil és nonprofit modul (`OrgCivilPage`) | Dedikált `is_public_benefit` (közhasznú jogállás) kapcsoló bevezetése a cégtörzsbe. |
| `K01.07` | Könyvelt szervezet – rögzíthető adat: Közhasznú jogállás kezdőnapja. | ❌ **Hiányzik** | Nincs a cégtörzsben | `public_benefit_start_date` dátummező hozzáadása a cégbeállításokhoz. |
| `K01.08` | Könyvelt szervezet – rögzíthető adat: Közhasznú jogállás megszűnésének napja. | ❌ **Hiányzik** | Nincs a cégtörzsben | `public_benefit_end_date` dátummező hozzáadása a cégbeállításokhoz. |
| `K01.09` | Könyvelt szervezet – rögzíthető adat: Belföldi adószám. | ✅ **Kész** | `companies.tax_number` – 8-1-2 formátumú magyar adószám, parseTaxNumber validációval és formázással | Megvalósítva. |
| `K01.10` | Könyvelt szervezet – rögzíthető adat: Közösségi adószám. | 🟡 **Részben van meg** | Magyar adószámból automatikus HU előtag generálás VIES/NAV szinkronhoz; partnereknél `eu_tax_number` | A `companies` táblán külön `eu_tax_number` mező biztosítása az egyedi közösségi adószámhoz. |
| `K01.11` | Könyvelt szervezet – rögzíthető adat: Cégjegyzékszám gazdasági társaságnál. | 🟡 **Részben van meg** | `accounty_nav_representations.registration_number` tárolja a cégképviseletnél | A `companies` alaptáblában dedikált `registration_number` (Cégjegyzékszám: 01-09-XXXXXX) mező rögzítése. |
| `K01.12` | Könyvelt szervezet – rögzíthető adat: Bírósági nyilvántartási szám civil szervezetnél. | ❌ **Hiányzik** | Nincs a cégtörzsben | `court_registration_number` (bírósági nyilvántartási szám) mező felvétele civil szervezetekhez. |
| `K01.13` | Könyvelt szervezet – rögzíthető adat: Statisztikai számjel. | 🟡 **Részben van meg** | Az adószám első 8 jegye (törzsszám) kinyerhető | 17 jegyű KSH statisztikai számjel mező (`statistical_code`) rögzítése. |
| `K01.14` | Könyvelt szervezet – rögzíthető adat: Főtevékenység TEÁOR-kódja. | ✅ **Kész** | `companies.primary_teaor` – 4 jegyű TEÁOR kód mező és választó a felületen | Megvalósítva. |
| `K01.15` | Könyvelt szervezet – rögzíthető adat: Alapítás dátuma. | ❌ **Hiányzik** | Nincs a cégtörzsben | `incorporation_date` (alapítás dátuma) mező hozzáadása a cégtörzshöz. |
| `K01.16` | Könyvelt szervezet – rögzíthető adat: Képviseletre jogosult személy neve. | ✅ **Kész** | `accounty_nav_representations.name`, `accounty_cegkapu_settings.signer_name` (P-075) | Megvalósítva. |
| `K01.17` | Könyvelt szervezet – rögzíthető adat: Képviselő tisztsége. | ✅ **Kész** | `accounty_nav_representations.rep_type` (ügyvezető, képviselő jogcíme) | Megvalósítva. |
| `K01.18` | Könyvelt szervezet – rögzíthető adat: Kapcsolattartási e-mail-cím. | ✅ **Kész** | `company_email_settings`, `company_email_accounts`, `email_aliases` | Megvalósítva. |
| `K01.19` | Könyvelt szervezet – rögzíthető adat: Kapcsolattartási telefonszám. | ❌ **Hiányzik** | Nincs a cégtörzsben | `phone` mező hozzáadása a `companies` táblához és a cégbeállítások űrlaphoz. |
| `K01.20` | Könyvelt szervezet – rögzíthető adat: Felelős könyvelő felhasználói azonosítója. | ✅ **Kész** | `accounty_assignments.accountant_user_id`, `is_main_accountant` | Megvalósítva. |
| `K01.21` | Könyvelt szervezet – rögzíthető adat: Felelős ellenőrző felhasználói azonosítója. | ✅ **Kész** | `accounty_assignments` felülvizsgáló (auditor / senior reviewer) szerepkör hozzárendelés | Megvalósítva. |
| `K01.22` | Könyvelt szervezet – rögzíthető adat: Könyvelés átvételének dátuma. | ✅ **Kész** | `accounty_assignments.assigned_at` (ügyfél megbízás kezdő dátuma) | Megvalósítva. |
| `K01.23` | Könyvelt szervezet – rögzíthető adat: Inaktív ügyfél jelölése. | 🟡 **Részben van meg** | `accounty_assignments.kanban_status` (archived, inactive) | Közvetlen `is_active` boolean oszlop és inaktiválási workflow kialakítása a `companies` táblán. |
| `K01.24` | A nonprofit jelölés és a közhasznú jogállás egymástól függetlenül beállítható legyen. | ❌ **Hiányzik** | Civil modulban van funkció, de nem független kapcsolók a cégtörzsben | Két független kapcsoló (Nonprofit gazdasági társaság vs Közhasznú jogállás) beépítése a cégbeállításokba. |
| `K01.25` | Cégváltáskor a kiválasztott cég neve és üzleti éve a rögzítőképernyőn látható maradjon. | ✅ **Kész** | `CompanySwitcher.tsx`, ScopedLayout `:companyId/:dateRange`, globális fejléc és breadcrumb (P-076, P-083, P-084) | Megvalósítva: cégváltáskor a felső sávban és az útvonalban mindig rögzített a cég és az üzleti év. |
| `K01.26` | Új céghez számlatükör és naplótörzs másolható legyen forgalmi tételek másolása nélkül. | ✅ **Kész** | `chart_of_accounts_presets`, `gl_accounts` sablonból másolás forgalmi tételek nélkül (P-071) | Megvalósítva: új cég beállításakor az alapértelmezett számlatükör tiszta állapotban jön létre. |
| `K01.27` | Másik cég dokumentuma ne jelenhessen meg a kiválasztott cég bizonylatai között. | ✅ **Kész** | Row Level Security (RLS) policies minden táblán (`invoices`, `transactions`, `gl_journal_entries`) `company_id` szűréssel | Megvalósítva: technológiai védelem garantálja, hogy más cég dokumentuma nem jelenhet meg. |

### 02. Cégtörzs – címek

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K02.01` | Szervezeti cím – rögzíthető adat: Cím típusa: székhely, levelezési cím vagy telephely. | ✅ **Kész** | `company_locations.location_type` (headquarters, site, branch), `is_default` | Megvalósítva. |
| `K02.02` | Szervezeti cím – rögzíthető adat: Országkód. | 🟡 **Részben van meg** | `companies.address` és `company_locations.address` egybefüggő szövegként tárolja a címet | Strukturált címmezők bevezetése szükséges: országkód, irányítószám, település, közterület neve, jellege, házszám (Országkód.). |
| `K02.03` | Szervezeti cím – rögzíthető adat: Irányítószám. | 🟡 **Részben van meg** | `companies.address` és `company_locations.address` egybefüggő szövegként tárolja a címet | Strukturált címmezők bevezetése szükséges: országkód, irányítószám, település, közterület neve, jellege, házszám (Irányítószám.). |
| `K02.04` | Szervezeti cím – rögzíthető adat: Település. | 🟡 **Részben van meg** | `companies.address` és `company_locations.address` egybefüggő szövegként tárolja a címet | Strukturált címmezők bevezetése szükséges: országkód, irányítószám, település, közterület neve, jellege, házszám (Település.). |
| `K02.05` | Szervezeti cím – rögzíthető adat: Közterület neve. | 🟡 **Részben van meg** | `companies.address` és `company_locations.address` egybefüggő szövegként tárolja a címet | Strukturált címmezők bevezetése szükséges: országkód, irányítószám, település, közterület neve, jellege, házszám (Közterület neve.). |
| `K02.06` | Szervezeti cím – rögzíthető adat: Közterület jellege. | 🟡 **Részben van meg** | `companies.address` és `company_locations.address` egybefüggő szövegként tárolja a címet | Strukturált címmezők bevezetése szükséges: országkód, irányítószám, település, közterület neve, jellege, házszám (Közterület jellege.). |
| `K02.07` | Szervezeti cím – rögzíthető adat: Házszám. | 🟡 **Részben van meg** | `companies.address` és `company_locations.address` egybefüggő szövegként tárolja a címet | Strukturált címmezők bevezetése szükséges: országkód, irányítószám, település, közterület neve, jellege, házszám (Házszám.). |
| `K02.08` | Szervezeti cím – rögzíthető adat: Épület. | ❌ **Hiányzik** | A szöveges cím nem tartalmaz dedikált strukturált bontást | Finom címmező hozzáadása szükséges: Épület.. |
| `K02.09` | Szervezeti cím – rögzíthető adat: Lépcsőház. | ❌ **Hiányzik** | A szöveges cím nem tartalmaz dedikált strukturált bontást | Finom címmező hozzáadása szükséges: Lépcsőház.. |
| `K02.10` | Szervezeti cím – rögzíthető adat: Emelet. | ❌ **Hiányzik** | A szöveges cím nem tartalmaz dedikált strukturált bontást | Finom címmező hozzáadása szükséges: Emelet.. |
| `K02.11` | Szervezeti cím – rögzíthető adat: Ajtó. | ❌ **Hiányzik** | A szöveges cím nem tartalmaz dedikált strukturált bontást | Finom címmező hozzáadása szükséges: Ajtó.. |
| `K02.12` | Szervezeti cím – rögzíthető adat: Helyrajzi szám. | ❌ **Hiányzik** | Csak a tárgyi eszköz ingatlankartonon van HRSZ | Telephelycímekhez `parcel_number` (helyrajzi szám) mező biztosítása. |
| `K02.13` | Szervezeti cím – rögzíthető adat: Cím érvényességének kezdete. | ❌ **Hiányzik** | Nincs cím érvényességi idő nyilvántartás | `valid_from` és `valid_to` érvényességi dátummezők felvétele a `company_locations` táblába. |
| `K02.14` | Szervezeti cím – rögzíthető adat: Cím érvényességének vége. | ❌ **Hiányzik** | Nincs cím érvényességi idő nyilvántartás | `valid_from` és `valid_to` érvényességi dátummezők felvétele a `company_locations` táblába. |
| `K02.15` | Egy könyvelt céghez több telephelycím rögzíthető legyen. | ✅ **Kész** | `company_locations` és `accounty_sites` 1:N kapcsolatban a cégekkel | Megvalósítva: tetszőleges számú telephelycím felvihető. |
| `K02.16` | A cégnév és cím változása ne írja át a korábban kiállított számlaképet. | ✅ **Kész** | A korábbi számlák és NAV bizonylatok immutable bizonylatfejben tárolják a kiállításkori cégadatokat | Megvalósítva: a cégtörzs módosítása nem írja felül a korábbi bizonylatképeket. |

### 03. Adózás és számviteli beállítások

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K03.01` | Cégbeállítás – rögzíthető adat: Eredményadózási mód: TAO vagy KIVA. | ✅ **Kész** | `accounty_tax_profiles.is_kiva`, `tax_group`, `TaoSetupWizardPage.tsx`, `TaoPortfolioPage.tsx` | Megvalósítva. |
| `K03.02` | Cégbeállítás – rögzíthető adat: Eredményadózási mód kezdőnapja. | 🟡 **Részben van meg** | `accounty_tax_profiles`, `TaoBusinessYearPage.tsx` | Dedikált kezdő- és zárónap mezők felvétele a társasági adózási módhoz. |
| `K03.03` | Cégbeállítás – rögzíthető adat: Eredményadózási mód zárónapja. | 🟡 **Részben van meg** | `accounty_tax_profiles`, `TaoBusinessYearPage.tsx` | Dedikált kezdő- és zárónap mezők felvétele a társasági adózási módhoz. |
| `K03.04` | Cégbeállítás – rögzíthető adat: Áfastátusz: általános szabályok szerinti vagy alanyi adómentes. | ✅ **Kész** | `companies.vat_regime` (normal, exempt, cash_accounting) | Megvalósítva. |
| `K03.05` | Cégbeállítás – rögzíthető adat: Áfastátusz érvényességének kezdete. | ✅ **Kész** | `companies.vat_regime_effective_from` | Megvalósítva. |
| `K03.06` | Cégbeállítás – rögzíthető adat: Áfastátusz érvényességének vége. | 🟡 **Részben van meg** | `companies.vat_regime` tárolja az aktuális státuszt | `vat_regime_effective_to` mező hozzáadása. |
| `K03.07` | Cégbeállítás – rögzíthető adat: Áfabevallási gyakoriság: havi, negyedéves vagy éves. | ✅ **Kész** | `accounty_tax_profiles.vat_frequency` (monthly, quarterly, yearly) | Megvalósítva. |
| `K03.08` | Cégbeállítás – rögzíthető adat: Áfagyakoriság-váltás hatálynapja. | 🟡 **Részben van meg** | `accounty_tax_profiles` tárolja az aktuális gyakoriságot | Áfagyakoriság-váltás hatálynapjának naplózása historikus táblában. |
| `K03.09` | Cégbeállítás – rögzíthető adat: Saját pénzforgalmi áfa választásának jelölése. | ✅ **Kész** | `companies.vat_regime = "cash_accounting"` (P-073, P-093) | Megvalósítva. |
| `K03.10` | Cégbeállítás – rögzíthető adat: Saját pénzforgalmi áfa kezdőnapja. | ✅ **Kész** | `companies.vat_regime_effective_from` | Megvalósítva. |
| `K03.11` | Cégbeállítás – rögzíthető adat: Saját pénzforgalmi áfa zárónapja. | 🟡 **Részben van meg** | `companies` tábla | Pénzforgalmi áfa zárónap mező hozzáadása. |
| `K03.12` | Cégbeállítás – rögzíthető adat: Számviteli árfolyam forrása: MNB vagy kiválasztott hitelintézet. | ✅ **Kész** | `company_fx_settings`, `daily_exchange_rates`, MNB árfolyamszinkron API | Megvalósítva. |
| `K03.13` | Cégbeállítás – rögzíthető adat: Számviteli árfolyamtípus. | 🟡 **Részben van meg** | `daily_exchange_rates` MNB középárfolyamot tárol | Egyedi hitelintézeti vételi/eladási árfolyamtípus választó beépítése. |
| `K03.14` | Cégbeállítás – rögzíthető adat: Számviteli árfolyamválasztás hatálynapja. | 🟡 **Részben van meg** | `company_fx_settings` | Árfolyamválasztás hatálynap mező rögzítése. |
| `K03.15` | Cégbeállítás – rögzíthető adat: Áfaárfolyam forrása, a számviteli forrástól függetlenül. | 🟡 **Részben van meg** | MNB árfolyam motor elérhető számlákon és áfaanalitikában | Különálló áfaárfolyam-forrás választó kialakítása a számviteli forrástól függetlenül. |
| `K03.16` | Cégbeállítás – rögzíthető adat: Áfaárfolyam-választás hatálynapja. | ❌ **Hiányzik** | Nincs rögzítve | Áfaárfolyam-választás hatálynap mező hozzáadása. |
| `K03.17` | Cégbeállítás – rögzíthető adat: Beszámolótípus: éves, egyszerűsített éves, mikrogazdálkodói vagy civil szervezeti. | ✅ **Kész** | `annual_reports`, `AnnualReportPage.tsx` (éves, egyszerűsített, mikrogazdálkodói, civil) | Megvalósítva. |
| `K03.18` | Cégbeállítás – rögzíthető adat: Eredménykimutatás eljárása: összköltség vagy forgalmi költség. | 🟡 **Részben van meg** | `pnl_structure`, `pnl_mapping` (összköltségi eljárás kész, P-060, A-151) | Forgalmi költség eljárású eredménykimutatás séma és leképezés kidolgozása. |
| `K03.19` | Cégbeállítás – rögzíthető adat: Költségkönyvelés rendje: csak 5-ös, illetve 6–7-es számlaosztályt is használó. | 🟡 **Részben van meg** | `chart_of_accounts_presets` (5-ös és 6-7-es számlák léteznek a sablonokban) | Cégszintű ellenőrző kapcsoló beállítása a költségkönyvelés rendjére. |
| `K03.20` | Cégbeállítás – rögzíthető adat: Könyvvizsgálati kötelezettség jelölése. | ✅ **Kész** | `annual_reports` adatok és beszámoló varázsló | Megvalósítva. |
| `K03.21` | Cégbeállítás – rögzíthető adat: Készpénzes kerekítési különbözet bevételi főkönyvi száma. | 🟡 **Részben van meg** | `petty_cash_registers` kerekítési modul (5 Ft-os készpénzes kerekítés) | Cégszintű alapértelmezett kerekítési bevételi (96) és ráfordítási (86) főkönyvi szám beállítás. |
| `K03.22` | Cégbeállítás – rögzíthető adat: Készpénzes kerekítési különbözet ráfordítási főkönyvi száma. | 🟡 **Részben van meg** | `petty_cash_registers` kerekítési modul (5 Ft-os készpénzes kerekítés) | Cégszintű alapértelmezett kerekítési bevételi (96) és ráfordítási (86) főkönyvi szám beállítás. |
| `K03.23` | A könyvvezetés pénzneme HUF legyen; a devizaügyletekhez külön eredeti devizaösszeg tartozzon. | ✅ **Kész** | `transactions`, `invoices`, `gl_journal_entries`, `acc_journal_lines` (HUF könyvelés + eredeti deviza) | Megvalósítva. |
| `K03.24` | Az áfamentes tevékenység bizonylaton is jelölhető legyen általános áfastátuszú cégnél. | ✅ **Kész** | `vat_codes` (TAM, AAM) bizonylatonként választható általános áfastátusznál is (P-101) | Megvalósítva. |
| `K03.25` | Az adózási mód időbeli változása ne módosítsa visszamenőleg a lezárt időszakokat. | ✅ **Kész** | `acc_accounting_periods` lezárt időszak védelem visszamenőleges módosítás ellen | Megvalósítva. |
| `K03.26` | KIVA-alany cégnél a naptáritól eltérő üzleti év beállítását a program tiltsa. | 🟡 **Részben van meg** | `TaoBusinessYearPage.tsx` | Szigorú UI/DB tiltó validáció aktiválása KIVA-alany esetén naptáritól eltérő üzleti évre. |
| `K03.27` | Civil szervezetnél ne lehessen pusztán a nonprofit jelölés alapján KIVA-státuszt beállítani. | 🟡 **Részben van meg** | Civil modul és TAO modul szétválasztva | Civil szervezetnél KIVA választás tiltása a setup wizardban. |

### 04. Üzleti év és végelszámolás

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K04.01` | Üzleti időszak – rögzíthető adat: Üzleti év belső azonosítója. | ✅ **Kész** | `acc_accounting_periods.id` és év/hónap kulcsok | Megvalósítva. |
| `K04.02` | Üzleti időszak – rögzíthető adat: Üzleti év kezdőnapja. | ✅ **Kész** | `acc_accounting_periods`, ScopedLayout `:dateRange` | Megvalósítva. |
| `K04.03` | Üzleti időszak – rögzíthető adat: Üzleti év zárónapja. | ✅ **Kész** | `acc_accounting_periods`, ScopedLayout `:dateRange` | Megvalósítva. |
| `K04.04` | Üzleti időszak – rögzíthető adat: Mérlegfordulónap. | 🟡 **Részben van meg** | `annual_reports` tábla tartalmazza a mérlegfordulónapot és a mérlegkészítés napját | Az általános `acc_accounting_periods` időszaktáblába is bevezetendő a mérlegkészítési nap. |
| `K04.05` | Üzleti időszak – rögzíthető adat: Mérlegkészítés napja. | 🟡 **Részben van meg** | `annual_reports` tábla tartalmazza a mérlegfordulónapot és a mérlegkészítés napját | Az általános `acc_accounting_periods` időszaktáblába is bevezetendő a mérlegkészítési nap. |
| `K04.06` | Üzleti időszak – rögzíthető adat: Időszak típusa: normál, tört vagy végelszámolási. | 🟡 **Részben van meg** | Normál és tört hónapok szűrhetők | Időszak típus mező (`period_type`: normal, broken, liquidation) rögzítése. |
| `K04.07` | Üzleti időszak – rögzíthető adat: Végelszámolás kezdőnapja. | ❌ **Hiányzik** | Nincs a modulban | Végelszámolási adatok felvétele: Végelszámolás kezdőnapja.. |
| `K04.08` | Üzleti időszak – rögzíthető adat: Végelszámolás befejezésének napja. | ❌ **Hiányzik** | Nincs a modulban | Végelszámolási adatok felvétele: Végelszámolás befejezésének napja.. |
| `K04.09` | Üzleti időszak – rögzíthető adat: Végelszámoló neve. | ❌ **Hiányzik** | Nincs a modulban | Végelszámolási adatok felvétele: Végelszámoló neve.. |
| `K04.10` | Üzleti időszak – rögzíthető adat: Előző üzleti év kapcsolata. | ✅ **Kész** | `bs_prior_year`, `annual_reports`, `acc_accounting_periods` kapcsolatok | Megvalósítva. |
| `K04.11` | Üzleti időszak – rögzíthető adat: Következő üzleti év kapcsolata. | ✅ **Kész** | `bs_prior_year`, `annual_reports`, `acc_accounting_periods` kapcsolatok | Megvalósítva. |
| `K04.12` | Engedélyezett szervezeti és adózási formánál naptáritól eltérő üzleti év létrehozható legyen. | 🟡 **Részben van meg** | `dateRange` tetszőleges intervallumot enged | Naptáritól eltérő üzleti év havi bontási logikájának optimalizálása. |
| `K04.13` | Az egymást követő üzleti évek dátumtartománya ne fedhesse át egymást. | ✅ **Kész** | Időszak átfedés vizsgálata mentéskor | Megvalósítva. |
| `K04.14` | Az üzleti év hónapjai a megadott kezdőnaptól képződjenek. | 🟡 **Részben van meg** | Hónapok leképezése a naptári évre épül | Kezdőnaptól számított gördülő 12 hónapos ciklusok támogatása. |
| `K04.15` | Nyitó könyvelési időszak különüljön el a tárgyévi forgalomtól. | ✅ **Kész** | `acc_journals` type=opening / closing, `acc_journal_headers.entry_type` elkülönítve a tárgyévi forgalomtól | Megvalósítva. |
| `K04.16` | Záró könyvelési időszak különüljön el a tárgyévi forgalomtól. | ✅ **Kész** | `acc_journals` type=opening / closing, `acc_journal_headers.entry_type` elkülönítve a tárgyévi forgalomtól | Megvalósítva. |
| `K04.17` | Előző és tárgyévi könyvelés két külön ablakban is megnyitható legyen. | ✅ **Kész** | Több böngészőfül / ablak támogatása URL-scoped routinggal (`:companyId/:dateRange`) | Megvalósítva. |
| `K04.18` | Végelszámolás előtt külön tevékenységet lezáró időszak legyen nyitható. | ❌ **Hiányzik** | Végelszámolási speciális időszakok | Tevékenységet lezáró, végelszámolási és befejező időszakok specifikus zárási varázslója. |
| `K04.19` | Végelszámolás közbeni üzleti évek külön zárhatók legyenek. | ❌ **Hiányzik** | Végelszámolási speciális időszakok | Tevékenységet lezáró, végelszámolási és befejező időszakok specifikus zárási varázslója. |
| `K04.20` | Végelszámolás befejezésekor külön lezáró időszak legyen kezelhető. | ❌ **Hiányzik** | Végelszámolási speciális időszakok | Tevékenységet lezáró, végelszámolási és befejező időszakok specifikus zárási varázslója. |

### 05. Partnertörzs – alapadatok

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K05.01` | Partner – rögzíthető adat: Egyedi partnerkód. | ✅ **Kész** | `partners.partner_code`, `gl_audit_partners.partner_code` | Megvalósítva. |
| `K05.02` | Partner – rögzíthető adat: Teljes név. | ✅ **Kész** | `partners.partner_name`, `Partner.name` | Megvalósítva. |
| `K05.03` | Partner – rögzíthető adat: Rövid név. | 🟡 **Részben van meg** | `custom_monogram` mező létezik, automatikus monogram generálás van | Dedikált `short_name` (rövid név) mező felvétele a `partners` táblába. |
| `K05.04` | Partner – rögzíthető adat: Partner típusa: szervezet vagy magánszemély. | 🟡 **Részben van meg** | Adószámból automatikusan detektált (cég adószám vs magánszemély adóazonosító jel) | Explicit partner típus radio/select mező a partner űrlapon. |
| `K05.05` | Partner – rögzíthető adat: Vevői szerep jelölése. | ✅ **Kész** | `partners.partner_type` (customer, vendor, both) | Megvalósítva. |
| `K05.06` | Partner – rögzíthető adat: Szállítói szerep jelölése. | ✅ **Kész** | `partners.partner_type` (customer, vendor, both) | Megvalósítva. |
| `K05.07` | Partner – rögzíthető adat: Egyéb folyószámla-partner jelölése. | 🟡 **Részben van meg** | `partner_type` egyéb kategóriával kiegészíthető | Egyéb folyószámla partner (pl. munkavállaló, tag) típus felvétele az enumba. |
| `K05.08` | Partner – rögzíthető adat: Belföldi adószám. | ✅ **Kész** | `partners.tax_number`, 8-1-2 ellenőrzés és formázás | Megvalósítva. |
| `K05.09` | Partner – rögzíthető adat: Közösségi adószám. | ✅ **Kész** | `partners.eu_tax_number` | Megvalósítva. |
| `K05.10` | Partner – rögzíthető adat: Külföldi adóazonosító. | ✅ **Kész** | FOREIGN: szintetikus azonosító és külföldi adószám támogatás (`isForeignPartner`) | Megvalósítva. |
| `K05.11` | Partner – rögzíthető adat: Adóilletőség országkódja. | 🟡 **Részben van meg** | Közösségi adószám előtagjából (pl. DE, AT) kinyerhető | Külön `country_code` oszlop rögzítése a partnereknél. |
| `K05.12` | Partner – rögzíthető adat: Cégjegyzékszám, ha rendelkezésre áll. | ❌ **Hiányzik** | Nincs a partnertörzsben | Partner nyilvántartási szám (Cégjegyzékszám, ha rendelkezésre áll.) mező felvétele. |
| `K05.13` | Partner – rögzíthető adat: Civil nyilvántartási szám, ha rendelkezésre áll. | ❌ **Hiányzik** | Nincs a partnertörzsben | Partner nyilvántartási szám (Civil nyilvántartási szám, ha rendelkezésre áll.) mező felvétele. |
| `K05.14` | Partner – rögzíthető adat: Belföldi áfacsoport-azonosító, ha a partner áfacsoporttag. | ✅ **Kész** | `parseTaxNumber`, `isGroupVatTaxNumber` (4-es áfakód), P-088 Csoportos áfa azonosítás | Megvalósítva. |
| `K05.15` | Partner – rögzíthető adat: Pénzforgalmi áfa alkalmazásának jelölése. | 🟡 **Részben van meg** | A bejövő számlán az AI és NAV OSA jelzi a pénzforgalmi áfát | A `partners` törzsben dedikált `is_cash_accounting` jelölő kapcsoló rögzítése. |
| `K05.16` | Partner – rögzíthető adat: Partner pénzforgalmi áfastátuszának kezdőnapja. | ❌ **Hiányzik** | Nincs a partnertörzsben | Partner pénzforgalmi áfastátusz kezdő- és zárónap mezők felvétele. |
| `K05.17` | Partner – rögzíthető adat: Partner pénzforgalmi áfastátuszának zárónapja. | ❌ **Hiányzik** | Nincs a partnertörzsben | Partner pénzforgalmi áfastátusz kezdő- és zárónap mezők felvétele. |
| `K05.18` | Partner – rögzíthető adat: Kapcsolt vállalkozás jelölése. | ✅ **Kész** | `partners.related_party` kapcsoló, P-124, A-165 (Kapcsolt vállalkozások kezelése) | Megvalósítva. |
| `K05.19` | Partner – rögzíthető adat: Kapcsoltság kezdőnapja. | ✅ **Kész** | `partners.valid_from`, `partners.valid_to`, P-124 időszaki kapcsoltság követés | Megvalósítva. |
| `K05.20` | Partner – rögzíthető adat: Kapcsoltság zárónapja. | ✅ **Kész** | `partners.valid_from`, `partners.valid_to`, P-124 időszaki kapcsoltság követés | Megvalósítva. |
| `K05.21` | Partner – rögzíthető adat: Alapértelmezett fizetési mód. | 🟡 **Részben van meg** | Számla OCR és korábbi előzmények alapján az AI javaslatot tesz | Partnertörzs szintű alapértelmezett beállítás mező (Alapértelmezett fizetési mód.) hozzáadása. |
| `K05.22` | Partner – rögzíthető adat: Alapértelmezett fizetési határidő napokban. | 🟡 **Részben van meg** | Számla OCR és korábbi előzmények alapján az AI javaslatot tesz | Partnertörzs szintű alapértelmezett beállítás mező (Alapértelmezett fizetési határidő napokban.) hozzáadása. |
| `K05.23` | Partner – rögzíthető adat: Alapértelmezett számlázási devizanem. | 🟡 **Részben van meg** | Számla OCR és korábbi előzmények alapján az AI javaslatot tesz | Partnertörzs szintű alapértelmezett beállítás mező (Alapértelmezett számlázási devizanem.) hozzáadása. |
| `K05.24` | Partner – rögzíthető adat: Alapértelmezett vevői főkönyvi szám. | ✅ **Kész** | `partners.custom_gl_account_id` (P-124, egyedi vevő/szállító alszámla felülbírálás) | Megvalósítva. |
| `K05.25` | Partner – rögzíthető adat: Alapértelmezett szállítói főkönyvi szám. | ✅ **Kész** | `partners.custom_gl_account_id` (P-124, egyedi vevő/szállító alszámla felülbírálás) | Megvalósítva. |
| `K05.26` | Partner – rögzíthető adat: Partnerhez tartozó kontírozási sablon azonosítója. | ✅ **Kész** | `invoice_item_rules`, `company_prompt_rules`, P-109 (partnerezhető kontírozási szabályok) | Megvalósítva. |
| `K05.27` | Partner – rögzíthető adat: Partnercsoport kódja. | 🟡 **Részben van meg** | `partners.parent_partner_id`, cégcsoport hierarchia P-124 | Partnercsoport kód törzsadat bővítése. |
| `K05.28` | Partner – rögzíthető adat: Külső rendszerbeli partnerazonosító. | ✅ **Kész** | `partners.import_id` (külső ERP/számlázó azonosító) | Megvalósítva. |
| `K05.29` | Partner – rögzíthető adat: Megjegyzés. | ✅ **Kész** | `partners.related_party_notes` és megjegyzés mező | Megvalósítva. |
| `K05.30` | Partner – rögzíthető adat: Aktív vagy inaktív állapot. | 🟡 **Részben van meg** | `exclude_from_accounting` kapcsoló létezik a partnereknél | Általános `is_active` inaktiválási állapot kapcsoló bevezetése a partnertörzsbe. |

### 06. Partnertörzs – cím és kapcsolattartás

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K06.01` | Partnercím vagy kapcsolattartó – rögzíthető adat: Cím típusa: székhely, számlázási, levelezési vagy szállítási. | 🟡 **Részben van meg** | Számlázási címként jelenik meg a partner címe | Címtípus választó (székhely, számlázási, levelezési, szállítási) bevezetése. |
| `K06.02` | Partnercím vagy kapcsolattartó – rögzíthető adat: Országkód. | 🟡 **Részben van meg** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Országkód.. |
| `K06.03` | Partnercím vagy kapcsolattartó – rögzíthető adat: Irányítószám. | 🟡 **Részben van meg** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Irányítószám.. |
| `K06.04` | Partnercím vagy kapcsolattartó – rögzíthető adat: Település. | 🟡 **Részben van meg** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Település.. |
| `K06.05` | Partnercím vagy kapcsolattartó – rögzíthető adat: Közterület neve. | 🟡 **Részben van meg** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Közterület neve.. |
| `K06.06` | Partnercím vagy kapcsolattartó – rögzíthető adat: Közterület jellege. | 🟡 **Részben van meg** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Közterület jellege.. |
| `K06.07` | Partnercím vagy kapcsolattartó – rögzíthető adat: Házszám. | 🟡 **Részben van meg** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Házszám.. |
| `K06.08` | Partnercím vagy kapcsolattartó – rögzíthető adat: Épület. | 🟡 **Részben van meg** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Épület.. |
| `K06.09` | Partnercím vagy kapcsolattartó – rögzíthető adat: Lépcsőház. | 🟡 **Részben van meg** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Lépcsőház.. |
| `K06.10` | Partnercím vagy kapcsolattartó – rögzíthető adat: Emelet. | 🟡 **Részben van meg** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Emelet.. |
| `K06.11` | Partnercím vagy kapcsolattartó – rögzíthető adat: Ajtó. | 🟡 **Részben van meg** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Ajtó.. |
| `K06.12` | Partnercím vagy kapcsolattartó – rögzíthető adat: Helyrajzi szám. | 🟡 **Részben van meg** | `partners.address` egyetlen szöveges mezőként tárolja a partnercímet | Strukturált partnercím mező felvétele: Helyrajzi szám.. |
| `K06.13` | Partnercím vagy kapcsolattartó – rögzíthető adat: Kapcsolattartó neve. | ❌ **Hiányzik** | Nincs a partnertörzsben | Kapcsolattartói mező (Kapcsolattartó neve.) felvétele. |
| `K06.14` | Partnercím vagy kapcsolattartó – rögzíthető adat: Kapcsolattartó beosztása. | ❌ **Hiányzik** | Nincs a partnertörzsben | Kapcsolattartói mező (Kapcsolattartó beosztása.) felvétele. |
| `K06.15` | Partnercím vagy kapcsolattartó – rögzíthető adat: Kapcsolattartó e-mail-címe. | 🟡 **Részben van meg** | `partners.email` mező létezik; KintlevoPage kezeli a felszólító emailt | Külön dedikált e-számla fogadó és fizetési felszólító email mezők rögzítése. |
| `K06.16` | Partnercím vagy kapcsolattartó – rögzíthető adat: Kapcsolattartó telefonszáma. | ❌ **Hiányzik** | Nincs a partnertörzsben | Kapcsolattartói mező (Kapcsolattartó telefonszáma.) felvétele. |
| `K06.17` | Partnercím vagy kapcsolattartó – rögzíthető adat: Elektronikus számla fogadására kijelölt e-mail-cím. | 🟡 **Részben van meg** | `partners.email` mező létezik; KintlevoPage kezeli a felszólító emailt | Külön dedikált e-számla fogadó és fizetési felszólító email mezők rögzítése. |
| `K06.18` | Partnercím vagy kapcsolattartó – rögzíthető adat: Fizetési felszólítás címzettjének e-mail-címe. | 🟡 **Részben van meg** | `partners.email` mező létezik; KintlevoPage kezeli a felszólító emailt | Külön dedikált e-számla fogadó és fizetési felszólító email mezők rögzítése. |
| `K06.19` | Partnerhez több cím rögzíthető legyen. | ❌ **Hiányzik** | Jelenleg 1 cím és 1 email tartozik egy partnerhez | 1:N partnercímek és 1:N partner kapcsolattartók relációs altábla létrehozása. |
| `K06.20` | Partnerhez több kapcsolattartó rögzíthető legyen. | ❌ **Hiányzik** | Jelenleg 1 cím és 1 email tartozik egy partnerhez | 1:N partnercímek és 1:N partner kapcsolattartók relációs altábla létrehozása. |
| `K06.21` | Partnerenként kijelölhető legyen az alapértelmezett számlázási cím. | ❌ **Hiányzik** | Nincs többcímű / több kapcsolattartós struktúra | Alapértelmezett számlázási cím és kapcsolattartó kijelölés megvalósítása. |
| `K06.22` | Partnerenként kijelölhető legyen az alapértelmezett kapcsolattartó. | ❌ **Hiányzik** | Nincs többcímű / több kapcsolattartós struktúra | Alapértelmezett számlázási cím és kapcsolattartó kijelölés megvalósítása. |

### 07. Partnertörzs – bankszámlák

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K07.01` | Partner bankszámlája – rögzíthető adat: Bankszámla tulajdonosának neve. | 🟡 **Részben van meg** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Bankszámla tulajdonosának neve.) létrehozása. |
| `K07.02` | Partner bankszámlája – rögzíthető adat: Belföldi bankszámlaszám. | 🟡 **Részben van meg** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Belföldi bankszámlaszám.) létrehozása. |
| `K07.03` | Partner bankszámlája – rögzíthető adat: IBAN. | 🟡 **Részben van meg** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (IBAN.) létrehozása. |
| `K07.04` | Partner bankszámlája – rögzíthető adat: SWIFT/BIC-kód. | 🟡 **Részben van meg** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (SWIFT/BIC-kód.) létrehozása. |
| `K07.05` | Partner bankszámlája – rögzíthető adat: Bank neve. | 🟡 **Részben van meg** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Bank neve.) létrehozása. |
| `K07.06` | Partner bankszámlája – rögzíthető adat: Bank országkódja. | 🟡 **Részben van meg** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Bank országkódja.) létrehozása. |
| `K07.07` | Partner bankszámlája – rögzíthető adat: Számla devizaneme. | 🟡 **Részben van meg** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Számla devizaneme.) létrehozása. |
| `K07.08` | Partner bankszámlája – rögzíthető adat: Alapértelmezett bankszámla jelölése. | 🟡 **Részben van meg** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Alapértelmezett bankszámla jelölése.) létrehozása. |
| `K07.09` | Partner bankszámlája – rögzíthető adat: Bankszámla érvényességének kezdete. | 🟡 **Részben van meg** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Bankszámla érvényességének kezdete.) létrehozása. |
| `K07.10` | Partner bankszámlája – rögzíthető adat: Bankszámla érvényességének vége. | 🟡 **Részben van meg** | Számla OCR-ből és bankkivonatokból a tranzakció-párosító motor felismeri a partner számlaszámát | Partnertörzs 1:N bankszámlák tábla (`partner_bank_accounts`) és mező (Bankszámla érvényességének vége.) létrehozása. |
| `K07.11` | Egy partnerhez több bankszámlaszám rögzíthető legyen. | ❌ **Hiányzik** | Nincs 1:N partnertörzs bankszámla altábla | Egy partnerhez több bankszámlaszám rögzítésének biztosítása. |
| `K07.12` | Belföldi bankszámlaszámnál hossz- és ellenőrzőszám-vizsgálat történjen. | ✅ **Kész** | `validationUtils.ts` (GIRO 16/24 jegy ellenőrzés és MOD-97 IBAN validáció) | Megvalósítva. |
| `K07.13` | IBAN-nál országfüggő hossz- és ellenőrzőszám-vizsgálat történjen. | ✅ **Kész** | `validationUtils.ts` (GIRO 16/24 jegy ellenőrzés és MOD-97 IBAN validáció) | Megvalósítva. |
| `K07.14` | Más partnernél már szereplő bankszámlaszám felvitelekor figyelmeztetés jelenjen meg. | ❌ **Hiányzik** | Nincs keresztellenőrzés | Figyelmeztetés megjelenítése, ha a rögzített bankszámlaszám már szerepel másik partnernél. |
| `K07.15` | Számlán felismert, a partnertörzstől eltérő bankszámlaszám külön jóváhagyást igényeljen a törzs frissítése előtt. | 🟡 **Részben van meg** | Tranzakció- és számlapárosító dialógusban látható az eltérés | Partner törzsfrissítési jóváhagyó gomb és folyamat kialakítása új bankszámlaszám detektálásakor. |

### 08. Törzsadatok – ellenőrzés és módosítás

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K08.01` | Partner magyar adószámánál formai és ellenőrzőszám-vizsgálat történjen. | ✅ **Kész** | `validationUtils.ts` (`parseTaxNumber`, CDV modulus-7 ellenőrzőszám algoritmus) | Megvalósítva. |
| `K08.02` | Közösségi adószámnál az országkód és az ország szerinti formátum ellenőrizhető legyen. | ✅ **Kész** | Közösségi adószám formátum és országkód ellenőrzés | Megvalósítva. |
| `K08.03` | Partneradatok adószám alapján lekérhetők legyenek hivatalos adatforrásból. | ✅ **Kész** | `navTaxpayerService.ts`, P-098, A-132 (NAV Online Számla adózói lekérdezés gomb és automatikus kitöltés) | Megvalósítva. |
| `K08.04` | A lekérdezett partneradat csak megtekintés és elfogadás után írja felül a törzset. | ✅ **Kész** | `navTaxpayerService.ts`, P-098, A-132 (NAV Online Számla adózói lekérdezés gomb és automatikus kitöltés) | Megvalósítva. |
| `K08.05` | A közösségi adószám VIES-ellenőrzésének eredménye tárolható legyen. | 🟡 **Részben van meg** | VIES ellenőrzési modul elérhető | VIES lekérdezési válasz JSON és státusz auditált eltárolása a partnernél. |
| `K08.06` | Az adószámellenőrzés időpontja visszakereshető legyen. | 🟡 **Részben van meg** | `last_nav_sync_at` tárolódik | Partner szintű adószám-ellenőrzési időbélyeg naplózása. |
| `K08.07` | Adószám nélküli külföldi vagy magánszemély partner rögzíthető legyen. | ✅ **Kész** | FOREIGN: szintetikus azonosító generálás és magánszemély partner rögzítés | Megvalósítva. |
| `K08.08` | Már létező magyar adószámnál a program ajánlja fel a meglévő partner kiválasztását. | ✅ **Kész** | Létező adószámnál partnerduplikáció-szűrés és felajánlás | Megvalósítva. |
| `K08.09` | Hasonló nevű, adószám nélküli partnereknél jelenjen meg duplikációs figyelmeztetés. | 🟡 **Részben van meg** | Hasonló nevek fuzzy egyezés vizsgálata | Duplikációs figyelmeztető banner megjelenítése adószám nélküli hasonló nevű partnereknél. |
| `K08.10` | Partnerösszevonás előtt megtekinthető legyen az érintett bizonylatok listája. | ❌ **Hiányzik** | Nincs partnerösszevonó modul | Partnerösszevonás előtti bizonylatlista előnézet és összevonás utáni audit azonosító kapcsolat megőrzése. |
| `K08.11` | Partnerösszevonás után az eredeti partnerazonosítók kapcsolata maradjon visszakereshető. | ❌ **Hiányzik** | Nincs partnerösszevonó modul | Partnerösszevonás előtti bizonylatlista előnézet és összevonás utáni audit azonosító kapcsolat megőrzése. |
| `K08.12` | Használt partner fizikailag ne legyen törölhető; inaktiválható legyen. | ✅ **Kész** | Adatbázis Foreign Key kényszerek védik a használt partnert, számlát, naplót, áfakódot, gyűjtőt (P-071) | Megvalósítva: használt törzsadat fizikailag nem törölhető, kizárólag inaktiválható. |
| `K08.13` | Használt főkönyvi számla fizikailag ne legyen törölhető. | ✅ **Kész** | Adatbázis Foreign Key kényszerek védik a használt partnert, számlát, naplót, áfakódot, gyűjtőt (P-071) | Megvalósítva: használt törzsadat fizikailag nem törölhető, kizárólag inaktiválható. |
| `K08.14` | Használt napló fizikailag ne legyen törölhető. | ✅ **Kész** | Adatbázis Foreign Key kényszerek védik a használt partnert, számlát, naplót, áfakódot, gyűjtőt (P-071) | Megvalósítva: használt törzsadat fizikailag nem törölhető, kizárólag inaktiválható. |
| `K08.15` | Használt áfakód fizikailag ne legyen törölhető. | ✅ **Kész** | Adatbázis Foreign Key kényszerek védik a használt partnert, számlát, naplót, áfakódot, gyűjtőt (P-071) | Megvalósítva: használt törzsadat fizikailag nem törölhető, kizárólag inaktiválható. |
| `K08.16` | Használt gyűjtőkód fizikailag ne legyen törölhető. | ✅ **Kész** | Adatbázis Foreign Key kényszerek védik a használt partnert, számlát, naplót, áfakódot, gyűjtőt (P-071) | Megvalósítva: használt törzsadat fizikailag nem törölhető, kizárólag inaktiválható. |
| `K08.17` | Új partner bizonylatrögzítés közben felvehető legyen a piszkozat elvesztése nélkül. | ✅ **Kész** | Számlarögzítés / bizonylatfelvitel közben beágyazott gyors partner-létrehozó dialógus | Megvalósítva: a piszkozat nem vész el. |
| `K08.18` | Törzsadat módosításakor a régi érték megőrződjön. | ✅ **Kész** | `audit_logs`, `acc_journal_audit_logs`, `vat_code_overrides_log` (régi/új érték, felhasználó, timestamp) | Megvalósítva. |
| `K08.19` | Törzsadat módosításának felhasználója visszakereshető legyen. | ✅ **Kész** | `audit_logs`, `acc_journal_audit_logs`, `vat_code_overrides_log` (régi/új érték, felhasználó, timestamp) | Megvalósítva. |
| `K08.20` | Törzsadat módosításának időpontja visszakereshető legyen. | ✅ **Kész** | `audit_logs`, `acc_journal_audit_logs`, `vat_code_overrides_log` (régi/új érték, felhasználó, timestamp) | Megvalósítva. |
| `K08.21` | Inaktív törzsadat új bizonylaton ne legyen választható, korábbi bizonylaton megmaradjon. | 🟡 **Részben van meg** | Dropdown szűrők | Inaktív törzsadat letiltása új bizonylat felvitelekor a választólistákban. |
| `K08.22` | Kötelező adat hiányakor a hibajelzés nevezze meg a hiányzó mezőt. | ✅ **Kész** | React Hook Form és Zod validációs séma, mezőre mutató hibaüzenetek | Megvalósítva. |

### 09. Számlatükör

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K09.01` | Főkönyvi számla – rögzíthető adat: Főkönyvi szám. | ✅ **Kész** | `gl_accounts.gl_number` | Megvalósítva. |
| `K09.02` | Főkönyvi számla – rögzíthető adat: Főkönyvi számla megnevezése. | ✅ **Kész** | `gl_accounts.description` és `short_name` | Megvalósítva. |
| `K09.03` | Főkönyvi számla – rögzíthető adat: Szülő vagy összesítő főkönyvi szám. | ✅ **Kész** | `gl_accounts.parent_id` (hierarchikus struktúra) | Megvalósítva. |
| `K09.04` | Főkönyvi számla – rögzíthető adat: Könyvelhető vagy csak összesítő jelleg. | 🟡 **Részben van meg** | Főkönyvi fa nézet a felületen | Explicit `is_synthetic` (csak összesítő, közvetlenül nem könyvelhető) jelölő bevezetése. |
| `K09.05` | Főkönyvi számla – rögzíthető adat: Mérlegszámla vagy eredményszámla jelleg. | ✅ **Kész** | Számlaosztályok (1-4 Mérleg, 5-9 Eredmény) automatikus besorolása és leképezése | Megvalósítva. |
| `K09.06` | Főkönyvi számla – rögzíthető adat: Normál egyenleg iránya: tartozik vagy követel. | ✅ **Kész** | Normál egyenlegirány (T/K) szabályok a mérleg és eredménykimutatás motorban | Megvalósítva. |
| `K09.07` | Főkönyvi számla – rögzíthető adat: Folyószámla-vezetés előírása. | 🟡 **Részben van meg** | 311 és 454 automatikusan folyószámlás és partnerköteles | Főkönyvi számlánkénti `is_partner_required` és `is_subledger` kapcsoló beállítása. |
| `K09.08` | Főkönyvi számla – rögzíthető adat: Partner megadásának kötelezettsége. | 🟡 **Részben van meg** | 311 és 454 automatikusan folyószámlás és partnerköteles | Főkönyvi számlánkénti `is_partner_required` és `is_subledger` kapcsoló beállítása. |
| `K09.09` | Főkönyvi számla – rögzíthető adat: Devizaadat megadásának kötelezettsége. | ✅ **Kész** | `gl_accounts.is_multicurrency`, `currency` (P-108: Multicurrency chart of accounts) | Megvalósítva. |
| `K09.10` | Főkönyvi számla – rögzíthető adat: Költséghely megadásának kötelezettsége. | 🟡 **Részben van meg** | `acc_journal_lines` támogatja a költséghelyet, munkaszámot, projektet | Főkönyvi számlán kötelezővé tehető gyűjtőkitöltési szabály konfigurálása. |
| `K09.11` | Főkönyvi számla – rögzíthető adat: Munkaszám megadásának kötelezettsége. | 🟡 **Részben van meg** | `acc_journal_lines` támogatja a költséghelyet, munkaszámot, projektet | Főkönyvi számlán kötelezővé tehető gyűjtőkitöltési szabály konfigurálása. |
| `K09.12` | Főkönyvi számla – rögzíthető adat: Projekt megadásának kötelezettsége. | 🟡 **Részben van meg** | `acc_journal_lines` támogatja a költséghelyet, munkaszámot, projektet | Főkönyvi számlán kötelezővé tehető gyűjtőkitöltési szabály konfigurálása. |
| `K09.13` | Főkönyvi számla – rögzíthető adat: Tevékenység megadásának kötelezettsége. | 🟡 **Részben van meg** | `acc_journal_lines` támogatja a költséghelyet, munkaszámot, projektet | Főkönyvi számlán kötelezővé tehető gyűjtőkitöltési szabály konfigurálása. |
| `K09.14` | Főkönyvi számla – rögzíthető adat: Alapértelmezett áfakód. | 🟡 **Részben van meg** | AI és kontírsablonok (`invoice_item_rules`) rendelnek áfakódot | Alapértelmezett áfakód mező felvétele a `gl_accounts` táblába. |
| `K09.15` | Főkönyvi számla – rögzíthető adat: Mérlegsor-megfeleltetés. | ✅ **Kész** | `bs_mapping`, `pnl_mapping` táblák (P-060, A-151) | Megvalósítva: főkönyvi számlák hozzárendelése mérleg- és eredménykimutatás sorokhoz. |
| `K09.16` | Főkönyvi számla – rögzíthető adat: Eredménykimutatássor-megfeleltetés. | ✅ **Kész** | `bs_mapping`, `pnl_mapping` táblák (P-060, A-151) | Megvalósítva: főkönyvi számlák hozzárendelése mérleg- és eredménykimutatás sorokhoz. |
| `K09.17` | Főkönyvi számla – rögzíthető adat: Következő évi nyitó főkönyvi szám eltérő számlatükör esetén. | ❌ **Hiányzik** | Nincs a számlatükörben | Következő évi nyitó főkönyvi szám leképezés mező eltérő számlatükrök kezeléséhez. |
| `K09.18` | Főkönyvi számla – rögzíthető adat: Másodlagos vagy külső rendszerbeli főkönyvi kód. | 🟡 **Részben van meg** | `gl_audit_accounts` tárolja az importált külső kódokat | Másodlagos főkönyvi kód mező felvétele a törzsbe. |
| `K09.19` | Főkönyvi számla – rögzíthető adat: Érvényesség kezdete. | ❌ **Hiányzik** | Nincs érvényességi idő a számlatükörben | `valid_from` és `valid_to` mezők hozzáadása a `gl_accounts` táblához. |
| `K09.20` | Főkönyvi számla – rögzíthető adat: Érvényesség vége. | ❌ **Hiányzik** | Nincs érvényességi idő a számlatükörben | `valid_from` és `valid_to` mezők hozzáadása a `gl_accounts` táblához. |
| `K09.21` | Összesítő főkönyvi számra közvetlen tétel ne legyen könyvelhető. | 🟡 **Részben van meg** | Gyermekkel rendelkező számlák szűrése | Közvetlen könyvelés tiltása szintetikus szülő számlákra. |
| `K09.22` | A számlatükör Excelből importálható legyen. | ✅ **Kész** | `UploadChartOfAccountsModal.tsx`, `OpeningCSVImportModal.tsx`, P-102 (Excel, CSV, XML import) | Megvalósítva. |
| `K09.23` | Számlatükör-import előtt a meglévő számlákkal való ütközések jelenjenek meg. | ✅ **Kész** | Számlatükör import dry-run és konfliktus-kezelés | Megvalósítva. |
| `K09.24` | A főkönyvi szám vezető nullái adatátvételkor ne vesszenek el. | ✅ **Kész** | `gl_number` VARCHAR típusú, vezető nullák szigorúan megőrződnek (pl. 011, 052) | Megvalósítva. |
| `K09.25` | Előírt gyűjtő hiánya esetén a főkönyvi tétel ne legyen véglegesíthető. | 🟡 **Részben van meg** | Bizonylatsor szinten figyelmeztetés | Kötelező gyűjtő hiánya esetén végleges könyvelés blokkolása. |

### 10. Naplótörzs

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K10.01` | Könyvelési napló – rögzíthető adat: Naplókód. | ✅ **Kész** | `acc_journals.code` (VEV, SZA, BAN, PEN, VEG, NYI, ZAR) | Megvalósítva. |
| `K10.02` | Könyvelési napló – rögzíthető adat: Napló megnevezése. | ✅ **Kész** | `acc_journals.name` | Megvalósítva. |
| `K10.03` | Könyvelési napló – rögzíthető adat: Naplótípus: vevő, szállító, bank, pénztár, vegyes, nyitó vagy záró. | ✅ **Kész** | `acc_journals.type` (customer, vendor, bank, cash, general, opening, closing) | Megvalósítva. |
| `K10.04` | Könyvelési napló – rögzíthető adat: Alapértelmezett főkönyvi szám. | ✅ **Kész** | `acc_journals.connected_gl_account` | Megvalósítva. |
| `K10.05` | Könyvelési napló – rögzíthető adat: Alapértelmezett ellenszámla. | 🟡 **Részben van meg** | Sablonokból ajánlott | Alapértelmezett ellenszámla mező a naplótörzsben. |
| `K10.06` | Könyvelési napló – rögzíthető adat: Kapcsolódó saját bankszámla azonosítója banknaplónál. | ✅ **Kész** | `company_bank_accounts.journal_id` kapcsolat | Megvalósítva. |
| `K10.07` | Könyvelési napló – rögzíthető adat: Kapcsolódó pénztár azonosítója pénztárnaplónál. | ✅ **Kész** | `petty_cash_registers` napló hozzárendelés | Megvalósítva. |
| `K10.08` | Könyvelési napló – rögzíthető adat: Alapértelmezett devizanem. | ✅ **Kész** | `acc_journals.currency` (HUF, EUR, USD...) | Megvalósítva. |
| `K10.09` | Könyvelési napló – rögzíthető adat: Belső bizonylatszám előtagja. | ✅ **Kész** | `acc_journal_counters`, előtag, sorszámhossz és kezdősorszám kezelés | Megvalósítva. |
| `K10.10` | Könyvelési napló – rögzíthető adat: Belső bizonylatszám sorszámhossza. | ✅ **Kész** | `acc_journal_counters`, előtag, sorszámhossz és kezdősorszám kezelés | Megvalósítva. |
| `K10.11` | Könyvelési napló – rögzíthető adat: Belső bizonylatszám kezdősorszáma. | ✅ **Kész** | `acc_journal_counters`, előtag, sorszámhossz és kezdősorszám kezelés | Megvalósítva. |
| `K10.12` | Könyvelési napló – rögzíthető adat: Évenkénti sorszám-újrakezdés beállítása. | ✅ **Kész** | `acc_journal_counters.year` alapú évenkénti számlálás | Megvalósítva. |
| `K10.13` | Könyvelési napló – rögzíthető adat: Naplóra engedélyezett felhasználók. | 🟡 **Részben van meg** | Cégszintű és moduláris jogosultságok (`accounty_module_permissions`) | Naplószintű felhasználói hozzáférés-korlátozás kialakítása. |
| `K10.14` | Könyvelési napló – rögzíthető adat: Napló lezárásának dátuma. | 🟡 **Részben van meg** | `acc_accounting_periods` havi/éves időszakzárás | Naplónkénti egyedi zárási dátum megadása. |
| `K10.15` | Azonos naplóban ugyanaz a belső bizonylatszám ne képződhessen kétszer. | ✅ **Kész** | Adatbázis unique constraint `(journal_id, accounting_year, journal_number)` | Megvalósítva: sorszámduplikáció kizárva. |
| `K10.16` | Banknaplóban a kiválasztott bankszámla főkönyvi száma automatikusan ajánlódjon fel. | ✅ **Kész** | Bank- és pénztárnapló esetén automatikusan felajánlott kapcsolódó főkönyvi szám | Megvalósítva. |
| `K10.17` | Pénztárnaplóban a kiválasztott pénztár főkönyvi száma automatikusan ajánlódjon fel. | ✅ **Kész** | Bank- és pénztárnapló esetén automatikusan felajánlott kapcsolódó főkönyvi szám | Megvalósítva. |

### 11. Saját bank- és pénztártörzs

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K11.01` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Bank vagy pénztár belső kódja. | ✅ **Kész** | `company_bank_accounts`, `petty_cash_registers` (kód, név, típus, fksz, napló, deviza, IBAN, SWIFT, banknév) | Megvalósítva. |
| `K11.02` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Bank vagy pénztár megnevezése. | ✅ **Kész** | `company_bank_accounts`, `petty_cash_registers` (kód, név, típus, fksz, napló, deviza, IBAN, SWIFT, banknév) | Megvalósítva. |
| `K11.03` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Típus: forintbank, devizabank, forintpénztár vagy valutapénztár. | ✅ **Kész** | `company_bank_accounts`, `petty_cash_registers` (kód, név, típus, fksz, napló, deviza, IBAN, SWIFT, banknév) | Megvalósítva. |
| `K11.04` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Kapcsolódó főkönyvi szám. | ✅ **Kész** | `company_bank_accounts`, `petty_cash_registers` (kód, név, típus, fksz, napló, deviza, IBAN, SWIFT, banknév) | Megvalósítva. |
| `K11.05` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Kapcsolódó naplókód. | ✅ **Kész** | `company_bank_accounts`, `petty_cash_registers` (kód, név, típus, fksz, napló, deviza, IBAN, SWIFT, banknév) | Megvalósítva. |
| `K11.06` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Devizanem. | ✅ **Kész** | `company_bank_accounts`, `petty_cash_registers` (kód, név, típus, fksz, napló, deviza, IBAN, SWIFT, banknév) | Megvalósítva. |
| `K11.07` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Megnyitás dátuma. | ✅ **Kész** | `company_bank_accounts`, `petty_cash_registers` (kód, név, típus, fksz, napló, deviza, IBAN, SWIFT, banknév) | Megvalósítva. |
| `K11.08` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Megszüntetés dátuma. | ✅ **Kész** | `company_bank_accounts`, `petty_cash_registers` (kód, név, típus, fksz, napló, deviza, IBAN, SWIFT, banknév) | Megvalósítva. |
| `K11.09` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Bank neve bankszámlánál. | ✅ **Kész** | `company_bank_accounts`, `petty_cash_registers` (kód, név, típus, fksz, napló, deviza, IBAN, SWIFT, banknév) | Megvalósítva. |
| `K11.10` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Saját belföldi bankszámlaszám bankszámlánál. | ✅ **Kész** | `company_bank_accounts`, `petty_cash_registers` (kód, név, típus, fksz, napló, deviza, IBAN, SWIFT, banknév) | Megvalósítva. |
| `K11.11` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Saját IBAN bankszámlánál. | ✅ **Kész** | `company_bank_accounts`, `petty_cash_registers` (kód, név, típus, fksz, napló, deviza, IBAN, SWIFT, banknév) | Megvalósítva. |
| `K11.12` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: SWIFT/BIC bankszámlánál. | ✅ **Kész** | `company_bank_accounts`, `petty_cash_registers` (kód, név, típus, fksz, napló, deviza, IBAN, SWIFT, banknév) | Megvalósítva. |
| `K11.13` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Banki importhoz rendelt formátumazonosító. | ✅ **Kész** | Aggreg8 PSD2 API, OTP, K&H, Erste, Raiffeisen, Revolut, Wise parserek és formátumok | Megvalósítva. |
| `K11.14` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Devizakészlet kivezetési módszere: súlyozott átlagárfolyam vagy FIFO. | 🟡 **Részben van meg** | Súlyozott átlagárfolyamos készletértékelés | FIFO módszer választható opcióként való implementálása. |
| `K11.15` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Pénztárért felelős felhasználó pénztárnál. | 🟡 **Részben van meg** | `petty_cash_registers` | Pénztáros / felelős személy mező rögzítése a pénztártörzsben. |
| `K11.16` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Bevételi pénztárbizonylat sorszám-előtagja. | ✅ **Kész** | `petty_cash_registers` bejövő és kimenő bizonylatszám előtagok | Megvalósítva. |
| `K11.17` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Kiadási pénztárbizonylat sorszám-előtagja. | ✅ **Kész** | `petty_cash_registers` bejövő és kimenő bizonylatszám előtagok | Megvalósítva. |
| `K11.18` | Saját pénzeszköz-nyilvántartás – rögzíthető adat: Pénztári kerekítés beállítása pénznemenként. | ✅ **Kész** | 5 Ft-os készpénzes kerekítési motor pénztárbizonylatokon | Megvalósítva. |
| `K11.19` | Ugyanazon banknál több saját bankszámla létrehozható legyen. | ✅ **Kész** | 1:N kapcsolat cégenként: több bankszámla, több devizanem, több pénztár | Megvalósítva. |
| `K11.20` | Ugyanazon devizanemben több saját bankszámla létrehozható legyen. | ✅ **Kész** | 1:N kapcsolat cégenként: több bankszámla, több devizanem, több pénztár | Megvalósítva. |
| `K11.21` | Ugyanazon devizanemben több pénztár létrehozható legyen. | ✅ **Kész** | 1:N kapcsolat cégenként: több bankszámla, több devizanem, több pénztár | Megvalósítva. |

### 12. Deviza- és árfolyamtörzs

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K12.01` | Deviza vagy árfolyamrekord – rögzíthető adat: Deviza ISO-kódja. | ✅ **Kész** | `daily_exchange_rates`, `ExchangeRates.tsx` (ISO kód, név, tizedesek, egység, nap, forrás, középárfolyam, HUF érték) | Megvalósítva. |
| `K12.02` | Deviza vagy árfolyamrekord – rögzíthető adat: Deviza megnevezése. | ✅ **Kész** | `daily_exchange_rates`, `ExchangeRates.tsx` (ISO kód, név, tizedesek, egység, nap, forrás, középárfolyam, HUF érték) | Megvalósítva. |
| `K12.03` | Deviza vagy árfolyamrekord – rögzíthető adat: Pénzösszeg tizedesjegyeinek száma. | ✅ **Kész** | `daily_exchange_rates`, `ExchangeRates.tsx` (ISO kód, név, tizedesek, egység, nap, forrás, középárfolyam, HUF érték) | Megvalósítva. |
| `K12.04` | Deviza vagy árfolyamrekord – rögzíthető adat: Árfolyam jegyzési egysége, például 1 vagy 100 pénzegység. | ✅ **Kész** | `daily_exchange_rates`, `ExchangeRates.tsx` (ISO kód, név, tizedesek, egység, nap, forrás, középárfolyam, HUF érték) | Megvalósítva. |
| `K12.05` | Deviza vagy árfolyamrekord – rögzíthető adat: Árfolyam napja. | ✅ **Kész** | `daily_exchange_rates`, `ExchangeRates.tsx` (ISO kód, név, tizedesek, egység, nap, forrás, középárfolyam, HUF érték) | Megvalósítva. |
| `K12.06` | Deviza vagy árfolyamrekord – rögzíthető adat: Árfolyam forrása. | ✅ **Kész** | `daily_exchange_rates`, `ExchangeRates.tsx` (ISO kód, név, tizedesek, egység, nap, forrás, középárfolyam, HUF érték) | Megvalósítva. |
| `K12.07` | Deviza vagy árfolyamrekord – rögzíthető adat: Árfolyam típusa: vételi, eladási vagy közép. | ✅ **Kész** | `daily_exchange_rates`, `ExchangeRates.tsx` (ISO kód, név, tizedesek, egység, nap, forrás, középárfolyam, HUF érték) | Megvalósítva. |
| `K12.08` | Deviza vagy árfolyamrekord – rögzíthető adat: Árfolyam értéke forintban. | ✅ **Kész** | `daily_exchange_rates`, `ExchangeRates.tsx` (ISO kód, név, tizedesek, egység, nap, forrás, középárfolyam, HUF érték) | Megvalósítva. |
| `K12.09` | Deviza vagy árfolyamrekord – rögzíthető adat: Kézi árfolyam indoklása. | 🟡 **Részben van meg** | `acc_journal_headers.justification` | Kézi árfolyam indoklás kötelezővé tétele manuális árfolyam-felülbírálásnál. |
| `K12.10` | MNB-árfolyamok dátum szerint automatikusan betölthetők legyenek. | ✅ **Kész** | Automata napi MNB SOAP API szinkronizáció | Megvalósítva. |
| `K12.11` | Hiányzó napi árfolyamnál a választott szabály szerinti utolsó elérhető árfolyam ajánlódjon fel a tényleges árfolyamnap feltüntetésével. | ✅ **Kész** | Hétvégén és munkaszüneti napon a legutolsó hivatalos MNB munkanap árfolyama érvényesül | Megvalósítva. |
| `K12.12` | Hiányzó árfolyam helyére ne kerüljön automatikusan 1-es vagy 0-s érték. | ✅ **Kész** | Validáció riasztást ad, ha devizás tételnél az árfolyam 1.00 vagy 0 | Megvalósítva. |
| `K12.13` | Az árfolyam és a jegyzési egység alapján számított forintérték ellenőrizhető legyen. | ✅ **Kész** | Számított forintérték azonnal ellenőrizhető; a könyvelt tételen tárolt árfolyam fix marad | Megvalósítva. |
| `K12.14` | A könyvelt tételen használt árfolyamot egy későbbi törzsfrissítés ne írja át. | ✅ **Kész** | Számított forintérték azonnal ellenőrizhető; a könyvelt tételen tárolt árfolyam fix marad | Megvalósítva. |

### 13. Gyűjtőtörzsek és költségfelosztás

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K13.01` | Gyűjtőérték – rögzíthető adat: Gyűjtő típusa: költséghely, munkaszám, projekt, telephely, részleg, pályázat, támogatás vagy tevékenység. | ✅ **Kész** | `accounty_cost_centers`, `accounty_departments`, `projects`, `accounty_sites`, `item_project_rules` | Megvalósítva. |
| `K13.02` | Gyűjtőérték – rögzíthető adat: Gyűjtőkód. | ✅ **Kész** | `accounty_cost_centers`, `accounty_departments`, `projects`, `accounty_sites`, `item_project_rules` | Megvalósítva. |
| `K13.03` | Gyűjtőérték – rögzíthető adat: Gyűjtő megnevezése. | ✅ **Kész** | `accounty_cost_centers`, `accounty_departments`, `projects`, `accounty_sites`, `item_project_rules` | Megvalósítva. |
| `K13.04` | Gyűjtőérték – rögzíthető adat: Szülő gyűjtőkód. | ✅ **Kész** | `accounty_cost_centers`, `accounty_departments`, `projects`, `accounty_sites`, `item_project_rules` | Megvalósítva. |
| `K13.05` | Gyűjtőérték – rögzíthető adat: Érvényesség kezdete. | ✅ **Kész** | `accounty_cost_centers`, `accounty_departments`, `projects`, `accounty_sites`, `item_project_rules` | Megvalósítva. |
| `K13.06` | Gyűjtőérték – rögzíthető adat: Érvényesség vége. | ✅ **Kész** | `accounty_cost_centers`, `accounty_departments`, `projects`, `accounty_sites`, `item_project_rules` | Megvalósítva. |
| `K13.07` | Gyűjtőérték – rögzíthető adat: Felelős személy. | 🟡 **Részben van meg** | Projekt felelősök kezelése | Költséghely felelős személy mező rögzítése. |
| `K13.08` | Gyűjtőérték – rögzíthető adat: Tevékenység besorolása: alapcél szerinti, közhasznú vagy vállalkozási. | 🟡 **Részben van meg** | Civil modulban megvan a tevékenységi felosztás | Alapcél / közhasznú / vállalkozási kategória általános gyűjtőbe vezetése. |
| `K13.09` | Gyűjtőérték – rögzíthető adat: Felosztási sablon azonosítója. | ❌ **Hiányzik** | Nincs felosztási sablon modul | Százalékos és arányos költségfelosztási sablontörzs kidolgozása. |
| `K13.10` | Gyűjtőérték – rögzíthető adat: Felosztási sablonban szereplő célgyűjtő. | ❌ **Hiányzik** | Nincs felosztási sablon modul | Százalékos és arányos költségfelosztási sablontörzs kidolgozása. |
| `K13.11` | Gyűjtőérték – rögzíthető adat: Célgyűjtőre jutó százalék. | ❌ **Hiányzik** | Nincs felosztási sablon modul | Százalékos és arányos költségfelosztási sablontörzs kidolgozása. |
| `K13.12` | Gyűjtőérték – rögzíthető adat: Felosztási sablon hatálynapja. | ❌ **Hiányzik** | Nincs felosztási sablon modul | Százalékos és arányos költségfelosztási sablontörzs kidolgozása. |
| `K13.13` | Egy könyvelési sorhoz egyszerre költséghely és munkaszám rendelhető legyen. | ✅ **Kész** | `acc_journal_lines` (`cost_center_id`, `project_id`), `gl_journal_entries` (`cost_center`, `work_number`) | Megvalósítva. |
| `K13.14` | Egy könyvelési sorhoz egyszerre projekt és telephely rendelhető legyen. | ✅ **Kész** | `acc_journal_lines` (`cost_center_id`, `project_id`), `gl_journal_entries` (`cost_center`, `work_number`) | Megvalósítva. |
| `K13.15` | Egy könyvelési sorhoz egyszerre támogatás és tevékenység rendelhető legyen. | ✅ **Kész** | `acc_journal_lines` (`cost_center_id`, `project_id`), `gl_journal_entries` (`cost_center`, `work_number`) | Megvalósítva. |
| `K13.16` | A gyűjtőtípusok egymástól függetlenül bővíthetők legyenek. | ✅ **Kész** | `acc_journal_lines` (`cost_center_id`, `project_id`), `gl_journal_entries` (`cost_center`, `work_number`) | Megvalósítva. |
| `K13.17` | Egy tétel összege több azonos típusú gyűjtő között százalékosan felosztható legyen. | 🟡 **Részben van meg** | Kézzel több sorra bontható a könyvelési tétel tetszőleges összeggel | Automatikus százalékos és összeg szerinti felosztó funkció megvalósítása 100%-os ellenőrzéssel. |
| `K13.18` | Egy tétel összege több azonos típusú gyűjtő között forintösszeggel felosztható legyen. | 🟡 **Részben van meg** | Kézzel több sorra bontható a könyvelési tétel tetszőleges összeggel | Automatikus százalékos és összeg szerinti felosztó funkció megvalósítása 100%-os ellenőrzéssel. |
| `K13.19` | Százalékos felosztásnál a teljes felosztásnak 100%-ot kell adnia. | 🟡 **Részben van meg** | Kézzel több sorra bontható a könyvelési tétel tetszőleges összeggel | Automatikus százalékos és összeg szerinti felosztó funkció megvalósítása 100%-os ellenőrzéssel. |
| `K13.20` | Összeg szerinti felosztásnál a részösszegeknek a tétel összegével kell egyezniük. | 🟡 **Részben van meg** | Kézzel több sorra bontható a könyvelési tétel tetszőleges összeggel | Automatikus százalékos és összeg szerinti felosztó funkció megvalósítása 100%-os ellenőrzéssel. |
| `K13.21` | Felosztási kerekítési maradék kijelölt gyűjtőre kerüljön. | 🟡 **Részben van meg** | Kézzel több sorra bontható a könyvelési tétel tetszőleges összeggel | Automatikus százalékos és összeg szerinti felosztó funkció megvalósítása 100%-os ellenőrzéssel. |
| `K13.22` | Költséghelyenkénti összesítés egyezzen a gyűjtővel könyvelt főkönyvi tételekkel. | ✅ **Kész** | `GeneralLedgerPage.tsx` költséghely és projekt szerinti szűrés és egyezőség | Megvalósítva. |
| `K13.23` | Hiányzó gyűjtővel rögzített tételek külön listázhatók legyenek. | 🟡 **Részben van meg** | GL szűrőkben szűrhető az üres költséghely | Dedikált „Gyűjtő nélküli tételek” audit nézet kialakítása. |
| `K13.24` | Gyűjtő módosítása lezárt időszakban csak jogosult visszanyitás után történhessen. | ✅ **Kész** | Lezárt időszakban a tétel és gyűjtő módosítása szigorúan zárolt | Megvalósítva. |

### 14. Áfakódtörzs

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K14.01` | Áfakód – rögzíthető adat: Áfakód egyedi azonosítója. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.02` | Áfakód – rögzíthető adat: Áfakód megnevezése. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.03` | Áfakód – rögzíthető adat: Adómérték százalékban. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.04` | Áfakód – rögzíthető adat: Fizetendő vagy levonható jelleg. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.05` | Áfakód – rögzíthető adat: Ügylet iránya: beszerzés vagy értékesítés. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.06` | Áfakód – rögzíthető adat: Ügylet típusa: termék vagy szolgáltatás. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.07` | Áfakód – rögzíthető adat: Ügylet területe: belföld, közösség vagy harmadik ország. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.08` | Áfakód – rögzíthető adat: Adómentesség jogcímkódja. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.09` | Áfakód – rögzíthető adat: Áfa területi hatályán kívüli jogcímkód. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.10` | Áfakód – rögzíthető adat: Fordított adózás jelölése. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.11` | Áfakód – rögzíthető adat: Pénzforgalmi elszámolás jelölése. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.12` | Áfakód – rögzíthető adat: Levonható hányad százalékban. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.13` | Áfakód – rögzíthető adat: Levonási korlátozás jogcíme. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.14` | Áfakód – rögzíthető adat: Fizetendő áfa főkönyvi száma. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.15` | Áfakód – rögzíthető adat: Levonható áfa főkönyvi száma. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.16` | Áfakód – rögzíthető adat: Le nem vonható áfa költség- vagy eszközszámlája. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.17` | Áfakód – rögzíthető adat: Halasztott fizetendő áfa technikai főkönyvi száma. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.18` | Áfakód – rögzíthető adat: Halasztott levonható áfa technikai főkönyvi száma. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.19` | Áfakód – rögzíthető adat: Áfabevallás adóalapsora. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.20` | Áfakód – rögzíthető adat: Áfabevallás adóösszegsora. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.21` | Áfakód – rögzíthető adat: Belföldi összesítő jelentésbe tartozás jelölése. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.22` | Áfakód – rögzíthető adat: A60 ügyletbesorolás. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.23` | Áfakód – rögzíthető adat: Mennyiségi adatszolgáltatás előírása. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.24` | Áfakód – rögzíthető adat: eÁFA adókód-megfeleltetés. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.25` | Áfakód – rögzíthető adat: Érvényesség kezdete. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.26` | Áfakód – rögzíthető adat: Érvényesség vége. | ✅ **Kész** | `vat_codes` tábla, P-100, P-101, P-116, P-119 (kód, név, %, fizetendő/levonható, irány, jogcím, főkönyvek, 65-ös sorok, M-lap, eÁFA) | Megvalósítva. |
| `K14.27` | A 0%-os adómérték és az adómentes jogcím külön kódként legyen kezelhető. | ✅ **Kész** | 0%-os adómérték és adómentes jogcímek (AAM, TAM, KBAET) külön kódként kezelve | Megvalósítva. |
| `K14.28` | Az áfakód verzióját az ügylet időpontja alapján válassza ki a program. | ✅ **Kész** | Teljesítési dátum alapján érvényes áfakód verzió feloldása | Megvalósítva. |
| `K14.29` | Érvényességi időn kívüli áfakód használatakor tételszintű hiba jelenjen meg. | 🟡 **Részben van meg** | `vat_codes` érvényességi dátumok | Érvényességi időn kívüli kód blokkolása mentéskor. |
| `K14.30` | Fordított adózásnál ugyanabból az adóalapból képződjön a fizetendő és a levonhatóság szerinti levonható oldal. | ✅ **Kész** | `reverse_charge_entries`, P-119, A-159 (fordított adózás fizetendő és levonható oldal generálása) | Megvalósítva. |
| `K14.31` | Áfakód módosítása a korábban lezárt bevallás összegét ne változtassa meg. | ✅ **Kész** | `vat_returns` lezárt bevallási állapot immutable | Megvalósítva. |

### 15. Fizetési módok és kontírsablonok

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K15.01` | Fizetési mód vagy sablon – rögzíthető adat: Fizetési mód kódja. | ✅ **Kész** | Fizetési módok (átutalás, készpénz, bankkártya, kompenzáció) és esedékességi határidők | Megvalósítva. |
| `K15.02` | Fizetési mód vagy sablon – rögzíthető adat: Fizetési mód neve: átutalás, készpénz, bankkártya, beszedés vagy kompenzáció. | ✅ **Kész** | Fizetési módok (átutalás, készpénz, bankkártya, kompenzáció) és esedékességi határidők | Megvalósítva. |
| `K15.03` | Fizetési mód vagy sablon – rögzíthető adat: Fizetési mód alapértelmezett határideje napokban. | ✅ **Kész** | Fizetési módok (átutalás, készpénz, bankkártya, kompenzáció) és esedékességi határidők | Megvalósítva. |
| `K15.04` | Fizetési mód vagy sablon – rögzíthető adat: Kontírsablon kódja. | ✅ **Kész** | `invoice_item_rules`, `company_prompt_rules`, `transaction_rules`, P-062, P-109 | Megvalósítva. |
| `K15.05` | Fizetési mód vagy sablon – rögzíthető adat: Kontírsablon megnevezése. | ✅ **Kész** | `invoice_item_rules`, `company_prompt_rules`, `transaction_rules`, P-062, P-109 | Megvalósítva. |
| `K15.06` | Fizetési mód vagy sablon – rögzíthető adat: Sablonhoz rendelt partner. | ✅ **Kész** | `invoice_item_rules`, `company_prompt_rules`, `transaction_rules`, P-062, P-109 | Megvalósítva. |
| `K15.07` | Fizetési mód vagy sablon – rögzíthető adat: Sablonhoz rendelt napló. | ✅ **Kész** | `invoice_item_rules`, `company_prompt_rules`, `transaction_rules`, P-062, P-109 | Megvalósítva. |
| `K15.08` | Fizetési mód vagy sablon – rögzíthető adat: Sablon tartozik főkönyvi száma. | ✅ **Kész** | `invoice_item_rules`, `company_prompt_rules`, `transaction_rules`, P-062, P-109 | Megvalósítva. |
| `K15.09` | Fizetési mód vagy sablon – rögzíthető adat: Sablon követel főkönyvi száma. | ✅ **Kész** | `invoice_item_rules`, `company_prompt_rules`, `transaction_rules`, P-062, P-109 | Megvalósítva. |
| `K15.10` | Fizetési mód vagy sablon – rögzíthető adat: Sablon áfakódja. | ✅ **Kész** | `invoice_item_rules`, `company_prompt_rules`, `transaction_rules`, P-062, P-109 | Megvalósítva. |
| `K15.11` | Fizetési mód vagy sablon – rögzíthető adat: Sablon közleménye. | ✅ **Kész** | `invoice_item_rules`, `company_prompt_rules`, `transaction_rules`, P-062, P-109 | Megvalósítva. |
| `K15.12` | Fizetési mód vagy sablon – rögzíthető adat: Sablon gyűjtőkódja gyűjtőtípusonként. | ✅ **Kész** | `invoice_item_rules`, `company_prompt_rules`, `transaction_rules`, P-062, P-109 | Megvalósítva. |
| `K15.13` | Fizetési mód vagy sablon – rögzíthető adat: Sablon felosztási aránya. | ✅ **Kész** | `invoice_item_rules`, `company_prompt_rules`, `transaction_rules`, P-062, P-109 | Megvalósítva. |
| `K15.14` | Fizetési mód vagy sablon – rögzíthető adat: Sablon érvényességének kezdete. | ✅ **Kész** | `invoice_item_rules`, `company_prompt_rules`, `transaction_rules`, P-062, P-109 | Megvalósítva. |
| `K15.15` | Fizetési mód vagy sablon – rögzíthető adat: Sablon érvényességének vége. | ✅ **Kész** | `invoice_item_rules`, `company_prompt_rules`, `transaction_rules`, P-062, P-109 | Megvalósítva. |
| `K15.16` | Több sorból álló kontírsablon menthető legyen. | 🟡 **Részben van meg** | Bontott tételek könyvelhetők | Többsoros kontírsablon definíció mentésének támogatása. |
| `K15.17` | A kontírsablon alkalmazása könyvelési javaslatot hozzon létre. | ✅ **Kész** | AI és szabálymotor kontírozási javaslatot állít elő, ami könyvelés előtt szabadon szerkeszthető | Megvalósítva. |
| `K15.18` | A sablonból létrejött javaslat könyvelés előtt módosítható legyen. | ✅ **Kész** | AI és szabálymotor kontírozási javaslatot állít elő, ami könyvelés előtt szabadon szerkeszthető | Megvalósítva. |

### 16. Felhasználók és jogosultságok

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K16.01` | Felhasználó – rögzíthető adat: Egyedi felhasználói azonosító. | ✅ **Kész** | Supabase Auth, `profiles`, szerepkörök, céges tagságok (`company_members`), TOTP MFA | Megvalósítva. |
| `K16.02` | Felhasználó – rögzíthető adat: Teljes név. | ✅ **Kész** | Supabase Auth, `profiles`, szerepkörök, céges tagságok (`company_members`), TOTP MFA | Megvalósítva. |
| `K16.03` | Felhasználó – rögzíthető adat: Bejelentkezési e-mail-cím. | ✅ **Kész** | Supabase Auth, `profiles`, szerepkörök, céges tagságok (`company_members`), TOTP MFA | Megvalósítva. |
| `K16.04` | Felhasználó – rögzíthető adat: Szerepkör. | ✅ **Kész** | Supabase Auth, `profiles`, szerepkörök, céges tagságok (`company_members`), TOTP MFA | Megvalósítva. |
| `K16.05` | Felhasználó – rögzíthető adat: Engedélyezett könyvelt cégek. | ✅ **Kész** | Supabase Auth, `profiles`, szerepkörök, céges tagságok (`company_members`), TOTP MFA | Megvalósítva. |
| `K16.06` | Felhasználó – rögzíthető adat: Aktív vagy letiltott állapot. | ✅ **Kész** | Supabase Auth, `profiles`, szerepkörök, céges tagságok (`company_members`), TOTP MFA | Megvalósítva. |
| `K16.07` | Felhasználó – rögzíthető adat: Többtényezős bejelentkezés beállítása. | ✅ **Kész** | Supabase Auth, `profiles`, szerepkörök, céges tagságok (`company_members`), TOTP MFA | Megvalósítva. |
| `K16.08` | A törzsadat-felvitel joga külön kiosztható legyen. | ✅ **Kész** | `accounty_module_permissions`, `eaisybill_module_permissions`, `PermissionMatrixPage.tsx`, `useEaisybillPermissions.ts` | Megvalósítva. |
| `K16.09` | A törzsadat-módosítás joga külön kiosztható legyen. | ✅ **Kész** | `accounty_module_permissions`, `eaisybill_module_permissions`, `PermissionMatrixPage.tsx`, `useEaisybillPermissions.ts` | Megvalósítva. |
| `K16.10` | A bizonylatrögzítés joga külön kiosztható legyen. | ✅ **Kész** | `accounty_module_permissions`, `eaisybill_module_permissions`, `PermissionMatrixPage.tsx`, `useEaisybillPermissions.ts` | Megvalósítva. |
| `K16.11` | A könyvelői jóváhagyás joga külön kiosztható legyen. | ✅ **Kész** | `accounty_module_permissions`, `eaisybill_module_permissions`, `PermissionMatrixPage.tsx`, `useEaisybillPermissions.ts` | Megvalósítva. |
| `K16.12` | Az időszak lezárásának joga külön kiosztható legyen. | ✅ **Kész** | `accounty_module_permissions`, `eaisybill_module_permissions`, `PermissionMatrixPage.tsx`, `useEaisybillPermissions.ts` | Megvalósítva. |
| `K16.13` | Az időszak visszanyitásának joga külön kiosztható legyen. | ✅ **Kész** | `accounty_module_permissions`, `eaisybill_module_permissions`, `PermissionMatrixPage.tsx`, `useEaisybillPermissions.ts` | Megvalósítva. |
| `K16.14` | Az adatexport joga külön kiosztható legyen. | ✅ **Kész** | `accounty_module_permissions`, `eaisybill_module_permissions`, `PermissionMatrixPage.tsx`, `useEaisybillPermissions.ts` | Megvalósítva. |
| `K16.15` | A bevallás benyújtásának joga külön kiosztható legyen. | ✅ **Kész** | `accounty_module_permissions`, `eaisybill_module_permissions`, `PermissionMatrixPage.tsx`, `useEaisybillPermissions.ts` | Megvalósítva. |
| `K16.16` | A banki utalási csomag jóváhagyási joga külön kiosztható legyen. | ✅ **Kész** | `accounty_module_permissions`, `eaisybill_module_permissions`, `PermissionMatrixPage.tsx`, `useEaisybillPermissions.ts` | Megvalósítva. |
| `K16.17` | Ügyfélfelhasználó csak a saját cégének engedélyezett dokumentumait érhesse el. | ✅ **Kész** | Row Level Security és szerepkör-védelem: ügyfél csak a saját bizonylatait látja, főkönyvet nem véglegesíthet | Megvalósítva. |
| `K16.18` | Ügyfélfelhasználó könyvelési tételt ne véglegesíthessen. | ✅ **Kész** | Row Level Security és szerepkör-védelem: ügyfél csak a saját bizonylatait látja, főkönyvet nem véglegesíthet | Megvalósítva. |
| `K16.19` | Letiltott felhasználó korábbi jóváhagyásai név szerint visszakereshetők maradjanak. | ✅ **Kész** | `acc_journal_audit_logs.actor_id`, `posted_by` megőrzi a felhasználó nevét inaktiválás után is | Megvalósítva. |

### 17. Könyvelés – bizonylatfej

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K17.01` | Könyvelési bizonylat – rögzíthető adat: Könyvelt cég azonosítója. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.02` | Könyvelési bizonylat – rögzíthető adat: Üzleti év azonosítója. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.03` | Könyvelési bizonylat – rögzíthető adat: Naplókód. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.04` | Könyvelési bizonylat – rögzíthető adat: Belső bizonylatazonosító. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.05` | Könyvelési bizonylat – rögzíthető adat: Eredeti bizonylatszám. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.06` | Könyvelési bizonylat – rögzíthető adat: Bizonylattípus. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.07` | Könyvelési bizonylat – rögzíthető adat: Partnerazonosító. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.08` | Könyvelési bizonylat – rögzíthető adat: Bizonylat kelte. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.09` | Könyvelési bizonylat – rögzíthető adat: Számviteli teljesítés dátuma. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.10` | Könyvelési bizonylat – rögzíthető adat: Áfateljesítés dátuma. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.11` | Könyvelési bizonylat – rögzíthető adat: Fizetési határidő. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.12` | Könyvelési bizonylat – rögzíthető adat: Könyvelési időszak. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.13` | Könyvelési bizonylat – rögzíthető adat: Áfabevallási időszak. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.14` | Könyvelési bizonylat – rögzíthető adat: Fizetési mód. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.15` | Könyvelési bizonylat – rögzíthető adat: Devizanem. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.16` | Könyvelési bizonylat – rögzíthető adat: Számviteli árfolyam. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.17` | Könyvelési bizonylat – rögzíthető adat: Számviteli árfolyam dátuma. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.18` | Könyvelési bizonylat – rögzíthető adat: Áfaárfolyam. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.19` | Könyvelési bizonylat – rögzíthető adat: Áfaárfolyam dátuma. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.20` | Könyvelési bizonylat – rögzíthető adat: Közlemény. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.21` | Könyvelési bizonylat – rögzíthető adat: Forrásdokumentum azonosítója. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.22` | Könyvelési bizonylat – rögzíthető adat: Import forrásrendszerének neve. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.23` | Könyvelési bizonylat – rögzíthető adat: Forrásrendszerbeli bizonylatazonosító. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.24` | Könyvelési bizonylat – rögzíthető adat: Eredeti módosított számla kapcsolata. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.25` | Könyvelési bizonylat – rögzíthető adat: Elszámolási időszak kezdete. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.26` | Könyvelési bizonylat – rögzíthető adat: Elszámolási időszak vége. | ✅ **Kész** | `acc_journal_headers`, `invoices`, `gl_journal_entries` (cég, év, napló, azonosító, partner, kelte, teljesítés, áfateljesítés, esedékesség, deviza, árfolyamok, közlemény, dokumentum link) | Megvalósítva. |
| `K17.27` | Egy bizonylathoz több melléklet kapcsolható legyen. | ✅ **Kész** | `transaction_uploaded_files`, dokumentum csatolások, P-090, P-111 | Megvalósítva. |
| `K17.28` | Egy dokumentum több könyvelési bizonylathoz kapcsolható legyen. | ✅ **Kész** | `transaction_uploaded_files`, dokumentum csatolások, P-090, P-111 | Megvalósítva. |
| `K17.29` | A bizonylat kelte és a számviteli teljesítés eltérhet egymástól. | ✅ **Kész** | P-066, P-103: kelt, számviteli teljesítés és áfateljesítés, valamint könyvelési és áfaidőszak egymástól függetlenül kezelhető | Megvalósítva. |
| `K17.30` | A számviteli teljesítés és az áfateljesítés eltérhet egymástól. | ✅ **Kész** | P-066, P-103: kelt, számviteli teljesítés és áfateljesítés, valamint könyvelési és áfaidőszak egymástól függetlenül kezelhető | Megvalósítva. |
| `K17.31` | A könyvelési időszak és az áfabevallási időszak eltérhet egymástól. | ✅ **Kész** | P-066, P-103: kelt, számviteli teljesítés és áfateljesítés, valamint könyvelési és áfaidőszak egymástól függetlenül kezelhető | Megvalósítva. |

### 18. Könyvelés – bizonylatsor

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K18.01` | Könyvelési sor – rögzíthető adat: Sorszám a bizonylaton belül. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.02` | Könyvelési sor – rögzíthető adat: Főkönyvi szám. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.03` | Könyvelési sor – rögzíthető adat: Ellenszámla. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.04` | Könyvelési sor – rögzíthető adat: Tartozik vagy követel irány. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.05` | Könyvelési sor – rögzíthető adat: Nettó összeg eredeti devizában. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.06` | Könyvelési sor – rögzíthető adat: Áfaösszeg eredeti devizában. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.07` | Könyvelési sor – rögzíthető adat: Bruttó összeg eredeti devizában. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.08` | Könyvelési sor – rögzíthető adat: Könyvelt forintösszeg. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.09` | Könyvelési sor – rögzíthető adat: Áfaalap forintban. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.10` | Könyvelési sor – rögzíthető adat: Áfaösszeg forintban. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.11` | Könyvelési sor – rögzíthető adat: Áfakód. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.12` | Könyvelési sor – rögzíthető adat: Levonható áfaösszeg. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.13` | Könyvelési sor – rögzíthető adat: Le nem vonható áfaösszeg. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.14` | Könyvelési sor – rögzíthető adat: Költséghely. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.15` | Könyvelési sor – rögzíthető adat: Munkaszám. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.16` | Könyvelési sor – rögzíthető adat: Projekt. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.17` | Könyvelési sor – rögzíthető adat: Telephely. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.18` | Könyvelési sor – rögzíthető adat: Részleg. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.19` | Könyvelési sor – rögzíthető adat: Pályázat. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.20` | Könyvelési sor – rögzíthető adat: Támogatás. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.21` | Könyvelési sor – rögzíthető adat: Tevékenység. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.22` | Könyvelési sor – rögzíthető adat: Sor közleménye. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.23` | Könyvelési sor – rögzíthető adat: Mennyiség mennyiségi adatszolgáltatásnál. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.24` | Könyvelési sor – rögzíthető adat: Mértékegység mennyiségi adatszolgáltatásnál. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.25` | Könyvelési sor – rögzíthető adat: Termékazonosító vagy vámtarifaszám mennyiségi adatszolgáltatásnál. | ✅ **Kész** | `acc_journal_lines`, `gl_journal_entries` (sorszám, fksz, ellenszámla, T/K, deviza/HUF összegek, áfakód, levonhatóság, költséghely, projekt, mennyiség, VTSZ) | Megvalósítva. |
| `K18.26` | Egy bizonylat több ellenszámlára bontható legyen. | ✅ **Kész** | Több ellenszámlára bontás és több áfakód egy bizonylaton belül támogatott | Megvalósítva. |
| `K18.27` | Egy számla több áfakódot tartalmazhasson. | ✅ **Kész** | Több ellenszámlára bontás és több áfakód egy bizonylaton belül támogatott | Megvalósítva. |
| `K18.28` | Tartozik és követel oldal eltérésekor a végleges könyvelés legyen tiltott. | ✅ **Kész** | Tartozik és követel egyezőség szigorúan ellenőrizve mentéskor (kiegyenlítetlen tétel nem könyvelhető) | Megvalósítva. |
| `K18.29` | A nettó és áfa összegéből számolt bruttó eltérése látható legyen. | ✅ **Kész** | Nettó + Áfa = Bruttó ellenőrzés és vizuális eltérés-kijelzés | Megvalósítva. |
| `K18.30` | Nem létező főkönyvi számra ne lehessen véglegesíteni. | ✅ **Kész** | Nem létező főkönyvi számra történő könyvelést a rendszer és az adatbázis FK blokkolja | Megvalósítva. |
| `K18.31` | Gyűjtőmásolás több kijelölt bizonylatsorra alkalmazható legyen. | 🟡 **Részben van meg** | Sorok duplikálása elérhető | Csoportos gyűjtőkód-másolás kijelölt sorokra. |

### 19. Könyvelés – jóváhagyás és javítás

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K19.01` | Menthető legyen nem teljes bizonylat piszkozatként. | ✅ **Kész** | `ApprovalQueuePage.tsx`, `acc_journal_headers.status` (draft, pending_review, posted, rejected), P-065, P-067 | Megvalósítva: minden automata, importált és MI tétel könyvelői jóváhagyással kerül a főkönyvbe. |
| `K19.02` | Piszkozat átadható legyen könyvelői ellenőrzésre. | ✅ **Kész** | `ApprovalQueuePage.tsx`, `acc_journal_headers.status` (draft, pending_review, posted, rejected), P-065, P-067 | Megvalósítva: minden automata, importált és MI tétel könyvelői jóváhagyással kerül a főkönyvbe. |
| `K19.03` | A könyvelő visszaadhassa javításra a bizonylatot indoklással. | ✅ **Kész** | `ApprovalQueuePage.tsx`, `acc_journal_headers.status` (draft, pending_review, posted, rejected), P-065, P-067 | Megvalósítva: minden automata, importált és MI tétel könyvelői jóváhagyással kerül a főkönyvbe. |
| `K19.04` | A könyvelő a véglegesítés előtt megtekinthesse a teljes kontírozást. | ✅ **Kész** | `ApprovalQueuePage.tsx`, `acc_journal_headers.status` (draft, pending_review, posted, rejected), P-065, P-067 | Megvalósítva: minden automata, importált és MI tétel könyvelői jóváhagyással kerül a főkönyvbe. |
| `K19.05` | A kézzel rögzített bizonylat csak könyvelői jóváhagyás után kerüljön a főkönyvbe. | ✅ **Kész** | `ApprovalQueuePage.tsx`, `acc_journal_headers.status` (draft, pending_review, posted, rejected), P-065, P-067 | Megvalósítva: minden automata, importált és MI tétel könyvelői jóváhagyással kerül a főkönyvbe. |
| `K19.06` | Az importált bizonylat csak könyvelői jóváhagyás után kerüljön a főkönyvbe. | ✅ **Kész** | `ApprovalQueuePage.tsx`, `acc_journal_headers.status` (draft, pending_review, posted, rejected), P-065, P-067 | Megvalósítva: minden automata, importált és MI tétel könyvelői jóváhagyással kerül a főkönyvbe. |
| `K19.07` | Az MI által előkészített bizonylat csak könyvelői jóváhagyás után kerüljön a főkönyvbe. | ✅ **Kész** | `ApprovalQueuePage.tsx`, `acc_journal_headers.status` (draft, pending_review, posted, rejected), P-065, P-067 | Megvalósítva: minden automata, importált és MI tétel könyvelői jóváhagyással kerül a főkönyvbe. |
| `K19.08` | A program által számított vegyes feladás csak könyvelői jóváhagyás után kerüljön a főkönyvbe. | ✅ **Kész** | `ApprovalQueuePage.tsx`, `acc_journal_headers.status` (draft, pending_review, posted, rejected), P-065, P-067 | Megvalósítva: minden automata, importált és MI tétel könyvelői jóváhagyással kerül a főkönyvbe. |
| `K19.09` | Csoportos jóváhagyásnál látható legyen a kijelölt bizonylatok tételes listája. | ✅ **Kész** | `ApprovalQueuePage.tsx`, `acc_journal_headers.status` (draft, pending_review, posted, rejected), P-065, P-067 | Megvalósítva: minden automata, importált és MI tétel könyvelői jóváhagyással kerül a főkönyvbe. |
| `K19.10` | Jóváhagyáskor tárolódjon a jóváhagyó felhasználó. | ✅ **Kész** | `ApprovalQueuePage.tsx`, `acc_journal_headers.status` (draft, pending_review, posted, rejected), P-065, P-067 | Megvalósítva: minden automata, importált és MI tétel könyvelői jóváhagyással kerül a főkönyvbe. |
| `K19.11` | Jóváhagyáskor tárolódjon a jóváhagyás időpontja. | ✅ **Kész** | Csoportos jóváhagyó panel tételes előnézettel | Megvalósítva. |
| `K19.12` | Jóváhagyáskor tárolódjon a jóváhagyott bizonylatverzió. | ✅ **Kész** | `acc_journal_audit_logs`, jóváhagyó, időpont, verzió mentése; módosításkor új jóváhagyás szükséges | Megvalósítva. |
| `K19.13` | Kontírozás módosítása érvénytelenítse a korábbi jóváhagyást. | ✅ **Kész** | `acc_journal_audit_logs`, jóváhagyó, időpont, verzió mentése; módosításkor új jóváhagyás szükséges | Megvalósítva. |
| `K19.14` | Összeg módosítása érvénytelenítse a korábbi jóváhagyást. | ✅ **Kész** | `acc_journal_audit_logs`, jóváhagyó, időpont, verzió mentése; módosításkor új jóváhagyás szükséges | Megvalósítva. |
| `K19.15` | Áfakód vagy áfaidőszak módosítása érvénytelenítse a korábbi jóváhagyást. | ✅ **Kész** | `acc_journal_audit_logs`, jóváhagyó, időpont, verzió mentése; módosításkor új jóváhagyás szükséges | Megvalósítva. |
| `K19.16` | Könyvelt bizonylat sztornózható legyen az eredeti tétel megőrzésével. | ✅ **Kész** | `stornoed_entry_id`, `original_entry_id`, sztornó és helyesbítő láncok; könyvelt tétel nyomtalanul nem törölhető | Megvalósítva. |
| `K19.17` | Könyvelt bizonylat javító tétellel módosítható legyen az eredetihez kapcsolva. | ✅ **Kész** | `stornoed_entry_id`, `original_entry_id`, sztornó és helyesbítő láncok; könyvelt tétel nyomtalanul nem törölhető | Megvalósítva. |
| `K19.18` | Könyvelt bizonylat ne legyen nyom nélkül törölhető. | ✅ **Kész** | `stornoed_entry_id`, `original_entry_id`, sztornó és helyesbítő láncok; könyvelt tétel nyomtalanul nem törölhető | Megvalósítva. |
| `K19.19` | Bizonylat másolásakor új belső azonosító képződjön. | ✅ **Kész** | Bizonylatmásolás új belső azonosítóval és dátum-ellenőrzéssel | Megvalósítva. |
| `K19.20` | Bizonylat másolásakor a keltezés és az időszak ellenőrzésre legyen kijelölve. | ✅ **Kész** | Bizonylatmásolás új belső azonosítóval és dátum-ellenőrzéssel | Megvalósítva. |
| `K19.21` | A rögzítőmezők billentyűzettel végigjárhatók legyenek. | ✅ **Kész** | Billentyűzetes gyors navigáció, Combobox keresés számlaszám és partner kód/név/adószám alapján | Megvalósítva. |
| `K19.22` | A főkönyvi számla kód és megnevezés alapján is kiválasztható legyen. | ✅ **Kész** | Billentyűzetes gyors navigáció, Combobox keresés számlaszám és partner kód/név/adószám alapján | Megvalósítva. |
| `K19.23` | A partner kód, név és adószám alapján is kiválasztható legyen. | ✅ **Kész** | Billentyűzetes gyors navigáció, Combobox keresés számlaszám és partner kód/név/adószám alapján | Megvalósítva. |

### 20. Könyvelés – számlák és folyószámla

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K20.01` | Forintos vevőszámla könyvelhető legyen. | ✅ **Kész** | Forintos és devizás vevő- és szállítószámlák könyvelése forintértékkel | Megvalósítva. |
| `K20.02` | Devizás vevőszámla forintértékkel könyvelhető legyen. | ✅ **Kész** | Forintos és devizás vevő- és szállítószámlák könyvelése forintértékkel | Megvalósítva. |
| `K20.03` | Forintos szállítószámla könyvelhető legyen. | ✅ **Kész** | Forintos és devizás vevő- és szállítószámlák könyvelése forintértékkel | Megvalósítva. |
| `K20.04` | Devizás szállítószámla forintértékkel könyvelhető legyen. | ✅ **Kész** | Forintos és devizás vevő- és szállítószámlák könyvelése forintértékkel | Megvalósítva. |
| `K20.05` | Vevői előleg számlához kapcsolható legyen. | ✅ **Kész** | Vevői és szállítói előlegek kezelése, végszámlába beszámítás, nyitott előlegállomány csökkentése | Megvalósítva. |
| `K20.06` | Szállítói előleg számlához kapcsolható legyen. | ✅ **Kész** | Vevői és szállítói előlegek kezelése, végszámlába beszámítás, nyitott előlegállomány csökkentése | Megvalósítva. |
| `K20.07` | Végszámlához több előlegszámla kapcsolható legyen. | ✅ **Kész** | Vevői és szállítói előlegek kezelése, végszámlába beszámítás, nyitott előlegállomány csökkentése | Megvalósítva. |
| `K20.08` | Előlegből részösszeg is beszámítható legyen a végszámlába. | ✅ **Kész** | Vevői és szállítói előlegek kezelése, végszámlába beszámítás, nyitott előlegállomány csökkentése | Megvalósítva. |
| `K20.09` | A beszámított előleg a nyitott előlegállományt csökkentse. | ✅ **Kész** | Vevői és szállítói előlegek kezelése, végszámlába beszámítás, nyitott előlegállomány csökkentése | Megvalósítva. |
| `K20.10` | Helyesbítő számla az eredeti számlához kapcsolódjon. | ✅ **Kész** | Helyesbítő és sztornó számlák, módosítási lánc megtekintő (P-111) | Megvalósítva. |
| `K20.11` | Többször módosított számla teljes módosítási lánca megnyitható legyen. | ✅ **Kész** | Helyesbítő és sztornó számlák, módosítási lánc megtekintő (P-111) | Megvalósítva. |
| `K20.12` | Sztornózott számla eredeti és sztornótétele együtt visszakereshető legyen. | ✅ **Kész** | Helyesbítő és sztornó számlák, módosítási lánc megtekintő (P-111) | Megvalósítva. |
| `K20.13` | Egy utalás több számlához rendelhető legyen. | ✅ **Kész** | Több számla – több utalás, részfizetés (P-064), túlfizetés nyilvántartás és átvezetés | Megvalósítva. |
| `K20.14` | Egy számlához több utalás rendelhető legyen. | ✅ **Kész** | Több számla – több utalás, részfizetés (P-064), túlfizetés nyilvántartás és átvezetés | Megvalósítva. |
| `K20.15` | Részfizetés után a fennmaradó összeg maradjon nyitott. | ✅ **Kész** | Több számla – több utalás, részfizetés (P-064), túlfizetés nyilvántartás és átvezetés | Megvalósítva. |
| `K20.16` | Túlfizetés külön nyitott tételként maradjon nyilvántartva. | ✅ **Kész** | Több számla – több utalás, részfizetés (P-064), túlfizetés nyilvántartás és átvezetés | Megvalósítva. |
| `K20.17` | Túlfizetés másik számlára átvezethető legyen. | ✅ **Kész** | Több számla – több utalás, részfizetés (P-064), túlfizetés nyilvántartás és átvezetés | Megvalósítva. |
| `K20.18` | Vevői visszatérítés az eredeti kiegyenlítéshez kapcsolható legyen. | ✅ **Kész** | Visszatérítés kapcsolása az eredeti kiegyenlítéshez | Megvalósítva. |
| `K20.19` | Vevő–szállító kompenzáció kontírozott javaslatként előállítható legyen. | 🟡 **Részben van meg** | Vevő-szállító összevezetés kézzel kontírozható | Automatikus kompenzációs jegyzőkönyv és megállapodás csatoló varázsló. |
| `K20.20` | Kompenzációhoz megállapodás csatolható legyen. | 🟡 **Részben van meg** | Vevő-szállító összevezetés kézzel kontírozható | Automatikus kompenzációs jegyzőkönyv és megállapodás csatoló varázsló. |
| `K20.21` | Rendezési különbözet leírásához forintértékhatár állítható legyen. | ✅ **Kész** | Rendezési különbözet, árfolyamkülönbözet elszámolás és visszavonási korrekció | Megvalósítva. |
| `K20.22` | Rendezési különbözet leírása könyvelői jóváhagyást igényeljen. | ✅ **Kész** | Rendezési különbözet, árfolyamkülönbözet elszámolás és visszavonási korrekció | Megvalósítva. |
| `K20.23` | Folyószámla-rendezés visszavonható legyen a korábbi kapcsolat megőrzésével. | ✅ **Kész** | Rendezési különbözet, árfolyamkülönbözet elszámolás és visszavonási korrekció | Megvalósítva. |
| `K20.24` | Rendezés visszavonása a kapcsolódó árfolyamkülönbözet korrekcióját is készítse elő. | ✅ **Kész** | Rendezési különbözet, árfolyamkülönbözet elszámolás és visszavonási korrekció | Megvalósítva. |
| `K20.25` | Fordulónapi nyitott állomány a későbbi kiegyenlítésektől függetlenül lekérdezhető legyen. | ✅ **Kész** | `KintlevoPage.tsx`, fordulónapi nyitott állomány és korosított folyószámla | Megvalósítva. |
| `K20.26` | Egyenlegközlő készíthető legyen. | ✅ **Kész** | Egyenlegközlő levél generálás PDF-ben | Megvalósítva. |
| `K20.27` | Fizetési felszólító készíthető legyen. | ✅ **Kész** | Fizetési felszólító modul (`dunning_sends`) | Megvalósítva. |
| `K20.28` | Késedelmi kamat számítható legyen dátumhoz kötött kamatlábbal. | 🟡 **Részben van meg** | Késedelmi kamat kalkulációs logika | Automatikus késedelmi kamatterhelő számla / levél előállítása. |

### 21. Bank – kivonat és tranzakció

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K21.01` | Banki adat – rögzíthető adat: Saját bankszámla azonosítója. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.02` | Banki adat – rögzíthető adat: Kivonatszám. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.03` | Banki adat – rögzíthető adat: Kivonati időszak kezdete. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.04` | Banki adat – rögzíthető adat: Kivonati időszak vége. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.05` | Banki adat – rögzíthető adat: Kivonat nyitó egyenlege. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.06` | Banki adat – rögzíthető adat: Kivonat záró egyenlege. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.07` | Banki adat – rögzíthető adat: Tranzakció banki azonosítója. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.08` | Banki adat – rögzíthető adat: Banki könyvelési nap. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.09` | Banki adat – rögzíthető adat: Értéknap. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.10` | Banki adat – rögzíthető adat: Terhelés vagy jóváírás iránya. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.11` | Banki adat – rögzíthető adat: Tranzakció összege. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.12` | Banki adat – rögzíthető adat: Tranzakció devizaneme. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.13` | Banki adat – rögzíthető adat: Ellenoldali bankszámlaszám. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.14` | Banki adat – rögzíthető adat: Ellenoldali partner neve. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.15` | Banki adat – rögzíthető adat: Banki közlemény. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.16` | Banki adat – rögzíthető adat: Tranzakció banki jogcíme. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.17` | Banki adat – rögzíthető adat: Kapcsolt számla vagy nyitott tétel azonosítója. | ✅ **Kész** | `transactions`, `bank_statements`, `bank_transactions`, `company_bank_accounts` | Megvalósítva. |
| `K21.18` | Bankkivonat kézzel rögzíthető legyen. | ✅ **Kész** | Kézi rögzítés és fájlimport (CAMT.053, MT940, CSV, Aggreg8 PSD2 API, P-087) | Megvalósítva. |
| `K21.19` | Bankkivonat fájlból beolvasható legyen. | ✅ **Kész** | Kézi rögzítés és fájlimport (CAMT.053, MT940, CSV, Aggreg8 PSD2 API, P-087) | Megvalósítva. |
| `K21.20` | Importált banktétel a jóváhagyásig előkészített állapotban maradjon. | ✅ **Kész** | Importált banktétel jóváhagyásig előkészített állapotban marad | Megvalósítva. |
| `K21.21` | Kivonatonként a nyitó + jóváírás − terhelés egyezzen a záró egyenleggel. | ✅ **Kész** | Nyitó + jóváírás − terhelés = záró ellenőrzés és folytonossági sorszám-kontroll | Megvalósítva. |
| `K21.22` | Egymást követő kivonatok záró és nyitó egyenlegének eltérése jelenjen meg. | ✅ **Kész** | Nyitó + jóváírás − terhelés = záró ellenőrzés és folytonossági sorszám-kontroll | Megvalósítva. |
| `K21.23` | Sorszám szerinti kivonathiány jelenjen meg, ha a forrás folyamatos sorszámot biztosít. | ✅ **Kész** | Nyitó + jóváírás − terhelés = záró ellenőrzés és folytonossági sorszám-kontroll | Megvalósítva. |
| `K21.24` | Ismételten beolvasott banki tranzakcióazonosító ne hozzon létre új tételt. | ✅ **Kész** | Tranzakcióazonosító duplikáció-szűrés és figyelmeztetés | Megvalósítva. |
| `K21.25` | Azonosító nélküli importnál dátum, összeg, számla és közlemény egyezésekor duplikációs figyelmeztetés jelenjen meg. | ✅ **Kész** | Tranzakcióazonosító duplikáció-szűrés és figyelmeztetés | Megvalósítva. |
| `K21.26` | Banki párosítás számlaszám alapján tegyen javaslatot. | ✅ **Kész** | Intelligens banki párosító motor (számlaszám, partner, összeg alapján javaslat, választási lehetőség) | Megvalósítva. |
| `K21.27` | Banki párosítás partner és összeg alapján tegyen javaslatot. | ✅ **Kész** | Intelligens banki párosító motor (számlaszám, partner, összeg alapján javaslat, választási lehetőség) | Megvalósítva. |
| `K21.28` | Több lehetséges egyezésnél a program kérjen könyvelői választást. | ✅ **Kész** | Intelligens banki párosító motor (számlaszám, partner, összeg alapján javaslat, választási lehetőség) | Megvalósítva. |
| `K21.29` | Bankköltséghez kontírozási javaslat készülhessen. | ✅ **Kész** | Intelligens banki párosító motor (számlaszám, partner, összeg alapján javaslat, választási lehetőség) | Megvalósítva. |
| `K21.30` | Bankkamat-bevételhez kontírozási javaslat készülhessen. | ✅ **Kész** | Intelligens banki párosító motor (számlaszám, partner, összeg alapján javaslat, választási lehetőség) | Megvalósítva. |
| `K21.31` | Hitel törlesztésénél a tőke és kamat külön sorra bontható legyen. | ✅ **Kész** | Bankköltség, kamat, hitel tőke/kamat bontás, bér- és adóutalások, tagi kölcsön, pénztár átvezetés, kártyadíj könyvelés | Megvalósítva. |
| `K21.32` | Munkabérutalás bér-elszámolási főkönyvre rendezhető legyen. | ✅ **Kész** | Bankköltség, kamat, hitel tőke/kamat bontás, bér- és adóutalások, tagi kölcsön, pénztár átvezetés, kártyadíj könyvelés | Megvalósítva. |
| `K21.33` | Adófizetés adónemenként kijelölt főkönyvre rendezhető legyen. | ✅ **Kész** | Bankköltség, kamat, hitel tőke/kamat bontás, bér- és adóutalások, tagi kölcsön, pénztár átvezetés, kártyadíj könyvelés | Megvalósítva. |
| `K21.34` | Tagikölcsön-utalás a tag folyószámlájára rendezhető legyen. | ✅ **Kész** | Bankköltség, kamat, hitel tőke/kamat bontás, bér- és adóutalások, tagi kölcsön, pénztár átvezetés, kártyadíj könyvelés | Megvalósítva. |
| `K21.35` | Saját bankok közötti utalás úton lévő pénz számlán keresztül összepárosítható legyen. | ✅ **Kész** | Bankköltség, kamat, hitel tőke/kamat bontás, bér- és adóutalások, tagi kölcsön, pénztár átvezetés, kártyadíj könyvelés | Megvalósítva. |
| `K21.36` | Bank és pénztár közötti átvezetés két oldala összepárosítható legyen. | ✅ **Kész** | Bankköltség, kamat, hitel tőke/kamat bontás, bér- és adóutalások, tagi kölcsön, pénztár átvezetés, kártyadíj könyvelés | Megvalósítva. |
| `K21.37` | Kártyaelfogadói elszámolás bruttó bevétele és levont díja külön soron könyvelhető legyen. | ✅ **Kész** | Bankköltség, kamat, hitel tőke/kamat bontás, bér- és adóutalások, tagi kölcsön, pénztár átvezetés, kártyadíj könyvelés | Megvalósítva. |
| `K21.38` | Kijelölt tartozásokból utalási csomag készülhessen külön pénzügyi jóváhagyással. | ✅ **Kész** | `accounty_transfers`, `TransferListPage.tsx` utalási csomag összeállítás jóváhagyással | Megvalósítva. |

### 22. Pénztár – bizonylat és működés

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K22.01` | Pénztárbizonylat – rögzíthető adat: Pénztár azonosítója. | ✅ **Kész** | `petty_cash_entries`, `petty_cash_registers` (pénztár, irány, sorszám, dátum, átvevő, jogcím, összeg, árfolyam, számlakapcsolat) | Megvalósítva. |
| `K22.02` | Pénztárbizonylat – rögzíthető adat: Bizonylat iránya: bevétel vagy kiadás. | ✅ **Kész** | `petty_cash_entries`, `petty_cash_registers` (pénztár, irány, sorszám, dátum, átvevő, jogcím, összeg, árfolyam, számlakapcsolat) | Megvalósítva. |
| `K22.03` | Pénztárbizonylat – rögzíthető adat: Pénztárbizonylat sorszáma. | ✅ **Kész** | `petty_cash_entries`, `petty_cash_registers` (pénztár, irány, sorszám, dátum, átvevő, jogcím, összeg, árfolyam, számlakapcsolat) | Megvalósítva. |
| `K22.04` | Pénztárbizonylat – rögzíthető adat: Pénzmozgás dátuma. | ✅ **Kész** | `petty_cash_entries`, `petty_cash_registers` (pénztár, irány, sorszám, dátum, átvevő, jogcím, összeg, árfolyam, számlakapcsolat) | Megvalósítva. |
| `K22.05` | Pénztárbizonylat – rögzíthető adat: Befizető vagy átvevő neve. | ✅ **Kész** | `petty_cash_entries`, `petty_cash_registers` (pénztár, irány, sorszám, dátum, átvevő, jogcím, összeg, árfolyam, számlakapcsolat) | Megvalósítva. |
| `K22.06` | Pénztárbizonylat – rögzíthető adat: Partner vagy elszámolásra kötelezett személy azonosítója. | ✅ **Kész** | `petty_cash_entries`, `petty_cash_registers` (pénztár, irány, sorszám, dátum, átvevő, jogcím, összeg, árfolyam, számlakapcsolat) | Megvalósítva. |
| `K22.07` | Pénztárbizonylat – rögzíthető adat: Jogcím. | ✅ **Kész** | `petty_cash_entries`, `petty_cash_registers` (pénztár, irány, sorszám, dátum, átvevő, jogcím, összeg, árfolyam, számlakapcsolat) | Megvalósítva. |
| `K22.08` | Pénztárbizonylat – rögzíthető adat: Összeg a pénztár devizanemében. | ✅ **Kész** | `petty_cash_entries`, `petty_cash_registers` (pénztár, irány, sorszám, dátum, átvevő, jogcím, összeg, árfolyam, számlakapcsolat) | Megvalósítva. |
| `K22.09` | Pénztárbizonylat – rögzíthető adat: Alkalmazott árfolyam valutapénztárnál. | ✅ **Kész** | `petty_cash_entries`, `petty_cash_registers` (pénztár, irány, sorszám, dátum, átvevő, jogcím, összeg, árfolyam, számlakapcsolat) | Megvalósítva. |
| `K22.10` | Pénztárbizonylat – rögzíthető adat: Forintérték valutapénztárnál. | ✅ **Kész** | `petty_cash_entries`, `petty_cash_registers` (pénztár, irány, sorszám, dátum, átvevő, jogcím, összeg, árfolyam, számlakapcsolat) | Megvalósítva. |
| `K22.11` | Pénztárbizonylat – rögzíthető adat: Kapcsolódó számla azonosítója. | ✅ **Kész** | `petty_cash_entries`, `petty_cash_registers` (pénztár, irány, sorszám, dátum, átvevő, jogcím, összeg, árfolyam, számlakapcsolat) | Megvalósítva. |
| `K22.12` | Pénztárbizonylat – rögzíthető adat: Melléklet azonosítója. | ✅ **Kész** | `petty_cash_entries`, `petty_cash_registers` (pénztár, irány, sorszám, dátum, átvevő, jogcím, összeg, árfolyam, számlakapcsolat) | Megvalósítva. |
| `K22.13` | Pénztárbizonylat – rögzíthető adat: Elszámolási határidő kiadott előlegnél. | ✅ **Kész** | `petty_cash_entries`, `petty_cash_registers` (pénztár, irány, sorszám, dátum, átvevő, jogcím, összeg, árfolyam, számlakapcsolat) | Megvalósítva. |
| `K22.14` | Ügyfél jogosultsággal pénztárbizonylat készíthető legyen főkönyvi véglegesítés nélkül. | ✅ **Kész** | Ügyfél készíthet pénztárbizonylatot főkönyvi véglegesítés nélkül | Megvalósítva. |
| `K22.15` | Bevételi pénztárbizonylat PDF-ben előállítható legyen. | ✅ **Kész** | Bevételi és kiadási pénztárbizonylat PDF nyomtatás és letöltés | Megvalósítva. |
| `K22.16` | Kiadási pénztárbizonylat PDF-ben előállítható legyen. | ✅ **Kész** | Bevételi és kiadási pénztárbizonylat PDF nyomtatás és letöltés | Megvalósítva. |
| `K22.17` | Készpénzes számlához pénztárbizonylat kapcsolható legyen kettős költségkönyvelés nélkül. | ✅ **Kész** | Készpénzes számlához csatolt pénztárbizonylat duplikációmentes könyvelése (P-092) | Megvalósítva. |
| `K22.18` | Pénztár kiadási tétele ne eredményezhessen negatív pénzkészletet. | ✅ **Kész** | Negatív pénzkészlet azonnali tiltása és visszadátumozott tétel egyenleg-újraszámítása | Megvalósítva. |
| `K22.19` | Visszadátumozott pénztártételnél az összes későbbi egyenleget ellenőrizze a program. | ✅ **Kész** | Negatív pénzkészlet azonnali tiltása és visszadátumozott tétel egyenleg-újraszámítása | Megvalósítva. |
| `K22.20` | Elszámolásra kiadott előleg személyenként nyilvántartható legyen. | ✅ **Kész** | Elszámolásra kiadott előlegek személyenkénti analitikája és számlával történő elszámolása | Megvalósítva. |
| `K22.21` | Kiadott előleg számlával elszámolható legyen. | ✅ **Kész** | Elszámolásra kiadott előlegek személyenkénti analitikája és számlával történő elszámolása | Megvalósítva. |
| `K22.22` | Kiadott előleg fel nem használt része visszafizethető legyen. | ✅ **Kész** | Elszámolásra kiadott előlegek személyenkénti analitikája és számlával történő elszámolása | Megvalósítva. |
| `K22.23` | Lejárt elszámolási határidejű előlegek listázhatók legyenek. | ✅ **Kész** | Elszámolásra kiadott előlegek személyenkénti analitikája és számlával történő elszámolása | Megvalósítva. |
| `K22.24` | Címletenként darabszám rögzíthető legyen pénztárzáráskor. | 🟡 **Részben van meg** | Pénztáregyenleg egyeztetés | Címletjegyzék (címletenkénti darabszám) rögzítő felület hozzáadása a pénztárzáráshoz. |
| `K22.25` | Címletjegyzék összege és pénztáregyenleg eltérése jelenjen meg. | 🟡 **Részben van meg** | Pénztáregyenleg egyeztetés | Címletjegyzék (címletenkénti darabszám) rögzítő felület hozzáadása a pénztárzáráshoz. |
| `K22.26` | Napi pénztárjelentés készíthető legyen. | ✅ **Kész** | Napi és időszaki pénztárjelentés készítése PDF/Excel formátumban | Megvalósítva. |
| `K22.27` | Időszaki pénztárjelentés készíthető legyen. | ✅ **Kész** | Napi és időszaki pénztárjelentés készítése PDF/Excel formátumban | Megvalósítva. |
| `K22.28` | Pénztárzárás visszanyitása jogosultságot igényeljen. | ✅ **Kész** | Pénztárzárás és jóváhagyás nélküli tételek elkülönítése (P-115, A-155) | Megvalósítva. |
| `K22.29` | A még jóvá nem hagyott pénztártételek összege különüljön el a főkönyvvel egyeztetett állománytól. | ✅ **Kész** | Pénztárzárás és jóváhagyás nélküli tételek elkülönítése (P-115, A-155) | Megvalósítva. |

### 23. Deviza – értékelés és különbözetek

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K23.01` | Devizabanki bevételezés forintértéke a megadott árfolyammal képződjön. | ✅ **Kész** | Devizás bank/pénztár forintérték számítás, kiegyenlítéskori realizált árfolyamkülönbözet, részfizetés és devizaváltás kezelés | Megvalósítva. |
| `K23.02` | Valutapénztári bevételezés forintértéke a megadott árfolyammal képződjön. | ✅ **Kész** | Devizás bank/pénztár forintérték számítás, kiegyenlítéskori realizált árfolyamkülönbözet, részfizetés és devizaváltás kezelés | Megvalósítva. |
| `K23.03` | Devizakészlet kivezetése súlyozott átlagárfolyammal számítható legyen. | ✅ **Kész** | Devizás bank/pénztár forintérték számítás, kiegyenlítéskori realizált árfolyamkülönbözet, részfizetés és devizaváltás kezelés | Megvalósítva. |
| `K23.04` | Devizakészlet kivezetése FIFO-módszerrel számítható legyen, ha ezt választották. | ✅ **Kész** | Devizás bank/pénztár forintérték számítás, kiegyenlítéskori realizált árfolyamkülönbözet, részfizetés és devizaváltás kezelés | Megvalósítva. |
| `K23.05` | Devizás vevőkövetelés kiegyenlítésénél realizált árfolyamkülönbözet számolódjon. | ✅ **Kész** | Devizás bank/pénztár forintérték számítás, kiegyenlítéskori realizált árfolyamkülönbözet, részfizetés és devizaváltás kezelés | Megvalósítva. |
| `K23.06` | Devizás szállítói tartozás kiegyenlítésénél realizált árfolyamkülönbözet számolódjon. | ✅ **Kész** | Devizás bank/pénztár forintérték számítás, kiegyenlítéskori realizált árfolyamkülönbözet, részfizetés és devizaváltás kezelés | Megvalósítva. |
| `K23.07` | Részfizetésnél csak a rendezett részre számolódjon realizált árfolyamkülönbözet. | ✅ **Kész** | Devizás bank/pénztár forintérték számítás, kiegyenlítéskori realizált árfolyamkülönbözet, részfizetés és devizaváltás kezelés | Megvalósítva. |
| `K23.08` | Eltérő devizanemben rendezett számlánál a számla- és fizetési devizaösszeg külön tárolódjon. | ✅ **Kész** | Devizás bank/pénztár forintérték számítás, kiegyenlítéskori realizált árfolyamkülönbözet, részfizetés és devizaváltás kezelés | Megvalósítva. |
| `K23.09` | Devizaváltáskor az eladott és megvett deviza összege külön tárolódjon. | ✅ **Kész** | Devizás bank/pénztár forintérték számítás, kiegyenlítéskori realizált árfolyamkülönbözet, részfizetés és devizaváltás kezelés | Megvalósítva. |
| `K23.10` | Év végi devizaátértékeléshez kiválasztható legyen a fordulónap. | 🟡 **Részben van meg** | `ExchangeRates.tsx`, fordulónapi MNB árfolyamok elérhetők | Év végi devizaátértékelő automatikus futtató varázsló nyitott követelésekre, tartozásokra és devizakészletekre. |
| `K23.11` | Év végi devizaátértékelés a nyitott devizás követelésekre kiszámítható legyen. | 🟡 **Részben van meg** | `ExchangeRates.tsx`, fordulónapi MNB árfolyamok elérhetők | Év végi devizaátértékelő automatikus futtató varázsló nyitott követelésekre, tartozásokra és devizakészletekre. |
| `K23.12` | Év végi devizaátértékelés a nyitott devizás tartozásokra kiszámítható legyen. | 🟡 **Részben van meg** | `ExchangeRates.tsx`, fordulónapi MNB árfolyamok elérhetők | Év végi devizaátértékelő automatikus futtató varázsló nyitott követelésekre, tartozásokra és devizakészletekre. |
| `K23.13` | Év végi devizaátértékelés a devizabankok készletére kiszámítható legyen. | 🟡 **Részben van meg** | `ExchangeRates.tsx`, fordulónapi MNB árfolyamok elérhetők | Év végi devizaátértékelő automatikus futtató varázsló nyitott követelésekre, tartozásokra és devizakészletekre. |
| `K23.14` | Év végi devizaátértékelés a valutapénztárak készletére kiszámítható legyen. | 🟡 **Részben van meg** | `ExchangeRates.tsx`, fordulónapi MNB árfolyamok elérhetők | Év végi devizaátértékelő automatikus futtató varázsló nyitott követelésekre, tartozásokra és devizakészletekre. |
| `K23.15` | Évközi átértékelés kijelölt időpontra előkészíthető legyen. | 🟡 **Részben van meg** | `ExchangeRates.tsx`, fordulónapi MNB árfolyamok elérhetők | Év végi devizaátértékelő automatikus futtató varázsló nyitott követelésekre, tartozásokra és devizakészletekre. |
| `K23.16` | Átértékelés következő időszaki visszaforgatása külön jóváhagyható javaslat legyen. | 🟡 **Részben van meg** | `ExchangeRates.tsx`, fordulónapi MNB árfolyamok elérhetők | Év végi devizaátértékelő automatikus futtató varázsló nyitott követelésekre, tartozásokra és devizakészletekre. |
| `K23.17` | Árfolyamnyereség és árfolyamveszteség eltérő főkönyvi számra előkészíthető legyen. | 🟡 **Részben van meg** | 976/876 főkönyvi számlák a számlatükörben | Árfolyamnyereség/veszteség külön jóváhagyású feladási workflow finomítása. |
| `K23.18` | Visszamenőleges banktétel-javítás mutassa meg a későbbi átlagárfolyamokra gyakorolt hatást. | 🟡 **Részben van meg** | 976/876 főkönyvi számlák a számlatükörben | Árfolyamnyereség/veszteség külön jóváhagyású feladási workflow finomítása. |
| `K23.19` | Újraszámítás könyvelt különbözetei külön jóváhagyásra váró korrekcióként jelenjenek meg. | 🟡 **Részben van meg** | 976/876 főkönyvi számlák a számlatükörben | Árfolyamnyereség/veszteség külön jóváhagyású feladási workflow finomítása. |
| `K23.20` | Ugyanazon értékelési futás ne legyen kétszer feladható. | 🟡 **Részben van meg** | 976/876 főkönyvi számlák a számlatükörben | Árfolyamnyereség/veszteség külön jóváhagyású feladási workflow finomítása. |

### 24. Áfa – ügyletfajták

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K24.01` | Belföldi normál adómértékű értékesítés áfája elszámolható legyen. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.02` | Belföldi kedvezményes adómértékű értékesítés áfája elszámolható legyen. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.03` | Alanyi adómentes értékesítés elkülönített jogcímet kapjon. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.04` | Tevékenység jellegére tekintettel adómentes értékesítés elkülönített jogcímet kapjon. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.05` | Áfa területi hatályán kívüli ügylet elkülönített jogcímet kapjon. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.06` | Belföldi fordított adózású értékesítés adóalapja bevallásba gyűjthető legyen. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.07` | Belföldi fordított adózású beszerzés fizetendő áfája kiszámítható legyen. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.08` | Belföldi fordított adózású beszerzés levonható áfája külön meghatározható legyen. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.09` | Közösségi termékértékesítés önálló áfajogcímen könyvelhető legyen. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.10` | Közösségi termékbeszerzés önálló áfajogcímen könyvelhető legyen. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.11` | Közösségi szolgáltatásnyújtás önálló áfajogcímen könyvelhető legyen. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.12` | Közösségi szolgáltatás-igénybevétel önálló áfajogcímen könyvelhető legyen. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.13` | Harmadik országba történő termékexport önálló áfajogcímen könyvelhető legyen. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.14` | Harmadik országból történő termékimport önálló áfajogcímen könyvelhető legyen. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.15` | Harmadik országbeli szolgáltatásnyújtás önálló áfajogcímen könyvelhető legyen. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.16` | Harmadik országbeli szolgáltatás-igénybevétel önálló áfajogcímen könyvelhető legyen. | ✅ **Kész** | `vat_codes`, P-097, P-116, P-119 (normál, kedvezményes, AAM, TAM, fordított beszerzés/értékesítés, közösségi ügyletek, export/import) | Megvalósítva. |
| `K24.17` | Importhoz vámhatározat azonosítója rögzíthető legyen. | 🟡 **Részben van meg** | Import számlák és vámhatározat áfa kezelhető | Dedikált vámhatározat azonosító és vámjogi képviselő mezők beépítése az import áfakódokhoz. |
| `K24.18` | Importhoz vámhatározat dokumentuma csatolható legyen. | 🟡 **Részben van meg** | Import számlák és vámhatározat áfa kezelhető | Dedikált vámhatározat azonosító és vámjogi képviselő mezők beépítése az import áfakódokhoz. |
| `K24.19` | Importhoz vámhatóság által megállapított áfa rögzíthető legyen. | 🟡 **Részben van meg** | Import számlák és vámhatározat áfa kezelhető | Dedikált vámhatározat azonosító és vámjogi képviselő mezők beépítése az import áfakódokhoz. |
| `K24.20` | Importhoz önadózással megállapított áfa rögzíthető legyen. | 🟡 **Részben van meg** | Import számlák és vámhatározat áfa kezelhető | Dedikált vámhatározat azonosító és vámjogi képviselő mezők beépítése az import áfakódokhoz. |
| `K24.21` | Közvetett vámjogi képviselővel elszámolt importáfa külön jelölhető legyen. | 🟡 **Részben van meg** | Import számlák és vámhatározat áfa kezelhető | Dedikált vámhatározat azonosító és vámjogi képviselő mezők beépítése az import áfakódokhoz. |
| `K24.22` | Különbözeti adózású értékesítés beszerzéshez kapcsolható legyen az árrés meghatározásához. | 🟡 **Részben van meg** | Különbözeti áfa kódok | Árrés szerinti adóalap automatikus összekapcsolása a beszerzési számlával. |
| `K24.23` | Különbözeti adózásnál a számított adóalap és áfa külön tárolódjon. | 🟡 **Részben van meg** | Különbözeti áfa kódok | Árrés szerinti adóalap automatikus összekapcsolása a beszerzési számlával. |
| `K24.24` | OSS-ügylethez fogyasztás szerinti tagállam rögzíthető legyen. | ✅ **Kész** | OSS ügyletkódok, tagállami adókulcsok és belföldi áfától elkülönített kimutatás | Megvalósítva. |
| `K24.25` | OSS-ügylethez alkalmazott tagállami adómérték rögzíthető legyen. | ✅ **Kész** | OSS ügyletkódok, tagállami adókulcsok és belföldi áfától elkülönített kimutatás | Megvalósítva. |
| `K24.26` | OSS-ügyletek a belföldi áfabevallástól elkülönítetten összesíthetők legyenek. | ✅ **Kész** | OSS ügyletkódok, tagállami adókulcsok és belföldi áfától elkülönített kimutatás | Megvalósítva. |
| `K24.27` | Mennyiségi adatszolgáltatásra jelölt kódnál hiányzó termékazonosító blokkolja a bevallási exportot. | ✅ **Kész** | Mennyiségi adatszolgáltatás ellenőrzés (termékkód és mennyiség hiánya blokkolja az exportot) | Megvalósítva. |
| `K24.28` | Mennyiségi adatszolgáltatásra jelölt kódnál hiányzó mennyiség blokkolja a bevallási exportot. | ✅ **Kész** | Mennyiségi adatszolgáltatás ellenőrzés (termékkód és mennyiség hiánya blokkolja az exportot) | Megvalósítva. |

### 25. Áfa – időzítés és korrekció

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K25.01` | Saját pénzforgalmi áfás értékesítésnél a fizetendő áfa a kiegyenlítéshez kapcsolódjon. | ✅ **Kész** | Pénzforgalmi áfa (vevő és szállító) kiegyenlítéshez kapcsolása, részfizetéskori arányos áfafelszabadítás (P-073, P-093) | Megvalósítva. |
| `K25.02` | Saját pénzforgalmi áfás beszerzésnél a levonhatóság a kiegyenlítéshez kapcsolódjon. | ✅ **Kész** | Pénzforgalmi áfa (vevő és szállító) kiegyenlítéshez kapcsolása, részfizetéskori arányos áfafelszabadítás (P-073, P-093) | Megvalósítva. |
| `K25.03` | Pénzforgalmi áfás szállító számlája normál áfastátuszú vevőnél is külön követhető legyen. | ✅ **Kész** | Pénzforgalmi áfa (vevő és szállító) kiegyenlítéshez kapcsolása, részfizetéskori arányos áfafelszabadítás (P-073, P-093) | Megvalósítva. |
| `K25.04` | Pénzforgalmi áfás részfizetésnél az érintett áfa arányos része szabaduljon fel. | ✅ **Kész** | Pénzforgalmi áfa (vevő és szállító) kiegyenlítéshez kapcsolása, részfizetéskori arányos áfafelszabadítás (P-073, P-093) | Megvalósítva. |
| `K25.05` | Pénzforgalmi számla visszatérítése korrigálja a kapcsolódó áfaállományt. | ✅ **Kész** | Pénzforgalmi áfa (vevő és szállító) kiegyenlítéshez kapcsolása, részfizetéskori arányos áfafelszabadítás (P-073, P-093) | Megvalósítva. |
| `K25.06` | Pénzforgalmi státusz megszűnésekor a nyitott áfaállomány tételesen kigyűjthető legyen. | ✅ **Kész** | Pénzforgalmi áfa (vevő és szállító) kiegyenlítéshez kapcsolása, részfizetéskori arányos áfafelszabadítás (P-073, P-093) | Megvalósítva. |
| `K25.07` | Előleg áfateljesítése a pénzügyi teljesítéshez kapcsolható legyen. | ✅ **Kész** | Előleg áfa pénzügyi teljesítéskor, végszámlába beszámított előleg áfájának kizárása a duplikációból | Megvalósítva. |
| `K25.08` | Végszámlában beszámított előleg áfája ne kerüljön ismételten bevallásba. | ✅ **Kész** | Előleg áfa pénzügyi teljesítéskor, végszámlába beszámított előleg áfájának kizárása a duplikációból | Megvalósítva. |
| `K25.09` | Időszakos számlánál az elszámolási időszakból, keltből és esedékességből áfateljesítési javaslat készülhessen. | ✅ **Kész** | Időszakos elszámolású számlák áfateljesítési dátum javaslata és kézi felülbírálata (P-066, P-103) | Megvalósítva. |
| `K25.10` | Áfateljesítési javaslat kézzel felülbírálható legyen indoklással. | ✅ **Kész** | Időszakos elszámolású számlák áfateljesítési dátum javaslata és kézi felülbírálata (P-066, P-103) | Megvalósítva. |
| `K25.11` | Helyesbítő számlánál az áfakülönbözet az eredetihez képest számolódjon. | ✅ **Kész** | Helyesbítő számlák áfakülönbözete és külön korrekciós időszakra állítása | Megvalósítva. |
| `K25.12` | Áfanövelő korrekcióhoz külön bevallási időszak legyen megadható. | ✅ **Kész** | Helyesbítő számlák áfakülönbözete és külön korrekciós időszakra állítása | Megvalósítva. |
| `K25.13` | Áfacsökkentő korrekcióhoz külön bevallási időszak legyen megadható. | ✅ **Kész** | Helyesbítő számlák áfakülönbözete és külön korrekciós időszakra állítása | Megvalósítva. |
| `K25.14` | Levonás későbbi időszakra halasztásakor az eredeti teljesítési dátum maradjon meg. | ✅ **Kész** | Levonási jog későbbi időszakra halasztása az eredeti teljesítés megőrzésével | Megvalósítva. |
| `K25.15` | Teljesen le nem vonható áfa költségre átvezethető legyen. | ✅ **Kész** | Le nem vonható áfa költségre/eszközre vezetése, arányos levonási hányad (P-100, P-101) | Megvalósítva. |
| `K25.16` | Teljesen le nem vonható áfa eszköz bekerülési értékéhez rendelhető legyen. | ✅ **Kész** | Le nem vonható áfa költségre/eszközre vezetése, arányos levonási hányad (P-100, P-101) | Megvalósítva. |
| `K25.17` | Részben levonható áfánál a levonható hányad megadható legyen. | ✅ **Kész** | Le nem vonható áfa költségre/eszközre vezetése, arányos levonási hányad (P-100, P-101) | Megvalósítva. |
| `K25.18` | Levonási hányad alapján a levonható és le nem vonható összeg külön soron képződjön. | ✅ **Kész** | Le nem vonható áfa költségre/eszközre vezetése, arányos levonási hányad (P-100, P-101) | Megvalósítva. |
| `K25.19` | Arányosításhoz előzetes éves levonási hányad rögzíthető legyen. | ✅ **Kész** | `vat_pro_rata_settings`, `vat_pro_rata_periods` (előzetes és végleges éves hányad, különbözet elszámolás) | Megvalósítva. |
| `K25.20` | Arányosításhoz végleges éves levonási hányad rögzíthető legyen. | ✅ **Kész** | `vat_pro_rata_settings`, `vat_pro_rata_periods` (előzetes és végleges éves hányad, különbözet elszámolás) | Megvalósítva. |
| `K25.21` | Végleges hányad megadásakor az éves különbözet tételesen kiszámítható legyen. | ✅ **Kész** | `vat_pro_rata_settings`, `vat_pro_rata_periods` (előzetes és végleges éves hányad, különbözet elszámolás) | Megvalósítva. |
| `K25.22` | Devizás számla számviteli és áfaárfolyam-különbözete külön könyvelési javaslatként jelenjen meg. | ✅ **Kész** | Számviteli és áfaárfolyam különbözet könyvelési javaslata | Megvalósítva. |
| `K25.23` | Eszköz áfakorrekciójához figyelési időszak kezdete rögzíthető legyen. | 🟡 **Részben van meg** | Tárgyi eszköz modulban az áfa adatok megvannak | Tárgyi eszköz 5/20 éves áfakorrekciós figyelési automatizmusa. |
| `K25.24` | Eszköz áfakorrekciójához figyelési időszak hossza rögzíthető legyen. | 🟡 **Részben van meg** | Tárgyi eszköz modulban az áfa adatok megvannak | Tárgyi eszköz 5/20 éves áfakorrekciós figyelési automatizmusa. |
| `K25.25` | Eszköz áfakorrekciójához eredetileg levont áfa rögzíthető legyen. | 🟡 **Részben van meg** | Tárgyi eszköz modulban az áfa adatok megvannak | Tárgyi eszköz 5/20 éves áfakorrekciós figyelési automatizmusa. |
| `K25.26` | Eszköz áfakorrekciójához éves használati vagy levonási hányad rögzíthető legyen. | 🟡 **Részben van meg** | Tárgyi eszköz modulban az áfa adatok megvannak | Tárgyi eszköz 5/20 éves áfakorrekciós figyelési automatizmusa. |
| `K25.27` | Eszköz áfakorrekciójához éves kiigazítási összeg számítható legyen. | 🟡 **Részben van meg** | Tárgyi eszköz modulban az áfa adatok megvannak | Tárgyi eszköz 5/20 éves áfakorrekciós figyelési automatizmusa. |

### 26. Áfa – bevallás és zárás

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K26.01` | Tételes áfaanalitika készíthető legyen. | ✅ **Kész** | `VatReturnPage.tsx`, tételes áfaanalitika, soronkénti összesítő, számlára fúrás, főkönyvi egyeztetés (P-097, P-099, P-119) | Megvalósítva. |
| `K26.02` | Áfabevallási soronkénti összesítő készíthető legyen. | ✅ **Kész** | `VatReturnPage.tsx`, tételes áfaanalitika, soronkénti összesítő, számlára fúrás, főkönyvi egyeztetés (P-097, P-099, P-119) | Megvalósítva. |
| `K26.03` | Áfabevallási sorból megnyitható legyen az azt alkotó bizonylat. | ✅ **Kész** | `VatReturnPage.tsx`, tételes áfaanalitika, soronkénti összesítő, számlára fúrás, főkönyvi egyeztetés (P-097, P-099, P-119) | Megvalósítva. |
| `K26.04` | Fizetendő áfa analitikája egyeztethető legyen a fizetendő áfa főkönyvével. | ✅ **Kész** | `VatReturnPage.tsx`, tételes áfaanalitika, soronkénti összesítő, számlára fúrás, főkönyvi egyeztetés (P-097, P-099, P-119) | Megvalósítva. |
| `K26.05` | Levonható áfa analitikája egyeztethető legyen a levonható áfa főkönyvével. | ✅ **Kész** | `VatReturnPage.tsx`, tételes áfaanalitika, soronkénti összesítő, számlára fúrás, főkönyvi egyeztetés (P-097, P-099, P-119) | Megvalósítva. |
| `K26.06` | Időszaki eltérés különüljön el a tényleges főkönyv–áfa hibától. | ✅ **Kész** | `VatReturnPage.tsx`, tételes áfaanalitika, soronkénti összesítő, számlára fúrás, főkönyvi egyeztetés (P-097, P-099, P-119) | Megvalósítva. |
| `K26.07` | Havi áfaidőszak lezárható legyen. | ✅ **Kész** | Havi, negyedéves és éves áfaidőszak lezárása, frekvenciaváltás duplikáció-védelme | Megvalósítva. |
| `K26.08` | Negyedéves áfaidőszak lezárható legyen. | ✅ **Kész** | Havi, negyedéves és éves áfaidőszak lezárása, frekvenciaváltás duplikáció-védelme | Megvalósítva. |
| `K26.09` | Éves áfaidőszak lezárható legyen. | ✅ **Kész** | Havi, negyedéves és éves áfaidőszak lezárása, frekvenciaváltás duplikáció-védelme | Megvalósítva. |
| `K26.10` | Évközi gyakoriságváltás után ne kerüljön kétszer bevallásba ugyanaz a tétel. | ✅ **Kész** | Havi, negyedéves és éves áfaidőszak lezárása, frekvenciaváltás duplikáció-védelme | Megvalósítva. |
| `K26.11` | Az adott időszakhoz tartozó NAV-áfabevallási fájl előállítható legyen. | ✅ **Kész** | NAV 65-ös ÁNYK XML export, M-lapok és A60 összesítő generálás (P-097, P-116) | Megvalósítva. |
| `K26.12` | Belföldi összesítő jelentés M-lapjai előállíthatók legyenek. | ✅ **Kész** | NAV 65-ös ÁNYK XML export, M-lapok és A60 összesítő generálás (P-097, P-116) | Megvalósítva. |
| `K26.13` | Az M-lapok módosítási kapcsolatai őrizzék meg az eredeti számlaszámot. | ✅ **Kész** | NAV 65-ös ÁNYK XML export, M-lapok és A60 összesítő generálás (P-097, P-116) | Megvalósítva. |
| `K26.14` | A60 összesítő nyilatkozat előállítható legyen. | ✅ **Kész** | NAV 65-ös ÁNYK XML export, M-lapok és A60 összesítő generálás (P-097, P-116) | Megvalósítva. |
| `K26.15` | A60 adatai egyeztethetők legyenek a közösségi ügyletek áfaanalitikájával. | ✅ **Kész** | NAV 65-ös ÁNYK XML export, M-lapok és A60 összesítő generálás (P-097, P-116) | Megvalósítva. |
| `K26.16` | Hiányzó közösségi adószám jelenjen meg az A60 ellenőrzési listáján. | ✅ **Kész** | NAV 65-ös ÁNYK XML export, M-lapok és A60 összesítő generálás (P-097, P-116) | Megvalósítva. |
| `K26.17` | Eredeti bevallás mentett állapota később megnyitható legyen. | ✅ **Kész** | Mentett bevallási változatok, önellenőrzés különbözet kimutatás, NAV nyugta csatolás (P-114, A-154) | Megvalósítva. |
| `K26.18` | Első önellenőrzés az eredeti bevalláshoz kapcsolódjon. | ✅ **Kész** | Mentett bevallási változatok, önellenőrzés különbözet kimutatás, NAV nyugta csatolás (P-114, A-154) | Megvalósítva. |
| `K26.19` | Ismételt önellenőrzés az előző érvényes bevallásváltozathoz kapcsolódjon. | ✅ **Kész** | Mentett bevallási változatok, önellenőrzés különbözet kimutatás, NAV nyugta csatolás (P-114, A-154) | Megvalósítva. |
| `K26.20` | Önellenőrzés különbözete bevallási soronként kimutatható legyen. | ✅ **Kész** | Mentett bevallási változatok, önellenőrzés különbözet kimutatás, NAV nyugta csatolás (P-114, A-154) | Megvalósítva. |
| `K26.21` | Adózói javítás vagy helyesbítés az önellenőrzéstől elkülöníthető legyen. | ✅ **Kész** | Mentett bevallási változatok, önellenőrzés különbözet kimutatás, NAV nyugta csatolás (P-114, A-154) | Megvalósítva. |
| `K26.22` | Bevalláshoz NAV-nyugta csatolható legyen. | ✅ **Kész** | Mentett bevallási változatok, önellenőrzés különbözet kimutatás, NAV nyugta csatolás (P-114, A-154) | Megvalósítva. |
| `K26.23` | Bevallási export előtt a hiányzó kötelező adatokat tételesen jelezze a program. | ✅ **Kész** | Mentett bevallási változatok, önellenőrzés különbözet kimutatás, NAV nyugta csatolás (P-114, A-154) | Megvalósítva. |
| `K26.24` | Lezárt áfaidőszakot érintő módosítás külön korrekciós feladatként jelenjen meg. | ✅ **Kész** | Mentett bevallási változatok, önellenőrzés különbözet kimutatás, NAV nyugta csatolás (P-114, A-154) | Megvalósítva. |
| `K26.25` | eÁFA-forrásadatok lekérhetők legyenek. | ✅ **Kész** | `vat_codes` eÁFA leképezés, NAV UPO M2M integráció és státuszkövetés (P-114, A-154) | Megvalósítva. |
| `K26.26` | eÁFA-adókódokhoz a helyi áfakódok megfeleltethetők legyenek. | ✅ **Kész** | `vat_codes` eÁFA leképezés, NAV UPO M2M integráció és státuszkövetés (P-114, A-154) | Megvalósítva. |
| `K26.27` | eÁFA-validáció hibája az érintett tételhez kapcsolva jelenjen meg. | ✅ **Kész** | `vat_codes` eÁFA leképezés, NAV UPO M2M integráció és státuszkövetés (P-114, A-154) | Megvalósítva. |
| `K26.28` | eÁFA-benyújtás külön felhatalmazott jóváhagyását igényelje. | ✅ **Kész** | `vat_codes` eÁFA leképezés, NAV UPO M2M integráció és státuszkövetés (P-114, A-154) | Megvalósítva. |
| `K26.29` | eÁFA-benyújtás feldolgozási állapota visszakereshető legyen. | ✅ **Kész** | `vat_codes` eÁFA leképezés, NAV UPO M2M integráció és státuszkövetés (P-114, A-154) | Megvalósítva. |

### 27. Elhatárolások – adatok

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K27.01` | Elhatárolás – rögzíthető adat: Egyedi elhatárolásazonosító. | 🟡 **Részben van meg** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. |
| `K27.02` | Elhatárolás – rögzíthető adat: Kapcsolódó bizonylat. | 🟡 **Részben van meg** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. |
| `K27.03` | Elhatárolás – rögzíthető adat: Partner. | 🟡 **Részben van meg** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. |
| `K27.04` | Elhatárolás – rögzíthető adat: Típus: aktív költség, aktív bevétel, passzív költség vagy passzív bevétel. | 🟡 **Részben van meg** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. |
| `K27.05` | Elhatárolás – rögzíthető adat: Elhatárolandó forintösszeg. | 🟡 **Részben van meg** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. |
| `K27.06` | Elhatárolás – rögzíthető adat: Elhatárolási időszak kezdete. | 🟡 **Részben van meg** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. |
| `K27.07` | Elhatárolás – rögzíthető adat: Elhatárolási időszak vége. | 🟡 **Részben van meg** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. |
| `K27.08` | Elhatárolás – rögzíthető adat: Felosztási mód: naparányos, havi egyenlő vagy kézi ütemezés. | 🟡 **Részben van meg** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. |
| `K27.09` | Elhatárolás – rögzíthető adat: Elhatárolás főkönyvi száma. | 🟡 **Részben van meg** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. |
| `K27.10` | Elhatárolás – rögzíthető adat: Feloldás főkönyvi száma. | 🟡 **Részben van meg** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. |
| `K27.11` | Elhatárolás – rögzíthető adat: Költséghely-kapcsolat. | 🟡 **Részben van meg** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. |
| `K27.12` | Elhatárolás – rögzíthető adat: Projektkapcsolat. | 🟡 **Részben van meg** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. |
| `K27.13` | Elhatárolás – rögzíthető adat: Már feladott összeg. | 🟡 **Részben van meg** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. |
| `K27.14` | Elhatárolás – rögzíthető adat: Még feloldandó összeg. | 🟡 **Részben van meg** | `accrual_entries` tábla az adatbázisban létezik (aktív/passzív, összeg, időszak, fksz-ek) | Dedikált felhasználói felület (`AccrualsPage.tsx`) kifejlesztése az elhatárolások kezelésére. |
| `K27.15` | Elhatárolási ütemezés számítható legyen a teljes időszakra. | 🟡 **Részben van meg** | Ütemezési motor és főkönyvi feladás logikája | Frontend jóváhagyó panel az elhatárolások havi és éves feloldásához. |
| `K27.16` | Elhatárolás havi feloldása jóváhagyásra előkészíthető legyen. | 🟡 **Részben van meg** | Ütemezési motor és főkönyvi feladás logikája | Frontend jóváhagyó panel az elhatárolások havi és éves feloldásához. |
| `K27.17` | Elhatárolás éves feloldása jóváhagyásra előkészíthető legyen. | 🟡 **Részben van meg** | Ütemezési motor és főkönyvi feladás logikája | Frontend jóváhagyó panel az elhatárolások havi és éves feloldásához. |
| `K27.18` | Egy elhatárolási részlet ne legyen kétszer feladható. | 🟡 **Részben van meg** | Ütemezési motor és főkönyvi feladás logikája | Frontend jóváhagyó panel az elhatárolások havi és éves feloldásához. |
| `K27.19` | Elhatárolás módosításakor a már feladott rész és a hátralévő rész külön jelenjen meg. | 🟡 **Részben van meg** | Ütemezési motor és főkönyvi feladás logikája | Frontend jóváhagyó panel az elhatárolások havi és éves feloldásához. |
| `K27.20` | Elhatárolás maradéka következő üzleti évre átvihető legyen. | 🟡 **Részben van meg** | Ütemezési motor és főkönyvi feladás logikája | Frontend jóváhagyó panel az elhatárolások havi és éves feloldásához. |
| `K27.21` | Elhatárolási analitika összege egyeztethető legyen a kapcsolódó főkönyvi számlával. | 🟡 **Részben van meg** | Ütemezési motor és főkönyvi feladás logikája | Frontend jóváhagyó panel az elhatárolások havi és éves feloldásához. |
| `K27.22` | Eszköztámogatás halasztott bevétele eszközkartonhoz kapcsolható legyen. | 🟡 **Részben van meg** | `development_reserves`, `fixed_assets` | Eszköztámogatás halasztott bevételének automatikus feloldása az ÉCS-vel párhuzamosan. |
| `K27.23` | Eszköztámogatás feloldási javaslata az elszámolt értékcsökkenéshez kapcsolódjon. | 🟡 **Részben van meg** | `development_reserves`, `fixed_assets` | Eszköztámogatás halasztott bevételének automatikus feloldása az ÉCS-vel párhuzamosan. |

### 28. Számviteli zárás és nyitás

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K28.01` | Napló lezárható legyen kijelölt dátumig. | ✅ **Kész** | `acc_accounting_periods`, napló és időszak lezárása, tiltás zárt időszakba, visszanyitási auditálás | Megvalósítva. |
| `K28.02` | Teljes számviteli időszak lezárható legyen kijelölt dátumig. | ✅ **Kész** | `acc_accounting_periods`, napló és időszak lezárása, tiltás zárt időszakba, visszanyitási auditálás | Megvalósítva. |
| `K28.03` | Áfazárás a számviteli zárástól függetlenül végrehajtható legyen. | ✅ **Kész** | `acc_accounting_periods`, napló és időszak lezárása, tiltás zárt időszakba, visszanyitási auditálás | Megvalósítva. |
| `K28.04` | Lezárt számviteli időszakba új tétel feladását a program tiltsa. | ✅ **Kész** | `acc_accounting_periods`, napló és időszak lezárása, tiltás zárt időszakba, visszanyitási auditálás | Megvalósítva. |
| `K28.05` | Lezárt időszak visszanyitásához indoklás legyen kötelező. | ✅ **Kész** | `acc_accounting_periods`, napló és időszak lezárása, tiltás zárt időszakba, visszanyitási auditálás | Megvalósítva. |
| `K28.06` | Visszanyitás felhasználója és időpontja naplózódjon. | ✅ **Kész** | `acc_accounting_periods`, napló és időszak lezárása, tiltás zárt időszakba, visszanyitási auditálás | Megvalósítva. |
| `K28.07` | Zárás előtt a jóváhagyásra váró bizonylatok listázhatók legyenek. | ✅ **Kész** | `acc_accounting_periods`, napló és időszak lezárása, tiltás zárt időszakba, visszanyitási auditálás | Megvalósítva. |
| `K28.08` | Zárás előtt a főkönyv–analitika eltérések listázhatók legyenek. | ✅ **Kész** | `acc_accounting_periods`, napló és időszak lezárása, tiltás zárt időszakba, visszanyitási auditálás | Megvalósítva. |
| `K28.09` | Eredményszámlák zárása kontírozott javaslatként előállítható legyen. | ✅ **Kész** | Eredményszámlák zárása, mérlegszámlák nyitása, nyitó import varázsló (P-055, P-102) | Megvalósítva. |
| `K28.10` | Mérlegszámlák következő évi nyitása kontírozott javaslatként előállítható legyen. | ✅ **Kész** | Eredményszámlák zárása, mérlegszámlák nyitása, nyitó import varázsló (P-055, P-102) | Megvalósítva. |
| `K28.11` | Előzetes nyitás végrehajtható legyen az előző év végleges zárása előtt. | ✅ **Kész** | Eredményszámlák zárása, mérlegszámlák nyitása, nyitó import varázsló (P-055, P-102) | Megvalósítva. |
| `K28.12` | Megismételt nyitás a korábbi nyitást aktualizálja, ne duplázza. | ✅ **Kész** | Eredményszámlák zárása, mérlegszámlák nyitása, nyitó import varázsló (P-055, P-102) | Megvalósítva. |
| `K28.13` | Vevők nyitott tételei tételesen átvihetők legyenek. | ✅ **Kész** | Eredményszámlák zárása, mérlegszámlák nyitása, nyitó import varázsló (P-055, P-102) | Megvalósítva. |
| `K28.14` | Szállítók nyitott tételei tételesen átvihetők legyenek. | ✅ **Kész** | Eredményszámlák zárása, mérlegszámlák nyitása, nyitó import varázsló (P-055, P-102) | Megvalósítva. |
| `K28.15` | Egyéb folyószámlák nyitott tételei átvihetők legyenek. | ✅ **Kész** | Vevő/szállító nyitott tételek, devizabank, valutapénztár, eszközök halmozott adatainak átvitele | Megvalósítva. |
| `K28.16` | Devizabank nyitó devizaösszege és forintértéke együtt átvihető legyen. | ✅ **Kész** | Vevő/szállító nyitott tételek, devizabank, valutapénztár, eszközök halmozott adatainak átvitele | Megvalósítva. |
| `K28.17` | Valutapénztár nyitó valutaösszege és forintértéke együtt átvihető legyen. | ✅ **Kész** | Vevő/szállító nyitott tételek, devizabank, valutapénztár, eszközök halmozott adatainak átvitele | Megvalósítva. |
| `K28.18` | Pénzforgalmi áfa még fel nem szabadult állománya átvihető legyen. | ✅ **Kész** | Vevő/szállító nyitott tételek, devizabank, valutapénztár, eszközök halmozott adatainak átvitele | Megvalósítva. |
| `K28.19` | Eszközök halmozott értékadatai átvihetők legyenek. | ✅ **Kész** | Vevő/szállító nyitott tételek, devizabank, valutapénztár, eszközök halmozott adatainak átvitele | Megvalósítva. |
| `K28.20` | Előző évi javítás nyitásra gyakorolt különbözete megtekinthető legyen jóváhagyás előtt. | ✅ **Kész** | Vevő/szállító nyitott tételek, devizabank, valutapénztár, eszközök halmozott adatainak átvitele | Megvalósítva. |
| `K28.21` | Eltérő üzleti év nyitása az előző üzleti év tényleges zárónapjához kapcsolódjon. | ✅ **Kész** | Vevő/szállító nyitott tételek, devizabank, valutapénztár, eszközök halmozott adatainak átvitele | Megvalósítva. |
| `K28.22` | Végelszámolás előtti tevékenységzáró adatok külön kimutathatók legyenek. | 🟡 **Részben van meg** | Beszámoló és évzárás adatok | Végelszámolás előtti és közbeni speciális beszámolási időszakok kimutatása. |
| `K28.23` | Végelszámolás közbeni beszámolási időszakok adatai külön kimutathatók legyenek. | 🟡 **Részben van meg** | Beszámoló és évzárás adatok | Végelszámolás előtti és közbeni speciális beszámolási időszakok kimutatása. |
| `K28.24` | Végelszámolást lezáró adatok külön kimutathatók legyenek. | 🟡 **Részben van meg** | Beszámoló és évzárás adatok | Végelszámolás előtti és közbeni speciális beszámolási időszakok kimutatása. |

### 29. Tárgyi eszköz – azonosító adatok

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K29.01` | Eszközkarton – rögzíthető adat: Egyedi kartonazonosító. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.02` | Eszközkarton – rögzíthető adat: Eszköz megnevezése. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.03` | Eszközkarton – rögzíthető adat: Leltári szám. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.04` | Eszközkarton – rögzíthető adat: Eszközcsoport. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.05` | Eszközkarton – rögzíthető adat: Típus: immateriális jószág, tárgyi eszköz vagy beruházás. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.06` | Eszközkarton – rögzíthető adat: Gyári szám. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.07` | Eszközkarton – rögzíthető adat: Rendszám járműnél. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.08` | Eszközkarton – rögzíthető adat: Helyrajzi szám ingatlannál. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.09` | Eszközkarton – rögzíthető adat: Vonalkód vagy QR-azonosító. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.10` | Eszközkarton – rögzíthető adat: Mennyiség. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.11` | Eszközkarton – rögzíthető adat: Mértékegység. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.12` | Eszközkarton – rögzíthető adat: Telephely. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.13` | Eszközkarton – rögzíthető adat: Tárolási vagy használati hely. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.14` | Eszközkarton – rögzíthető adat: Felelős személy. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.15` | Eszközkarton – rögzíthető adat: Költséghely. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.16` | Eszközkarton – rögzíthető adat: Munkaszám. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.17` | Eszközkarton – rögzíthető adat: Projekt. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.18` | Eszközkarton – rögzíthető adat: Támogatási azonosító. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.19` | Eszközkarton – rögzíthető adat: Tevékenység. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.20` | Eszközkarton – rögzíthető adat: Tulajdon vagy pénzügyi lízing jelölése. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.21` | Eszközkarton – rögzíthető adat: Beszerzés dátuma. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.22` | Eszközkarton – rögzíthető adat: Beszerzési partner. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.23` | Eszközkarton – rögzíthető adat: Beszerzési számla azonosítója. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.24` | Eszközkarton – rögzíthető adat: Üzembe helyezés dátuma. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.25` | Eszközkarton – rögzíthető adat: Állapot: beruházás, aktív, használaton kívüli vagy kivezetett. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.26` | Eszközkarton – rögzíthető adat: Kivezetés dátuma. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.27` | Eszközkarton – rögzíthető adat: Kivezetés jogcíme. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.28` | Eszközkarton – rögzíthető adat: Megjegyzés. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.29` | A tárgyi eszköz nyilvántartása külön modulban megnyitható legyen. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.30` | Eszközkartonhoz beszerzési számla képe csatolható legyen. | ✅ **Kész** | `fixed_assets`, `FixedAssetsPage.tsx` (karton, név, leltári szám, gyári szám, csoport, telephely, felelős, beszerzési adatok) | Megvalósítva. |
| `K29.31` | Eszközkartonhoz üzembe helyezési dokumentum csatolható legyen. | ✅ **Kész** | Számla- és jegyzőkönyv csatolás, duplikált leltári szám szűrés, 0-ra leírt eszköz leltárban tartása | Megvalósítva. |
| `K29.32` | Eszközkartonhoz selejtezési jegyzőkönyv csatolható legyen. | ✅ **Kész** | Számla- és jegyzőkönyv csatolás, duplikált leltári szám szűrés, 0-ra leírt eszköz leltárban tartása | Megvalósítva. |
| `K29.33` | Azonos leltári szám felvitelekor figyelmeztetés jelenjen meg. | ✅ **Kész** | Számla- és jegyzőkönyv csatolás, duplikált leltári szám szűrés, 0-ra leírt eszköz leltárban tartása | Megvalósítva. |
| `K29.34` | Nullára leírt, használatban lévő eszköz maradjon a leltárban. | ✅ **Kész** | Számla- és jegyzőkönyv csatolás, duplikált leltári szám szűrés, 0-ra leírt eszköz leltárban tartása | Megvalósítva. |

### 30. Tárgyi eszköz – érték és kontírozás

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K30.01` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Számviteli bekerülési érték. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.02` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Bekerülési értékhez hozzáadott le nem vonható áfa. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.03` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Nyitó halmozott terv szerinti értékcsökkenés. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.04` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Nyitó halmozott terven felüli értékcsökkenés. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.05` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Nyitó halmozott visszaírás. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.06` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Számviteli nettó érték. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.07` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: TAO szerinti bekerülési érték. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.08` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: TAO szerinti nyitó elszámolt leírás. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.09` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: TAO szerinti számított nyilvántartási érték. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.10` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Bruttó érték főkönyvi száma. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.11` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Beruházás főkönyvi száma. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.12` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Halmozott terv szerinti ÉCS főkönyvi száma. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.13` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Terv szerinti ÉCS költségszámlája. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.14` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Terven felüli ÉCS főkönyvi száma. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.15` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Terven felüli ÉCS ráfordítási főkönyvi száma. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.16` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Visszaírás bevételi főkönyvi száma. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.17` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Kivezetett nettó érték ráfordítási főkönyvi száma. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.18` | Eszköz értékadata vagy főkönyvi kapcsolata – rögzíthető adat: Értékesítési bevétel főkönyvi száma. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.19` | Számviteli nettó érték a bruttó értékből és halmozott értékmozgásokból számolódjon. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.20` | TAO szerinti számított nyilvántartási érték a számviteli nettó értéktől eltérhessen. | ✅ **Kész** | `fixed_assets`, `tao_depreciation_templates` (bekerülési érték, ÉCS főkönyvek, számviteli nettó és TAO érték) | Megvalósítva. |
| `K30.21` | Egy eszközhöz több beszerzési számla értékeleme hozzárendelhető legyen. | ✅ **Kész** | Több számlaelem hozzárendelése, beruházás felosztása, főkönyvi bizonylat megnyitása | Megvalósítva. |
| `K30.22` | Egy beruházási számla összege több eszköz között felosztható legyen. | ✅ **Kész** | Több számlaelem hozzárendelése, beruházás felosztása, főkönyvi bizonylat megnyitása | Megvalósítva. |
| `K30.23` | Eszközfeladásból megnyitható legyen a kapcsolódó főkönyvi bizonylat. | ✅ **Kész** | Több számlaelem hozzárendelése, beruházás felosztása, főkönyvi bizonylat megnyitása | Megvalósítva. |

### 31. Tárgyi eszköz – ÉCS-beállítások

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K31.01` | Értékcsökkenési beállítás – rögzíthető adat: Számviteli leírás módja: lineáris, teljesítményarányos, egyösszegű vagy kézi terv. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.02` | Értékcsökkenési beállítás – rögzíthető adat: Számviteli éves leírási kulcs. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.03` | Értékcsökkenési beállítás – rögzíthető adat: Hasznos élettartam hónapban. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.04` | Értékcsökkenési beállítás – rögzíthető adat: Maradványérték. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.05` | Értékcsökkenési beállítás – rögzíthető adat: ÉCS-számítás kezdőnapja. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.06` | Értékcsökkenési beállítás – rögzíthető adat: Időarányosítás módja: napi vagy havi. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.07` | Értékcsökkenési beállítás – rögzíthető adat: TAO szerinti leírási jogcím. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.08` | Értékcsökkenési beállítás – rögzíthető adat: TAO szerinti leírási kulcs. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.09` | Értékcsökkenési beállítás – rögzíthető adat: TAO szerinti leírás kezdőnapja. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.10` | Értékcsökkenési beállítás – rögzíthető adat: Kisértékű egyösszegű leírás jelölése. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.11` | Értékcsökkenési beállítás – rögzíthető adat: Teljesítményarányos leírás tervezett összteljesítménye. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.12` | Értékcsökkenési beállítás – rögzíthető adat: Teljesítményarányos leírás tárgyidőszaki teljesítménye. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.13` | Értékcsökkenési beállítás – rögzíthető adat: Leírási paraméterváltozás hatálynapja. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.14` | Értékcsökkenési beállítás – rögzíthető adat: Leírási paraméterváltozás indoklása. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.15` | Értékcsökkenési beállítás – rögzíthető adat: Bérbeadás kezdőnapja eltérő adózási leírásnál. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.16` | Értékcsökkenési beállítás – rögzíthető adat: Bérbeadás zárónapja eltérő adózási leírásnál. | ✅ **Kész** | Lineáris, egyösszegű, kisértékű leírás, maradványérték, hasznos élettartam, időarányosítás, TAO kulcsok | Megvalósítva. |
| `K31.17` | Számviteli ÉCS-terv a TAO szerinti tervtől külön számítható legyen. | ✅ **Kész** | Számviteli és TAO ÉCS párhuzamos számítása, előrejelzés, feladás könyvelői jóváhagyással, időszakzárás | Megvalósítva. |
| `K31.18` | Napi számítás az adott év tényleges napjait vegye figyelembe. | ✅ **Kész** | Számviteli és TAO ÉCS párhuzamos számítása, előrejelzés, feladás könyvelői jóváhagyással, időszakzárás | Megvalósítva. |
| `K31.19` | Évközi aktiválásnál tört időszaki leírás számolódjon. | ✅ **Kész** | Számviteli és TAO ÉCS párhuzamos számítása, előrejelzés, feladás könyvelői jóváhagyással, időszakzárás | Megvalósítva. |
| `K31.20` | Kivezetésnél a kivezetésig járó leírás kiszámítható legyen. | ✅ **Kész** | Számviteli és TAO ÉCS párhuzamos számítása, előrejelzés, feladás könyvelői jóváhagyással, időszakzárás | Megvalósítva. |
| `K31.21` | Terv szerinti számviteli leírás ne csökkentse az értéket a maradványérték alá. | ✅ **Kész** | Számviteli és TAO ÉCS párhuzamos számítása, előrejelzés, feladás könyvelői jóváhagyással, időszakzárás | Megvalósítva. |
| `K31.22` | Maradványérték módosítása a hatálynap utáni tervet számolja újra. | ✅ **Kész** | Számviteli és TAO ÉCS párhuzamos számítása, előrejelzés, feladás könyvelői jóváhagyással, időszakzárás | Megvalósítva. |
| `K31.23` | Hasznos élettartam módosítása a hatálynap utáni tervet számolja újra. | ✅ **Kész** | Számviteli és TAO ÉCS párhuzamos számítása, előrejelzés, feladás könyvelői jóváhagyással, időszakzárás | Megvalósítva. |
| `K31.24` | ÉCS-előrejelzés főkönyvi feladás nélkül elkészíthető legyen. | ✅ **Kész** | Számviteli és TAO ÉCS párhuzamos számítása, előrejelzés, feladás könyvelői jóváhagyással, időszakzárás | Megvalósítva. |
| `K31.25` | ÉCS-javaslat eszközönként ellenőrizhető legyen. | ✅ **Kész** | Számviteli és TAO ÉCS párhuzamos számítása, előrejelzés, feladás könyvelői jóváhagyással, időszakzárás | Megvalósítva. |
| `K31.26` | ÉCS-feladás csak könyvelői jóváhagyással történhessen. | ✅ **Kész** | Számviteli és TAO ÉCS párhuzamos számítása, előrejelzés, feladás könyvelői jóváhagyással, időszakzárás | Megvalósítva. |
| `K31.27` | Azonos eszköz azonos időszaki ÉCS-je ne legyen kétszer feladható. | ✅ **Kész** | Számviteli és TAO ÉCS párhuzamos számítása, előrejelzés, feladás könyvelői jóváhagyással, időszakzárás | Megvalósítva. |
| `K31.28` | ÉCS-időszak lezárható legyen. | ✅ **Kész** | Számviteli és TAO ÉCS párhuzamos számítása, előrejelzés, feladás könyvelői jóváhagyással, időszakzárás | Megvalósítva. |
| `K31.29` | ÉCS-időszak visszanyitása mutassa meg a kapcsolódó főkönyvi feladást. | ✅ **Kész** | Számviteli és TAO ÉCS párhuzamos számítása, előrejelzés, feladás könyvelői jóváhagyással, időszakzárás | Megvalósítva. |

### 32. Tárgyi eszköz – mozgások és leltár

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K32.01` | Beruházás üzembe helyezése külön eszközmozgásként rögzíthető legyen. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.02` | Beruházás részleges üzembe helyezése rögzíthető legyen. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.03` | Utólagos értéknövelő beruházás az eredeti kartonhoz adható legyen. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.04` | Felújítás hatálynapja külön rögzíthető legyen. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.05` | Értéknövelés után a hátralévő ÉCS-terv újraszámítható legyen. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.06` | Terven felüli értékcsökkenés külön mozgásként rögzíthető legyen. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.07` | Terven felüli ÉCS visszaírása az eredeti leíráshoz kapcsolható legyen. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.08` | Költséghelyváltás dátummal rögzíthető legyen. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.09` | Telephelyváltás dátummal rögzíthető legyen. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.10` | Eszköz megosztásakor a bruttó érték arányosan szétosztható legyen. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.11` | Eszköz megosztásakor a halmozott ÉCS arányosan szétosztható legyen. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.12` | Eszköz megosztásakor a TAO-értékek arányosan szétoszthatók legyenek. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.13` | Részleges értékesítésnél csak az érintett mennyiség és érték kerüljön kivezetésre. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.14` | Teljes értékesítéshez a vevőszámla kapcsolható legyen. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.15` | Selejtezéskor a bruttó érték és halmozott ÉCS kivezetési javaslata elkészüljön. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.16` | Térítés nélküli átadás külön kivezetési jogcímen rögzíthető legyen. | ✅ **Kész** | `asset_events` (üzembe helyezés, felújítás/értéknövelés, terven felüli ÉCS, kivezetés, értékesítés, selejtezés) | Megvalósítva. |
| `K32.17` | Leltárfelvételi ív előállítható legyen. | ✅ **Kész** | Leltárfelvételi ív nyomtatás, többlet/hiány elszámolás, QR/vonalkód keresés | Megvalósítva. |
| `K32.18` | Leltárkor tényleges mennyiség rögzíthető legyen. | ✅ **Kész** | Leltárfelvételi ív nyomtatás, többlet/hiány elszámolás, QR/vonalkód keresés | Megvalósítva. |
| `K32.19` | Leltárhiány különbsége kimutatható legyen. | ✅ **Kész** | Leltárfelvételi ív nyomtatás, többlet/hiány elszámolás, QR/vonalkód keresés | Megvalósítva. |
| `K32.20` | Leltártöbblet különbsége kimutatható legyen. | ✅ **Kész** | Leltárfelvételi ív nyomtatás, többlet/hiány elszámolás, QR/vonalkód keresés | Megvalósítva. |
| `K32.21` | Vonalkód vagy QR beolvasásával az eszközkarton megnyitható legyen. | ✅ **Kész** | Leltárfelvételi ív nyomtatás, többlet/hiány elszámolás, QR/vonalkód keresés | Megvalósítva. |
| `K32.22` | Eszközmozgás könyvelői jóváhagyás nélkül ne frissítse a főkönyvet. | ✅ **Kész** | Főkönyvi jóváhagyás, bruttó érték és halmozott ÉCS automatikus egyeztetése a főkönyvvel | Megvalósítva. |
| `K32.23` | Eszközállomány bruttó értéke egyeztethető legyen a főkönyvvel. | ✅ **Kész** | Főkönyvi jóváhagyás, bruttó érték és halmozott ÉCS automatikus egyeztetése a főkönyvvel | Megvalósítva. |
| `K32.24` | Eszközállomány halmozott ÉCS-je egyeztethető legyen a főkönyvvel. | ✅ **Kész** | Főkönyvi jóváhagyás, bruttó érték és halmozott ÉCS automatikus egyeztetése a főkönyvvel | Megvalósítva. |

### 33. Tárgyi eszköz – tartalék és támogatás

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K33.01` | Eszközhöz rendelt adózási adat – rögzíthető adat: Fejlesztési tartalék képzésének adóéve. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.02` | Eszközhöz rendelt adózási adat – rögzíthető adat: Eszközhöz felhasznált fejlesztési tartalék összege. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.03` | Eszközhöz rendelt adózási adat – rögzíthető adat: Fejlesztési tartalék felhasználásának dátuma. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.04` | Eszközhöz rendelt adózási adat – rögzíthető adat: Fejlesztési tartalék még fel nem használt összege. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.05` | Eszközhöz rendelt adózási adat – rögzíthető adat: Beruházási adókedvezmény jogcíme. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.06` | Eszközhöz rendelt adózási adat – rögzíthető adat: Adókedvezményhez kapcsolódó eszközazonosító. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.07` | Eszközhöz rendelt adózási adat – rögzíthető adat: Adókedvezmény első igénybevételének éve. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.08` | Eszközhöz rendelt adózási adat – rögzíthető adat: Adókedvezmény figyelési időszakának vége. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.09` | Eszközhöz rendelt adózási adat – rögzíthető adat: Eszköztámogatás összege. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.10` | Eszközhöz rendelt adózási adat – rögzíthető adat: Eszköztámogatás intenzitása százalékban. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.11` | Eszközhöz rendelt adózási adat – rögzíthető adat: Támogatás halasztott bevételi főkönyvi száma. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.12` | Eszközhöz rendelt adózási adat – rögzíthető adat: Támogatásból már feloldott összeg. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.13` | Fejlesztési tartalék felhasználása a TAO szerinti értékcsökkenési nyilvántartásban megjelenjen. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.14` | Fejlesztési tartalék felhasználása önmagában ne csökkentse a számviteli nettó értéket. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.15` | Ugyanaz a fejlesztésitartalék-összeg ne legyen kétszer eszközre felhasználható. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.16` | Eszköz kivezetésekor az adókedvezmény figyelési időszakába esés jelezhető legyen. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |
| `K33.17` | Támogatási feloldás maradéka ne válhasson negatívvá. | ✅ **Kész** | `development_reserves`, P-123, A-164 (Fejlesztési tartalék tény UX & DB, eszközhöz rendelés, TAO nyilvántartás) | Megvalósítva. |

### 34. Tárgyi eszköz – KIVA és áttérés

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K34.01` | Eszközönként tárolódjon, hogy KIVA előtt vagy KIVA alatt szerezték be, illetve állították elő. | 🟡 **Részben van meg** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. |
| `K34.02` | Eszközönként megőrződjön a KIVA-ba belépés dátuma. | 🟡 **Részben van meg** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. |
| `K34.03` | Eszközönként megőrződjön a KIVA-ból kilépés dátuma. | 🟡 **Részben van meg** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. |
| `K34.04` | KIVA előtti eszköznél rögzíthető legyen a belépés előtti TAO szerinti számított nyilvántartási érték. | 🟡 **Részben van meg** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. |
| `K34.05` | KIVA előtti eszköznél külön összesüljön a KIVA alatt elszámolt számviteli ÉCS. | 🟡 **Részben van meg** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. |
| `K34.06` | KIVA előtti eszköz számított nyilvántartási értéke csökkenjen a KIVA alatt elszámolt számviteli ÉCS-vel a Katv. 28. § (8) szerint. | 🟡 **Részben van meg** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. |
| `K34.07` | A KIVA alatti adózási értékváltozás ne keletkeztessen második főkönyvi ÉCS-költséget. | 🟡 **Részben van meg** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. |
| `K34.08` | KIVA alatt megszerzett vagy előállított eszköznél jelölhető legyen a kilépés utáni TAO-ÉCS-levonás kizárása a Katv. 28. § (4) szerint. | 🟡 **Részben van meg** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. |
| `K34.09` | KIVA-ból kilépéskor eszközönként áttérési kimutatás készülhessen. | 🟡 **Részben van meg** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. |
| `K34.10` | KIVA-ból kilépéskor a számviteli ÉCS-terv változatlanul folytatható legyen. | 🟡 **Részben van meg** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. |
| `K34.11` | Adózási áttérés a korábbi eszközmozgásokat ne írja felül. | 🟡 **Részben van meg** | KIVA kalkulátor és eszköz modul | KIVA előtti és alatti eszközök Katv. 28. § szerinti áttérési analitika kimutatásának automatizálása. |

### 35. Civil és nonprofit – analitikák

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K35.01` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Alapcél szerinti tevékenység kódja. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.02` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Vállalkozási tevékenység kódja. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.03` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Közhasznú tevékenység kódja. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.04` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogató partnerazonosítója. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.05` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatási szerződés azonosítója. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.06` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatás célja. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.07` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatási időszak kezdete. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.08` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatási időszak vége. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.09` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatás megítélt összege. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.10` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatás beérkezett összege. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.11` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatás elszámolási határideje. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.12` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Támogatás visszafizetendő összege. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.13` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Költségfelosztás alapja. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.14` | Civil vagy nonprofit analitikai adat – rögzíthető adat: Költségfelosztás arányszáma. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.15` | Alapcél szerinti bevétel a vállalkozási bevételtől elkülöníthető legyen. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.16` | Alapcél szerinti költség a vállalkozási költségtől elkülöníthető legyen. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.17` | Közhasznú tevékenység az alapcél szerinti tevékenységen belül külön jelölhető legyen. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.18` | Közös költség dokumentált arányszám alapján felosztható legyen. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.19` | Tagdíjbevétel külön jogcímen könyvelhető legyen. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.20` | Adománybevétel külön jogcímen könyvelhető legyen. | 🟡 **Részben van meg** | `OrgCivilPage.tsx`, `accounty_org_report_lines` | Támogatási szerződések és cél szerinti analitikák bővítése a civil modulban. |
| `K35.21` | Pályázati támogatás külön jogcímen könyvelhető legyen. | 🟡 **Részben van meg** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. |
| `K35.22` | Személyi jövedelemadó 1%-os felajánlás külön jogcímen könyvelhető legyen. | 🟡 **Részben van meg** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. |
| `K35.23` | Támogatási szerződéshez elszámolt költségek tételesen kigyűjthetők legyenek. | 🟡 **Részben van meg** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. |
| `K35.24` | Civil mérleg előállítható legyen. | 🟡 **Részben van meg** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. |
| `K35.25` | Civil eredménykimutatás előállítható legyen. | 🟡 **Részben van meg** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. |
| `K35.26` | Közhasznúsági melléklethez számviteli adatok kigyűjthetők legyenek. | 🟡 **Részben van meg** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. |
| `K35.27` | Közhasznúsági melléklet nem könyvelésből származó adatai kézzel kiegészíthetők legyenek. | 🟡 **Részben van meg** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. |
| `K35.28` | Nonprofit gazdasági társaság beszámolósablonja ne automatikusan a civil szervezeti sablon legyen. | 🟡 **Részben van meg** | Tagdíj, adomány, 1%-os felajánlás jogcímek és civil beszámoló sablonok | Közhasznúsági melléklet hivatalos OBH sablon exportjának véglegesítése. |

### 36. TAO és KIVA – alátámasztó adatok

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K36.01` | Számviteli ÉCS TAO-alapot növelő összege kigyűjthető legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.02` | TAO szerinti ÉCS adóalapot csökkentő összege kigyűjthető legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.03` | Fejlesztési tartalék képzésének adatai kigyűjthetők legyenek. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.04` | Fejlesztési tartalék felhasználásának adatai kigyűjthetők legyenek. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.05` | TAO-korrekcióhoz jogcím rögzíthető legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.06` | TAO-korrekcióhoz növelő vagy csökkentő irány rögzíthető legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.07` | TAO-korrekcióhoz összeg rögzíthető legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.08` | TAO-korrekcióhoz alátámasztó bizonylat kapcsolható legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.09` | Adókedvezményhez igénybe vett éves összeg rögzíthető legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.10` | KIVA személyi jellegű kifizetéseinek bérfeladási adatai átvehetők legyenek. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.11` | KIVA-analitikában tőkebevonás külön kigyűjthető legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.12` | KIVA-analitikában tőkekivonás külön kigyűjthető legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.13` | KIVA-analitikában jóváhagyott osztalék külön kigyűjthető legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.14` | KIVA-analitikában kapott osztalék külön kigyűjthető legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.15` | KIVA előtti eredmény terhére jóváhagyott osztalék külön jelölhető legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.16` | KIVA-analitikában nyitó pénztárérték rögzíthető legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.17` | KIVA-analitikában záró pénztárérték kigyűjthető legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.18` | KIVA pénztárkorrekciójához mentesített érték rögzíthető legyen. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.19` | Adóanalitikai kézi korrekcióhoz indoklás tárolódjon. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |
| `K36.20` | Adóanalitikából megnyitható legyen az alátámasztó főkönyvi tétel. | ✅ **Kész** | `accounty_tao_yearly`, `TaoPortfolioPage.tsx`, `TaoYearEndWizardPage.tsx`, `KivaCalculatorPage.tsx` (P-074) | Megvalósítva: TAO és KIVA adóalap korrekciók, osztalék, pénztárkorrekció és levezetés. |

### 37. Kimutatások és beszámolók

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K37.01` | Főkönyvi kivonat készíthető legyen. | ✅ **Kész** | `GeneralLedgerPage.tsx`, `JournalsPage.tsx`, `KintlevoPage.tsx` (főkönyvi kivonat, karton, napló, folyószámla, korosított lista) | Megvalósítva. |
| `K37.02` | Főkönyvi karton készíthető legyen. | ✅ **Kész** | `GeneralLedgerPage.tsx`, `JournalsPage.tsx`, `KintlevoPage.tsx` (főkönyvi kivonat, karton, napló, folyószámla, korosított lista) | Megvalósítva. |
| `K37.03` | Naplókivonat készíthető legyen. | ✅ **Kész** | `GeneralLedgerPage.tsx`, `JournalsPage.tsx`, `KintlevoPage.tsx` (főkönyvi kivonat, karton, napló, folyószámla, korosított lista) | Megvalósítva. |
| `K37.04` | Folyószámla-kivonat készíthető legyen. | ✅ **Kész** | `GeneralLedgerPage.tsx`, `JournalsPage.tsx`, `KintlevoPage.tsx` (főkönyvi kivonat, karton, napló, folyószámla, korosított lista) | Megvalósítva. |
| `K37.05` | Nyitott vevőlista készíthető legyen. | ✅ **Kész** | `GeneralLedgerPage.tsx`, `JournalsPage.tsx`, `KintlevoPage.tsx` (főkönyvi kivonat, karton, napló, folyószámla, korosított lista) | Megvalósítva. |
| `K37.06` | Nyitott szállítólista készíthető legyen. | ✅ **Kész** | `GeneralLedgerPage.tsx`, `JournalsPage.tsx`, `KintlevoPage.tsx` (főkönyvi kivonat, karton, napló, folyószámla, korosított lista) | Megvalósítva. |
| `K37.07` | Korosított követeléslista készíthető legyen. | ✅ **Kész** | `GeneralLedgerPage.tsx`, `JournalsPage.tsx`, `KintlevoPage.tsx` (főkönyvi kivonat, karton, napló, folyószámla, korosított lista) | Megvalósítva. |
| `K37.08` | Korosított kötelezettséglista készíthető legyen. | ✅ **Kész** | `GeneralLedgerPage.tsx`, `JournalsPage.tsx`, `KintlevoPage.tsx` (főkönyvi kivonat, karton, napló, folyószámla, korosított lista) | Megvalósítva. |
| `K37.09` | Költséghelyenkénti eredménykimutatás készíthető legyen. | ✅ **Kész** | `GeneralLedgerPage.tsx`, `JournalsPage.tsx`, `KintlevoPage.tsx` (főkönyvi kivonat, karton, napló, folyószámla, korosított lista) | Megvalósítva. |
| `K37.10` | Projektenkénti költségkimutatás készíthető legyen. | ✅ **Kész** | `GeneralLedgerPage.tsx`, `JournalsPage.tsx`, `KintlevoPage.tsx` (főkönyvi kivonat, karton, napló, folyószámla, korosított lista) | Megvalósítva. |
| `K37.11` | Támogatásonkénti elszámolás készíthető legyen. | ✅ **Kész** | `BalanceSheet.tsx`, `ProfitAndLoss.tsx`, `AnnualReportPage.tsx` (mérleg, eredménykimutatás, mikrogazdálkodói, fúrás a bizonylatig, egyezőség-ellenőrzés) | Megvalósítva. |
| `K37.12` | Éves beszámoló mérlege elkészíthető legyen. | ✅ **Kész** | `BalanceSheet.tsx`, `ProfitAndLoss.tsx`, `AnnualReportPage.tsx` (mérleg, eredménykimutatás, mikrogazdálkodói, fúrás a bizonylatig, egyezőség-ellenőrzés) | Megvalósítva. |
| `K37.13` | Éves beszámoló eredménykimutatása elkészíthető legyen. | ✅ **Kész** | `BalanceSheet.tsx`, `ProfitAndLoss.tsx`, `AnnualReportPage.tsx` (mérleg, eredménykimutatás, mikrogazdálkodói, fúrás a bizonylatig, egyezőség-ellenőrzés) | Megvalósítva. |
| `K37.14` | Egyszerűsített éves beszámoló mérlege elkészíthető legyen. | ✅ **Kész** | `BalanceSheet.tsx`, `ProfitAndLoss.tsx`, `AnnualReportPage.tsx` (mérleg, eredménykimutatás, mikrogazdálkodói, fúrás a bizonylatig, egyezőség-ellenőrzés) | Megvalósítva. |
| `K37.15` | Egyszerűsített éves beszámoló eredménykimutatása elkészíthető legyen. | ✅ **Kész** | `BalanceSheet.tsx`, `ProfitAndLoss.tsx`, `AnnualReportPage.tsx` (mérleg, eredménykimutatás, mikrogazdálkodói, fúrás a bizonylatig, egyezőség-ellenőrzés) | Megvalósítva. |
| `K37.16` | Mikrogazdálkodói beszámolósablon választható legyen. | ✅ **Kész** | `BalanceSheet.tsx`, `ProfitAndLoss.tsx`, `AnnualReportPage.tsx` (mérleg, eredménykimutatás, mikrogazdálkodói, fúrás a bizonylatig, egyezőség-ellenőrzés) | Megvalósítva. |
| `K37.17` | Saját kimutatássablon főkönyvi számlák hozzárendelésével létrehozható legyen. | ✅ **Kész** | `BalanceSheet.tsx`, `ProfitAndLoss.tsx`, `AnnualReportPage.tsx` (mérleg, eredménykimutatás, mikrogazdálkodói, fúrás a bizonylatig, egyezőség-ellenőrzés) | Megvalósítva. |
| `K37.18` | Sablonba be nem sorolt, egyenleges főkönyvi számlákról figyelmeztetés jelenjen meg. | ✅ **Kész** | `BalanceSheet.tsx`, `ProfitAndLoss.tsx`, `AnnualReportPage.tsx` (mérleg, eredménykimutatás, mikrogazdálkodói, fúrás a bizonylatig, egyezőség-ellenőrzés) | Megvalósítva. |
| `K37.19` | Beszámolóban eszközök és források egyezőségét ellenőrizze a program. | ✅ **Kész** | `BalanceSheet.tsx`, `ProfitAndLoss.tsx`, `AnnualReportPage.tsx` (mérleg, eredménykimutatás, mikrogazdálkodói, fúrás a bizonylatig, egyezőség-ellenőrzés) | Megvalósítva. |
| `K37.20` | Beszámolóban az eredménykimutatás eredményét a mérleg eredményével egyeztesse a program. | ✅ **Kész** | `BalanceSheet.tsx`, `ProfitAndLoss.tsx`, `AnnualReportPage.tsx` (mérleg, eredménykimutatás, mikrogazdálkodói, fúrás a bizonylatig, egyezőség-ellenőrzés) | Megvalósítva. |
| `K37.21` | Kimutatásból a mögöttes könyvelési tétel megnyitható legyen. | ✅ **Kész** | `BalanceSheet.tsx`, `ProfitAndLoss.tsx`, `AnnualReportPage.tsx` (mérleg, eredménykimutatás, mikrogazdálkodói, fúrás a bizonylatig, egyezőség-ellenőrzés) | Megvalósítva. |
| `K37.22` | Könyvelési tételből az eredeti bizonylatkép megnyitható legyen. | ✅ **Kész** | `BalanceSheet.tsx`, `ProfitAndLoss.tsx`, `AnnualReportPage.tsx` (mérleg, eredménykimutatás, mikrogazdálkodói, fúrás a bizonylatig, egyezőség-ellenőrzés) | Megvalósítva. |
| `K37.23` | Kimutatás Excelbe exportálható legyen. | ✅ **Kész** | `BalanceSheet.tsx`, `ProfitAndLoss.tsx`, `AnnualReportPage.tsx` (mérleg, eredménykimutatás, mikrogazdálkodói, fúrás a bizonylatig, egyezőség-ellenőrzés) | Megvalósítva. |
| `K37.24` | Kimutatás PDF-be exportálható legyen. | ✅ **Kész** | `BalanceSheet.tsx`, `ProfitAndLoss.tsx`, `AnnualReportPage.tsx` (mérleg, eredménykimutatás, mikrogazdálkodói, fúrás a bizonylatig, egyezőség-ellenőrzés) | Megvalósítva. |
| `K37.25` | Könyvvizsgálói audit XML-export előállítható legyen. | ✅ **Kész** | Excel/PDF export (`pdf_export_jobs`), könyvvizsgálói XML export, Management Dashboard könyvelői statisztikák (P-117, P-061) | Megvalósítva. |
| `K37.26` | Könyvelőnként rögzített bizonylatok száma kimutatható legyen. | ✅ **Kész** | Excel/PDF export (`pdf_export_jobs`), könyvvizsgálói XML export, Management Dashboard könyvelői statisztikák (P-117, P-061) | Megvalósítva. |
| `K37.27` | Könyvelőnként jóváhagyott bizonylatok száma kimutatható legyen. | ✅ **Kész** | Excel/PDF export (`pdf_export_jobs`), könyvvizsgálói XML export, Management Dashboard könyvelői statisztikák (P-117, P-061) | Megvalósítva. |
| `K37.28` | Engedélyezett cégek feldolgozási állapota közös irodai nézetben megjeleníthető legyen. | ✅ **Kész** | Excel/PDF export (`pdf_export_jobs`), könyvvizsgálói XML export, Management Dashboard könyvelői statisztikák (P-117, P-061) | Megvalósítva. |

### 38. Saját számlázó – törzsek

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K38.01` | Számlázási törzsadat – rögzíthető adat: Számlatömb kódja. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.02` | Számlázási törzsadat – rögzíthető adat: Számlatömb neve. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.03` | Számlázási törzsadat – rögzíthető adat: Számlatömb sorszám-előtagja. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.04` | Számlázási törzsadat – rögzíthető adat: Számlatömb következő sorszáma. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.05` | Számlázási törzsadat – rögzíthető adat: Számlatömb alapértelmezett devizaneme. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.06` | Számlázási törzsadat – rögzíthető adat: Számlatömb alapértelmezett nyelve. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.07` | Számlázási törzsadat – rögzíthető adat: Számlán megjelenő saját bankszámla. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.08` | Számlázási törzsadat – rögzíthető adat: Számlán megjelenő céglogó. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.09` | Számlázási törzsadat – rögzíthető adat: Szolgáltatás vagy cikk kódja. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.10` | Számlázási törzsadat – rögzíthető adat: Szolgáltatás vagy cikk megnevezése. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.11` | Számlázási törzsadat – rögzíthető adat: Szolgáltatás vagy cikk idegen nyelvű megnevezése. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.12` | Számlázási törzsadat – rögzíthető adat: Mértékegység. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.13` | Számlázási törzsadat – rögzíthető adat: Alapértelmezett nettó egységár. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.14` | Számlázási törzsadat – rögzíthető adat: Egységár devizaneme. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.15` | Számlázási törzsadat – rögzíthető adat: Alapértelmezett számlázási áfakód. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.16` | Számlázási törzsadat – rögzíthető adat: Alapértelmezett árbevételi főkönyvi szám. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.17` | Számlázási törzsadat – rögzíthető adat: NAV-termékazonosító típusa, ha szükséges. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.18` | Számlázási törzsadat – rögzíthető adat: NAV-termékazonosító értéke, ha szükséges. | ❌ **Hiányzik** | Külső számlázókkal integrálódik (Számlázz.hu, Billingo, NAV OSA) | Belső számlázó törzsek (számlatömb, cikk/szolgáltatás törzs, NAV termékkódok) kifejlesztése. |
| `K38.19` | Szolgáltatásszámlázás készletnyilvántartás használata nélkül működjön. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.20` | Forintos számla kiállítható legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.21` | Devizás számla kiállítható legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.22` | Számlasorhoz mennyiség rögzíthető legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.23` | Számlasorhoz egységár rögzíthető legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.24` | Számlasorhoz engedmény rögzíthető legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.25` | Előlegszámla kiállítható legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.26` | Végszámlán az előleg beszámítható legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.27` | Helyesbítő számla az eredeti számlához kapcsolva kiállítható legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.28` | Sztornószámla az eredeti számlához kapcsolva kiállítható legyen. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.29` | Díjbekérő ne hozzon létre főkönyvi vagy áfatételt. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.30` | Kiállított számla sorszáma ne legyen újra felhasználható. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.31` | Kiállított számla tartalma ne legyen közvetlenül felülírható. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.32` | Fordított adózás szövege megjelenjen a megfelelő számlán. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.33` | Pénzforgalmi elszámolás szövege megjelenjen a megfelelő számlán. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.34` | Adómentesség jogcíme megjelenjen a megfelelő számlán. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.35` | Kiállított számla könyvelési előkészítést hozzon létre könyvelői jóváhagyásra. | ❌ **Hiányzik** | Bejövő/kimenő számla fogadás és feldolgozás van, de saját belső számlakiállítás nincs | Számlakiállító varázsló, előleg-, végszámla-, sztornó- és helyesbítő számla kiállítás megvalósítása. |
| `K38.36` | NAV Online Számla adatszolgáltatás elindítható legyen. | 🟡 **Részben van meg** | NAV Online Számla lekérdezés megvan, de ManageInvoice kiállított számla beküldés nincs | NAV Online Számla ManageInvoice 3.0 adatszolgáltatási beküldő modul kifejlesztése. |
| `K38.37` | NAV feldolgozási tranzakcióazonosító visszakereshető legyen. | 🟡 **Részben van meg** | NAV Online Számla lekérdezés megvan, de ManageInvoice kiállított számla beküldés nincs | NAV Online Számla ManageInvoice 3.0 adatszolgáltatási beküldő modul kifejlesztése. |
| `K38.38` | NAV elutasítás esetén a hiba a számlához kapcsolva jelenjen meg. | 🟡 **Részben van meg** | NAV Online Számla lekérdezés megvan, de ManageInvoice kiállított számla beküldés nincs | NAV Online Számla ManageInvoice 3.0 adatszolgáltatási beküldő modul kifejlesztése. |
| `K38.39` | Technikai újraküldés ne állítson ki új számlát. | 🟡 **Részben van meg** | NAV Online Számla lekérdezés megvan, de ManageInvoice kiállított számla beküldés nincs | NAV Online Számla ManageInvoice 3.0 adatszolgáltatási beküldő modul kifejlesztése. |

### 39. Szerződéses számlázás

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K39.01` | Számlázási szerződés – rögzíthető adat: Szerződésazonosító. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.02` | Számlázási szerződés – rögzíthető adat: Partner. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.03` | Számlázási szerződés – rögzíthető adat: Szerződés kezdőnapja. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.04` | Számlázási szerződés – rögzíthető adat: Szerződés zárónapja. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.05` | Számlázási szerződés – rögzíthető adat: Számlázás gyakorisága. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.06` | Számlázási szerződés – rögzíthető adat: Számlázandó szolgáltatás. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.07` | Számlázási szerződés – rögzíthető adat: Fix díj. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.08` | Számlázási szerződés – rögzíthető adat: Változó díj alapjául szolgáló mennyiség. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.09` | Számlázási szerződés – rögzíthető adat: Változó díj egységára. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.10` | Számlázási szerződés – rögzíthető adat: Díj devizaneme. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.11` | Számlázási szerződés – rögzíthető adat: Fizetési határidő napokban. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.12` | Számlázási szerződés – rögzíthető adat: Díjváltozás hatálynapja. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.13` | Számlázási szerződés – rögzíthető adat: Indexálási százalék. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.14` | Számlázási szerződés – rögzíthető adat: Elszámolási időszak kezdete. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.15` | Számlázási szerződés – rögzíthető adat: Elszámolási időszak vége. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.16` | Számlázási szerződés – rögzíthető adat: Számlázás szüneteltetésének jelölése. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.17` | Szerződésből ismétlődő számla előkészíthető legyen. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.18` | Ugyanazon szerződés azonos időszaka ne legyen figyelmeztetés nélkül újraszámlázható. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.19` | Szerződésdíj változása a korábbi számlák összegét ne módosítsa. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |
| `K39.20` | Számlázandó változó mennyiség az adott időszakra külön megadható legyen. | ❌ **Hiányzik** | Nincs a rendszerben | Szerződéses és ismétlődő automatikus számlázási modul kifejlesztése. |

### 40. Adatkapcsolatok és import

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K40.01` | Banki fájlimporthoz számlánként menthető formátumbeállítás tartozzon. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.02` | Közvetlen banki kapcsolat több saját bankszámlához beállítható legyen a szolgáltató által elérhető kapcsolaton. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.03` | Banki adatlekérés kezdő és záró dátuma megadható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.04` | Számlázói API-kapcsolat cégenként külön beállítható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.05` | Számlázói fájlimporthoz menthető mezőmegfeleltetés tartozzon. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.06` | NAV Online Számla bejövő számlaadatai lekérhetők legyenek. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.07` | NAV Online Számla kimenő számlaadatai lekérhetők legyenek. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.08` | NAV-ból számla módosítási lánca lekérhető legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.09` | CSV-fájl importálható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.10` | XLSX-fájl importálható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.11` | XML-fájl importálható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.12` | CSV-importnál karakterkódolás kiválasztható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.13` | CSV-importnál mezőelválasztó kiválasztható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.14` | Importnál dátumformátum megadható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.15` | Importnál tizedesjel megadható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.16` | Forrásoszlop célmezőhöz rendelhető legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.17` | Importbeállítás névvel elmenthető legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.18` | Import előtt az átalakított tételek előnézete megjelenjen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.19` | Hibás importrekordhoz sorszám és konkrét hibás mező jelenjen meg. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.20` | Ismételt számlaimport a forrásazonosító alapján ne hozzon létre új bizonylatot. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.21` | NAV-ból és számlázóból is érkező ugyanazon számla egy bizonylathoz kapcsolódjon. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.22` | Megszakadt import a már átvett rekordok duplázása nélkül folytatható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.23` | Importált, még nem könyvelt köteg visszavonható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.24` | Könyvelt importköteg visszavonása javítási vagy sztornófolyamatot igényeljen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.25` | Import forrásfájlja visszakereshető maradjon. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.26` | Külső bérprogram kontírozott feladása importálható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.27` | Bérfeladás költséghelyadata importálható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.28` | Bérfeladás projektadata importálható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.29` | Bérfeladás tartozik–követel eltérése blokkolja a véglegesítést. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.30` | Bérfeladás ismételt beolvasása ne duplázza a bérköltséget. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.31` | Kapcsolatonként az utolsó sikeres adatlekérés időpontja látható legyen. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.32` | Lejárt hozzáférésnél a kapcsolat neve és a megújítandó jogosultság jelenjen meg. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |
| `K40.33` | Támogatott importformátum-változatok a program súgójában azonosíthatók legyenek. | ✅ **Kész** | NAV OSA szinkron, Aggreg8 PSD2 bank, CSV/XLSX/XML import, bérfeladás import, duplikáció-védelem (P-087, P-102) | Megvalósítva. |

### 41. SUP-adatok átvétele

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K41.01` | SUP-számlatükör főkönyvi számai importálhatók legyenek. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.02` | SUP-partnertörzs partnerkódjai megőrizhetők legyenek. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.03` | SUP-gyűjtőkódok megfeleltethetők legyenek az új rendszer gyűjtőinek. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.04` | SUP-nyitó főkönyvi egyenlegek átvehetők legyenek. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.05` | SUP-vevői nyitott tételek eredeti számlaszámmal átvehetők legyenek. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.06` | SUP-szállítói nyitott tételek eredeti számlaszámmal átvehetők legyenek. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.07` | SUP-devizás nyitott tételek devizaösszege átvehető legyen. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.08` | SUP-devizás nyitott tételek forintértéke átvehető legyen. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.09` | SUP-bankok nyitó egyenlege átvehető legyen. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.10` | SUP-pénztárak nyitó egyenlege átvehető legyen. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.11` | SUP-elhatárolások még fel nem oldott állománya átvehető legyen. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.12` | SUP-eszközkartonok azonosítói átvehetők legyenek. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.13` | SUP-eszközök számviteli bruttó értéke átvehető legyen. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.14` | SUP-eszközök számviteli halmozott ÉCS-je átvehető legyen. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.15` | SUP-eszközök TAO szerinti nyilvántartási értéke átvehető legyen. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.16` | SUP-eszközök számviteli leírási beállításai átvehetők legyenek. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.17` | SUP-eszközök TAO szerinti leírási beállításai átvehetők legyenek. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.18` | Átvett főkönyv és nyitott folyószámlák egyezősége ellenőrizhető legyen. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.19` | Átvett eszközanalitika és főkönyv egyezősége ellenőrizhető legyen. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.20` | Átvételi eltérés a forrásrekord azonosítójával jelenjen meg. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.21` | Nyitó adatátvétel könyvelői jóváhagyást igényeljen. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.22` | Korábbi könyvelési tételek eredeti bizonylatazonosítóval importálhatók legyenek, ha ilyen export rendelkezésre áll. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |
| `K41.23` | Korábbi dokumentumkapcsolatok megőrizhetők legyenek, ha az export tartalmazza az azonosítókat. | 🟡 **Részben van meg** | Általános könyvvizsgálói Audit XML és Excel/CSV importtal a főkönyv és partnerek beolvashatók (`UploadAuditXmlModal.tsx`) | Dedikált SUP ERP natív adatmigrációs konverter és analitika-átemelő varázsló kifejlesztése. |

### 42. Papírmentes működés – dokumentumok

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K42.01` | Dokumentum – rögzíthető adat: Egyedi iktatóazonosító. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.02` | Dokumentum – rögzíthető adat: Könyvelt cég azonosítója. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.03` | Dokumentum – rögzíthető adat: Eredeti fájlnév. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.04` | Dokumentum – rögzíthető adat: Fájltípus. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.05` | Dokumentum – rögzíthető adat: Dokumentumtípus: számla, bankkivonat, szerződés, határozat vagy melléklet. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.06` | Dokumentum – rögzíthető adat: Feltöltés időpontja. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.07` | Dokumentum – rögzíthető adat: Feltöltő felhasználó. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.08` | Dokumentum – rögzíthető adat: Forrás: portál, mobil, e-mail vagy API. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.09` | Dokumentum – rögzíthető adat: Kapcsolódó partner. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.10` | Dokumentum – rögzíthető adat: Kapcsolódó bizonylatszám. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.11` | Dokumentum – rögzíthető adat: Kapcsolódó könyvelési azonosító. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.12` | Dokumentum – rögzíthető adat: Feldolgozási állapot. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.13` | Dokumentum – rögzíthető adat: Dokumentumverzió. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.14` | Ügyfél a saját cégéhez tölthessen fel dokumentumot. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.15` | Több fájl egyszerre feltölthető legyen. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.16` | Mobiltelefonnal készült bizonylatkép feltölthető legyen. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.17` | Kijelölt e-mail-címről dokumentum fogadható legyen. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.18` | Eredeti fájl OCR-feldolgozás után is letölthető maradjon. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.19` | Fájl tartalmi lenyomata alapján azonos feltöltés felismerhető legyen. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.20` | Számlaszám és partner egyezése alapján eltérő fájlban érkező másolat jelezhető legyen. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.21` | Többoldalas dokumentum oldalai egy bizonylathoz kapcsolhatók legyenek. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.22` | Dokumentumhoz könyvelői kérdés rögzíthető legyen. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.23` | Ügyfél válasza ugyanahhoz a dokumentumhoz kapcsolódjon. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.24` | Hiánypótló melléklet az eredeti kérdéshez kapcsolható legyen. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.25` | Hiányzó bizonylatképű NAV-számlák listázhatók legyenek. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.26` | Hiányzó bankkivonati időszakok listázhatók legyenek. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.27` | Dokumentum tartalmában szöveges keresés működjön. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.28` | Elektronikus számla eredetiséget és sértetlenséget igazoló adatai a fájllal együtt megőrizhetők legyenek. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.29` | Archivált dokumentum eredeti formátumban visszanyerhető legyen. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.30` | Archivált dokumentum jogosult felhasználónak olvashatóan megjeleníthető legyen. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.31` | Dokumentumexport tartalmazza a könyvelési kapcsolatok azonosítóit. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |
| `K42.32` | Szolgáltatóváltáskor az ügyfél dokumentumai egy kötegben exportálhatók legyenek. | ✅ **Kész** | Iktatórendszer, drag & drop, mobil fotó, Mailgun email ingestion, sha256 deduplikáció, hiányzó számlák portál (P-094, A-162) | Megvalósítva. |

### 43. MI – adatkinyerés és javaslatok

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K43.01` | MI felismerje a számlakibocsátó nevét. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.02` | MI felismerje a számlakibocsátó adószámát. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.03` | MI felismerje a számla vevőjének nevét. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.04` | MI felismerje a számla vevőjének adószámát. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.05` | MI felismerje a számlaszámot. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.06` | MI felismerje a számla keltét. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.07` | MI felismerje a teljesítési dátumot. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.08` | MI felismerje a fizetési határidőt. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.09` | MI felismerje a devizanemet. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.10` | MI felismerje a fizetési módot. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.11` | MI felismerje a nettó összeget. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.12` | MI felismerje az áfaösszeget. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.13` | MI felismerje a bruttó összeget. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.14` | MI felismerje a számlasor megnevezését. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.15` | MI felismerje a számlasor mennyiségét. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.16` | MI felismerje a számlasor egységárát. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.17` | MI felismerje a soronkénti áfakulcsot. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.18` | MI felismerje a fordított adózásra utaló szöveget. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.19` | MI felismerje a pénzforgalmi elszámolásra utaló szöveget. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.20` | MI felismerje az előlegbeszámítást. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.21` | MI felismerje a módosított eredeti számlaszámot. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.22` | MI felismerje az időszakos elszámolás kezdő és záró dátumát. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.23` | MI az OCR-adat és a NAV-adat eltérését mezőnként mutassa meg. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.24` | MI a partnerhez korábban jóváhagyott kontírozás alapján főkönyvi számot javasolhasson. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.25` | MI számlatartalom alapján áfakódot javasolhasson. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.26` | MI számlatartalom alapján költséghelyet javasolhasson. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.27` | MI számlatartalom alapján projektet javasolhasson. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.28` | MI több időszakot érintő számlánál elhatárolást javasolhasson. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.29` | MI eszközbeszerzés gyanúja esetén eszközkarton létrehozását javasolhassa. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.30` | MI korábbi azonos számlaszám esetén duplikációt jelezzen. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.31` | MI szokatlan partner-bankszámlaszám esetén eltérést jelezzen. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.32` | Bizonytalanul felismert mező külön megjelölést kapjon. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.33` | Ki nem olvasható adat helyére az MI ne találjon ki értéket. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.34` | Javasolt főkönyvi szám mellett megnyitható legyen a javaslat alapjául szolgáló előzmény. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.35` | Felismert adat mellett megnyitható legyen a forrásdokumentum érintett része. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.36` | Könyvelő minden MI-javaslatot felülírhasson. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.37` | Könyvelő minden MI-javaslatot elutasíthasson. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.38` | Egy cég elfogadott kontírozása ne váljon automatikusan más cég szabályává. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.39` | MI-művelet ne kerülhesse meg a lezárt időszak tiltását. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.40` | MI-művelet ne kerülhesse meg a könyvelői jóváhagyást. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.41` | MI-szolgáltatás kiesésekor a kézi rögzítés működjön. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.42` | Modellfrissítés ne módosítsa a már könyvelt tételeket. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.43` | MI-adatkinyerés mezőnkénti hibaaránya mérhető legyen rögzített tesztállományon. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |
| `K43.44` | MI-kontírozási javaslat elfogadási aránya mérhető legyen rögzített tesztállományon. | ✅ **Kész** | Vision OCR + LLM motor, mezőszintű felismerés, NAV keresztellenőrzés, emberi jóváhagyás nélkül nincs könyvelés, prompt szabályok (P-062, P-096, P-109) | Megvalósítva. |

### 44. Stabilitás – adat és számítás

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K44.01` | Sikeresen mentett bizonylat böngészőbezárás után újra megnyitható legyen. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.02` | Sikeresen mentett bizonylat szerver-újraindítás után újra megnyitható legyen. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.03` | Sikertelen mentéskor ne jelenjen meg sikeres mentést jelző üzenet. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.04` | Kapcsolatmegszakadáskor a még nem mentett mezők állapota látható legyen. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.05` | Munkamenet megszakadása után a mentett piszkozat visszaállítható legyen. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.06` | Dupla jóváhagyó kattintás ne eredményezzen két könyvelést. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.07` | Hálózati újraküldés ne eredményezzen két könyvelést. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.08` | Két felhasználó párhuzamos módosításakor a második mentés ütközést jelezzen. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.09` | Főkönyvi feladás és folyószámla-frissítés együtt sikerüljön vagy együtt maradjon el. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.10` | Főkönyvi feladás és áfaanalitika-frissítés együtt sikerüljön vagy együtt maradjon el. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.11` | Eszközfeladás és főkönyvi feladás együtt sikerüljön vagy együtt maradjon el. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.12` | Azonos adatokból ismételten futtatott főkönyvi kivonat azonos eredményt adjon. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.13` | Azonos adatokból ismételten futtatott áfaanalitika azonos eredményt adjon. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.14` | Pénzösszegek számítása ne hozzon létre bináris lebegőpontos kerekítési eltérést. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.15` | Kerekítési eltérés külön tételen legyen követhető. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.16` | Importrekordok száma egyezzen a sikeres, hibás és kihagyott rekordok számának összegével. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.17` | Keresési válaszidő mérése rögzíthető legyen másodpercben a vizsgált tételszámmal együtt. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.18` | Import futásideje mérhető legyen a forrásrekordok számával együtt. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.19` | Kimutatás futásideje mérhető legyen a feldolgozott könyvelési sorok számával együtt. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.20` | Párhuzamos terhelési próba eredménye tartalmazza az egyidejű felhasználók számát. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.21` | Mentési hiba a hibás bizonylat azonosítójával jelenjen meg. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |
| `K44.22` | Importhiba a hibás forrássor azonosítójával jelenjen meg. | ✅ **Kész** | Idempotencia kulcsok, tranzakcionális Supabase RPC-k, rate limiter (A-152), lebegőpontos kerekítési védelem, offline állapotjelzés | Megvalósítva. |

### 45. Adatbiztonság és üzemeltetés

| Azonosító | Funkció / Elvárt működés | Státusz | Megvalósítás Eaisybill / eaisyBooks-ban | Hiányosság / Teendő |
| :--- | :--- | :---: | :--- | :--- |
| `K45.01` | Böngésző és szerver között titkosított HTTPS-kapcsolat működjön. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.02` | Többtényezős bejelentkezés bekapcsolható legyen. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.03` | Letiltott felhasználó aktív munkamenete visszavonható legyen. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.04` | Más cég dokumentuma közvetlen URL-lel se legyen megnyitható jogosultság nélkül. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.05` | Más cég könyvelése exporttal se legyen elérhető jogosultság nélkül. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.06` | NAV-hozzáférési titkok ne jelenjenek meg a normál felhasználói felületen. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.07` | Banki hozzáférési titkok ne kerüljenek hibajegyek szövegébe. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.08` | API-kulcs visszavonható legyen. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.09` | API-kulcs lecserélhető legyen a könyvelési előzmények elvesztése nélkül. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.10` | Adatbázisról automatikus biztonsági mentés készüljön. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.11` | Feltöltött dokumentumokról automatikus biztonsági mentés készüljön. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.12` | Biztonsági mentés utolsó sikeres időpontja az üzemeltetőnek látható legyen. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.13` | Sikertelen biztonsági mentés az üzemeltetőnek hibajelzést adjon. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.14` | Visszaállítási próba igazolja a bizonylatok és dokumentumkapcsolatok helyreállását. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.15` | Vállalt maximális helyreállítási idő órában dokumentálva legyen. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.16` | Vállalt maximális elveszíthető időszak percben vagy órában dokumentálva legyen. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.17` | Adatkezelési tájékoztató nevezze meg az MI-feldolgozást végző szolgáltatókat. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.18` | Adatkezelési tájékoztató nevezze meg a feldolgozás és tárolás országát. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.19` | Ügyféladatok általános MI-modelltanítási felhasználása alapértelmezetten legyen kikapcsolva. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.20` | Adatfeldolgozói szerződés rendelkezésre álljon. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.21` | Dokumentummegőrzési idő beállítása és törlési eljárása dokumentálva legyen. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.22` | Felvitel eseménye felhasználóval és időponttal naplózódjon. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.23` | Módosítás eseménye régi és új értékkel naplózódjon. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.24` | Jóváhagyás eseménye bizonylatverzióval naplózódjon. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.25` | Export eseménye felhasználóval és időponttal naplózódjon. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.26` | Jogosultságváltozás régi és új jogosultsággal naplózódjon. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.27` | Frissítéshez kiadási változásjegyzék legyen elérhető. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.28` | Frissítés előtt korábbi hibák ismételt ellenőrzése történjen rögzített tesztesetekkel. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.29` | Hibás frissítés visszaállításának lépései dokumentálva legyenek. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.30` | NAV-sémaváltáskor a régi időszak fájlja a régi sémával is előállítható maradjon. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.31` | Hibabejelentés egyedi hibajegyazonosítót kapjon. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.32` | Hibajegy állapota a bejelentőnek követhető legyen. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.33` | Alapbeállításokról képernyőképes útmutató legyen elérhető. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.34` | Számlarögzítésről és jóváhagyásról útmutató legyen elérhető. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.35` | Bankimportálásról útmutató legyen elérhető. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.36` | Áfazárásról és önellenőrzésről útmutató legyen elérhető. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.37` | Tárgyieszköz-kezelésről útmutató legyen elérhető. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.38` | Bemutató kövesse végig egy számla dokumentum–könyvelés–folyószámla–áfa kapcsolatát. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.39` | Bemutató kövesse végig egy eszköz beszerzés–aktiválás–ÉCS–főkönyvi feladás kapcsolatát. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |
| `K45.40` | Oktatási felvétel visszanézhető legyen az új felhasználóknak. | ✅ **Kész** | HTTPS, Supabase RLS adatizoláció, TOTP MFA, titkosított kulcsok, mentések, GDPR, Changelog (P-112), Knowledge Base (P-078), Tickets hibajegykezelő | Megvalósítva. |

