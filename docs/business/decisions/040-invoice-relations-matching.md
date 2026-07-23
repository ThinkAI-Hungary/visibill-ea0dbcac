# Decision 040: Számla Kapcsolatok és Párosítási Logikák (Matching & Relations)

**Status:** Decided  
**Date:** 2026-06-28  
**Category:** Számlázás & Integrációk  

---

## 1. Bizonylat-láncolatok és Kapcsolatok (Invoice-to-Invoice Relations)

A rendszer támogatja a magyar számlázási rendszerben megszokott dokumentum-láncok (előleg-végszámla és sztornó-cancellation) logikai összekötését. Ezeket az összefüggéseket a háttérben futó Python worker LLM pipeline-jai nyerik ki a dokumentumok szövegéből és mentik el az `invoices` táblába.

### A. Díjbekérő (Proforma) ↔ Előlegszámla ↔ Végszámla Láncolat
* **Díjbekérő / Előlegbekérő (Proforma):** 
  * A számla típusa (`invoice_type`): `dijbekero_proforma` vagy `dijbekero`.
  * Saját azonosítója a `bizonylatsorszam` mezőben van.
* **Előlegszámla:** 
  * Az előleg beérkezése után kiállított számla (`invoice_type` = `elolegszamla`).
  * A **`reference_number`** mezőben tárolja az alapul szolgáló díjbekérő sorszámát (pl. *"XY díjbekérő alapján"*).
* **Végszámla:** 
  * A teljesítés után kiállított végszámla (`invoice_type` = `vegszamla`).
  * A **`elolegszamla_hivatkozas`** mezőben (vesszővel elválasztva) tárolódnak a beszámított előlegszámlák sorszámai (pl. `"EL-2023/001, EL-2023/005"`).
  * A **`elszamolt_eloleg_osszeg`** mező rögzíti a levont előleg pontos összegét.
  * **Matematikai ellenőrzés (Worker):** `brutto_vegosszeg ≈ (adoalap_osszesen + afa_osszeg_osszesen) − elszamolt_eloleg_osszeg`

### B. Eredeti Számla ↔ Sztornó/Helyesbítő Számla Párok
* **Sztornó számla:** Egy korábban kiállított számla érvénytelenítése/visszavonása (`invoice_type` = `sima_szla` vagy `vegszamla`, ahol az LLM a `klaszter.md` alapján azonosította a sztornó jelleget).
* **Összekapcsolás:** A sztornó számla a **`reference_number`** mezőben tárolja az eredeti (sztornózott) számla bizonylatszámát.
* **Kioltás:** A sztornó számlán az összegek (pl. `brutto_vegosszeg`, `adoalap_osszesen`) negatív előjellel szerepelnek a DB-ben, ami kioltja az eredeti számla értékét a pénzügyi összesítőkben.

---

## 2. Banki Tranzakció ↔ Számla Párosítás (Bank Matching)

A bankkivonatok (bank statements) tételeinek és a számláknak az összevezetése.

