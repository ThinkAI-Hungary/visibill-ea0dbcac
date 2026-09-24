# P-111: Számlaláncolatok Megjelenítése, Kapcsolt Bizonylatok és Többdokumentumos Számlakép Lapozó UX

**Status:** Decided  
**Date:** 2026-09-24  
**Kategória:** Számlakezelés / UI/UX  
**Kapcsolódó ADR:** [A-147: Kétirányú Számlaláncolat és Előnézeti Dokumentum-lapozás](../../architecture/decisions/A-147-bidirectional-invoice-chaining-and-preview-tabs.md)  

---

## 1. Kérdés
Hogyan jelenjenek meg a logikailag és pénzügyileg egymáshoz tartozó bizonylatok (alapszámlák, sztornó bizonylatok, helyesbítők, előleg- és végszámlák) a számlák táblázat kibontott soraiban, valamint a számlakép előnézetben, biztosítva, hogy:
- Ne jelenjenek meg hamis figyelmeztetések hiányzó bizonylatokról, ha a bizonylat valójában létezik.
- A könyvelő a számlakép megnyitásakor azonnal lássa és közvetlenül lapozhassa az összes kapcsolódó dokumentum képét.

---

## 2. Döntés

1. **Kapcsolt Bizonylat Kártyák a Kibontott Sorban (`LinkedInvoicesSection`):**
   - Amikor a felhasználó lenyit egy számlasort (`ExpandedInvoiceRow`), a rendszer megjeleníti a kapcsolódó számlák kártyáit a **„Kapcsolt bizonylatok”** szekcióban.
   - Minden kártya tartalmazza:
     - Reláció iránya badge: `Hivatkozott bizonylat` (szülő számla) vagy `Hivatkozó bizonylat` (gyermek számla).
     - Számlatípus badge (pl. `Sztornó számla`, `Végszámla`, `Előlegszámla`).
     - Bizonylatsorszám, Eladó, Vevő neve, Kiállítás dátuma és Bruttó végösszeg.
     - `Kattints a részletekért` ikon, amelyre kattintva közvetlenül megnyílik a kapcsolt számla képe.

2. **Megbízható Hiányzó Bizonylat Jelzés (Broken Chain Guard):**
   - A rendszer csak akkor jeleníti meg az amber színű figyelmeztető dobozt (*„Hiányzó bizonylat(ok) — A következő hivatkozott bizonylat(ok) hiányoznak vagy törölték őket”*), ha a számlán szereplő referenciaszámok valóban nem találhatók meg a feltöltött bizonylatok között.
   - Támogatott a több, vesszővel vagy pontosvesszővel elválasztott referenciaszám kezelése; a figyelmeztetés pontosan megnevezi a hiányzó bizonylatszámokat.

3. **Többdokumentumos Számlakép Lapozó Fülrendszer (`InvoiceImageDialog`):**
   - A számlakép megnyitásakor a fejléc alatt dinamikus fülek jelennek meg az összes kapcsolódó számlához és melléklethez.
   - A fülek egyértelmű szerepkör-címkével vannak ellátva:
     - `THINK-2026-44 (Sztornó).pdf`
     - `THINK-2026-34 (Alapszámla).pdf`
     - Kísérő dokumentumok esetén: `(Melléklet 1)`, `(Melléklet 2)`.
   - **Kiterjesztés-védelem:** A tab neveken a típus a fájlkiterjesztés előtt szerepel, megelőzve az ismeretlen fájlformátum hibát.
   - **Átmenet & Villódzásvédelem:** Fülváltáskor nem jelenik meg zavaró teljes képernyős portál-overlay, a váltás egyenletes, és a lapozó gombok stabilak maradnak (nincs layout shift).

---

## 3. Kapcsolódó
- [A-147: Kétirányú Számlaláncolat (Invoice Chaining), Dinamikus Kapcsolt Bizonylat Feloldás és Előnézeti Dokumentum-lapozás](../../architecture/decisions/A-147-bidirectional-invoice-chaining-and-preview-tabs.md)
- [A-042: Sztornó Számla Kézi Lezárás Architektúra](../../architecture/decisions/A-042-storno-settle-architecture.md)
- [docs/design/13-file-preview-pattern.md](../../design/13-file-preview-pattern.md)
- [docs/design/11-data-display-tables.md](../../design/11-data-display-tables.md)
