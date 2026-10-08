# A-229: Egységes Számlatükör Cégenként, Cégek Közötti Klónozás és Folyószámla Szabályrendszer (EB-0255)

**Status:** Decided  
**Date:** 2026-10-08  
**Utoljára frissítve:** 2026-10-08  
**Ügyféligény:** EB-0255 (Lendvai Ádám · Ván Iroda / Kolos Transport Kft., spec: `tests/docs/lendvai_feature/255.pdf`)  
**Kapcsolódó PRD:** [P-168: Egységes Számlatükör, Cégek Közötti Másolás és Folyószámla Kényszer](../../product/decisions/P-168-eb0255-chart-of-accounts-subledger.md)

## Context
A magyar számviteli gyakorlatban és a könyvelőirodák mindennapjaiban a főkönyvi számlatükör az elszámolások gerince. Az EB-0255 ügyféligény szerint az alábbi kritikus hiányosságok okoztak nehézséget és hibalehetőségeket:
1. **Számlatükör-kezelés és klónozás hiánya:** Egy új cég könyvelésének indulásakor nincs lehetőség egy másik már beállított, bevált cég számlatükrének és hierarchiájának 1 kattintásos átvételére. A könyvelők kénytelenek voltak sablonokból újraépíteni vagy manuálisan importálni a kontókat.
2. **Csoportszámlák és könyvelési számlák keveredése:** Nem volt vizuális és logikai védelem: a könyvelő tévedésből olyan gyűjtő/csoportszámlákra is tudott tételt könyvelni (pl. 31, 45), amelyek kizárólag összesítésre szolgálnak.
3. **Partnerkényszer hiánya:** A folyószámla számláknál (pl. 311 Belföldi vevők, 454 Belföldi szállítók) partnermegadás nélkül is le lehetett könyvelni tételsorokat, ami az analitika és a főkönyv azonnali szétcsúszását eredményezte.
4. **"Egyéb" analitikus folyószámla-típus hiánya:** Olyan számláknál, mint a tagi kölcsönök (451), bankhitelek (44) vagy letétek, belső személyenkénti / tételenkénti analitikára és nyitott tételes párosításra van szükség partnerkényszer nélkül.
5. **Zaj a Folyószámla modulban:** A folyószámla párosító felületen megjelentek a csoportszámlák és nem párosítható tételek is.

## Decision

1. **Adatbázis Séma és Tranzakciós RPC (`acc_copy_chart_of_accounts`):**
   * A `gl_accounts` táblán a korábbi migrációkból meglévő és megerősített oszlopok:
     - `account_type VARCHAR(20) DEFAULT 'detail'` (`'group' | 'detail'`)
     - `subledger_type VARCHAR(20) DEFAULT 'none'` (`'none' | 'partner' | 'detail'`)
     - `is_open_item_managed BOOLEAN DEFAULT false`
   * Új `SECURITY DEFINER` tárolt eljárás: `public.acc_copy_chart_of_accounts(p_source_company_id uuid, p_target_company_id uuid)`:
     - Tranzakcióban (`BEGIN ... COMMIT`) lefutó művelet.
     - Létrehoz egy új egyedi preset rekordot a `chart_of_accounts_presets` táblában a célvállalat számára: `[Forrás cég neve] - Másolt számlatükör`.
     - Inaktiválja a célvállalat korábbi preseteit (`is_active = false`), és az újat aktívvá teszi (`is_active = true`), garantálva az **egyetlen aktív számlatükör cégenként** elvet.
     - Egy átmeneti tábla (`temp_gl_account_map`) segítségével leklónozza mind az 1,645 számlaszámot, újraillesztve az önhivatkozó `parent_id` idegen kulcsokat (a hierarchikus fa sértetlenségéért).
     - Átmásolja a mérleg (`bs_mapping`) és eredménykimutatás (`pnl_mapping`) hozzárendeléseket, valamint az összes audit és paraméter oszlopot (`account_type`, `subledger_type`, `is_open_item_managed`, `is_multicurrency`, `currency`).

2. **Megosztott Űrlap Architektúra (`GlAccountFormFields.tsx`):**
   * Létrehoztunk egy újrahasznosítható `GlAccountFormFields` komponenst, amely mind a létrehozási (`AddGlAccountModal.tsx`), mind a módosítási (`EditGlAccountModal.tsx`) folyamatban egységes validációt biztosít:
     - Radio group: *Könyvelési számla (analitikus)* vs. *Csoportszámla (gyűjtő)*.
     - Dropdown: *Folyószámla és analitika típus* (`none`, `partner`, `detail`).
     - Reaktivitás: a `partner` vagy `detail` kiválasztása automatikusan bekapcsolja az `is_open_item_managed` jelölőt.
     - Automatikus szülő-detektálás (`detectedParent`) és alárendelt alszámlák detektálása (`hasChildren`), megvédve a meglévő szülőket attól, hogy véletlenül analitikussá váljanak.

3. **Főkönyvi Kivonat UI Hardening (`GeneralLedgerTable.tsx`, `GlToolbar.tsx`):**
   * A táblázat a fa- és az összesítő nézetben is betölti a preset számlaszám metaadatait (`fetchAllGlAccountsByPreset`), és vizuális jelvényeket renderel:
     - `Csoport` (szürke gyűjtő jelvény)
     - `Partner` (kék partnerkényszeres jelvény)
     - `Egyéb analitika` (lila jelvény)
     - `Párosítható` (zöld nyitott tétel jelvény)
   * A sorok végére és a tételes drilldown fülre (`Sheet`) kihelyeztük az `EditGlAccountModal` megnyitására szolgáló akciógombokat.
   * Az eszköztáron megjelent a `CopyChartOfAccountsModal` indító gombja.

4. **Kényszerek Érvényesítése a Bizonylatrögzítésben (`AddManualJournalEntryModal.tsx`):**
   * **Csoportszámlára könyvelés blokkolása:** Mind a GL kereső Popover felületén (`Csoport` jelvény, nem választható státusz), mind űrlap beküldésekor (`handleSubmit`) blokkolja a mentést, ha a kiválasztott kontó `account_type === 'group'` vagy alatta gyermek-számlák találhatók.
   * **Partnerkényszer:** Ha bármely tételsor `subledger_type === 'partner'` típusú számlára hivatkozik, kötelező partnert rendelni a bizonylathoz, ellenkező esetben a rendszer figyelmeztető ablakkal leállítja a beküldést.

5. **Folyószámla Modul Szűrése (`useSubledger.ts`, `SubledgerPage.tsx`):**
   * A `useSubledgerAccounts` hook mostantól az aktív `preset_id` alapján szűri a számlákat, és szigorúan kiszűri a gyűjtőket (`account_type !== 'group'`).
   * A dropdown opciókban vizuálisan megjelenik a számla jellege (`[Partner]` vagy `[Egyéb]`).

## Consequences

**Pozitív:**
- **Zéró analitikai elcsúszás:** A vevő/szállító tételek nem maradhatnak partner nélkül, kizárva a folyószámla és a főkönyv közötti eltéréseket.
- **Hierarchikus integritás:** A csoportszámlákra történő könyvelés blokkolása megelőzi a szintetikus összesítők torzulását.
- **Rugalmas analitika:** Az „Egyéb” folyószámla típus lehetővé teszi a tagi kölcsönök (451) és hitelek személyenkénti precíz kezelését és nyitott tételes párosítását.
- **1-Kattintásos Cég Klónozás:** Egyetlen gombnyomással átvehető a komplett 1,600+ számlaszámból álló tükör a hierarchia újrakötésével együtt.