### A. Automatikus Párosítás (Backend/Worker)
* **Trigger:** A banki CSV importálásakor egy Edge Function elhelyez egy feladatot a PGMQ `transaction_jobs` sorában, amit a Python worker dolgoz fel.
* **Heurisztikus matching:** Első körben a bizonylatszám, a pontos összeg (cross-currency tűréshatárokkal), a dátum-toleranciák és a partnernév alapján párosít.
  * **Rövid számlaszámok előtag-alapú illesztése:** A rendszer a legalább 5 karakter hosszú számlaszámokat automatikusan keresi a leírásokban. A 5 karakternél rövidebb számlaszámokat (pl. `55`, `56`) a dátumok és egyéb rövid számok miatti téves egyezések elkerülése érdekében csak akkor tekinti jelöltnek, ha azokat a tranzakció leírásában közvetlenül egy számlára utaló kulcsszó előzi meg (pl. `invoice`, `inv`, `számla`, `szla`, `bill`, `no.`, `#`).
  * **Szigorú számlairány-ellenőrzés (Direction Safeguard):** A rendszer szigorúan elválasztja a tranzakció típusát (kiadás vs. bevétel) és a számla irányát (`INBOUND` vs. `OUTBOUND`). Kiadásokhoz (negatív banki tételekhez) kizáróleg bejövő (`INBOUND`) számlák rendelhetők hozzá, míg bevételekhez (pozitív banki tételekhez) kizárólag kimenő (`OUTBOUND`) számlák. Ez megakadályozza, hogy egy kimenő számla (pl. a SportsBase Hungary által kiállított, de valamilyen oknál fogva stornózott vagy negatív összegű számla) tévesen egy kiadási tranzakcióhoz kapcsolódjon.
  * **Előjeles egyezés vizsgálata (Sign Safeguard):** A stornó és helyesbítő számlák téves párosítása ellen a rendszer figyelembe veszi a számla bruttó összegének előjelét a tranzakció irányával összefüggésben. Kimenő (OUTBOUND) számláknál a számlának és a tranzakciónak azonos előjelűnek kell lennie (pozitív számla -> bejövő összeg; stornó számla -> kifizetett visszatérítés). Bejövő (INBOUND) számláknál ellentétes előjel szükséges (pozitív számla -> kiadási tranzakció; stornó számla -> bejövő jóváírás/visszatérítés).
  * **Szóhatár-alapú névvizsgálat:** A korábbi, szóközöktől megtisztított részstring-alapú keresést felváltotta a szóhatár-alapú ellenőrzés. A tranzakció leírását szavakra bontva vetjük össze a számla partnernevéből kinyert kulcsszavakkal. Ez megakadályozza, hogy a cég saját neve (pl. a `SPORTSBASE HUNGARY`-ben lévő *sportsbase*) hamis pozitív egyezést adjon egy teljesen más partnernév részszavára (pl. `MK SPORT MANAGEMENT LTD` partner *sport* szavára).
  * **Magyar végződés-illesztés (`+hu` szabály):** A banki kivonatokon gyakran előforduló egybeírt, országhivatkozásos partnernevek támogatására (pl. `WOLFHU` a `Wolf` céghez) a rendszer explicit módon engedélyezi a `partner_szó + "hu"` formájú egyezéseket.
  * **Biztonságos prefix-illesztés:** A rövidebb szavak véletlen egyezéseinek elkerülése érdekében szótöredékes/prefix-alapú illesztés csak a legalább 6 karakter hosszúságú név-kulcsszavak esetén engedélyezett (pl. `SimplePay` -> `SIMPLEP`).
* **AI Fallback:** Ha a heurisztikus keresés bizonytalan, az LLM a `tranzakcio_parositas.md` prompt alapján kiszámítja a `confidence_score`-t, meghatározza a `match_type`-ot (`exact`, `partial`, `ai_suggested`), és elmenti a `gl_reasoning` indoklást a `transactions` táblába.
* **Multi-match:** A kapcsolatokat a `transaction_invoice_matches` összekötő tábla tárolja (egy tranzakcióhoz több számla is tartozhat — pl. részfizetés vagy gyűjtőutalás).

### B. Manuális Felülbírálás (Frontend)
* **Felület:** A felhasználó a `TransactionDetailsDialog.tsx` ablakban kézzel kereshet és rendelhet hozzá számlát a tranzakcióhoz. Ekkor beállítódik a `is_verified = true` flag.
* **ML visszacsatolás:** Minden manuális felülírás mentődig a `match_transaction_overrides_log` táblába, amit a worker a jövőben felhasznál az AI pontosságának javításához.
* **Deviza-kezelés:** 
  * Azonos devizánál: direkt összeg-összehasonlítás.
  * Eltérő devizánál (cross-currency): a rendszer mindkét oldalt HUF-ra konvertálja a devizaárfolyam szerint, és az eltérést a helyes devizanemben jeleníti meg.

---

## 3. Fuvar ↔ Számla Párosítás (Shipment Matching)

