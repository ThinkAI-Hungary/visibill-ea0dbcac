# P-156: Könyvelési Szabályok Elérése az ÁFA Bevallás és Napló Alól, Valamint Egységes Szabálykezelő Dialógus UX

**Státusz:** ✅ Decided  
**Dátum:** 2026-10-04  
**Kategória:** UX / Könyvelési Szabályok / ÁFA / Napló  
**Kapcsolódó Kérés:** Felhasználói kérés: "Kell könyvelési szabályok az ÁFA és a Napló alá is. Kell a gomb mindkét helyre."  
**Kapcsolódó ADR:** [A-196: Könyvelési Szabályok Modális és Keresztmodul Integrációja](../../architecture/decisions/A-196-accounting-rules-dialog-and-cross-module-integration.md)  
**Kapcsolódó korábbi döntések:** [P-109: Determinisztikus Számlatétel Szabály Motor és Quick Save UX](./P-109-invoice-item-rules-and-quick-save-ux.md), [P-138: Egységes Könyvelési Szabályok Kezelőfelület](./P-138-unified-accounting-rules-and-prompt-library-ux.md)

---

## 1. Döntési Kontextus és Problémafelvetés

Az ÁFA bevallás felülvizsgálata és a könyvelési naplók egyeztetése közben a könyvelők gyakran azonosítanak olyan tételeket, amelyeket egyedi szabály alapján kellene automatikusan más főkönyvi számra vagy más ÁFA kódra terelni.

Korábban:
1. A könyvelési szabályok szerkesztéséhez el kellett hagyni az aktív munkaterületet (ÁFA bevallást vagy Naplót), át kellett navigálni az eaisyBooks felületre vagy a számlák táblázathoz.
2. Emiatt a könyvelő elveszítette a beállított szűrőket, időszakot, és megszakadt a munkafolyamat.
3. Nem volt közvetlen menüpont az eaisybill bal oldali menüjében a könyvelési szabályok elérésére.

---

## 2. A Döntés és Felületi Specifikáció

### 2.1 Azonnali Modális Dialógus a Munkafolyamat Megszakítása Nélkül (`AccountingRulesDialog`)
Az ÁFA bevallás és a Napló oldalak fejlécében (`PageHeader`) elhelyezett **„Könyvelési szabályok”** gombra kattintva egy azonnali modális párbeszédablak ugrik fel:
- **Nem navigál el:** Az ÁFA táblázat vagy a napló nézet és szűrők változatlanul a háttérben maradnak.
- **Két lapfül (Dual-Tab):**
  1. **Számlatétel szabályok:** Szövegminta-alapú kontírozási és ÁFA szabályok (`InvoiceItemRulesManager`). Tartalmazza a keresést, prioritási sorrendezést, szerkesztést, új szabály rögzítését és a még besorolatlan tételekre történő azonnali futtatást („Szabályok futtatása”).
  2. **AI Prompt könyvtár:** Cégre szabott természetes nyelvű AI prompt szabályok és mintasablonok (`CompanyPromptRulesManager`).
- **Valós idejű darabszám jelzők (Badge):** Mindkét fülön látható az aktív szabályok pontos száma (pl. `2`).

### 2.2 Fejléci Gombok Elhelyezése
- **ÁFA Bevallás (`VatReturnContainer`):** A fejléc műveleti sávjában (az ÁFA bevallás export / replika gombok mellett) megjelenik a `Sliders` ikonnal ellátott „Könyvelési szabályok” gomb (`variant="outline"`).
- **Napló (`JournalsPage`):** A fejléc jobb felső műveleti gombjai között (a kézi vegyes rögzítés és export gombok mellett) szintén elérhető a „Könyvelési szabályok” gomb.

### 2.3 Bal Oldali Menüpont (Sidebar)
Az `AppSidebar.tsx` komponensben a **„Könyvelés”** csoportban, közvetlenül az *ÁFA Bevallás* és a *Napló* alatt megjelenik a dedikált **„Könyvelési szabályok”** menüpont:
- **Ikon:** `Sliders`
- **Útvonal:** `/:companyId/:dateRange/accounting-rules`
- **Jogosultság:** A `journals` modul jogosultsági szintjével megegyező hozzáférés (könyvelők, adminok, tulajdonosok számára azonnal nyitott).

---

## 3. Felhasználói Élmény és Eredmények

1. **Zéró kontextusvesztés:** A könyvelő a bevallás készítése vagy a naplózási tételek ellenőrzése közben 1 kattintással felvehet új számlatétel- vagy prompt-szabályt, lefuttathatja a besorolást, majd a modál bezárása után azonnal folytathatja a munkáját.
2. **Konzisztens élmény:** Ugyanaz a kényelmes kétlapfüles felület jelenik meg felugró ablakban és a menüből elérhető teljes oldalas nézetben is.
