# Decision 023: Tárgyi Eszközök (TÉNY)

**Status:** Decided

**Category:** Pénzügyi Modulok

**Question:** Hogyan kezeli a rendszer a tárgyi eszközöket és az értékcsökkenést?

**Decision:**
- Teljes életciklus: active → disposed / sold / missing
- Értékcsökkenés: lineáris módszer, TAO sablonok (11 sablon), rate override lehetőség
- Aktiválási workflow: `asset_events` tábla (activation, transfer, project_transfer, disposal, inventory_check, value_change, reactivation)
- Számla-alapú eszköz létrehozás (`source_invoice_id`, `source_invoice_type`: submitted/nav)
- Dokumentum csatolás (`documents` JSONB), telephelyhez rendelés (`location_id`), projekthez rendelés (`project_id`)
- GL szám hozzárendelés (`gl_account_id`)
- VTSZ/TESZOR kód rögzítés
- Projektek oldali integráció: a projektek adatlapon megjelennek a hozzárendelt eszközök és azok összértéke

**Rationale:** A magyar számviteli törvénynek megfelelő tárgyi eszköz nyilvántartás szükséges. A TAO sablonok biztosítják a helyes adóalap számítást. Az aktiválási workflow audit trail-t biztosít. A projekt-hozzárendelés biztosítja a projektszintű eszköz- és költségallokációt.

---

## Megvalósítás részletei

### Projekt hozzárendelés (PROJEKT oszlop és áthelyezés)

Az eszközök a `projects` táblához rendelhetők a `fixed_assets.project_id` FK-n keresztül:
- **Aktiváláskor:** Választható projekt lenyílóból (ha a forrásszámla projekthez tartozott, előtöltésre kerül).
- **Áthelyezéskor:** A `TransferDialog`-ban a telephely és a projekt külön-külön vagy egyszerre módosítható.
- **Életút napló:** Projekt változáskor `project_transfer` esemény jön létre az `asset_events` táblában.
- **Projects oldalon:** A projekt kártyáján a "Eszközök" fül alatt megjelennek az allokált tárgyi eszközök, valamint az Áttekintés fülön a darabszám és összérték.

### Helyszín (HELYSZÍN oszlop)

Az `AssetListTable` a `company_locations` táblát joinja `fixed_assets.location_id` FK-n keresztül:

```
fixed_assets.location_id → company_locations(id, name, address, location_type)
```

- `location.name` → fősor megnevezés (pl. "Székhely", "Raktár")
- `location.address` → tooltip és második sor (pl. "2040 Budaörs, Gyár utca 15.")
- Ha nincs helyszín rendelve: `"-"` jelenik meg

### Felelős (FELELŐS oszlop)

A felelős személyt a `fixed_assets.activated_by_name` mező tárolja (szabad szöveges mezőként).
Az eszköz aktiválásakor az aktiváló személy neve kerül ide, de utólag is módosítható.

> **Konvenció:** A felelős neve az `accounty_employees` táblából válasszuk ki (dolgozónkénti hozzárendelés).

### Sandbox demo adatok (company_id: `59b545c0-...`)

**Helyszínek (`company_locations`):**
| ID suffix | Név | Cím | Típus |
|---|---|---|---|
| `...000001` | Székhely | 1034 Budapest, Székhely utca 1. | headquarters |
| `...000002` | Raktár | 2040 Budaörs, Gyár utca 15. | branch |

**Eszközök (`fixed_assets`):**
| Leltári szám | Megnevezés | Helyszín | Felelős |
|---|---|---|---|
| TE-001 | MacBook Pro 16 M4 | Székhely | Nagy Péter |
| TE-002 | Dell Monitor U2723QE | Székhely | Nagy Péter |
| TE-003 | Irodai bútorok | Székhely | Kovács Anna *(selejt)* |
| TE-004 | Samsung Galaxy S24 Ultra | Székhely | Tóth László |
| TE-005 | Toyota Proace City L2 | Raktár | Tóth László |
| TE-006 | Klímaberendezés (3 db) | Székhely | Kovács Anna |
| TE-007 | HP LaserJet Pro MFP M428 | Székhely | Horváth Katalin |
| TE-008 | Raktári polcrendszer | Raktár | Szabó Mária |

