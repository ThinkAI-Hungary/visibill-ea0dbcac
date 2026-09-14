---
trigger: model_decision
description: Apply when creating new UI components, modifying screens, making architectural changes, or creating new ADR/PRD documentation in eaisybill-prod.
---

# Design System & Documentation Governance

## 🎨 1. Új UI Elem / Komponens Kreálása (Design System Fegyelem)
Mielőtt bármilyen új vizuális komponenst, gombot, táblázatot vagy modált létrehozol, **kötelező ellenőrizni a `docs/design/` dokumentációt**:

1. **Ne találj fel létező elemeket:**
   * Olvasd el a [docs/design/04-component-library.md](file:///d:/ThinkAI/visibill/eaisybill-prod/docs/design/04-component-library.md) fájlt. Használd a már meglévő `shadcn/ui` és egyedi komponenseket (pl. `StatusBadge`, `MetricCard`, `UnifiedPagination`).
2. **Színek és Tokenek:**
   * Lásd: [docs/design/02-design-tokens.md](file:///d:/ThinkAI/visibill/eaisybill-prod/docs/design/02-design-tokens.md).
   * **Szigorúan tilos** hardkódolt hexadecimális kódokat és ad-hoc Tailwind osztályokat használni (pl. `bg-blue-600`). Kizárólag a platform szintű HSL tokeneket és szemantikus osztályokat használd (`bg-primary`, `text-muted-foreground`, `border-border`, stb.).
3. **Ikonok:**
   * Lásd: [docs/design/03-typography-icons.md](file:///d:/ThinkAI/visibill/eaisybill-prod/docs/design/03-typography-icons.md). Kizárólag **Lucide** ikonokat használj egységes méretezéssel (16px / 20px).
4. **Táblázatok & Lapozás:**
   * Lásd: [docs/design/11-data-display-tables.md](file:///d:/ThinkAI/visibill/eaisybill-prod/docs/design/11-data-display-tables.md). Használd a kompakt táblázat elrendezést és a központi `UnifiedPagination` komponenst.
5. **Dialógusok & Felugró ablakok:**
   * Lásd: [docs/design/12-dialogs-modals.md](file:///d:/ThinkAI/visibill/eaisybill-prod/docs/design/12-dialogs-modals.md). Dialógusokhoz a shadcn `Dialog`, `Sheet` vagy `Drawer` elemeket használd.
6. **Fájlelőnézet:**
   * Lásd: [docs/design/13-file-preview-pattern.md](file:///d:/ThinkAI/visibill/eaisybill-prod/docs/design/13-file-preview-pattern.md). Új fájl (PDF, kép, Excel) megjelenítéséhez mindig a közös `FilePreviewModal`-t kell behívni.
7. **Betöltési állapotok:**
   * Lásd: [docs/design/07-loading-patterns.md](file:///d:/ThinkAI/visibill/eaisybill-prod/docs/design/07-loading-patterns.md). Sose írj ki sima "Loading..." szöveget; kötelező Skeleton loader mintát használni.

---

## 🏛️ 2. Építészeti Döntések (ADR Fegyelem)
A Visibill projektben a döntéshozatal dokumentált (116+ elfogadott ADR).

* **Mikor kötelező új ADR-t írni?**
  1. Új Edge Function vagy külső API integráció bevezetésekor.
  2. Adatbázis architektúrát (táblák, RLS, új trigger lánc) érintő változáskor.
  3. Új routing vagy globális állapotkezelési paradigma bevezetésekor.
  4. Biztonsági protokoll vagy jogosultsági szint módosításakor.
* **Kötelező lépések új döntésnél:**
  1. Hozz létre egy új fájlt a következő sorszámmal: `docs/architecture/decisions/A-XXX-<kebab-case-cim>.md`.
  2. Kövesd a standard formátumot: *Context* (Probléma háttere), *Decision* (A meghozott döntés részletei diagrammal/kóddal), *Consequences* (Következmények, előnyök, kockázatok).
  3. Frissítsd a [docs/architecture/decisions/index.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/index.md) tartalomjegyzéket az új bejegyzéssel.

---

## 📋 3. Termék és Funkció Döntések (PRD Fegyelem)
* Ha egy új felhasználói felület, üzleti folyamat (pl. új számlázási/adózási kalkuláció) kerül megtervezésre:
  * Hozz létre új bejegyzést: `docs/product/decisions/P-XXX-<kebab-case-cim>.md`.
  * Vezesd fel a [docs/product/decisions/index.md](file:///d:/ThinkAI/visibill/eaisybill-prod/docs/product/decisions/index.md) fájlba.
