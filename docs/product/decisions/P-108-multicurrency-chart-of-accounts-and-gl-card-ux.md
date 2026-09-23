# P-108: Devizás Főkönyvi Számlakezelés, Bankszámla Safeguard és Többdevizás Karton/Analitika UX

**Status:** Decided  
**Date:** 2026-09-24  
**Category:** UI / Workflow  
**Kapcsolódó Hibajegy:** EB-0182 (Kolos Transport Kft. / Ván Iroda Kft.)  

---

## Question
Hogyan jelenjen meg és működjön a felhasználói felületen:
1. Az új és szerkesztett főkönyvi számlák devizanemének beállítása (`AddGlAccountModal`)?
2. A beállításokban a céges bankszámlák rögzítésekor a főkönyvi szám kiválasztása és a deviza-inkonzisztencia megelőzése (`BankAccountsTab`)?
3. A nyitó egyenlegek felvitelekor a devizás tételek rögzítése (`OpeningJournalWizardModal`)?
4. A főkönyvi számlakartonon (`GlAccountCardView`) és a partneri folyószámla analitikán (`PartnerLedgerCardView`) a forint mellett a devizás nyitó, forgalmi és záró adatok átlátható megjelenítése?
5. A számlakarton és egyenlegközlő levél többdevizás PDF exportja?

---

## Decision

### 1. Számlatükör Deviza Beállítás és Intelligens Felismerés (`AddGlAccountModal`)
- **Deviza kapcsoló:** Az űrlapon megjelenik egy "Devizás számla (második érték)" checkbox.
- **Opciók kiválasztása:** Ha a kapcsoló aktív:
  - Kiválasztható egy dedikált devizanem (`EUR`, `USD`, `CHF`, `GBP`, stb.).
  - Vagy választható az "Analitikus / Többdevizás gyűjtő" opció (`is_multicurrency = true`, `currency = null`), amely tetszőleges devizanemű tételeket fogad.
- **Prefix-alapú intelligens felismerés:** A számlaszám gépelésekor a rendszer valós időben elemzi a prefixet:
  - `386...` (deviza bank) gépelésekor automatikusan bekapcsolja a devizát és alapértelmezettként felajánlja az `EUR`-t.
  - `382...` (deviza pénztár) gépelésekor szintén felajánlja a deviza opciót.
  - `316...` vagy `4542...` esetén automatikusan többdevizás gyűjtőt javasol.

### 2. Bankszámla Rögzítési Safeguard (`BankAccountsTab`)
- **Főkönyvi szám választó:** A bankszámla felvételekor/szerkesztésekor megadható a könyvelési főkönyvi számlaszám (`gl_account_id`).
- **Valós idejű deviza-ellenőrzés:**
  - Ha a kiválasztott főkönyvi számlának dedikált devizaneme van, és az eltér a bankszámla devizájától (pl. EUR bankszámlához egy HUF-os `3841` vagy USD-s számla van rendelve), a felületen egy sárga/borostyán színű figyelmeztető banner jelenik meg (`AlertCircle` ikonnal).
  - A mentés gomb megnyomásakor a rendszer egyértelmű hibaüzenettel megakadályozza az inkonzisztens devizájú könyvelési párosítás mentését.

### 3. Nyitó Varázsló Devizás Rögzítés (`OpeningJournalWizardModal`)
- Amikor a könyvelő nyitó tételt visz fel, a rendszer ellenőrzi a kiválasztott főkönyvi számot.
- Ha a számlánál `is_multicurrency === true` vagy a `currency` nem HUF:
  - Automatikusan láthatóvá válnak a "Deviza összeg", "Pénznem" és "Árfolyam" beviteli mezők.
  - A rendszer a devizaösszeg és árfolyam szorzataként automatikusan kiszámítja a forint könyvelési értéket, miközben a devizás összeget is perzisztálja a naplósorokban (`foreign_amount`, `currency`).

### 4. Főkönyvi Számlakarton Devizás UX (`GlAccountCardView`)
- **Összegző Kártyák (KPI Cards):** A Nyitó egyenleg, Tartozik forgalom, Követel forgalom és Záró egyenleg kártyák a forint összeg alatt egy jól látható, diszkrét másodlagos értékként megjelenítik a devizaösszeget is (pl. `1 250,00 EUR`), ha a számlán devizamozgás történt.
- **Tételek Táblázata:**
  - A sorokban a T és K összegek mellett megjelenik az eredeti devizaösszeg.
  - A táblázat tartalmaz egy göngyölt devizaegyenleg oszlopot (`foreign_running_balance`), így a könyvelő sorról sorra látja a devizás egyenleg alakulását is.

### 5. Partneri Folyószámla Analitika Kiterjesztése (`PartnerLedgerCardView`)
- **Számlatartomány:** A partneri analitika kiterjesztésre került: a korábbi szigorú 311 és 454 helyett a teljes vevői (`311-317`) és szállítói (`454-455`) tartományt vizsgálja.
- **Többdevizás Badge-ek:** A partnerösszesítő kártyán és a fejlécekben a forint végösszeg mellett devizanemenkénti összegző badge-ek (pl. `2 400 EUR nyitott`) jelzik a devizás kitettséget.

### 6. Többdevizás PDF Exportok (`ledgerCardPdfs.ts`)
- **Karton PDF:** Az exportált számlakarton fejlécében és KPI dobozaiban a forint alatt zárójelben szerepel a devizaösszeg, a táblázat soraiban pedig feltüntetésre kerül a devizanem és az eredeti devizaérték.
- **Egyenlegközlő Levél PDF:** A partneri egyenlegközlő kimutatásban a számlatételek mellett a nyitott devizaösszeg és a levél végén lévő összegző blokkban a devizanemenkénti bontás is kiírásra kerül.

---

## Rationale
A magyar és nemzetközi könyvelési standardok megkövetelik, hogy a devizás pénzeszközöket (bank, pénztár), valamint a devizás vevőket és szállítókat mind forintban, mind az eredeti devizában nyilvántartsák. A felhasználói felület korábbi állapota nem biztosított dedikált devizabeállítást a számlatükörben, és nem akadályozta meg, hogy egy EUR bankszámlához egy forintos számlaszámot rendeljenek hozzá, ami súlyos könyvelési anomáliákhoz és hibás beszámolókhoz vezetett volna. Az új UX zökkenőmentes, intelligens felismerést és azonnali védelmet nyújt a könyvelők számára.

---

## Kapcsolódó
- **ADR:** [A-143: Devizás Főkönyvi Számlakezelés és Partner Analitika](../../architecture/decisions/A-143-multicurrency-chart-of-accounts-and-general-ledger.md)
- **ADR:** [A-057: Könyvelési Naplók Architektúrája](../../architecture/decisions/A-057-accounting-journals-architecture.md)
- **PRD:** [P-055: Könyvelési Napló és Nyitó Varázsló UX](./P-055-accounting-journals-ux.md)
- **PRD:** [P-106: Horvát Főkönyvi Kivonat és Devizás Nézetek UX](./P-106-croatian-general-ledger-and-multicurrency-views.md)
- **Index:** [docs/product/decisions/index.md](./index.md)
