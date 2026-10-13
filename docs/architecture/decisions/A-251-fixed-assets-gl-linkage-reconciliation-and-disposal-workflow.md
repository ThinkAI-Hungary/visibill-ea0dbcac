# A-251: Tárgyi Eszköz ↔ Főkönyv Kapcsolat, Rekonciliáció és Jóváhagyás-alapú Kivezetési Workflow

**Status:** Decided  
**Date:** 2026-10-13  
**Utoljára frissítve:** 2026-10-13  

## Context

A TENY ([A-164](./A-164-development-reserve-fixed-assets-db-and-depreciation.md), [A-180](./A-180-fixed-assets-periodic-depreciation-posting-service.md)) analitikája és a főkönyv (`acc_journal_headers` / `acc_journal_lines`) között nem volt azonosítható kapcsolat: az aktiválási, ÉCS és fejlesztési tartalék könyvelések csak szövegesen (bizonylatszám) hivatkoztak az eszközre. Emiatt:

1. a 1x / 1x9 / 161 főkönyvi egyenleg és a TENY analitika eltérését nem lehetett eszközönként kimutatni;
2. a kivezetés (`useDisposeAsset`) csak az eszköz státuszát írta át, főkönyvi tétel nélkül (a főkönyvi nettó érték a kivezetett eszköz után is megmaradt);
3. a kivezetést bárki, jóváhagyás nélkül végrehajthatta, kiegyensúlyozott könyvelés nélkül.

Alternatívák: (a) szöveges bizonylatszám-alapú kereszthivatkozás (törékeny), (b) külön link tábla (extra join, nincs hivatkozási integritás a sorszinten), (c) közvetlen oszlop a könyvelési soron (választott).

## Decision

### 1. `fixed_asset_id` címke a főkönyvi soron
`acc_journal_lines.fixed_asset_id` (FK → `fixed_assets.id`, **`ON DELETE RESTRICT`**: könyvelt eszköz nem törölhető, nem marad "árva" főkönyvi sor), cég-azonosság védő trigger (idegen cég eszközére nem címkézhető sor), FK-index. Az aktiválási, ÉCS és fejlesztési tartalék auto-posterek és a sztornó RPC átadják/átmásolják a címkét. A korábbi (címke nélküli) sorok **nincsenek visszatöltve** – árva tételként jelennek meg a rekonciliációban (visszatöltés külön döntés).

### 2. Rekonciliáció (csak olvasás)
`rpc_reconcile_fixed_assets_with_gl` (STABLE, `member_read`): eszközönként a TENY analitika vs. a címkézett főkönyvi tételek (bruttó, halmozott ÉCS, beruházás 161), root-cause besorolással (`not_posted`, `value_mismatch`, `orphan_gl`, …). A várt ÉCS a kliensen számolódik (zárt hónap határig). A régi `get_gl_analytic_reconciliation` változatlan.

### 3. Kivezetés = kérelem → jóváhagyás (maker–checker), DB-ben kikényszerítve
- `fixed_assets.disposal_status` (text + CHECK: `none | pending_approval | approved | rejected`), `disposal_details` jsonb.
- RPC-k (mind SECURITY DEFINER, `search_path` rögzítve, anon REVOKE): `request_asset_disposal` (`member_write`), `reject_asset_disposal` és `approve_asset_disposal` (`ledger_write`).
- A jóváhagyás egyetlen tranzakcióban: validál (≥2 sor, pozitív összeg, tartozik = követel, a számlák a cég számlatükréhez tartoznak), `KIV-<leltári szám>` fejlécet könyvel (`KONYVELT`), a sorokat `fixed_asset_id`-val címkézi, az eszköz `sold`/`disposed` lesz, `disposal_approved` + `disposal` esemény.
- Trigger: a `disposal_status = 'approved'` közvetlen UPDATE-tel nem állítható be (42501) – csak az RPC útvonalon.
- A kivezetési sorokat a kliens számolja (`buildDisposalJournal`), az RPC csak validálja – a számlaválasztás (cég egyedi számlatükre) kliensoldali, így a szerver nem hardcode-ol számlaszámot.

### 4. Egységes kivezetési motor
Minden jogcímnél (értékesítés, selejtezés, leltárhiány, térítés nélküli átadás): pótlólagos ÉCS a kivezetés napjáig (T 5711 → K 1x9), majd T 1x9 → K 1x (bruttó), a nettó érték T 861 (értékesítés) vagy T 869 (egyéb). Értékesítésnél az árbevétel (T 311/384 → K 961) opcionális, ÁFA nincs kezelve. Jóváhagyás blokkolt, ha az eszköz bruttó értéke nincs címkézve a főkönyvben (előbb a Rekonciliáció fülön kell könyvelni).

### 5. Fejlesztési tartalék figyelés (kliensoldali, tájékoztató)
`developmentReservePenaltyCalculator.ts`: lejárat-riasztás (3./4. adóév), fel nem használt rész visszafizetési becslése (9% Tao + késedelmi pótlék = MNB alapkamat + 5 pont, konfigurálható paraméterekkel) és elidegenítési tilalom (5 év) figyelmeztetés kivezetéskor. A jogszabályi paraméterek **feltevések** – a UI "tájékoztató becslés"-ként jelöli. A Tao 22/A. § kedvezmény nincs implementálva.

### 6. PDF
A selejtezési jegyzőkönyv **jsPDF + jspdf-autotable** (nem pdfmake), mert a repo meglévő aktiválási jegyzőkönyve is ezt használja.

## Consequences

**Pozitív:** eszközszintű, bizonyítható TENY ↔ főkönyv egyezés; a kivezetés csak jóváhagyással, kiegyensúlyozott, címkézett könyveléssel történhet; a szabály a DB-ben érvényesül (kliens megkerülése nem lehetséges).  
**Negatív / nyitott:** a legacy sorok címkézetlenek; `execute_journal_reclassification` / `rollback_journal_reclassification` nem másolja a `fixed_asset_id`-t; a Tao adóalap kivezetési korrekció nincs bekötve az éves zárásba; a függvénytestek a Dev élő definícióból készültek – Prod-ra élesítés előtt Prod definícióval össze kell vetni; a régi `useDisposeAsset` `@deprecated`, de még létezik.

## Kapcsolódó
- [A-164: Fejlesztési tartalék és TENY DB](./A-164-development-reserve-fixed-assets-db-and-depreciation.md)
- [A-180: ÉCS elszámolás és Vegyes napló feladás](./A-180-fixed-assets-periodic-depreciation-posting-service.md)
- [P-185: TENY rekonciliáció, kivezetés jóváhagyás és tartalék riasztás UX](../../product/decisions/P-185-fixed-assets-reconciliation-disposal-approval-and-reserve-alerts-ux.md)
- Terv: `implementation-plans/TENY_implementacios_terv.md`
- Migrációk: `20261012231000_fixed_assets_gl_link_and_disposal_gate.sql`, `20261012231100_fixed_asset_id_in_gl_posting_rpcs.sql`, `20261012232300_rpc_reconcile_fixed_assets_with_gl.sql`, `20261013000000_asset_disposal_workflow_rpcs.sql`
