# Decision 039: Kategóriák és Projektek Dual-table Szinkronizációja

**Status:** Decided

**Category:** Számla Kezelés / Kategóriák és Projektek

**Question:** Hogyan kell kezelni a kategóriák és projektek számlákhoz rendelését, ha mind feltöltött (invoices), mind NAV-ból jövő (nav_invoices) adatok szerepelnek a rendszerben?

**Decision:**
A **szinkronizált dual-table** megközelítés mellett döntöttünk:
- A kategória (`category_id`) és a projekt (`project_id`) hozzárendeléseket mindkét táblában (`invoices` és `nav_invoices`) párhuzamosan tároljuk.
- Bármelyik felületen végzi a felhasználó a hozzárendelést, a backend frissítések a számlaszám alapján mindkét rekordra kiterjednek.
- A számlalistában a NAV számlák fallback-ként automatikusan a párosított beküldött számla kategória/projekt adatait jelenítik meg, ha a NAV rekordon ez még nincs kitöltve.
- A kategóriák és projektek név/szín módosításait azonnali, cache-invalidáción alapuló reaktív felület-frissítéssel követjük le a számlák listájában szereplő badge-eken.

**Rationale:**
Ez a megközelítés biztosítja a legmegbízhatóbb adatintegritást anélkül, hogy a riportok elkészítésekor szigorúan függeni kellene a párosítások meglététől. A fallback logika garantálja a zökkenőmentes és konzisztens felhasználói élményt (UX) anélkül, hogy a felhasználónak kétszer kellene elvégeznie ugyanazt a hozzárendelést.
