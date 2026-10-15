# P-192 — RLB FOKTORZS (.RFT / .DBF) Számlatükör Feltöltési és Importálási Felhasználói Élmény (UX)

**Dátum:** 2026-10-15  
**Státusz:** ✅ Decided  
**Szerző:** Áron & Antigravity  
**Kapcsolódó döntések:** [076](../../business/decisions/076-rlb-foktorzs-rft-dbf-chart-of-accounts-parsing-and-import.md), [P-102](./P-102-chart-of-accounts-import-ux.md), [P-187](./P-187-rlb-general-ledger-basic-and-extended-templates-ux.md)

---

## 1. Felhasználói Igény és Célkitűzés

A könyvelők gyakran az RLB program mappájából közvetlenül kimásolt `FOKTORZS*.RFT` fájlt kapják meg vagy töltik le. A cél egy olyan akadálymentes és hibatűrő felhasználói felület (UX) biztosítása, ahol a könyvelőnek semmit nem kell átneveznie vagy konvertálnia:
- Egyszerűen behúzza a `.RFT` vagy `.DBF` fájlt a fogd-és-vidd (drag-and-drop) területre.
- A rendszer azonnal felismeri, hogy ez egy RLB számlatükör állomány.
- Megjeleníti a fájlban lévő rekordok és aktív számlák számát.
- Automatikusan kitölti a sablon nevét a fájl nevéből (pl. `FOKTORZS_WR 2026` -> `FOKTORZS_WR 2026 - RLB Számlatükör`).
- Egyetlen kattintással elmenti és aktiválja a számlatükröt a céghez.

---

## 2. Megvalósított Felületi Elemek és Viselkedés

### 2.1 Számlatükör Feltöltő Modál (`UploadChartOfAccountsModal`)
* **Helye:**
  * Főkönyvi kivonat (`/general-ledger`) toolbar -> `Számlatükör feltöltése`
  * Naplók (`/journals`) -> `Számlatükör importálása`
  * Nyitó napló varázsló (`OpeningJournalWizardModal`) -> `Számlatükör importálása`
* **Működés:**
  * Fájlkiterjesztés validáció: `.csv, .xlsx, .xls, .pdf, .txt, .rft, .dbf`
  * Fájl kiválasztásakor automatikus névkitöltés (`selectedFile.name.replace(/\.[^/.]+$/, "")`).
  * Feltöltéskor a `parseRlbRftChartOfAccounts` bináris motor azonnal kinyeri a számlaszámokat és a helyes ékezetes megnevezéseket.
  * Tömeges adatbázis mentés 500-as csomagokban a `gl_accounts` táblába.

### 2.2 Könyvvizsgálói Feladás Modál (`UploadAuditXmlModal`)
* **Helye:** Főkönyvi kivonat -> `Könyvvizsgálói XML feladás / RLB CSV` gomb.
* **Intelligens Formátum-felismerés:**
  * Ha a könyvelő véletlenül erre a felületre húzza be a `FOKTORZS*.RFT` fájlt, a rendszer nem dob hibaüzenetet!
  * Helyette aktiválódik a dedikált indigo stílusú **RLB Számlatükör (FOKTORZS RFT / DBF)** előnézeti kártya.
  * Vizuális mutatók:
    * `Összes rekord a fájlban` (pl. 681 db)
    * `Aktív főkönyvi számlák` (pl. 683 db zöld számlálóval)
    * Tájékoztató szöveg: az importálás sablont hoz létre és feltölti a teljes 1–4 szintű számlatörzset.
  * Az `Importálás indítása` gombra kattintva a `importRlbRftChartOfAccounts` háttérfolyamat lépésről lépésre végrehajtja a perzisztálást.

---

## 3. Minőségbiztosítás és Verifikáció

* **Valós adatteszt:** A mintaként kapott `FOKTORZS_WR  2026.RFT` (681 rekord) hibátlanul beolvasható.
* **Magyar ékezetek:** `Vagyoni értékű jogok`, `Belföldi vevő követelések forintban`, `Alapítás-átszervezés aktivált értéke` 100%-ban helyes UTF-8 karakterekkel kerül tárolásra.
* **Vitest tesztek:** `src/test/rlb/rlbRftParser.test.ts` (4/4 PASS), `src/test/rlb/rlbImportService.test.ts` (4/4 PASS), `UploadChartOfAccountsModal.test.tsx` (4/4 PASS).
* **Linter & Típusellenőrzés:** `oxlint` 0 hiba, `tsc --noEmit` 0 hiba.
