# Decision 019: Bér & Járulék Modul

**Status:** Decided

**Category:** Pénzügyi Modulok

**Question:** Hogyan kezeli a rendszer a béreket, járulékokat és a kapcsolódó dokumentumokat?

**Decision:**
- Bérjegyzék automatikus feldolgozás LLM pipeline-nal (salary_files → salary)
- Típusok: `bér`, `adó`, `járulék`, `bruttó_bér`, `ÁFA`
- Fizetési módok: készpénz, átutalás
- Státuszok: Függő, Kifizetve (+ webhook küldési státuszok)
- Tranzakció-bér párosítás (transaction_id FK)
- Alkalmazotti nyilvántartás: `employee_rates` (óradíj, havi bér, employee/contractor típus)
- Employee meghívás: registration_token alapú regisztráció

**Rationale:** A bérszámfejtési dokumentumok automatikus feldolgozása csökkenti a manuális adatbevitelt. A tranzakció-bér párosítás biztosítja a pénzügyi nyomon követhetőséget.

---

## Megvalósítás részletei

### `salary` tábla adatstruktúra

A tábla **kétféle sort** tartalmaz — ez kritikus a metrika-számítás szempontjából:

| Sor típus | `munkavallalo_neve` | Felhasználás |
|-----------|---------------------|--------------|
| **Per-dolgozó sorok** | `"Kovács Anna"` (kitöltött) | Accordion lebontás (ki mennyit kap / kinek mennyi SZJA-ja van) |
| **NAV összesítő sorok** | `NULL` (üres) | A tényleges NAV átutalás összege (pl. összes SZJA egy tételben) |

> **Fontos:** A per-dolgozó SZJA sorok összege = a NAV összesítő "Magánszemélytől levont SZJA" sor — **nem különálló pénzmozgások**, hanem ugyanannak a bontása!

### KPI metrikák (`useSalaryData.ts`)

| Metrika | Számítás | Megjegyzés |
|---------|----------|------------|
| `totalPayments` | `bér` (per-dolgozó) + `adó`/`járulék` ahol `munkavallalo_neve IS NULL` | Csak valódi kifizetések — duplikáció nélkül |
| `netSalary` | Összes `bér` típusú sor | Nettó bér a dolgozóknak |
| `grossSalary` | `bruttó_bér` típus per-employee per-month | Bruttó bérköltség (munkáltató szemszögéből) |
| `employeeCount` | Distinct `munkavallalo_neve` (nem NULL) | Aktív dolgozók száma |

**Bug fix (2026-06-24):** Az eredeti `totalPayments` számítás minden `adó`/`járulék` típusú sort összeadott,
beleértve a per-dolgozó bontás sorokat ÉS a NAV összesítő sorokat egyaránt — így minden NAV befizetés
kétszer szerepelt. Javítás: `adó`/`járulék` típusnál csak a `munkavallalo_neve IS NULL` sorok számítanak.

### Sandbox demo adatok (company_id: `59b545c0-...`)

- **Időszak:** 2026. január–február
- **Dolgozók:** Kovács Anna, Nagy Péter, Szabó Mária, Tóth László, Horváth Katalin
- **Bér rekordok:** Per-dolgozó nettó bér + bruttó bér + TB/SZJA/KIVA bontás
- **NAV utalások:** Magánszemélytől levont SZJA, KIVA összege, Egysz. fogl. SzHo, Társ.bizt. járulék