A szállítmányozási modulban a fuvarok és a hozzájuk kapcsolódó számlák/okmányok összekötése.

* **Elérés:** Kliens-specifikus (HRT Spedition) modul, alapértelmezetten ki van kapcsolva, és csak az `eaisybill_module_permissions` táblán keresztül engedélyezhető per-user/per-company alapon.
* **Feltöltés és Detektálás:** A PGMQ triggerelése után a worker elemzi a feltöltött dokumentumokat. Ha nem számláról van szó, elindik a **Transport Document Detection** (Vision OCR és fájlnév minták alapján).
* **Okmánytípusok:** `CMR` (fuvarlevél), `Nalog` (megbízás), `POD` (igazolás).
* **Párosítási logika:** A worker kiszűri a pozíciószámot (pl. `E/2627512` formátum), és megkeresi a Selexped RPA-ból importált fuvart a `shipments` táblában a `position_number` alapján.
* **Adatmodell:** Összeköti és menti a `transport_documents` táblában (`linked_shipment_id` és `linked_invoice_id` kitöltésével). A párosítás státusza a `shipment_matches` táblába kerül (`matched`, `escalated`, `pending`).

---

## 4. Manuális kifizetések (Máshogyan kiegyenlített tételek)

Azon számlák kezelése, amelyeket nem banki átutalással egyenlítettek ki.

* **Logika:** A felhasználó a számla nézetben rögzítheti a kifizetést (Készpénz, Privát kártya, Tagi hitel).
* **Technikai megvalósítás:**
    - A rendszer létrehoz egy virtuális tranzakciót a `transactions` táblában (`is_manual = true`).
    - A tranzakciót azonnal összekapcsolja a számlával (`matched_invoice_id`).
    - Ez biztosítja, hogy a pénzforgalmi riportok (pl. ÁFA bevallás) lássák a kifizetés tényét és dátumát.
* **Adatmodell:** A `transactions` tábla tartalmazza a kifizetés módját (`manual_payment_type`) és opcionális megjegyzést (`manual_payment_note`).

---

## 5. NAV Online Számla ↔ Feltöltött Számla Szinkronizáció (Twin Sync)

A rendszerben a számlák két külön táblában élnek: a feltöltött `invoices` és a NAV Online Számla rendszeréből lekért `nav_invoices`.

* **Párosítás:** A két rekord a számlaszám alapján kapcsolódik össze normalizált formában (`nav_invoices.invoice_number` ↔ `invoices.bizonylatsorszam`), kis- és nagybetű-érzéketlenül, szóközöktől megtisztítva.
* **Kategória és Projekt szinkronizáció (`P-022` / `A-022`):** Ha az egyik számlánál módosítjuk a fejléc `category_id` vagy `project_id` értékét, a rendszer automatikusan frissíti a kapcsolódó "testvér" számlát is a másik táblában a riportok konzisztenciája érdekében.
* **Főkönyvi (GL) tételszintű szinkronizáció (`P-043`):** 
  * A számlatételek módosításakor (`InvoiceItemsDialog`) a rendszer azonosítja a "testvér" számlát és annak azonos `line_number` (tételszám) értékkel rendelkező tételeit.
  * Mindkét tételt egyetlen atomi `override_gl_classifications_batch` RPC hívásban frissíti egyszerre a konzisztencia és a közös audit trail érdekében.

---

## Kapcsolódó Dokumentáció
- **ADR:** [A-006: Python Worker Architektúra](../../architecture/decisions/A-006-python-worker.md)
- **ADR:** [A-022: Categories and Projects Sync](../../architecture/decisions/A-022-categories-projects-sync.md)
- **PRD:** [P-018: Manuális Párosítás Felülírás](../decisions/P-018-manual-matching.md)
- **PRD:** [P-043: GL Twin Sync](../decisions/P-043-gl-twin-sync.md)
- **Architecture:** [Shipment Matching frontend specifikáció](../../architecture/shipment-matching.md)
- **Worker docs:** [Worker prompts specifikáció](../../../worker/docs/PROMPTS.md)
