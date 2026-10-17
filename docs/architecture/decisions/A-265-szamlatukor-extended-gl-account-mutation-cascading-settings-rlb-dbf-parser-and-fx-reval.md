# A-265: Számlatükör Extended — Főkönyvi Számlamódosítás, Csoportszámla Kaszkádolt Beállítás-öröklődés, Kliensoldali RLB FOKTORZS dBASE III Bináris Parser és Hóközi Devizás Átértékelés Varázsló

**Status:** Decided  
**Date:** 2026-10-17  
**Utoljára frissítve:** 2026-10-17  

## Context

A Visibill számlatükör (Chart of Accounts) modulja az eaisyBooks kettős könyvvitelének és a főkönyvi adatszolgáltatásoknak a legkritikusabb törzsadati alapja. Az éles könyvelőirodai tesztek során a könyvelők és a szakmai auditok az alábbi strukturális hiányosságokat tárták fel:

1. **Számlamódosítási Lehetőség Hiánya:** A felhasználók csak új számlát tudtak rögzíteni; a már létező főkönyvi számlák nevének (`short_name`), leírásának (`description`), devizabeállításainak vagy kényszereinek módosítására nem létezett szerkesztő felület.
2. **Beállítások Széttöredezettsége és Adatinkonzisztencia:** Ha egy csoportszámlán (pl. `311 Belföldi követelések` vagy `454 Szállítók`) a könyvelő előírta a kötelező partner- vagy projektkiválasztást, azt analitikus alszámlánként (pl. `3111`, `3112`, `3113`...) egyenként, manuálisan kellett volna beállítani. Hiányzott egy olyan kaszkádolt mechanizmus, amely a szintetikus csoportszámla beállításait automatikusan érvényesíti az összes alatta lévő analitikára.
3. **RLB-60 FOKTORZS Adatbázis Ingestion:** Az RLB-60 könyvviteli programból érkező új ügyfelek átvételekor a számlatükör `FOKTORZS.RFT` bináris állományként áll rendelkezésre. Ez nem Rich Text Format, hanem dBASE III / Visual FoxPro bináris tábla DOS CP852 kódolással. A konverziós segédeszközök hiánya miatt a könyvelők manuális Excel gépelésre vagy hibás karakterkódolású átalakításokra kényszerültek.
4. **Hóközi és Év Végi Devizás Átértékelés Hiánya (Sztv. 60. §):** A számviteli törvény előírja a külföldi pénzértékre szóló eszközök és kötelezettségek (devizapénztár 382, devizaszámla 386, devizás vevők 316, devizás szállítók 4542) fordulónapi és hóközi MNB árfolyamon történő átértékelését. Korábban a rendszerben nem létezett olyan eljárás, amely automatikusan összegyűjtötte volna a devizás tételeket, összevetette volna az aktuális MNB árfolyammal, és automatikusan lekönyvelte volna a nem realizált árfolyamnyereséget (`976`) vagy árfolyamveszteséget (`876`).

## Decision

1. **`gl_accounts` Séma Kiterjesztése és Indextámogatás:**
   - Hozzáadtuk a validációs és viselkedési mezőket a `public.gl_accounts` táblához:
     - `requires_partner BOOLEAN NOT NULL DEFAULT false` (Partner megadása kötelező a kontírozáskor)
     - `requires_project BOOLEAN NOT NULL DEFAULT false` (Projekt megadása kötelező)
     - `requires_cost_center BOOLEAN NOT NULL DEFAULT false` (Költséghely kötelező)
     - `is_reconcilable BOOLEAN NOT NULL DEFAULT false` (Folyószámla analitikában nyitott tételként kezelendő)
     - `is_monthly_fx_reval BOOLEAN NOT NULL DEFAULT false` (Hóközi devizás átértékelésbe bevonandó számla)
   - Automatikus törvényi backfill a standard magyar számlatükör szerint (31*, 35*, 44*, 45*, 47* -> `requires_partner = true`; 382*, 386*, 316*, 4542*, 455* -> `is_monthly_fx_reval = true`).
   - Parciális B-tree indexek: `idx_gl_accounts_requires_partner`, `idx_gl_accounts_requires_project`, `idx_gl_accounts_is_reconcilable`, `idx_gl_accounts_is_monthly_fx_reval`.

2. **Kaszkádolt Beállítás-öröklődés RPC (`acc_cascade_gl_account_settings`):**
   - Bevezettük az `acc_cascade_gl_account_settings` tárolt eljárást. Amikor a könyvelő egy szülő számla (pl. 311) tulajdonságait módosítja, a függvény megkeresi a számlaszám-prefix (`gl_number LIKE v_parent_gl_number || '%'`) vagy `parent_id` alapján az összes közvetlen és közvetett alszámlát a cég adott számlatükrében, és atomi módon frissíti a megadott attribútumokat.

