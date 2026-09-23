# A-143: Devizás Főkönyvi Számlakezelés (gl_accounts), Bankszámla Deviza Védelem, Devizás Számlakarton és Többdevizás Partner Analitika

**Státusz:** Elfogadva (Decided)  
**Dátum:** 2026-09-24  
**Kapcsolódó Hibajegy:** EB-0182 (Kolos Transport Kft. / Ván Iroda Kft. - Lendvai Ádám)  
**Kapcsolódó ADR:** [A-057: Könyvelési Naplók Architektúrája](./A-057-accounting-journals-architecture.md), [A-095: Nemzetközi POS és Deviza Guard](./A-095-international-pos-clearing-currency-override-guard.md), [A-137: Főkönyv és Nyitó Import](./A-137-general-ledger-and-opening-import-normalization.md), [A-140: Multi-Jurisdiction és Horvát Számlatükör](./A-140-multi-jurisdiction-and-croatian-chart-of-accounts.md)  
**Kapcsolódó PRD:** [P-108: Devizás Főkönyvi Számlakezelés, Bankszámla Safeguard és Többdevizás Karton/Analitika UX](../../product/decisions/P-108-multicurrency-chart-of-accounts-and-gl-card-ux.md)  
**Kapcsolódó BRD:** [021: Főkönyvi Rendszer](../../business/decisions/021-general-ledger.md)  
**Érintett komponensek:** `public.gl_accounts`, `src/integrations/supabase/types.ts`, `AddGlAccountModal.tsx`, `BankAccountsTab.tsx`, `OpeningJournalWizardModal.tsx`, `GlAccountCardView.tsx`, `PartnerLedgerCardView.tsx`, `ledgerCardPdfs.ts`

---

## 1. Kontextus és Problémafelvetés

Az EB-0182 ügyfélszolgálati megkeresés során az alábbi strukturális hiányosságok kerültek felszínre a devizakezelés terén:
1. **Számlatükör Deviza Beállítás Hiánya:** A `gl_accounts` táblában nem volt lehetőség megadni, hogy egy adott főkönyvi szám egyedi devizanemhez (pl. 3861 -> EUR bank) van-e rendelve, vagy gyűjtő jelleggel több devizát is fogad (pl. 316 -> külföldi vevők analitika). Emiatt a rendszer csak heurisztikus számlaszám-prefixekből (pl. 386) próbált devizás működésre következtetni.
2. **Bankszámla és Főkönyvi Szám Inkonzisztencia Kockázat:** A beállítások menüben bankszámla rögzítésekor a felhasználó bármilyen főkönyvi számot kiválaszthatott anélkül, hogy a rendszer ellenőrizte volna, a megadott számlaszám devizaneme egyezik-e a bankszámla devizanemével.
3. **Deviza Nyitó Tételek és Számlakarton Egyenlegek Hiánya:** A számlakarton felületén (`GlAccountCardView`) csak forintban (`amount`) került kimutatásra a nyitó, a forgalom és a záró egyenleg. Bár az adatbázis és a naplósorok (`acc_journal_lines`, `gl_journal_entries`) tartalmazzák a `foreign_amount` és `currency` értékeket, a számlakarton összegző kártyái és sorai nem összesítették és nem jelenítették meg a devizás egyenleget.
4. **Partner Folyószámla Analitika Devizás Korlátai:** A partneri analitika (`PartnerLedgerCardView`) kizárólag a 311 és 454 kezdetű számlákat vizsgálta és HUF összegeket jelenített meg, miközben nemzetközi partnereknél a nyitott és forgalmi tételek devizában keletkeznek a 316, 317 és 4542 számlákon.

---

## 2. Architekturális Döntések

### 2.1 Adatbázis Séma Bővítés (`public.gl_accounts`)
- **Új oszlopok:**
  - `currency TEXT DEFAULT NULL`: Rögzíti a főkönyvi számhoz rendelt dedikált devizanemet (pl. `'EUR'`, `'USD'`, `'HUF'`). `NULL` érték esetén nincs szigorú devizakorlátozás.
  - `is_multicurrency BOOLEAN NOT NULL DEFAULT false`: Jelzi, hogy a számla devizás működésű (akár egyedi devizás, akár többdevizás gyűjtő számla).
- **Indexelés:**
  - `CREATE INDEX idx_gl_accounts_multicurrency ON public.gl_accounts (preset_id, is_multicurrency) WHERE is_multicurrency = true;`
- **Adatmigráció:**
  - A korábbi számlatükrök meglévő számlái intelligens heurisztikával frissültek (386, 382, 316, 4542 -> `is_multicurrency = true`; 384, 381 -> `currency = 'HUF'`).

### 2.2 Számlatükör Karbantartás és Automatikus Felismerés (`AddGlAccountModal`)
- Az új számla rögzítésekor bekerült a "Devizás számla (második érték)" kapcsoló.
- Bekapcsoláskor kiválasztható a dedikált devizanem (EUR, USD, CHF, GBP) vagy az "Analitikus / Többdevizás gyűjtő" opció.
- A számlaszám beírásakor az űrlap valós időben felismeri a devizás számlaszámokat (pl. `386...` esetén automatikusan bekapcsolja a devizát és felajánlja az EUR-t).

