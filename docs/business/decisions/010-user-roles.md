# Decision 010: Felhasználói Szerepek (RBAC)

**Status:** Partially Decided

**Category:** Cégstruktúra & Jogosultságok

**Question:** Milyen felhasználói szerepek léteznek, mi a jogosultsági mátrix? Mi a különbség admin és owner között? Szükséges-e granulárisabb, modul-szintű jogosultság-kezelés?

**Decision:**

## Cég-szintű szerepek (company_members.role)

| Szerep | DB rekordok (prod) | UI viselkedés (prod) | Implementáció |
|--------|-------------------|----------------------|---------------|
| `owner` | 19 | Teljes hozzáférés | ✅ Aktív |
| `admin` | 2 | Teljes hozzáférés (= owner) | ✅ Aktív, de UI-ban NEM különbözik az owner-től |
| `member` | 4 | Teljes hozzáférés (= owner) | ⚠️ DB-ben létezik, de **NINCS** korlátozás a prod-ban |
| `employee` | 1 | Csak `/working-time` oldal | ✅ Aktív, ProtectedRoute-tal védett |

**⚠️ Fontos:** A prod kódbázisban (`visibill-709fffdf`) a member role-nak **NINCS semmilyen korlátozása** — minden oldalt és funkciót elér, pont úgy mint az owner/admin. A member korlátozások (Bérek, Házipénztár elrejtése, dashboard widgetek, NAV szekció) **csak a VSWEB instance-ben** vannak implementálva (`isMember`, `memberHidden` flag, `MEMBER_BLOCKED_PAGES`).

**Admin jogosultság logika** (prod `useUserRole.ts`, 53. sor):
```
isAdmin = role === 'owner' || role === 'admin' || !companyId
```
→ Nincs `isCompanyOwner` (owner_id) ellenőrzés a prod-ban — ez is csak VSWEB-ben van.

## Platform-szintű szerepek (profiles tábla)

| Mező | Értékek (prod) | Leírás |
|------|---------------|--------|
| `profiles.role` | `user` (27 fő), `management` (1 fő) | Platform adminisztráció |

A `management` role hozzáférést biztosít a `management-stats` Edge Function-höz.

**Megjegyzés:** Az `is_support_admin` mező **csak a VSWEB instance-en** létezik, a prod DB-ben nincs ilyen oszlop.

## Prod vs VSWEB különbségek összefoglalása

| Feature | Prod (709fffdf) | VSWEB |
|---------|----------------|-------|
| `isMember` flag | ❌ Nincs | ✅ Van |
| `memberHidden` sidebar flag | ❌ Nincs | ✅ Van |
| `MEMBER_BLOCKED_PAGES` | ❌ Nincs | ✅ `/salaries`, `/petty-cash` |
| `isCompanyOwner` (owner_id check) | ❌ Nincs | ✅ Van |
| Member korlátozások | ❌ Semmilyen | ✅ Bérek, Házipénztár, Dashboard widgetek, NAV szekció |

## Nyitott kérdések
1. **Member korlátozások portolása:** A VSWEB-ben már megvalósított member korlátozásokat portolni kell-e a prod-ba?
2. **Admin vs Owner:** Jelenleg mindkét kódbázisban azonos jogosultságuk van. Kell-e különbség?
3. **Employee scope:** Jelenleg csak a `/working-time` oldalt látja. Ez végleges?
4. **Granularitás:** Kell-e modul-szintű jogosultság a jövőben?

**Rationale:** A role rendszer DB szinten mindkét instance-ban létezik (owner/admin/member/employee), de a UI-szintű korlátozások csak a VSWEB-ben vannak implementálva. A prod kódbázis egyszerűbb: csak az employee role-t korlátozza (kizárólag `/working-time`-ot látja). Az egységesítés szükséges a két kódbázis között.
