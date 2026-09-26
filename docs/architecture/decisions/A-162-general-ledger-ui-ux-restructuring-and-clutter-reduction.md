# A-162: Főkönyv UI & UX Modularizáció, Ergonómiai Átszervezés és Zsúfoltság-Megszüntetés

* **Státusz**: ✅ Elfogadva (Decided)
* **Dátum**: 2026-09-26
* **Döntéshozók**: Antigravity Pair Programming & Vezető Könyvelő / Rendszertervező
* **Kapcsolódó döntések**: [A-085](./A-085-gl-date-basis-rpc-and-chunk-error-recovery.md), [A-086](./A-086-gl-posting-status-filter-and-journal-governance.md), [A-150](./A-150-gl-performance-resilience-and-layout-hardening.md), [A-157](./A-157-general-ledger-invoice-grouping-and-4col-export.md), [A-160](./A-160-general-ledger-invoice-document-preview-and-osa-fallback.md), [P-122](../product/decisions/P-122-general-ledger-ui-ux-restructuring-and-clutter-reduction.md)

---

## 1. Kontextus és Problémafelvetés

A főkönyvi modul (`/general-ledger`, `GeneralLedgerPage.tsx` és `GeneralLedgerTable.tsx`) az eaisybill platform leggyakrabban használt és legsűrűbb pénzügyi képernyője. Az elmúlt félév során számos kritikus képességgel bővült:
- Számlatükör sablonok dinamikus váltása és kezelése (`ManagePresetsModal`, `UploadChartOfAccountsModal`)
- Kézi vegyes bizonylatok rögzítése (`AddManualJournalEntryModal`) és új főkönyvi számok felvitele
- NAV és könyvelőprogram XML auditfájlok importálása (`UploadAuditXmlModal`) és előzmények követése (`AuditImportHistoryModal`)
- AI téves/besorolatlan tétel klasszifikáció valós idejű PGMQ triggereléssel
- 4 oszlopos klasszikus főkönyvi kivonat (Forgalom T/K, Egyenleg T/K) és exportálási motor
- Számlánkénti összevonás (`by_invoice`) és tételes kibontás (`detailed`)
- Dokumentum és NAV OSA tételes előnézet resolver (`useGlInvoiceDocumentResolver`)

### Az organikus növekedésből fakadó ergonómiai problémák (Clutter):
1. **Felső műveleti sáv túlcsordulása:** Egyetlen sorban **10 különböző vezérlő és gomb** (Sablon select, Sablonok kezelése, Új szám, Új sablon feltöltése [kiemelt primary], Vegyes bizonylat, XML Import, XML Importok, AI Besorolás, Export) zsúfolódott össze.
2. **Kapcsoló-rengeteg (Toggle Fatigue):** 7 különálló szegmentált kapcsoló (összesen **14 pill gomb**) foglalta el a táblázat fejlécét két sorban.
3. **Terminológiai ütközés:** A *"Tételes"* szó egymás felett kétszer is megjelent különböző jelentéssel (számlatükör fastruktúra kibontása vs. számlán belüli tételek soronkénti bontása).
4. **Függőleges helyrablás:** A vezérlők és a 4 nagy KPI kártya ~500px-t vettek el a képernyőből, így a tényleges adatsoroknak mindössze 6-7 sor hely maradt egy átlagos laptop kijelzőn.
5. **Nem-IT-s könyvelők számára riasztó komplexitás:** A ritkán használt adminisztratív eszközök (sablonfeltöltés, xml import) elnyomták a napi könyvelői feladatokat.

---

## 2. Döntési Alternatívák

* **Opció 1: Minimális styling finomhangolás (Status Quo megtartása):** Kisebb betűk és marginok. *Elvetve: Nem oldja meg a kognitív terhelést és a vertikális helyrablás problémáját.*
* **Opció 2: Funkciók törlése vagy kizárólagos szuboldalakra költöztetése:** *Elvetve: A felhasználó számára kritikus a zéró funkcióvesztés és a gyors hozzáférés.*
* **Opció 3 (Elfogadva): Tiszta Információs Architektúra (IA) Modularizáció & Progressive Disclosure:**
  - 100%-os funkció- és viselkedésmegőrzés.
  - Komponens dekompozíció: `GlToolbar.tsx`, `GlKpiBar.tsx`, `GlFilterBar.tsx`.
  - Logikai csoportosítás, összecsukható KPI sáv, és kontextusfüggő vezérlőmegjelenítés.

