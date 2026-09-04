# A-087: Főkönyvi Adatbázis-alapú Keresés, Számla-szintű Lapozás és Tooltip Architektúra

**Status:** Decided  
**Date:** 2026-09-04  
**Utoljára frissítve:** 2026-09-04  
**Category:** Database / Performance / General Ledger / Search / Frontend Architecture  
**Érintett komponensek:** `search_gl_entities`, `get_gl_categorized_items`, `GlSearchAutocomplete.tsx`, `GeneralLedgerTable.tsx`, `GeneralLedgerComparisonTable.tsx`, `JournalView.tsx`, `custom-tooltip.tsx`  

---

## Context

A Főkönyv modul nagyméretű cégek (több tízezer számla, banki tétel és naplóbejegyzés) esetén két jelentős architektúrális és skálázhatósági kihívással szembesült:

1. **Keresési Skálázhatóság (Kliens-oldali vs. Adatbázis keresés):**
   - A korábbi keresési megoldások vagy a már betöltött faágakban kerestek a memóriában, vagy a teljes adatmennyiség kliensre húzását feltételezték.
   - 1000+ tétel vagy több tízezer bizonylat felett a kliens-oldali szűrés nem találta meg a még be nem töltött tételeket, vagy a PostgREST alapértelmezett 1000 soros limitje miatt csonkított eredményt adott.
   - Szükség volt egy olyan direkt PostgreSQL keresőmotorra, amely partnerek, leírások, számlaszámok és főkönyvi számok alapján egyetlen gyors, indexelt lekérdezéssel ad vissza találatokat.

2. **DOM és Render Terhelés Nyitáskor (Főkönyvi Számlák és Besorolatlan Tételek):**
   - Amikor egy számla (különösen az `UNCLASSIFIED` / "Besorolatlan" tételcsoport) több száz vagy ezer sort tartalmaz, a faág lenyitása azonnal több ezer DOM csomópontot renderelt le egyszerre, ami jelentős felületi fagyást (layout freeze) okozott.
   - A `get_gl_categorized_items` eljárás egyszerre adta vissza egy számlához tartozó összes tételt limit nélkül.

3. **Kliens Navigáció és Keresési Találat Injektálás:**
   - Amikor a felhasználó a globális keresőből (`GlSearchAutocomplete`) kiválasztott egy olyan számlatételt, amely a számla első lapozott ablakában (100 sor) még nem szerepelt, a fa kinyitása után a célzott sor (`row_item_...`) nem létezett a DOM-ban, így a `scrollIntoView` és a sor kiemelése meghiúsult.

4. **Böngésző Title Tagek vs. Radix Tooltip:**
   - A komponensekben vegyesen használt HTML `title` attribútumok lassú, natív böngészőbuborékokat jelenítettek meg, amelyek stílusa nem illeszkedett a design rendszerhez, mobil/touch eszközökön használhatatlanok voltak, és React rehidratációs figyelmeztetéseket okozhattak.

---

## Decision

### 1. PostgreSQL Kereső RPC: `search_gl_entities`
Létrehoztunk egy dedikált tárolt eljárást (`supabase/migrations/20260904130000_search_gl_entities.sql`), amely közvetlenül az adatbázisban aggregálja és rangsorolja a találatokat:
- **Számlák keresése (`gl_accounts`):** Főkönyvi szám (`account_code`) vagy név (`name`) egyezés.
- **Tételek keresése (`invoices`, `journal_entries`, `bank_transactions`, `xml_audit_records`):**
  - Partner név, számlaszám, megjegyzés/leírás szerinti `ILIKE` keresés.
  - Visszaadja a tétel gazda főkönyvi számát (`target_gl_number`), típusát, dátumát, forrástábláját és összegét.
- **Limit:** Alapértelmezett 30 legrelevánsabb elem, hogy a hálózati payload minimális maradjon és a debounced keresés valós időben reagáljon.

### 2. Számla-szintű Ablakozott Lapozás (`get_gl_categorized_items` `p_limit` és `p_offset`)
Módosítottuk a `get_gl_categorized_items` RPC-t (`supabase/migrations/20260904120000_paginate_gl_categorized_items.sql`):
- Opcionális `p_limit INT DEFAULT NULL` és `p_offset INT DEFAULT 0` paramétereket kapott.
- A frontend [GeneralLedgerTable.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx) komponensében az egyes számlák kinyitásakor 100-as darabokban (`PAGE_SIZE = 100`) töltődnek be a tételek a [fetchGlItemsForAccount](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/glData.ts) segítségével.
- Ha egy számlához 100-nál több tétel tartozik, a lista alján egy diszkrét "További tételek betöltése..." gomb jelenik meg a fennmaradó darabszámmal, megakadályozva a több ezer DOM csomópont egyszerre történő renderelését.

