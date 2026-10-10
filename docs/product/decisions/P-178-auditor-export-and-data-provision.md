# P-178: Könyvvizsgálói Export és Adatszolgáltatás, 20-Oszlopos Karton, 15 Analitikai Csomag és Éves Zárlati Ellenőrzőlista UX

**Status:** Decided  
**Dátum:** 2026-10-10  
**Utoljára frissítve:** 2026-10-10  
**Érintett felületek:** `/annual-report?tab=audit-export`, `/annual-report?tab=closing`, `AnnualReportPage.tsx`, `AuditorExportWorkspace.tsx`  
**Kapcsolódó döntések:** [A-241](../../architecture/decisions/A-241-auditor-export-and-subsequent-settlements-architecture.md), [BDR-069](../../business/decisions/069-auditor-data-provision-and-statutory-closing-policy.md)

---

## 1. Termékcél és Felhasználói Előnyök

A könyvvizsgálati időszakban a könyvelőirodák és pénzügyi vezetők rengeteg időt töltenek auditori adatbekérések teljesítésével, analitikák és főkönyv egyeztetésével, valamint auditor szoftverekbe illeszthető táblázatok manuális formázásával.
A **19. Könyvvizsgálói Export és Adatszolgáltatás** modul célja:
1. **Azonnali auditori megfelelés:** 20-oszlopos standardizált tételes főkönyvi export előállítása Excel, CSV és MKVK XML formátumban.
2. **ISA 560 Fordulónap utáni rendezések:** A mérlegfordulónapi (december 31.) nyitott vevők és szállítók április 30-ig történt pénzügyi kiegyenlítésének automatikus kimutatása rendezési rátával.
3. **15 Elemből álló analitikai csomag:** Egykattintásos ZIP letöltés a könyvvizsgáló által kért összes analitikával és ellenőrző jegyzőkönyvvel.
4. **Adatintegritás és elavulás-védelem:** Kriptográfiai SHA-256 lenyomat rögzítése, valamint figyelmeztető sáv, ha az export átadása után bárki utólag módosít a könyvelésben.

---

## 2. Navigáció és Felépítés

A funkció közvetlenül a meglévő **Beszámoló** (`/annual-report`) menüpont alatt érhető el három logikai lapfülön keresztül:
- `?tab=closing`: **Éves Zárlat** (9 lépéses számviteli zárlati ellenőrzőlista haladási sávval, `localStorage` alapú állapotmegőrzéssel és nyitott alapértelmezéssel).
- `?tab=report`: **Beszámoló & Melléklet** (a meglévő 6 lépéses beszámoló varázsló).
- `?tab=audit-export`: **Könyvvizsgálói Export** (az új Modul 19 munkaterület).

---

## 3. Fő Funkciók és Kezelés

### 3.1 20-Oszlopos Főkönyvi Kivonat és Karton
- Oszlopok: Naplókód, Könyvelési sorszám, Könyvelés dátuma, Bizonylat kelte, Esedékesség, Főkönyvi számlaszám, Számla megnevezése, T/K, Összeg (HUF), Pénznem, Deviza összeg, Árfolyam, Partner adószáma, Partner neve, Költséghely, Munkaszám, Projekt kód, Pályázati azonosító, Szöveges leírás, Rögzítő felhasználó.
- Letöltések:
  - **Excel (.xlsx):** ExcelJS által formázott, színezett, összegző formulákkal ellátott táblázat kontrollappal (`Fokonyvi_Karton_{Cégnév}_{Időszak}.xlsx`).
  - **CSV (.csv):** Excel-barát UTF-8 BOM pontosvesszős formátum.
  - **MKVK AuditXML (.zip):** Hivatalos kamara-konform XML csomag v1.0.23.0 formátumban (`AuditXML_FK_{Cégnév}_{Időszak}.zip`).
  - **Pillanatkép (SHA-256):** Kriptográfiai állapotrögzítés az adatbázisban ÉS az egyedi hash-elt nevű Excel munkafüzet (`Fokonyv_{év}_{hash8}.xlsx`) azonnali fizikai letöltése.

### 3.2 ISA 560: Utólagos Pénzügyi Rendezések
- Vevőkövetelés (AR) és Szállítói kötelezettség (AP) rendezési arány (%) KPI kártyák.
- Tételes nyitott állomány és április 30-ig befolyt összegek.
- Színkódolt audit státuszok: *Teljesen rendezett* (zöld), *Részben rendezett* (sárga), *Kétes / Rendezetlen* (piros).

### 3.3 15 Elemű Analitikai Csomag
- Kijelölhető analitikák listája és egykattintásos tömörített ZIP archívum letöltése.