### 2.3 Safeguard: Bankszámla Deviza-Főkönyvi Egyezőség (`BankAccountsTab`)
- A bankszámla felvételekor/szerkesztésekor a rendszer validálja a kiválasztott főkönyvi számot:
  - Ha a főkönyvi szám dedikált devizaneme (`currency`) eltér a bankszámla devizájától (pl. USD bankhoz EUR vagy HUF számla van rendelve), figyelmeztetést ad.
  - Ha nemzetközi/devizás számlához (EUR/USD) HUF dedikált főkönyvi szám (pl. 3841) kerül kiválasztásra, vagy fordítva, a rendszer blokkolja/jelzi az ellentmondást.

### 2.4 Nyitó Varázsló Összekapcsolás (`OpeningJournalWizardModal`)
- A nyitó tételek rögzítésekor a deviza és árfolyam mezők automatikusan aktiválódnak, amennyiben a kiválasztott főkönyvi számlánál az `is_multicurrency === true` vagy a `currency` nem HUF.

### 2.5 Devizás Számlakarton Egyenlegek (`GlAccountCardView`)
- A számlakarton motor mind az RPC (`get_gl_account_card_items`), mind a kliens oldali fallback lekérdezés esetén soronként és összesítve is kalkulálja a devizás adatokat:
  - `foreignOpeningBalance`, `totalForeignDebit`, `totalForeignCredit`, `foreignClosingBalance`.
  - A tételek táblázatában a futó devizaegyenleg (`foreign_running_balance`) kiszámításra kerül.
  - Az összegző kártyákon a devizás egyenlegek jól látható másodlagos értékként (pl. `1 250,00 EUR`) jelennek meg a forint összegek alatt.

### 2.6 Többdevizás Partner Analitika (`PartnerLedgerCardView`)
- A partneranalitika kiterjesztésre került:
  - Szűrés: nemcsak a 311 és 454 számlákra, hanem a teljes `31x` (vevők, külföldi vevők) és `454x`/`455x` (szállítók, külföldi szállítók) tartományra.
  - Adatlekérés: a naplósorokból (`acc_journal_lines`) lekérjük a `foreign_amount` és `currency` értékeket.
  - Partnerek összesített nézetében devizánkénti bontás és vizuális jelölés (badge-ek) mutatja a devizás nyitott állományt.
### 2.7 Tört Időszaki Devizás Nyitó Göngyölítés az RPC-ben (`get_gl_account_card_items`)
- A PostgreSQL tárolt eljárás (`supabase/migrations/20260924000100_update_gl_account_card_rpc_multicurrency.sql`) kiegészítésre került:
  - Tört időszaki lekérdezéseknél (ha `p_date_from` évközi dátum) az eljárás a forint mellett a devizanyitót (`v_opening_foreign_debit`, `v_opening_foreign_credit`) is összegzi.
  - A számla devizanemének intelligens detektálása (`g.currency` vizsgálata a számlatükörből, vagy a megelőző devizás naplósorokból).
  - A generált `NYITÓ` sorban a devizás nettó nyitó egyenleg (`foreign_amount`) és a detektált devizanem (`currency`) pontosan visszatér.

### 2.8 Többdevizás PDF Export Generálás (`ledgerCardPdfs.ts`)
- **Főkönyvi Karton PDF (`generateGlAccountCardPdf`):**
  - Az összegző kártyák (Nyitó, T, K, Záró) a forint alatt zárójelben feltüntetik a devizaösszegeket (pl. `(+2 500,00 EUR)`).
  - A forgalmi táblázat celláiban a devizás tételeknél megjelenik a másodlagos devizaérték, és a futó devizaegyenleg.
- **Egyenlegközlő Levél PDF (`generateBalanceConfirmationPdf`):**
  - A tételek táblázatában az eredeti bruttó és a nyitott összegnél kiírásra kerül a devizaérték is.
  - A levél összesítő láblécében a forint végösszeg mellett a devizanemenkénti nyitott állomány (pl. `1 200,00 EUR`) is szerepel.

---

## 3. Verifikáció és Tesztek
- **TypeScript:** `npx tsc --noEmit` hibamentesen lefutott (0 hiba).
- **Unit Tesztek:**
  - `src/components/settings/__tests__/BankAccountsTab.test.tsx` (9 teszt lefutott, sikeres).
  - `src/components/journals/__tests__/OpeningJournalWizardModal.test.tsx` (15 teszt lefutott, sikeres).
  - `src/test/accounty/glCards.test.ts` (4 teszt lefutott, beleértve a többdevizás Karton és Egyenlegközlő PDF teszteket, sikeres).
  - `src/test/generalLedgerI18n.test.ts` (13 teszt lefutott, sikeres).
  - **Összesen:** 41/41 teszt sikeres.
- **Adatbázis séma és RPC ellenőrzés:**
  - A `gl_accounts` táblában a `currency`, `is_multicurrency` oszlopok és az index élesben léteznek.
  - A `get_gl_account_card_items` tárolt eljárás élesben frissítve, tesztelve és lefutott.
- **Production Build:** `npm run build` hibamentes (16.99s, Vite v5.4.19).
