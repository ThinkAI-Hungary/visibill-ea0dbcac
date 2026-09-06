# A-096: Hivatalos NAV Tételsor Védőháló, Sorszám Szinkronizáció és 23505 Ütközésvédelem (Authoritative NAV Line Items Crosscheck & Sync Guard)

**Status:** Decided  
**Date:** 2026-09-06  
**Utoljára frissítve:** 2026-09-06  

---

## Context

Feltöltött PDF és képes számlák feldolgozásánál – különösen többoldalas, 30–70 tételes bizonylatoknál (pl. Vasalat-Expressz Kft., Blum számlák) – a fejlett OCR és multimodális LLM modellek mellett is előfordulhatnak apróbb elütések, hiányzó tételek vagy formázási anomáliák.

Ugyanakkor a magyar vállalkozások bejövő és kimenő számlái a kiállító számlázóprogramja által közvetlenül és kötelezően a NAV Online Számla rendszerébe kerülnek beküldésre XML formátumban. A NAV Online Számla rendszeréből szinkronizált rekordok (`nav_invoices` és `nav_invoice_items`) hivatalos, jogilag hiteles és 100%-ban megbízható forrásnak minősülnek.

A mélyreható implementációs vizsgálat (`morfi-implementation-review`) rámutatott a kezdeti naiv összekapcsolási kísérletek rejtett kockázataira és technikai korlátaira:
1. **PostgREST ILIKE Korlát Kötőjeles Számlaszámoknál:** Az alfanumerikus mag keresése (`ilike '%BV20262240%'`) nem illeszkedett a kötőjeles / perjeles NAV számlaszámokra (`BV-2026/2240`), így a számlaszám alapú jelöltkeresés a magyar számlák túlnyomó többségénél üres eredménnyel tért volna vissza.
2. **Postgres 23505 Unique Constraint Ütközés:** Az `invoices` táblán létezik egy `(company_id, bizonylatsorszam)` egyedi index (`invoices_company_id_bizonylatsorszam_key`). Ha a célcégnél korábban már rögzítésre került egy számla a NAV hivatalos sorszámával, a feltöltött számla bizonylatszámának felülírása Postgres 23505 duplicate key hibával leállította volna a feldolgozást.
3. **Főkönyvi és Projekt Metaadatok Elvesztése:** A naiv tételmásolás eldobta a NAV tételeknél már létező `gl_classifications`, `project_id`, `exclude_from_accounting` és `deductible_percentage` adatokat.
4. **Fejléc Hitelesítés Blokkolódása 0 NAV Tételnél:** Ha a számla szerepelt a NAV-ban, de a tételek még nem szinkronizálódtak (0 sor a `nav_invoice_items`-ben), a számla fejléce sem kapta meg a `verified` státuszt.

---

## Decision

Bevezettük az automatikus, intelligens **Hivatalos NAV Tételsor Védőhálót** a worker számlafeldolgozási folyamatába (`_process_single_invoice` és `_process_multi_invoice_pipeline`):

### 1. Céghez rendelés és routing utáni aktiválás
- A védőháló a dokumentum kinyerése és céghez rendelése után lép életbe, garantáltan a végső cégazonosítót (`target_company_id`) használva.

### 2. Többlépcsős intelligens jelöltkeresés (`find_matching_nav_invoice_and_items`)
A PostgREST lekérdezési korlátait feloldva 4 szintű lekérdezési stratégiát alkalmazunk a jelöltek felkutatására:
- **1. Stratégia:** Eredeti tisztított sorszám közvetlen ILIKE illesztése (`.ilike("invoice_number", f"%{raw_clean}%")`).
- **2. Stratégia:** Leghosszabb alfanumerikus szegmens illesztése (pl. `2240` a `BV-2026/2240`-ből).
- **3. Stratégia:** Alfanumerikus mag keresése elválasztók nélkül.
- **4. Stratégia:** Bruttó végösszeg szerinti tenant-szintű lekérdezés (`eq("invoice_gross_amount", gross_amount)`).

