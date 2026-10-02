# A-191: Folyószámla Kettős Devizakezelés, Árfolyam-számítás és Csoportosítási Architektúra

- **Státusz:** ✅ Decided
- **Dátum:** 2026-10-02
- **Utoljára frissítve:** 2026-10-02
- **Érintett területek:** Folyószámla (Subledger), Kettős Könyvvitel, Devizakezelés (EUR/USD/HUF), MNB Árfolyamok, React Frontend, TypeScript Domain Engine

---

## 1. Kontextus és Problémafelvetés

A kettős könyvviteli rendszerben a könyvelés hivatalos törvényes devizaneme a forint (HUF), így az analitikus és főkönyvi sorok (`public.acc_journal_lines.amount`) könyvelési pénznemben, forintban kerülnek rögzítésre. A devizás bizonylatok esetén a bizonylat fejléce (`public.acc_journal_headers`) tárolja a bizonylat eredeti devizanemét (`currency`) és az érvényes MNB/választott árfolyamot (`exchange_rate`), míg a tételsorok az eredeti devizaértéket (`foreign_amount`).

### A feltárt probléma (Bug & Root Cause)
A folyószámla analitika korábbi felületén a számlaszintű csoportosítás és a tételes lista közvetlenül a forintban tárolt összeget formázta a bizonylat devizájával:
```typescript
// Korábbi hibás működés a SubledgerPage-en:
formatCurrency(inv.amount, inv.currency)
```
Ez azt eredményezte, hogy egy 45 EUR összegű számla (amely 385,40 Ft-os árfolyamon 17 343 Ft-ként került könyvelésre) a folyószámlán **17 343,00 EUR**-ként jelent meg. Ez elfogadhatatlan eltérést okozott a számlák (`/invoices`) és a folyószámla (`/subledger`) nézetek között.

---

## 2. Döntések és Architektúra

### D-1: Kettős Deviza Adatmodell és Típusbővítés (`src/types/subledger.ts`)
A `SubledgerItem` és `GroupedSubledgerInvoice` interfészeket kiegészítettük a devizás mezőkkel:
- `foreign_amount?: number | null`: eredeti devizás bruttó összeg
- `foreign_net_amount?: number | null`: devizás nettó összeg
- `foreign_vat_amount?: number | null`: devizás áfa összeg
- `foreign_settled_amount?: number | null`: devizás kiegyenlített összeg
- `foreign_remaining_amount?: number | null`: devizás fennmaradó nyitott hátralék
- `exchange_rate?: number | null`: bizonylati árfolyam (4 tizedes pontossággal)

### D-2: Tiszta Domain Segédmodul (`src/lib/subledgerGrouping.ts`)
A számítási és csoportosítási logikát leválasztottuk a React komponensekről, és egy független, 100%-ban egységtesztelt modulba szerveztük:
1. **`deriveItemForeignAmounts(item)`**:
   - Ha a bizonylat HUF, minden foreign mező `null`.
   - Ha a bizonylat devizás: az árfolyamot az `item.exchange_rate` mezőből vagy a `item.amount / item.foreign_amount` hányadosból deriválja.
   - **Falsy Zero Védelem:** Kifejezett `item.vat_amount === 0 ? 0 : ...` és `item.remaining_amount === 0 ? 0 : ...` ágak garantálják, hogy a 0 EUR/0 Ft értékek nem válnak undefineddé vagy fallback áldozatává.
   - A tétel áfáját és nettóját az `all_lines` tételsorok ÁFA szerepe (`ALAP` és `AFA`) alapján határozza meg, elkerülve a kerekítési hibákat.
2. **`groupSubledgerItems(items)`**:
   - Partner és bizonylatszám alapján csoportosítja az analitikus sorokat egyetlen számlafejjé.
   - Kiszámítja az aggregált devizás és forintos bruttó, nettó, áfa és nyitott összegeket.

### D-3: Kettős Devizamegjelenítés (Dual Accounting Display Pattern)
A `SubledgerPage.tsx` felületén a `JournalsPage.tsx` hivatalos vizuális mintáját követve:
- **Számla szintű nézet:**
  - Elsődleges összeg: a számla bizonylati devizája (pl. `45,00 EUR`).
  - Másodlagos tájékoztató: zárójelben a könyvelési forintérték (pl. `(17 343 Ft)`).
  - Interaktív MNB árfolyam tooltip: kurzor fölé húzásra megjelenik az alkalmazott árfolyam (pl. `1 EUR = 385,40 Ft`).
- **Analitikus tételsorok:**
  - Mivel a magyar kettős könyvvitel törvényes alapja a forint, a főkönyvi számlákhoz tartozó T/K könyvelési összegeknél a forint az elsődleges, és alatta kisebb szürke szöveggel jelenik meg a devizás érték (pl. `(45,00 EUR)`).

### D-4: Keresztdevizás Csoportos Kijelölés Védelme (Multi-Currency Guard)
Amikor a felhasználó egyszerre jelöl ki különböző devizanemű bizonylatokat (pl. HUF és EUR számlát vagy banki tételt):
- A lebegő párosító sávban automatikusan megjelenik egy diszkrét sárga figyelmeztetés:
  > ⚠️ **Vegyes devizájú kijelölés: az egyenleg könyvviteli forintértéken (HUF) számítódik**
- A rendszer kizárólag akkor jelenít meg zárójeles devizaegyenleget, ha a kijelölt számlák mind ugyanazon az egyetlen devizanemen osztoznak, megelőzve az érvénytelen devizakódos formázási hibákat.

---

## 3. Következmények és Eredmények

- ✅ **Hibamentes devizás folyószámla:** A számlák és a folyószámla nézet közötti drasztikus összegeltérések megszűntek.
- ✅ **Kettős könyvvitel integritása:** A könyvelési törvényeknek megfelelően a forintalapú könyvelési egyensúly maradéktalanul érvényesül.
- ✅ **Modulok szinkronja:** A párosítási (`SubledgerItemMatchesModal`), leírási (`WriteOffSettlementModal`), kerekítési (`BulkRoundingWriteOffModal`) és exportáló (`SubledgerExportDialog`) modálok mind átvették a kettős devizakezelést.

---

## 4. Kapcsolódó
- [A-175: Folyószámla és Analitika Architektúra](./A-175-subledger-and-open-items-architecture.md)
- [A-143: Devizás Főkönyvi Számlakezelés és Analitika](./A-143-multicurrency-chart-of-accounts-and-general-ledger.md)
- [P-152: Folyószámla Devizamegjelenítés és Keresztdevizás Kijelölés UX](../../product/decisions/P-152-subledger-dual-currency-display-and-multicurrency-selection-ux.md)
