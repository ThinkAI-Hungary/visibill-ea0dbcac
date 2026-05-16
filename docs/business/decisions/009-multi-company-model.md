# Decision 009: Multi-company Modell

**Status:** Decided

**Category:** Cégstruktúra & Jogosultságok

**Question:** Egy felhasználó hány céget kezelhet, és hogyan működik a cégek közötti váltás?

**Decision:**
- Egy felhasználó **több céget** is kezelhet
- Minden adatentitás (számla, tranzakció, partner, bér, stb.) `company_id`-hoz kötött
- A UI-ban **CompanySelector** komponens a cégváltáshoz
- Cég tulajdonos = `companies.owner_id`
- Más felhasználók csatlakozhatnak céghez **share token** alapján (Settings oldalon megosztó kód)
- Cég telephelyek kezelése: headquarters / branch (company_locations tábla)

**Megjegyzés (Prod vs VSWEB):** A prod-ban a csatlakozás share_token alapú. Az `invite-member` Edge Function és az `AddMemberDialog` komponens **csak a VSWEB instance-ben** létezik — a prod-ban nincs formális meghívási rendszer.

**Rationale:** A multi-company modell lehetővé teszi, hogy mind a több céget kezelő vállalkozók, mind a könyvelő irodák hatékonyan használják a rendszert. A company_id minden táblán biztosítja az adatszeparációt.