### 3. Szigorú memóriabeli ellenőrzés (0 Ft tolerancia & Partner egyezés)
- **Normalizált sorszám:** `normalize_invoice_number_for_match` kisbetűsítve, szóköz, kötőjel, aláhúzás és perjel mentesen vizsgálja az egyezést.
- **Partner név intelligens ellenőrzés (`partner_names_match`):**
  - Ha a számláról kinyert partner név (`elado_nev` vagy `vevo_nev`) elérhető, összeveti a NAV számla `supplier_name` és `customer_name` mezőivel.
  - A normalizálás (`normalize_company_name`) eltávolítja a jogi cégformákat (Kft., Zrt., Bt., Nyrt., e.v., s.r.o., GmbH), írásjeleket és felesleges szóközöket.
  - Támogatja az egzakt egyezést, a tartalmazást (containment, pl. *"Bútor Vonal"* vs *"Bútor Vonal Kereskedelmi Kft."*), és az érdemi szótő/márkanév metszetet (pl. *"Gyulavári és Társa"* vs *"Gyulavári Kft."*).
  - Ha mindkét oldalon szerepel partnernév, de azok teljesen különbözőek (pl. *"Vasalat Express"* vs *"Telekom"*), a védőháló szigorúan elutasítja a téves jelöltet.
  - Ha a partnernév nem olvasható vagy hiányzik a számláról, nem blokkolja a párosítást (feltéve, hogy a számlaszám és összegek pontosan egyeznek).
- **Pénznem sanity check:** Ha mind a számlán, mind a NAV-ban ismert a deviza és eltérnek, a védőháló elutasítja a párosítást.
- **0 Ft Összeg-tolerancia:** Mind a nettó összegnek, mind a bruttó végösszegnek pontosan (kerekítve) meg kell egyeznie. *Külföldi számlák nincsenek a NAV-ban, így náluk ez az ellenőrzés természetes módon, hibamentesen átugrik.*

### 4. Fejléc hitelesítés és 23505 ütközésvédelem (`apply_nav_verified_status`)
- Ha a számla bizonyítottan egyezik a NAV-ban, a számla sorszáma felülírásra kerül a hivatalos NAV bizonylatszámra, és megkapja a `nav_status = 'verified'` valamint `statusz = 'feldolgozott'` státuszt.
- **Ütközésvédelem:** Ha a célcégnél már létezik egy másik invoice rekord pontosan a NAV hivatalos sorszámával, a rendszer a sorszámot nem írja felül (elkerülve a Postgres 23505 megsértését), de a `nav_status = 'verified'` és `statusz = 'feldolgozott'` státuszt beállítja.
- **Trigger szinergia:** A bizonylatszám NAV sorszámra módosítása aktiválja a `mark_nav_invoice_as_submitted` adatbázis triggert, ami a `nav_invoices` táblában automatikusan beállítja a `submitted = true` értéket, aktiválva a számlakép ikont a felületen.

### 5. Tételsorok átvétele és metaadat megőrzés (`save_nav_items_to_invoice`)
- Ha a NAV számlához tartoznak tételsorok (`nav_invoice_items`), a worker idempotensen felülírja a feltöltött számla `invoice_items` rekordjait a hivatalos tételekkel.
- A natív mezőkön felül hiánytalanul átörökíti a `gl_classifications` (főkönyvi besorolás), `project_id`, `exclude_from_accounting`, `deductible_percentage` és `notes` mezőket.

### 6. Robusztus Fallback
- Ha nincs NAV számla találat, vagy a NAV-ban 0 tétel található (egyszerűsített adatközlés vagy még nem letöltött részletek): a worker zökkenőmentesen megtartja az AI által kinyert tételeket (`save_line_items`).

---

## Consequences

### Pozitív
- **100%-os adathitelesség:** Bármilyen OCR vagy LLM kihagyás esetén a hivatalos számlázóprogram által beküldött tételek kerülnek a rendszerbe.
- **Azonnali submitted szinkron:** A felületen a NAV számla és a feltöltött számlakép azonnal összekapcsolódik (`submitted = true`).
- **Nincs adatbázis leállás:** A 23505 ütközésvédelem garantálja, hogy duplikált számlaszámoknál sem száll el a feldolgozás.
- **Költség és token megtakarítás:** A meglévő főkönyvi besorolások (`gl_classifications`) átöröklődnek, nem kell újra lefuttatni az AI klasszifikációt.

### Negatív / Kockázatok
- Ha a NAV szinkronizáció késik a számlafeltöltéshez képest (a felhasználó hamarabb tölti fel a számlát, mint hogy a NAV Online Számla API-n keresztül megérkezne), a védőháló fallbackre vált az AI tételekre. Későbbi számlamegnyitáskor vagy újrafeldolgozáskor az adatok szinkronizálhatók.

---

## Kapcsolódó
- [A-012: NAV Online Számla API v3 integráció](./A-012-nav-integration.md)
- [A-025: Cross-company Invoice Routing](./A-025-cross-company-routing.md)
- [A-054: Szigorított NAV ↔ Beküldött Számla Összerendelés](./A-054-strict-nav-submitted-pairing.md)
- [A-084: NAV Online Számla Cross-Check & Könyvelői Jóváhagyási Kapu](./A-084-nav-crosscheck-approval-gate.md)
- Worker ADR: `worker/docs/DECISIONS.md` (ADR-065)
