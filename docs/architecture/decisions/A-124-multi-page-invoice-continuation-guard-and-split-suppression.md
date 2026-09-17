# A-124: Többoldalas Számlák Folytatás-Felismerése és Téves Multi-Invoice Split Megelőzés (Multi-Page Invoice Continuation Guard)

**Status:** Decided  
**Date:** 2026-09-17  
**Utoljára frissítve:** 2026-09-17  

## Context
A Visibill Worker automatikus PDF daraboló modulja (`pdf_splitter.py`) felelős azért, hogy a több számlát tartalmazó PDF fájlokat önálló bizonylatokra vágja szét a párhuzamos OCR és LLM feldolgozáshoz.

Egy nemzetközi szállító (D'Addario Europe LTD) 2 oldalas számlájánál (`740604`) súlyos hiba lépett fel:
1. A számla tételei az 1. oldalon szerepeltek (záró összeg nélkül, csupán a láblécben a „Folytatás” megjegyzéssel).
2. A számla tényleges végösszege (**684.22 EUR**) a 2. oldal legalján lévő összesítő blokkban volt.
3. A számlán nem szabványos `1/2. oldal` formátum szerepelt, hanem fejlécenként külön `Oldalszám: 1` és `Oldalszám: 2`.
4. A splitter a fejlécminta alapján 2 külön számlának minősítette a két oldalt. A Layer 2 azonos-számlaszám védőháló pedig elbukott, mert a `len(start_pages) == len(pages)` állapotban a kód azonnal visszatért, kikerülve a sorszám-egyeztetést.
5. Emiatt az 1. oldal önálló számlaként került mentésre, és az LLM az 1. tételsor összegét (**158.00 EUR**) vette fel a számla teljes bruttó végösszegeként, miközben az alsóbb tételsorok egységárai is elcsúsztak.

## Decision
Háromrétegű védelmet vezettünk be a `pdf_splitter.py` modulban:

1. **Előző Oldali Folytatás Jelző Detektálás (`_PREV_PAGE_CONTINUATION_RE`):**
   * A start-page jelöltek szűrésekor megvizsgáljuk az előző oldal láblécének utolsó 500 karakterét.
   * Ha az előző oldal folytatást jelez (`foly[ta]*t(?:[aá]s|[aá])?|\bfolyt\b|\bcontinued\b`), akkor az aktuális oldal nem indíthat új számlát (`suppressing_start_page_prev_continuation_detected`).
   * Kezeli a margónál levágott vagy csonkított szövegeket is (pl. `Folytata`).

2. **Fejléces Oldalszámozás Kiterjesztése (`_CONTINUATION_PAGE_RE`):**
   * A folytatásos oldalak mintája kiegészült az `oldalsz[aá]m` kifejezéssel:
     `r'\b(?:page|oldal|oldalsz[aá]m)\s*[:.]?\s*([2-9]|\d{2,})\b|\b([2-9]|\d{2,})\s*(?:oldal|oldalsz[aá]m)\b'`
   * Ezzel az `Oldalszám: 2` vagy `2. oldalszám` fejlécet tartalmazó oldalak automatikusan folytatásként lesznek felismerve.

3. **Layer 2 Sanity Check Kényszerítése (Early Return Eltávolítása):**
   * Megszüntettük a korai kilépést `if len(start_pages) == len(pages): return [[i] for i in range(len(pages))]`.
   * Ha minden oldalon észlelhető számla fejléc, a csoportok minden esetben átfutnak a Layer 2 azonos-számlaszám ellenőrzésen (`_has_same_invoice_number`). Ha az oldalak fejlécében azonos bizonylatszám szerepel, a rendszer elnyomja a téves szétvágást és egyetlen többoldalas számlaként kezeli a dokumentumot.

## Consequences

**Pozitív:**
* A többoldalas, folytatásos számlák (mint a D'Addario és hasonló nemzetközi bizonylatok) egyetlen egészként kerülnek az OCR/LLM motorhoz.
* A végösszeg a valós záróértékkel (pl. 684.22 EUR) kerül kinyerésre az 1. tételsor csonkolása helyett.
* Regressziós tesztekkel (`test_daddario_two_page_invoice_not_split`) fedett működés.

**Negatív / Kockázatok:**
* Ha két teljesen különálló egyoldalas számla közül az első véletlenül tartalmazza a „folytatás” szót (pl. megjegyzésben), az összevonásra kerülhet — a láblécre korlátozott 500 karakteres keresési tartomány ezt minimalizálja.

## Kapcsolódó
- [A-007: Multi-Invoice PDF Splitting](../../../visibill-worker/docs/DECISIONS.md)
- [Worker Architecture & Pipeline](../../../visibill-worker/docs/ARCHITECTURE.md)
- [Worker Gotchas: PDF Splitter](../../../visibill-worker/docs/GOTCHAS.md)
