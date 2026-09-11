# A-110: Bérszámfejtési Főkönyvi Számlatükör Pagináció, Cégprofilos Kontírozás Perzisztencia és Kattintási Outline Védelem

**Status:** Decided  
**Date:** 2026-09-11  
**Utoljára frissítve:** 2026-09-11  

## Context
Az eaisyBooks bérszámfejtési feladási folyamatában (Step 8 — Főkönyvi számok ellenőrzése és cikluszárás) a könyvelő felhasználó (Surányi Pál, TS Consult Kft.) jelezte, hogy a bruttó bér és járulék jellegű költségtételeknél az 5-ös számlaosztály csak 52-ig (`52997`) látszódik a lenyíló listákban. Ennek következtében a bérköltség (`541`) és a szociális hozzájárulási adó (`561`) számlaszámok egyáltalán nem voltak kiválaszthatók, blokkolva a bérszámfejtési zárást és könyvelési feladást.

A kivizsgálás során az alábbi három architekturális hiányosságot tártuk fel:
1. **PostgREST 1 000 rekordos lekérdezési limitje:** A Supabase / PostgREST kliens `.select('*')` lekérdezése lapozás nélkül alapértelmezetten maximum 1 000 rekordot ad vissza. A TS Consult Kft. egyedi számlatükre (`Jó számlatükör`) 1 135 tételt tartalmaz, így a számlák az 1 000. tételnél elvágásra kerültek.
2. **Hiányzó Cégprofilos Kontírozási Perzisztencia:** A Step 8-ban felülbírált főkönyvi számlák nem mentődtek le a cég beállításai közé, így minden havi zárásnál újra fel kellett volna kutatni és beállítani a kontírozási számlákat.
3. **Chromium / Windows Egérkattintási Fekete Keret (`:active` outline):** A Tailwind CSS `.outline-none` osztálya a valóságban `outline: 2px solid transparent; outline-offset: 2px;` szabályt generál. Windows és Chromium böngészőkben az egérkattintás lenyomásának pillanatában (`:active` állapot) a böngésző a transzparens színt felülbírálta a rendszer sötét fókuszkeret-színével, ami zavaró fekete keretként villant fel a gombon.

## Decision
1. **Számlatükör Paginált Lekérdezése (`fetchAllGlAccountsByPreset`):**
   - A `src/lib/payroll/payrollAutoPoster.ts` modulban a bérfeladási főkönyvi feloldás mostantól a `@/lib/glData`-ból származó `fetchAllGlAccountsByPreset` segédfüggvényt alkalmazza.
   - Ez 1 000 tételes blokkokban, automatikusan lapozva kéri le a teljes számlatükröt a cég aktív presetjéből, garantálva, hogy a több ezer számlát tartalmazó egyedi számlatükrök minden számlaosztálya (54x, 56x, 47x) hiánytalanul rendelkezésre áll.

2. **Perzisztens Cégkontírozási Térkép (`saveCompanyPayrollGlMapping`):**
   - Létrehoztunk és exportáltunk egy dedikált perzisztencia függvényt (`saveCompanyPayrollGlMapping`), amely a kiválasztott főkönyvi számlapárokat atomi módon a cég adóprofiljába menti:
     `accounty_tax_profiles.payroll_settings.gl_mapping` (JSONB struktúra: `{ gl541, gl561, gl551, gl463, gl462, gl473, gl479, gl471 }`).
   - A `resolveCompanyGlAccounts` elsődleges prioritásként ezt a cég-specifikus térképet olvassa be, biztosítva a könyvelő egyedi döntéseinek megőrzését a jövőbeli ciklusokban is.

3. **Komponens- és Globális Szintű Outline Reset:**
   - **Komponens szinten (`PayrollGlAccountSelector.tsx`):**
     A lenyíló gomb közvetlen inline stílust kapott: `style={{ outline: 'none', outlineOffset: 0, boxShadow: 'none' }}`, valamint `[outline:none!important] active:[outline:none!important] focus-visible:[outline:none!important]` és `ring-0 ring-offset-0` osztályokat, kizárva a felvillanást.
   - **Globális szinten (`src/index.css`):**
     Kiterjesztettük a globális fókusz-resetet az egérkattintási állapotra is:
     ```css
     *:focus:not(:focus-visible),
     *:active:not(:focus-visible) {
       outline: none !important;
       box-shadow: none !important;
     }
     ```

## Consequences
**Pozitív:**
- A könyvelők tetszőleges méretű (1 000+ számlás) számlatükrök esetén is hiánytalanul hozzáférnek a költség- és kötelezettségi számlákhoz.
- A kiválasztott számlabeállítások azonnal és tartósan mentődnek a cég profiljába.
- Megszűnt az egérkattintás alatti fekete outline villódzás, a felület megfelel a Linear-alapú fintech design tokeneknek.

**Negatív / Figyelembe veendő:**
- Nagyméretű (több ezer számlás) számlatükröknél a lapozott lekérés több PostgREST round-tripet igényel az első betöltéskor (a kliensoldali gyorsítótárazás és a `isLoadingGl` spinner védi a felhasználói élményt).

## Kapcsolódó
- [P-082: Bérszámfejtési Főkönyvi Feladás Kontírozás UX](../../product/decisions/P-082-payroll-gl-mapping-combobox-and-step8-ux.md)
- [P-033: Bérszámfejtési Ciklus Workflow](../../product/decisions/P-033-payroll-cycle.md)
- [A-094: Bérszámfejtési Ciklus Végtelen Re-render Védelem és Jelenlét Perzisztencia](./A-094-payroll-cycle-render-stability-and-attendance-persistence.md)
- [A-087: Főkönyvi Adatbázis-alapú Keresés és Számla Lapozás](./A-087-gl-database-search-and-account-pagination.md)