3. **Főkönyvi Számla Szerkesztő Modál (`EditGlAccountModal`):**
   - A `GeneralLedgerTable` és `GlAccountCardView` felületeken minden számlasor mellett elérhetővé tettük a ✏️ Szerkesztés gombot.
   - A dialógusban módosítható a megnevezés (`short_name`), leírás (`description`), devizabeállítás (`currency`, `is_multicurrency`), valamint a fenti validációs kényszerek.
   - Ha a szerkesztett számla csoportszámla (gyermekszámlákkal rendelkezik), a felület megerősítő kérdést tesz fel: *"Szeretné a beállításokat az összes alatta lévő alszámlára is érvényesíteni?"*, és jóváhagyás esetén meghívja a kaszkádolt RPC-t.

4. **Kliensoldali RLB FOKTORZS Bináris Parser (`src/lib/rlb/rlbRftParser.ts`):**
   - A böngésző memóriájában, zéró szerverterheléssel értelmezi a dBASE III / Visual FoxPro `.RFT` és `.DBF` fejlécet és rekordstruktúrát:
     - Fejléc validáció (bájtok száma, rekordhossz, mezőleírók).
     - Determinisztikus DOS CP852 és Windows-1250 magyar ékezetes dekódolás (különös tekintettel a speciális `0xFB` [ű], `0xF5` [ő], `0xDB` [Ű], `0xD5` [Ő] bájtokra).
     - Logikailag törölt rekordok (`0x2A` / `*`) kiszűrése.
     - Teljes számlahierarchia generálása (1, 2, 3 és 4 számjegyű szintek).
     - Hiányzó technikai számlák (`491 Nyitó mérleg számla`, `492 Záró mérleg számla`) automatikus pótlása.
   - Integrálva az `UploadChartOfAccountsModal` és a könyvvizsgálói import felületekbe.

5. **Hóközi és Év Végi Devizás Átértékelés Motor (`MonthlyFxRevaluationModal`):**
   - `calculate_monthly_fx_revaluation`: lekérdezi az összes aktív devizás számla nyitott tételeit és devizaszámla/devizapénztár egyenlegét a megadott fordulónapon (`p_cutoff_date`). Lekéri az MNB hivatalos árfolyamát a `daily_exchange_rates` táblából, és kiszámítja a könyv szerinti forintérték és a fordulónapi értékelés különbözetét tételenként.
   - `post_monthly_fx_revaluation`: a felhasználó által jóváhagyott tételekre automatikusan kiállít és lekönyvel egy vegyes könyvelési bizonylatot a cég `ARF` (vagy `VE`) naplójába:
     - Nettó nyereség esetén: `K 976 Pénzügyi műveletek egyéb bevételei`
     - Nettó veszteség esetén: `T 876 Pénzügyi műveletek egyéb ráfordításai`
     - Ellenszámlaként a releváns 316, 4542, 382, 386 devizás főkönyvi számlák megjelölésével.

## Consequences

**Pozitív:**
- **Teljeskörű Számlatükör Karbantartás:** A könyvelő azonnal átnevezhet, pontosíthat számlákat, és kikényszerítheti a kötelező partner- vagy projektmegadást.
- **Gyors és Hibátlan RLB Onboarding:** A könyvelők meglévő RLB állományai másodpercek alatt átvehetők hibátlan magyar ékezetekkel és 491/492 technikai számlákkal.
- **Törvényi Átértékelési Megfelelőség (Sztv. 60. §):** Az évközi zárások és a mérlegfordulónapi deviza-átértékelés automatizált varázslóval, manuális exceles számolgatás nélkül percek alatt elvégezhető.

**Negatív / Kockázatok:**
- A csoportszámla beállításainak kaszkádolása felülírhatja azokat az egyedi alszámlákat, ahol szándékosan más partner-követelmény volt beállítva. Ezt a felületen explicite megerősítő modál védi.

## Kapcsolódó
- [A-140: Multi-Jurisdiction és Horvát Rendszerszintű Számlatükör](./A-140-multi-jurisdiction-and-croatian-chart-of-accounts.md)
- [A-143: Devizás Főkönyvi Számlakezelés és Többdevizás Karton](./A-143-multicurrency-chart-of-accounts-and-general-ledger.md)
- [P-198: Főkönyvi Számla Szerkesztés és Hóközi Devizás Átértékelés UX](../product/decisions/P-198-szamlatukor-extended-gl-account-editing-and-monthly-fx-reval-ux.md)
- [BDR 076: RLB-60 FOKTORZS (.RFT / .DBF) Számlatükör Formátum](../../business/decisions/076-rlb-foktorzs-rft-dbf-chart-of-accounts-parsing-and-import.md)
- [BDR 078: Főkönyvi Számlamódosítás és Devizás Értékelés Szabályzata](../../business/decisions/078-gl-account-mutation-cascading-constraints-and-monthly-fx-revaluation-policy.md)
