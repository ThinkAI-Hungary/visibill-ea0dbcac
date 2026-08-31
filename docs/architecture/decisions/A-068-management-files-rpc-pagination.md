# A-068: High-Performance Server-Side Management Files Pagination & Multi-Source Unified Querying (`get_management_files` RPC)

**Status:** Decided  
**Date:** 2026-08-31  
**Category:** Adatbázis & Platform Üzemeltetés  
**Related Decisions:** [A-019](./A-019-management-dashboard.md), [A-050](./A-050-server-side-aggregation-and-n-plus-1-optimization.md), [P-036](../../product/decisions/P-036-management-dashboard.md)

---

## 1. Context

A Management Dashboard `Fájlok` fülén (`FilesPanel`) a rendszer a platform összes feltöltött dokumentumát jeleníti meg négy különböző forrás táblából (`invoice_uploads`, `transaction_uploads`, `bank_statement_uploads`, `report_uploads`).

Korábban a `buildFiles` funkció az Edge Function-ben külön lekérdezéseket futtatott minden egyes táblára egy statikus `.limit(500)` korlátozással, és a sorokat a memóriában aggregálta.
Ez két kritikus hibát okozott nagy adatmennyiségnél:
1. **Fals KPI metrikák:** A több mint 6 500 számlafeltöltésből csak a legfrissebb 500 rekord került beolvasásra. Mivel mind az 500 véletlenül `pending` státuszú volt, a KPI kártya `Folyamatban: 500` és `Összes fájl: 1129` értéket mutatott a valós **7 133** fájl helyett.
2. **Kliens-oldali lapozás és lassulás:** A kliensnek kellett a memóriában szűrnie és lapoznia 2 000 elemet, ami felesleges hálózati terhelést és késleltetést okozott.

---

## 2. Decision

Létrehoztunk és élesítettünk egy natív, nagy teljesítményű PostgreSQL tárolt eljárást (`get_management_files`), amely az összes tenant adatbázisban fut:

1. **Unifikált CTE lekérdezés:**
   Közvetlenül SQL szinten vonja össze a 4 forrás táblát (`invoice_uploads`, `transaction_uploads`, `bank_statement_uploads`, `report_uploads`), és `LEFT JOIN` segítségével egy menetben csatolja a valós cégneveket (`companies.name`) és feltöltő felhasználói neveket (`profiles.name`).
2. **Valós idejű, teljes körű KPI számítás:**
   A szűrések előtt pontos `COUNT` aggregációval számolja ki az `all_files`, `success_files` (beleértve a `webhook_sent` és `cmr_attached` státuszokat), `error_files`, `pending_files` és `dismissed_files` értékeket az összes (7 133+) rekordra vetítve.
3. **Szerver-oldali lapozás, keresés és rendezés:**
   - Keresés: gyors `ILIKE` keresés fájlnévre, hibaszövegre és forrástípusra.
   - Lapozás: natív SQL `LIMIT` és `OFFSET` (alapértelmezetten 25 elem/oldal).
   - Rendezés: dinamikus oszlop és irány szerinti rendezés (`created_at`, `file_name`, `company_name`, `user_name`, `processing_status`, `file_size`, `source`).

---

## 3. Consequences

### Pozitív:
- **100% Pontos KPI adatok:** Nincs 500-as csonkolás, a valós ~7 133 fájl statisztikája jelenik meg azonnal.
- **Rendkívül gyors válaszidő:** A teljes lekérdezés és lapozás **<30 ms** alatt lefut a szerveren.
- **Minimális hálózati forgalom:** Az Edge Function csak a lapozott 25 sort és az összesített KPI számokat adja vissza JSON formátumban.

### Trade-offs:
- A forrás táblák szerkezetének bővülésekor (új upload tábla) a `get_management_files` RPC-t is frissíteni kell a migrációkban.
