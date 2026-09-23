# P-106: Horvát Főkönyvi Kivonat és Nézetek Teljes Lokalizációja, Dinamikus Pénznem és Novo Konto UX

**Státusz:** Elfogadva (Decided)  
**Dátum:** 2026-09-23  
**Kapcsolódó ADR:** [A-140: Multi-Jurisdiction Cégkezelés és Horvát Számlatükör](../../architecture/decisions/A-140-multi-jurisdiction-and-croatian-chart-of-accounts.md), [A-109: Horvát Lokalizáció](../../architecture/decisions/A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md)  
**Kapcsolódó PRD:** [P-105: Főkönyvi Kivonat 2-Tier Eszköztár és Hierarchikus Számlafa UX](./P-105-general-ledger-toolbar-and-expand-collapse-ux.md), [P-081: Eaisybill Horvát Lokalizáció UX](./P-081-eaisybill-croatia-localization-and-demo-ux.md)  
**Érintett modulok:** Főkönyvi kivonat (`GeneralLedgerPage.tsx`), Főkönyvi fastruktúra táblázat (`GeneralLedgerTable.tsx`), Összehasonlító táblázat (`GeneralLedgerComparisonTable.tsx`), Naplófőkönyv nézet (`JournalView.tsx`), Partner folyószámla karton (`PartnerLedgerCardView.tsx`)

---

## 1. Kontextus és Problémafelvetés

A Főkönyv (`/general-ledger`) menüpontban a horvát cégek (`D-INVOICE D.O.O`, OIB: 11 számjegy) kezelésekor számos felületi disszonancia volt tapasztalható:
1. **Hardkódolt Magyar Forint (`Ft`) jelzések:**
   A KPI metrika kártyákon (`Tartozik (Ft)`, `Követel (Ft)`), az Összehasonlítás nézetben (`2025: -282 040 Ft`, `Eltérés (Ft)`), a Naplófőkönyvben és a Partner kartonokon fixen forintban jelentek meg az adatok, holott a horvát cég könyvelési alapdevizája az Euró (`EUR`).
2. **Lefordítatlan Eszköztár és Vezérlők:**
   A főkönyvi fejléc eszköztárán az új számla felvételére szolgáló gomb hardkódolva magyarul jelent meg: `+ Új főkönyvi szám`.
3. **Hiányzó Horvát Terminológia a Másodlagos Nézetekben:**
   - **Összehasonlítás:** A keresőmező, az időszaki szűrők (`Összes számla`, `Csak eltérések`), a táblázatfejlécek és a besorolatlan számlák magyarul maradtak.
   - **Naplófőkönyv:** A típus szűrő (`Összes típus`), a tételtípus jelvények, az összesítő sáv (`Tartozik`, `Követel`, `Nettó`) nem követték a horvát terminológiát.
   - **Kartonok:** A korosítási sáv (`Lejáraton belüli`, `31–60 napja lejárt`) és a partner egyenlegközlő funkció nem volt lokalizálva.

---

## 2. Termékdöntés és Megvalósítás

### 2.1 Új Főkönyvi Szám Eszköztár Gomb (`+ Novo konto`)
- A [`GeneralLedgerPage.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/GeneralLedgerPage.tsx) eszköztárán a gomb dinamikus i18n kulcsot kapott: `t('accounting:general_ledger.toolbar.add_account')`.
- Magyar nyelven: **`Új főkönyvi szám`**.
- Horvát nyelven (`/hr` route vagy horvát cég): **`Novo konto`**.

### 2.2 Dinamikus Devizakijelzés a Felület Egészén
A `useCompanyJurisdiction()` hook alapján a felület automatikusan alkalmazkodik a cég joghatóságához:
- **KPI kártyák:** Horvát cégnél `Duguje (EUR)` és `Potražuje (EUR)`, magyar cégnél `Tartozik (Ft)` és `Követel (Ft)`.
- **Összehasonlítás nézet:** Oszlopfejléc: `Odstupanje (EUR)` (HR) / `Eltérés (Ft)` (HU). A táblázat celláiban és a fejléc összesítőben a pénznem dinamikusan `EUR` vagy `Ft`, a formázás horvát cégnél `hr-HR` szerinti.
- **Naplófőkönyv nézet:** Összesítő sáv: `X stavki | Duguje: X EUR | Potražuje: X EUR | Neto: X EUR`. Soronkénti összegek dinamikus pénznemmel.
- **Partner karton nézet:** Táblázatfejlécek: `Fakturirano bruto (EUR)`, `Plaćeno (EUR)`, `Otvoreni saldo (EUR)`. A korosítási kártyákon és a kártyafejlécben az összes nyitott állomány `EUR`-ban jelenik meg.

### 2.3 Teljes Horvát Nyelvi Lefedettség a Nézetekben
- **Kereső és Szűrők:**
  - Összehasonlítás: *"Pretraživanje (konto, naziv...)"*, szűrők: `Sva konta`, `Samo odstupanja`, `Samo porast`, `Samo pad`.
  - Naplófőkönyv: *"Pretraživanje (partner, opis, konto...)"*, típusválasztó: `Sve vrste`.
  - Kartonok: *"Odaberite partnera"*, nézetek: `Samo otvorene stavke`, `Cjelokupni promet`, `Izvod otvorenih stavki (IOS) PDF`.
- **Tételtípusok és Leírások Horvát Megjelenítése:**
  - A `getLocalizedGlItemType` motor a tranzakciókat natív horvát kategóriákként jelöli meg: `Početna stavka`, `Završna stavka`, `Temeljnica`, `Ulazni račun (Trošak)`, `Izlazni račun (Prihod)`, `Bankovna transakcija`, `e-Račun Ulazni/Izlazni`, `Blagajna`.
  - A nyitó tételek leírása: `[NYITO-2026] Početno stanje (...)`.
  - Besorolatlan tételek: `Neraspoređeno`.
- **Betöltési és Üres Állapotok:**
  - Sorok kibontásakor megjelenő spinner felirata: *"Učitavanje stavki..."*.
  - Üres táblázatok: *"Nema podataka za usporedbu prema odabranim kriterijima."*, *"Nema stavki dnevnika u odabranom razdoblju"*, *"Nema analitičkih podataka partnera za prikaz."*.

---

## 3. UI/UX Minőségbiztosítás és Eredmények

- **Regresszióvédelem:** A `src/test/generalLedgerI18n.test.ts` (13 teszt) és `src/test/i18n.test.ts` (27 teszt) ellenőrzi az összes új kulcs mélységi egyezését a magyar és horvát névterek között.
- **Típus- és Build Stabilitás:** `npx tsc --noEmit` és `npm run build` hiba nélkül, sikeresen lefut.