---

## 3. Részletes Rendszer-Architektúra

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   GeneralLedgerPage.tsx                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [GlToolbar]                                                                           │
│    ├─ Számlatükör Sablon Select + ⚙ Sablon Műveletek (Kezelés, Új feltöltés)          │
│    ├─ Bizonylatműveletek (+ Vegyes bizonylat [Primary], + Új számlaszám)               │
│    ├─ Adatkezelés (XML Import [Upload + Előzmények], AI Besorolás)                     │
│    └─ Exportálás & Nyomtatás (PDF/Print, Excel teljes, Excel 0-ás nélkül, Analitika)   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [GlKpiBar]                                                                            │
│    ├─ Kompakt Mód (Default): 1-soros csík (Számlák, Analitikák, T/K egyenleg, AI %)    │
│    └─ Kiterjesztett Mód (Toggle): 4 nagykártya + AI haladási sáv (LocalStorage állapot)│
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [Tabs: Kivonat | Kartonok | Naplófőkönyv | Összehasonlítás]                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [GlFilterBar] (Kivonat fül esetén)                                                    │
│    ├─ Sor 1: GlSearchAutocomplete + [Mind kinyitása | Mind becsukása] + Dátum badge    │
│    └─ Sor 2:                                                                           │
│        ├─ Adatszűrők: Dátum alap (Kibocsátás/Telj), Bizonylat (Összes/Zárt), 0-ás szűrő│
│        └─ Megjelenítés: Nézetmód (Összesítő/4-oszlopos), Bontás (Számlák/Tételes),     │
│           és Progressive Disclosure: ha Tételes -> [Számlánként | Tételenként]        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  [GeneralLedgerTable]                                                                  │
│    └─ Soronkénti bizonylat resolver (InvoiceImageDialog / InvoiceItemsDialog fallback)  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Megvalósítási Eredmények

1. **`src/components/general-ledger/GlToolbar.tsx`**:
   - A 10 ömlesztett gomb helyett 3 tiszta, reszponzív zóna.
   - Az adminisztratív eszközök (Sablonok kezelése, Új sablon feltöltése) a sablonválasztó melletti `⚙` menübe kerültek.
   - Az `XML Import` egységes dropdownná alakult, elérve mind az új XML feltöltést, mind a korábbi importok előzménylistáját.
2. **`src/components/general-ledger/GlKpiBar.tsx`**:
   - Helytakarékos, 1-soros kompakt sáv (`Számlák: 142 • Analitikák: 389 • T: 45.2M Ft • K: 45.2M Ft • AI: 98%`).
   - `[Részletek ▾]` gombbal kinyitható a 4 kártyás részletes nézet.
   - `localStorage` perzisztencia (`visibill_gl_kpi_expanded_${companyId}`).
   - **~80-100px azonnali vertikális munkaterület-nyereség!**
3. **`src/components/general-ledger/GlFilterBar.tsx`**:
   - Megszünteti a zavaró „Tételes vs Tételes” névütközést: a bontás `Kontírok` vs `Tételes`, a tételek csoportosítása `Számlánként` vs `Tételenként`.
   - **Progressive Disclosure**: A `Számlánként vs Tételenként` kapcsoló kizárólag akkor jelenik meg, ha a tételes analitika aktív! Kontírok nézetben rejtve marad, kiküszöbölve az inaktív gombok jelenlétét.
4. **`src/pages/GeneralLedgerPage.tsx` refaktorálása**:
   - 1,339 sorról 880 sorra csökkent a monolit oldal mérete, jobb átláthatósággal és nulla kódduplikációval.

---

## 5. Minőségbiztosítás és Tesztelési Eredmények

- **TypeScript típusellenőrzés:** `npx tsc --noEmit` hibátlan (0 hiba).
- **Automata tesztek:** `npm test -- src/components/general-ledger src/test/gl`: Mind a 11 tesztcsomag (32 teszt) sikeresen lefutott.
- **Production Bundle ellenőrzés:** `npm run build` sikeres (24.01s alatt elkészült a production bundle, zéró regresszióval).
