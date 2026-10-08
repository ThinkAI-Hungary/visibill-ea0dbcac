# P-166: RLB Könyvvizsgálói XML és CSV Import Modal és Valós Idejű Előnézet UX

**Status:** Decided  
**Category:** UI / Workflow  
**Question:** Hogyan tehetjük a könyvelők számára a korábbi RLB-60 könyvelési adatok és számlatükrök importálását transzparenssé, biztonságossá és azonnal ellenőrizhetővé a feltöltés pillanatában?  
**Decision:** Kiterjesztettük a Főkönyvi Audit XML Feltöltése (`UploadAuditXmlModal`) dialógust, amely automatikusan felismeri az RLB 26.6+ XML és RLB CSV formátumokat, és már a mentés előtt gazdag statisztikai kártyát, mérlegegyezőségi zöld sávot, dinamikus sabloncímkét és valós idejű progress bart jelenít meg.  

## Current Implementation

1. **Univerzális Fájlfogadás:**
   * A dropzone és a tallózó `.xml` és `.csv` kiterjesztést is fogad.
   * Azonnali formátum-detektálás: megkülönbözteti az RLB XML feladást, az RLB CSV kivonatot és az egyéb audit állományokat.

2. **Azonnali Előnézeti Kártya (Live Preview):**
   * **RLB 26.6 Badge:** Cég neve, adószáma és könyvelési időszaka.
   * **4 Főkönyvi Mérőszám Kártya:** Főkönyvi számlák, partnerek, bizonylatok és naplósorok pontos száma.
   * **Mérlegegyezőségi Zöld Sáv:** A Tartozik és Követel forgalom valós idejű összehasonlítása. Ha az eltérés 0 Ft, zöld pipa jelzi: `Kettős könyvviteli egyezőség: [Összeg] Ft (T = K egyezik)`. Ha eltérés van, figyelmeztető sáv jelenik meg a delta megjelölésével.

3. **Intelligens Számlatükör Sablonkezelés:**
   * A sablonválasztó felirat automatikusan a fájlban azonosított cég nevét veszi fel: `Új dedikált RLB sablon létrehozása ([Cég neve] - RLB Számlatükör)`.
   * Lehetőség van létező sablonhoz rendelésre is.

4. **Kettős Akció és Valós Idejű Folyamatjelző:**
   * Ha a `Dry run (Csak előnézet)` aktív, a gomb felirata **„RLB Próbafuttatás”**, és nem rögzít naplótételeket az éles adatbázisba.
   * Ha a jelölőnégyzet nincs bejelölve, a gomb **„Azonnali RLB Importálás”**-ra vált.
   * Az importálás közben valós idejű százalékos progress bar mutatja a fázisokat (`preset` → `accounts` → `import_record` → `partners` → `entries`).

## Rationale
A könyvelők számára a korábbi könyvelési adatok migrációja kritikus művelet. A vakterhelés és hosszas várakozás helyett az azonnali előnézet és mérlegegyezőségi igazolás maximális bizalmat nyújt a feladás helyességéről még azelőtt, hogy a tranzakciók a főkönyvbe kerülnének.

## Kapcsolódó
- [A-227: RLB-60 Parser és Batch Ingestion Architektúra](../../architecture/decisions/A-227-rlb-60-audit-xml-and-csv-ledger-parser-and-batch-ingestion.md)
- [P-013: Feltöltés UX (multi-file batch upload)](./P-013-upload-ux.md)
- [P-102: Főkönyvi Kivonatok Rugalmas Fájlimportja](./P-102-general-ledger-and-opening-balance-import-ux.md)
