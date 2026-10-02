# P-152: Folyószámla Kettős Devizamegjelenítés, Árfolyam Tooltip és Vegyes Devizás Kijelölés UX

- **Státusz:** ✅ Decided
- **Kategória:** UI / Könyvelési Folyószámla / Devizakezelés
- **Dátum:** 2026-10-02
- **Kérdés:** Hogyan jelenjenek meg a devizás számlák a folyószámla analitika felületén úgy, hogy a felhasználó számára egyértelmű legyen a bizonylati devizaösszeg, miközben a magyar kettős könyvviteli törvényes forintérték és az MNB árfolyam is pontosan áttekinthető maradjon?
- **Döntés:** Bevezetjük a `JournalsPage.tsx` hivatalos kettős devizás megjelenítési mintáját a `SubledgerPage.tsx` oldalra és kapcsolódó modáljaira, valamint intelligens figyelmeztető sávval látjuk el a keresztdevizás csoportos kijelölést.

---

## 1. Felhasználói Felület és Működés (UX)

### 1.1 Folyószámla Táblázat Kettős Összegformázása
- **Számla szintű sorokban:**
  - **Devizás számla esetén (pl. EUR, USD):**
    - A Nettó, ÁFA, Bruttó és Nyitott oszlopokban az elsődleges kiemelt szöveg a bizonylat devizájában jelenik meg (pl. `45,00 EUR`).
    - Közvetlenül mellette szürke színnel zárójelben a könyvelt forintérték látható (pl. `(17 343 Ft)`).
    - Az összeg fölé húzva az egérmutatót, megjelenik az alkalmazott MNB/bizonylati árfolyam tooltip (pl. `1 EUR = 385,40 Ft`).
  - **Forintos számla esetén (HUF):**
    - A standard forintos formázás látható (pl. `17 343 Ft`), felesleges devizajelzések nélkül.
- **Lenyitott tételsoros nézet:**
  - A számla tételeinek analitikus főkönyvi számlasorainál a forint az elsődleges könyvelési összeg (mivel a főkönyv Ft alapú), és alatta 10px-es szürke betűvel jelenik meg az eredeti devizaösszeg (pl. `(45,00 EUR)`).

### 1.2 Lebegő Műveleti Sáv és Keresztdevizás Figyelmeztetés
- Ha a felhasználó kijelöl több számlát:
  - **Azonos devizájú kijelölés esetén:** A forintos egyenleg mellett zárójelben a devizás egyenleg is látható.
  - **Vegyes devizájú kijelölés esetén (pl. HUF + EUR):**
    - A lebegő sávban egy sárga figyelmeztető badge jelenik meg:
      > ⚠️ **Vegyes devizájú kijelölés: az egyenleg könyvviteli forintértéken (HUF) számítódik**
    - Megakadályozza, hogy a rendszer hibás devizakód-összefűzést jelenítsen meg.

### 1.3 Modálok és Export Szinkronizáció
- A `SubledgerPostingModal`, `SubledgerItemMatchesModal`, `WriteOffSettlementModal` és `BulkRoundingWriteOffModal` modálok mind átvették a devizás mezőket, megelőzve, hogy egy devizás számla kiegyenlítésekor forintösszeg kerüljön felülírásra.
- A `SubledgerExportDialog` Excel exportja automatikusan tartalmazza a devizás bruttó, nettó és árfolyam oszlopokat.

---

## 2. Rationale (Indoklás)

A könyvelők és pénzügyi vezetők számára elengedhetetlen, hogy egy külföldi partner devizás számláját az eredeti szerződéses devizájában (EUR) lássák, hiszen az átutalás és a banki kivonat is EUR-ban történik. Ugyanakkor a magyar számviteli törvények megkövetelik a forintérték folyamatos ellenőrizhetőségét is. A kettős megjelenítés mindkét igényt egyszerre elégíti ki maximális transzparenciával.

---

## 3. Kapcsolódó
- [A-191: Folyószámla Kettős Devizakezelés Architektúra](../../architecture/decisions/A-191-subledger-dual-currency-and-grouping-architecture.md)
- [P-136: Folyószámla és Analitika Kezelőfelület UX](./P-136-subledger-and-open-items-ux.md)
