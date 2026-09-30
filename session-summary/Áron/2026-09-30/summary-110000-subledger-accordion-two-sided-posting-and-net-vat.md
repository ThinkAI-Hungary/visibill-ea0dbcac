# Session Summary — 2026-09-30 11:00

```text
feat(subledger, db, ui): Folyószámla hierarchikus számlanézet (accordion kontírok), kétoldalas kontírozó & jóváhagyó modal, lekönyvelt tételek visszanyitása/módosítása, Nettó-ÁFA oszlopok és dupla valuta javítás

- Folyószámla és Analitika Hierarchikus Számlaszintű Csoportosítás (Accordion Nézet)
  - Korábban a folyószámla lapos tétellistaként működött; az új implementáció a számlasorszám (document_id / header_id) köré szervezi a fő sorokat
  - Lenyitható sorok (ChevronDown / ChevronRight váltógombbal és a bizonylatszámra kattintással): kibontja a számlához tartozó összes kapcsolódó könyvelési sort (all_lines)
  - Beágyazott részletező kontírozási táblázat: tételsorszám, Tartozik / Követel oldal (kék és zöld badge-ek), főkönyvi számlaszám és megnevezés, ÁFA szerepkör (ALAP, AFA + áfakód), összeg és sor leírás
  - Egykattintásos "Összes lenyitása / becsukása" gomb a táblázat fejlécében

- Kétoldalas Kontírozó és Könyvelő Modális Ablak (SubledgerPostingModal)
  - Új dedikált komponens: src/components/subledger/SubledgerPostingModal.tsx
  - Sorvégi "Könyvelés" gomb (gépi javaslatoknál) és lebegő mérlegsávos csoportos könyvelés esetén azonnal megnyitja a kétoldalas kontírozó felületet
  - Mindkét oldal (Tartozik és Követel) teljes körű megjelenítése és élő szerkesztése: főkönyvi számla kiválasztása kereshető Command comboboxból (fetchAllGlAccountsByPreset alapján), összeg, T/K oldal, sorleírás módosítása, valamint új sorok hozzáadása (+ Új sor) és törlése
  - Valós idejű mérlegegyensúly ellenőrzés: folyamatosan kalkulálja és vizuálisan visszajelzi a ∑T, ∑K és különbözet (Δ) értékeket; a végleges könyvelés gomb csak egyensúlyban lévő tétel esetén aktív (∑T = ∑K)
  - Több számla kijelölése esetén lépkedő navigáció (Előző / Következő számla) a csoportos áttekintéshez és jóváhagyáshoz
  - Közvetlen átkötés az AddManualJournalEntryModal-hoz ("Teljes kézi szerkesztő megnyitása")

- Lekönyvelt Tételek Visszanyitása és Módosítása Folyószámláról (acc_unpost_journal_entry)
  - "Módosítás" akciógomb bevezetése minden tételnél a folyószámla táblázatban
  - Gépi javaslat / piszkozat esetén a szerkesztő modal azonnal megnyílik
  - Véglegesen lekönyvelt (KONYVELT) bizonylatoknál megerősítő AlertDialog jelenik meg: a felhasználó jóváhagyásával a rendszer nyitott pénzügyi időszakban visszanyitja a tételt szerkeszthető KEZI_PISZKOZAT státuszba az acc_unpost_journal_entry RPC hívással (a bizonylatszám és naplósorszám folytonosságának megőrzése mellett)
  - A visszanyitást követően azonnal megnyílik a SubledgerPostingModal szerkesztő nézetben, lehetővé téve a kontírok korrekcióját és újrakönyvelését
  - Új mutation hook: useUnpostSubledgerEntry a src/hooks/useSubledger.ts-ben

- Nettó, ÁFA és Bruttó Pénzügyi Bontás Megjelenítése
  - Fő táblázat fejléc és oszlopok: külön Nettó, ÁFA és Bruttó oszlopok megjelenítése a bizonylatoknál
  - KPI fejléc kártyák és lenyitható számlakártyák: nettó és áfa forgalmi összesítések kiírása
  - Adatbázis RPC optimalizáció: a get_subledger_items eljárás mostantól CTE aggregációval automatikusan számolja a net_amount és vat_amount értékeket és egyetlen hívással aggregálja a bizonylathoz tartozó összes könyvelési tételt (all_lines jsonb), teljesen felszámolva az N+1 hálózati lekérdezéseket

- Kettős Valutamegjelenítés (Ft Ft / EUR EUR) Végleges Felszámolása
  - A formatCurrency már eleve tartalmazza a pénznem szimbólumot, de a kódban több helyen utólagos konkatenáció történt
  - Eltávolítva a felesleges manuális Ft és {currency} utótagok az összes érintett folyószámla felületről:
    * src/pages/SubledgerPage.tsx (KPI kártyák, lebegő egyensúlyi sáv, táblázat sorok)
    * src/components/subledger/WriteOffSettlementModal.tsx
    * src/components/subledger/SubledgerItemMatchesModal.tsx
    * src/components/subledger/BulkRoundingWriteOffModal.tsx
    * src/components/subledger/SubledgerExportDialog.tsx

- Adatbázis & Backend Migrációk
  - Létrehozva és élesítve a supabase/migrations/20260930101600_subledger_net_vat_and_lines_agg.sql migráció
  - Korábbi időbélyeg-ütközések elhárítása és a 20260928120500_periodic_cash_reports_schema.sql idempotens házirend-tisztítása
  - Távoli Supabase adatbázis frissítése lefutva (npx supabase db push --include-all)

- Minőségbiztosítás (QA) & Tesztek
  - Type-safe frontend: src/types/subledger.ts kibővítve SubledgerLineDetail és net_amount / vat_amount mezőkkel
  - Production build ellenőrzés: npm run build hiba nélkül, sikeresen lefordult (exit code 0)
  - Unit tesztek: src/test/subledger.test.ts kiegészítve kétoldalas könyvelési egyensúly, Nettó/ÁFA kalkuláció és nem-egyensúlyi állapot tesztekkel; 9/9 teszt hibátlanul átment
  - Vite dev szerver aktívan fut (http://localhost:8080/subledger)
```
