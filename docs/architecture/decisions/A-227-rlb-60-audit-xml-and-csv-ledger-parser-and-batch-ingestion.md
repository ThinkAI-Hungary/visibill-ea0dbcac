# A-227: RLB-60 Könyvvizsgálói XML és CSV Főkönyvi Kivonat Parser Motor és Kliensoldali Kötegelt Ingestion Architektúra

**Status:** Decided  
**Date:** 2026-10-08  
**Utoljára frissítve:** 2026-10-08  

## Context
A könyvelőirodák és partnerek körében az RLB-60 könyvelőprogram az egyik legelterjedtebb asztali kettős könyvviteli szoftver. A Visibill / eaisyBooks platformra történő onboarding és korábbi évek adatainak migrációja során (kiemelten a WR HOME Kft. és hasonló ügyfelek esetében) elengedhetetlen a korábbi könyvelési előzmények, számlatükör és naplósorok importálása.

Az RLB adatszerkezete két sajátos formátumot használ:
1. **RLB 26.6+ Könyvvizsgálói Feladás XML:** Tranzakciószintű teljes export (`<Adatok>` gyökérelemmel, `<Cegadatok>`, `<Szamlaszamok>`, `<Partnerek>`, `<FkBizonylatok>` és `<FkTetelek>` csomópontokkal).
2. **RLB Főkönyvi Kivonat CSV:** Számlatükör és egyenlegkivonat (`FOKSZAM;FOKNEV;NYTART;NYKOV;TART;KOV;IDTARTE;IDKOVE;TARTE;KOVE...`), Windows-1250 (CP1250) kódolású szöveges állomány.

**Kritikus architektúrális kihívások:**
- **RLB belső számlakódok vs. Főkönyvi számok:** Az RLB a `<Szamlaszamok>`-ban rögzíti a `<Kod>` (belső index, pl. 23, 383) és a `<TKod>` (törvényes főkönyvi szám, pl. 131, 491) mezőket. A könyvelési tételek (`<FkTetelek>`) a `<Tartozik>` és `<Kovetel>` elemekben a belső `<Kod>` értékre hivatkoznak! Ha a parser nem végez kódfeloldást, a naplósorok értelmetlen indexekre könyvelődnének.
- **Partnertörzs összerendelés:** A naplótételek a partnert belső partnerkóddal azonosítják, amit össze kell kapcsolni a `<Partnerek>` törzsben szereplő névvel és adószámmal.
- **Ütközésvédelem a főkönyvi számláknál:** A korábbi importkísérletek során a `gl_accounts_preset_id_gl_number_key` egyediségi megkötés sértése hibát dobott duplikált számlaszámok esetén.
- **Latencia és felhasználói visszajelzés:** A nagyméretű XML-ek feltöltése és háttér-workerre bízása nélkül a felhasználó nem kapott azonnali visszajelzést a bizonylatok, tételek számáról és a mérlegegyezőségről.

## Decision

1. **Hibrid Kliensoldali Feldolgozási és Ingestion Modell:**
   * **Zéró-latenciájú parser a böngészőben (`src/lib/rlb/rlbParser.ts`):** A fájl kiválasztásakor a TypeScript DOMParser azonnal feldolgozza az XML/CSV állományt, kiszámítja a statisztikákat, feloldja a belső kódokat és ellenőrzi a kettős könyvviteli egyezőséget (T = K).
   * **Kötegelt kliensoldali perzisztencia (`src/lib/rlb/rlbImportService.ts`):** A frontend streaming módon, tranzakciós csomagokban menti az adatokat a Supabase táblákba (főkönyvi számlák 500-as, naplósorok 250-es kötegekben), miközben a fájlt párhuzamosan archiválja a `gl_uploads` tárolóba.

2. **Dinamikus Cég-specifikus Számlatükör Sablon:**
   * Ha a felhasználó az eredeti struktúra megtartását választja, a rendszer automatikusan feloldja vagy létrehozza a `[Cég neve] - RLB Számlatükör` rekordot a `chart_of_accounts_presets` táblában (`type: 'custom'`, `is_active: true`), és inaktiválja a cég egyéb egyéni sablonjait.

3. **Kötelező Kódfeloldási Pipeline:**
   * `accountCodeMap[rawCode] = tkod || rawCode` térképet építünk fel.
   * Minden `<Tet>` feldolgozásakor `debitAccount = accountCodeMap[rawDebit]` és `creditAccount = accountCodeMap[rawCredit]`.
   * Garantáljuk a `491` (Nyitó mérleg) és `492` (Záró mérleg) technikai számlák jelenlétét.

4. **Adatbázis Ütközésvédelem (`gl_accounts`):**
   * Az `accountRows` tömböt a főkönyvi szám (`gl_number`) alapján memóriában deduplikáljuk.
   * A mentést `.upsert(chunk, { onConflict: 'preset_id,gl_number' })` hívással végezzük, megszüntetve a duplicate key hibákat.

5. **CP1250 Kódolás Felismerés (`readRlbFileAsText`):**
   * A `FileReader` / `TextDecoder` automatikusan detektálja a Windows-1250 kódolást a magyar speciális ékezetek (ő, ű) csonkításmentes konvertálásához.

## Consequences

**Pozitív:**
- Azonnali (pár száz milliszekundumos) validáció és statisztikai visszajelzés a feltöltési modálban (WR HOME Kft.: 681 számla, 42 partner, 518 bizonylat, 718 tétel azonnal látható).
- Teljes kettős könyvviteli biztonság: a Tartozik = Követel egyezőség igazolása már a tényleges adatbázis-mentés előtt megtörténik.
- Nincs szükség szerveroldali worker várakozási ciklusra vagy pollingra az importálás befejezéséhez.
- Idempotens és ütközésmentes számlatükör-feltöltés.

**Negatív / Kockázatok:**
- Rendkívül nagy (több tízezer tételes) XML-ek esetén a böngésző memóriaterhelése megnőhet; ezt a 250-es kötegelt streaming mentés és a chunkolt feldolgozás minimalizálja.

## Kapcsolódó
- [P-166: RLB Könyvvizsgálói XML és CSV Import Modal és Előnézet UX](../../product/decisions/P-166-rlb-audit-xml-and-csv-import-modal-and-realtime-preview-ux.md)
- [A-057: Könyvelési Napló Architektúra és Zárt Tételek](./A-057-accounting-journals-architecture.md)
- [A-090: Biztonságos Számlatükör Sablon Törlés és Átkötés](./A-090-safe-chart-of-accounts-preset-deletion-and-remapping.md)
- [A-102: eaisyBooks Kettős Működési Mód](./A-102-eaisybooks-dual-mode-modular-architecture.md)