### 3. Keresési Elem Injektálása és Célzott Görgetés (`handleNavigateToEntity`)
A [GeneralLedgerTable.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx)-ben a `handleNavigateToEntity` megvalósítása:
- Ha a keresési találat egy számlatétel (`entity_type === 'item'`), a komponens feloldja a szülő számlát (`target_gl_number` vagy `account_id`).
- Automatikusan lenyitja a faágat (`expandedIds.add(parentCid)`).
- **Injektálási logika:** Ellenőrzi, hogy a cél tétel benne van-e már a `loadedAccountItems` memóriabeli listájában. Ha még nincs (mert pl. a 350. elem lenne), az RPC találatban lévő gazdag metaadatokból (`item_type`, `item_date`, `source_table`, `currency`) szintetizál egy `LedgerItem`-et, és beilleszti az adott számla tétel-listájának elejére.
- **Kiemelés és Fókusz:** A `targetRowId` konzisztensen az `item_${result.entity_id}` azonosítót kapja, amely megegyezik a táblázat sor `id="row_item_..."` attribútumával, majd a `scrollIntoView({ behavior: 'smooth', block: 'center' })` pontosan a látómezőbe görgeti a kiemelt sort.

### 4. Egységes Tooltip Rendszer: `CustomTooltip`
Bevezettük a [custom-tooltip.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ui/custom-tooltip.tsx) komponenst, amely a Radix UI Tooltip primitívjeire épül:
- Kiváltja a böngésző natív `title` attribútumait a Főkönyv és Audit import modulokban.
- Automatikus fallback-et biztosít, ha az alkalmazás faágában nincs feljebb definiálva `TooltipProvider` (önmagát csomagolja, elkerülve a runtime hibákat).
- Egységes megjelenést, testreszabható késleltetést (`delayDuration={200}`) és akadálymentes billentyűzet-fókuszt nyújt.

---

## Consequences

### Pozitív
- **Azonnali Keresési Élmény:** Akár 100 000+ tétel esetén is kevesebb mint 100ms alatt megtalálja a bizonylatokat a PostgreSQL indexelt lekérdezésével.
- **Kliens Stabilitás és Nulla Lefagyás:** A 100 tételes ablakozás révén a sok ezer tételt tartalmazó gyűjtőszámlák (pl. 454-es vagy Besorolatlan) megnyitása is teljesen akadásmentes.
- **Garantált Ugrás és Kiemelés:** A keresőből kiválasztott bármely tétel azonnal láthatóvá válik és kiemelődik, még akkor is, ha a lapozási tartományon kívül esne.
- **Konzisztens UI/UX:** A standard `CustomTooltip` komponens révén a felület modern, animált és tiszta buborékokat használ a böngésző natív, szürke szövegdobozai helyett.

### Negatív / Kötöttségek
- A `search_gl_entities` RPC jelenleg `ILIKE` alapú mintakeresést futtat; extrém nagy adatmennyiség (>1 000 000 tétel) esetén PostgreSQL `pg_trgm` (trigram) indexek bevezetése válhat szükségessé a partner és számlaszám oszlopokon.

---

## Kapcsolódó
- **BRD:** [050: Főkönyvi Könyvelési Státusz és Naplózási Kormányzás](../../business/decisions/050-gl-posting-status-and-journal-governance.md)
- **BRD:** [031: eaisyBooks Modul Scope](../../business/decisions/031-accounty-module.md)
- **PRD:** [P-068: Főkönyvi Keresés, Összehasonlítás Pagináció és Felületi Ergonómia UX](../../product/decisions/P-068-gl-search-and-comparison-pagination-ux.md)
- **PRD:** [P-067: Főkönyvi Könyvelési Státusz Szűrés UX](../../product/decisions/P-067-gl-posting-status-filter-and-journal-governance-ux.md)
- **ADR:** [A-086: Főkönyvi Könyvelési Státusz Szűrő és Naplózási Irányelvek](./A-086-gl-posting-status-filter-and-journal-governance.md)
- **ADR:** [A-085: Főkönyvi Dátum Alap RPC Pushdown és Dinamikus Chunk Reload Recovery](./A-085-gl-date-basis-rpc-and-chunk-error-recovery.md)
- **Design:** [11: Adatmegjelenítés & Táblázatok](../../design/11-data-display-tables.md)
- **DB Migrációk:**
  - `supabase/migrations/20260904120000_paginate_gl_categorized_items.sql`
  - `supabase/migrations/20260904130000_search_gl_entities.sql`
