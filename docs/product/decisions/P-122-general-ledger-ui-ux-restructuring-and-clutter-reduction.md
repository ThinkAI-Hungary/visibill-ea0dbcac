# P-122: Főkönyv Felhasználói Élmény (UX), Letisztult Könyvelői Ergonómia és Zsúfoltság-Megszüntetés

* **Státusz**: ✅ Elfogadva (Decided)
* **Dátum**: 2026-09-26
* **Kapcsolódó termékdöntések**: [P-066](./P-066-gl-date-basis-toggle-and-settings-ux.md), [P-067](./P-067-gl-posting-status-filter-and-journal-governance-ux.md), [P-105](./P-105-general-ledger-toolbar-and-expand-collapse-ux.md), [P-113](./P-113-general-ledger-granularity-kontirok-teteles-view.md), [P-117](./P-117-general-ledger-invoice-grouping-and-4col-export-ux.md), [P-120](./P-120-general-ledger-invoice-document-preview-and-osa-fallback-ux.md), [A-162](../architecture/decisions/A-162-general-ledger-ui-ux-restructuring-and-clutter-reduction.md)

---

## 1. Felhasználói Igény és Célcsoport

A főkönyvi modult döntően hagyományos könyvelők, bérszámfejtők és vállalkozási pénzügyesek használják.
A felhasználói visszajelzések alapján a felület az új képességek hozzáadásával túlságosan "IT-s és zsúfolttá" (cluttered) vált:
- Túl sok gomb volt látható egyszerre anélkül, hogy világos lett volna, melyik mire való.
- A "Tételes" szó kétszeri szereplése egymás felett komoly fogalmi zavart keltett.
- A táblázat soraiból alig 5-6 látszódott egyszerre egy 1080p kijelzőn a hatalmas vezérlők és KPI kártyák miatt.

**Cél:**
Olyan könyvelői munkafelület kialakítása, amely:
1. **Nem-IT-s felhasználók számára is azonnal érthető, barátságos és tiszta.**
2. **Kettőzött függőleges munkaterületet biztosít** (legalább 15-20 könyvelési sor látható azonnal görgetés nélkül).
3. **Zéró funkcióvesztést garantál** (minden korábbi eszköz azonnal elérhető marad).

---

## 2. Terméktervezési Elvek és Megoldások

### A. Rendszerezett felső sáv (10 gomb helyett 3 tiszta blokk)
- **Sablonválasztó és ⚙ Műveletek:** A ritkán használt sablonfeltöltés és sablonkezelés egyetlen diszkrét fogaskerék menübe került a számlatükör dropdown mellett.
- **Elsődleges művelet:** Kiemelt `+ Vegyes bizonylat` gomb kézi könyveléshez, közvetlen mellette `+ Új számlaszám` felvitel.
- **Egyesített XML Import:** A korábbi két gomb (`XML Import` és `XML Importok`) helyett egyetlen tiszta legördülő menü biztosítja az új feltöltést és az előzmények elérését.
- **AI Besorolás & Exportálás:** Változatlanul gyorsan elérhető közvetlen gomb és lenyíló.

### B. Kompakt / Kiterjeszthető KPI csík (+80-100px munkaterület)
- Alapértelmezett állapotban elegáns, 1-soros csík mutatja a lényeget:
  - Főkönyvi számok és analitikák száma
  - Tartozik és Követel forgalom diszkrét színezéssel
  - AI besorolás % haladási csík
- Egy kattintással (`[Részletek ▾]`) kinyitható a hagyományos 4 nagy kártya. A felhasználó választását a rendszer megjegyzi.

### C. Tisztított Szűrősáv & Progressive Disclosure
- **Nincs "Tételes vs Tételes" ütközés:** A bontás elnevezése `Kontírok` vs `Tételes`, a tételek csoportosítása `Számlánként` vs `Tételenként`.
- **Feltételes megjelenítés:** A számlánkénti összevonás kapcsolója csak akkor jelenik meg, ha a felhasználó a tételes analitikus nézetben dolgozik; kontírok szintjén nem terheli a képernyőt.

---

## 3. Megtartott Képességek Garanciája

Minden korábbi funkció 100%-osan megmaradt:
- URL mélylinkek (`?date_basis=...`, `?posting_status=...`, `?granularity=...`, `?item_grouping=...`, `?hide_zero=...`)
- Billentyűparancsok (Ctrl+P)
- 4 oszlopos klasszikus nézet és Excel / Analitikus Excel export
- Számlakép / NAV OSA előnézet ikon minden tételsorban
- Kartonok, Naplófőkönyv és Összehasonlítás nézetek.
