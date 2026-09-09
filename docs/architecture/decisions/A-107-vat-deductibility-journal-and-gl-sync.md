# A-107: ÁFA Levonhatóság Szinkronizálása a Könyvelési Naplóval és Főkönyvvel, Valós Idejű Trigger és Zárt Tételek Védelme

**Státusz:** ✅ Elfogadva (Decided)  
**Dátum:** 2026-09-09  
**Döntéshozók:** Antigravity Architect, Surányi Pál (ügyféli visszajelzés alapján)  
**Érintett komponensek:** `acc_generate_drafts_from_ledger`, `get_gl_categorized_items`, `get_gl_balances`, `sync_item_deductible_to_journal_draft`, `InvoiceItemsDialog.tsx`, `draftFallbackGenerator.ts`  
**Kapcsolódó döntések:** [A-057](./A-057-accounting-journals-architecture.md), [A-078](./A-078-telecom-vat-deductibility-rules.md), [A-086](./A-086-gl-posting-status-filter-and-journal-governance.md)

---

## 1. Kontextus és Problémafelvetés

Ügyféli bejelentés érkezett az alábbi anomáliáról:
Amikor a Számlák felületen a felhasználó átállítja egy bejövő számla tételnél az ÁFA levonhatóságot le nem vonhatóra (0%, pl. személyautó tankolása esetén), az ÁFA bevallás ezt figyelembe vette, azonban a Könyvelési napló és a Főkönyv változatlan maradt:
1. A napló továbbra is létrehozta a 466-os levonható ÁFA sort.
2. A főkönyvi kimutatás csak a nettó összeget tekintette költségnek.
3. Az átállítás után a felhasználónak több menüponton keresztül újra és újra kézzel kellett volna korrigálnia a tételeket.

A magyar számviteli és adójogszabályok (Sztv. 47. § (2) bek. és Áfa tv. 124. §) szerint le nem vonható ÁFA esetén a számla teljes összege költségként kell, hogy megjelenjen ÁFA-könyvelés (466-os számla) nélkül.

---

## 2. Döntések és Architektúra

### D-1: Kétlábú Bruttó Könyvelés 0% Levonhatóságnál (`acc_generate_drafts_from_ledger`)
- Ha a bejövő szállítói tételnél a levonható ÁFA mértéke 0% (`deductible_percentage = 0.00`):
  - A 466-os ÁFA-sor **nem generálódik le**.
  - A számla teljes bruttó összege közvetlenül a költségszámlára (pl. `5121 - Üzemanyagok`) könyvelődik:
    `T 5121 Költség (bruttó)` / `K 4541 Szállító (bruttó)`.
- Részleges levonhatóság esetén (pl. 70/30 telefon):
  - A levonható 70% ÁFA kerül a 466-ra, míg a le nem vonható 30% automatikusan a költséget növeli (`T Költség (nettó + le nem vonható áfa)` / `T 466 (levonható áfa)` / `K 4541 (bruttó)`).

### D-2: Főkönyvi Karton és Egyenlegek Összhangja (`get_gl_categorized_items`, `get_gl_balances`)
- Az operatív (még nem véglegesített) számlatételek esetén a költségösszeg számítása a nem levonható ÁFA-val növelt valós költséget veszi figyelembe:
  ```sql
  -(COALESCE(net_amount, 0) + ROUND(COALESCE(vat_amount, 0) * (1.0 - (COALESCE(deductible_percentage, 100.0) / 100.0)), 2))
  ```

### D-3: Valós Idejű DB Trigger és Összegkorrekciók (`sync_item_deductible_to_journal_draft`)
- Az `invoice_items` és `nav_invoice_items` táblákra adatbázis trigger épült:
  `AFTER UPDATE OF deductible_percentage, net_amount, vat_amount`.
- A trigger automatikusan újraszámolja és kicseréli a kapcsolódó `GEPI_JAVASLAT` státuszú naplósorokat, így a felhasználói átállítás azonnal és beavatkozás nélkül érvényesül.

### D-4: Zárt / Véglegesített Könyvelési Tételek Védelme és UI Lakat Jelzés (`InvoiceItemsDialog.tsx`)
- A számviteli törvény szerinti auditvédelem miatt a már véglegesen lekönyvelt (`status = 'KONYVELT'`) tételek naplóbejegyzéseit az automatikus trigger nem írhatja felül csendben.
- Ezért a frontend felületen:
  1. `postedItemIds` query azonosítja a lezárt tételeket.
  2. A levonhatósági badge mellett borostyán színű `Lock` ikon és tooltip jelenik meg:
     *"Ez a tétel már le van könyvelve a naplóban (lezárt tétel). Az áfa módosítás a számlán érvényesül, de a zárt könyvelést nem írja felül automatikusan."*
  3. Módosításkor figyelmeztető toast értesíti a felhasználót a számviteli helyesbítés szükségességéről.

---

## 3. Következmények és Migráció

- Migráció: `20260909100000_sync_vat_deductibility_to_journals_and_gl.sql` élesítve és a `schema_migrations`-ben rögzítve.
- Kliensoldali fallback: `draftFallbackGenerator.ts` szinkronizálva és tesztelve.
- Verifikáció: TS Consult Kft. OMV számláján (`A/A30500070/2618/00005`) élesben ellenőrizve és igazolva.
