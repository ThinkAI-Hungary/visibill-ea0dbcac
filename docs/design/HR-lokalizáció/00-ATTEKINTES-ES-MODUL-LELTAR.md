# Eaisybill Horvát (HR) Lokalizációs Audit — Teljes Kódbázis Leltár és Hiányossági Térkép

**Projekt:** Eaisybill (főalkalmazás, `eaisybill-prod`)  
**Dátum:** 2026. október 5.  
**Cél:** Az Eaisybill alkalmazásrész teljes frontend felületeinek szisztematikus átvizsgálása, és minden olyan felhasználói felületi elem, értesítési ablak (toast), modális párbeszédpanel, státusz badge, szűrő és táblázatfejléc feltárása, amelyhez jelenleg hiányzik a hivatalos horvát (`hr`) fordítás vagy hardkódolt magyar szöveggel renderelődik.  
**Audit hatóköre:** Kizárólag az Eaisybill alkalmazás (`src/pages`, `src/features`, `src/components`, `src/hooks`, `src/lib`), az elkülönülő `eaisyBooks` (Accounty) portál nélkül.

---

## 📊 1. Vezetői Összefoglaló és Statisztikai Leltár

A statikus kód- és AST-elemzés alapján az Eaisybill kódbázisban összesen **410 komponensfájlban** azonosítottunk lokalizációs hiányosságot vagy közvetlenül beégetett magyar szöveget, összesen **7837 darab előfordulással**.

### Moduláris eloszlás

| Modul | Fájlok száma | Hiányzó / Hardkódolt elemek | Részletes specifikáció |
| :--- | :---: | :---: | :--- |
| **01. Számlák és Bizonylatkezelés** | 53 | 829 db | [01-SZAMLA-ES-BIZONYLATKEZELES.md](./01-SZAMLA-ES-BIZONYLATKEZELES.md) |
| **02. Pénzügy, Könyvelés és GL** | 95 | 1861 db | [02-PENZUGY-KONYVELES-ES-GL.md](./02-PENZUGY-KONYVELES-ES-GL.md) |
| **03. Bank, Partnerek és Tranzakciók** | 40 | 694 db | [03-BANK-PARTNER-ES-TRANZAKCIOK.md](./03-BANK-PARTNER-ES-TRANZAKCIOK.md) |
| **04. HR, Munkaidő és Tárgyi Eszközök** | 26 | 376 db | [04-HR-MUNKAIDO-ES-TARGYI-ESZKOZOK.md](./04-HR-MUNKAIDO-ES-TARGYI-ESZKOZOK.md) |
| **05. Beállítások, Integrációk és Globális UI** | 196 | 4077 db | [05-BEALLITASOK-INTEGRACIOK-ES-KOZOS-UI.md](./05-BEALLITASOK-INTEGRACIOK-ES-KOZOS-UI.md) |
| **Összesen** | **410** | **7837 db** | — |

---

### Elem kategóriák szerinti bontás

| Kategória | Leírás | Darabszám |
| :--- | :--- | :---: |
| **NOTIFICATION_TOAST** | Rendszerértesítések, sikeres/hibás műveletek címei és leírásai (`toast({ title, description })`) | **790 db** |
| **STATUS_BADGE** | Felületi állapotjelvények (`<Badge>...</Badge>`, `badgeText`) | **27 db** |
| **DIALOG_MODAL** | Modális ablakok fejlécei, megerősítő kérdések (`DialogTitle`, `window.confirm`) | **21 db** |
| **STATUS_OR_LABEL_TERNARY** | Táblázatos és kártyaszintű állapotok feltételes kiírásai (`? 'Fizetve' : 'Függőben'`) | **3949 db** |
| **TABLE_COLUMN_OR_OPTION** | Táblázatos oszlopfejlécek és szűrő legördülő menüpontok (`header`, `label`) | **484 db** |
| **PROP_TEXT** | Űrlapmezők helykitöltői, súgói és címei (`placeholder`, `title`, `tooltip`, `emptyText`) | **433 db** |
| **JSX_TEXT** | Felületi szöveges gombok, panelek, kártyák és súgók nyers szövegei | **1849 db** |
| **MISSING_HR_TRANSLATION_KEY** | Meghívott `t(...)` kulcsok, amelyek hiányoznak a `src/locales/hr/*.json` szótárakból | **284 db** |

---

## 🎯 2. Prioritási Mátrix (Értékesítési Demó és Éles Üzem)

1. **P0 — Showstopper / Demó-blokkoló (Azonnali prioritás):**
   - **Számla műveletek és Számlázz.hu / Minimax integráció:** Gombok (`Számlázz.hu szinkron`, `Új számla rögzítése`, `Export Excel/CSV/PDF`), státusz badge-ek és toastok.
   - **Főkönyvi és Kimutatási nézetek:** Mérleg és Eredménykimutatás kapcsolók, táblázatfejlécek, szűrősávok.
   - **Globális navigáció és fejlécek:** Oldalsáv gombok, dátumválasztó feliratok, kijelentkezési modálok.
2. **P1 — Magas láthatóságú aktív űrlapok:**
   - Új számla rögzítése modál (`ManualInvoiceCreateDialog`).
   - Tételkezelő és számlasor kontírozó párbeszédpanel (`InvoiceItemsDialog`).
   - Nyitó napló varázsló (`OpeningJournalWizardModal`).
   - Új partner hozzáadása modál és OIB validáció.
   - Tárgyi eszközök rögzítése és értékcsökkenés futtatása modál.
3. **P2 — Másodlagos kezelőszervek és értesítési üzenetek:**
   - Rendszer toastok (pl. sikeres mentés, hibás adószám, duplikáció figyelmeztetés).
   - Üres állapotok (Empty states) magyarázó szövegei.
   - Táblázatos műveleti legördülők és batch sávok feliratai.
4. **P3 — Mély beállítási és adminisztrációs panelek:**
   - Céges API beállítások, webhook logok, archív importok.

---

## 🗺️ 3. Részletes Moduldokumentációk Tartalomjegyzéke

- [01. Számlák és Bizonylatkezelés Leltár](./01-SZAMLA-ES-BIZONYLATKEZELES.md)
- [02. Pénzügy, Könyvelés és Főkönyv Leltár](./02-PENZUGY-KONYVELES-ES-GL.md)
- [03. Bank, Partnerek és Tranzakciók Leltár](./03-BANK-PARTNER-ES-TRANZAKCIOK.md)
- [04. HR, Munkaidő és Tárgyi Eszközök Leltár](./04-HR-MUNKAIDO-ES-TARGYI-ESZKOZOK.md)
- [05. Beállítások, Integrációk és Globális UI Leltár](./05-BEALLITASOK-INTEGRACIOK-ES-KOZOS-UI.md)
- [06. Hiányossági Katalógus és Cselekvési Terv (JSON kulcspótlásokkal)](./06-HIANYZOSEGI-KATALOGUS-ES-CSEKVESI-TERV.md)

---
*Készült a Visibill Docs-First és Zero Workspace Clutter fejlesztési protokollja alapján.*
