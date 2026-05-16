# Decision 011: Member Jogosultsági Határok

**Status:** Open

**Category:** Cégstruktúra & Jogosultságok

**Question:** Milyen modulokhoz NEM fér hozzá a "member" szerepű felhasználó?

**Decision:**

**Jelenlegi implementáció (Prod):** A member role-nak **NINCS semmilyen korlátozása** a prod kódbázisban. Minden oldalt és funkciót elér, pont úgy mint az owner/admin. Csak az employee role van korlátozva (kizárólag `/working-time`).

**Sidebar menüpontok a prod-ban** (mind elérhető a member számára):
Irányítópult, Kategóriák, Projektek, Partnertörzs, Számlák, Kintlévőség, Tranzakciók, Főkönyv, Eredménykimutatás, Mérleg, Beszámoló, Feltöltés, Bérek/járulékok, Munkaidő, Házipénztár, TENY, Integrációk, Árfolyamok, Előfizetés

**Megjegyzés (VSWEB eltérés):** A VSWEB instance-ben a member role korlátozva van: Bérek és Házipénztár elrejtve sidebar-ból + URL védelemmel. Emellett Dashboard widgetek és NAV szekció is rejtett. Ez a korlátozás a prod-ban **nem létezik**.

**Nyitott kérdés:** Portolni kell-e a VSWEB-ben meglévő member korlátozásokat a prod-ba?

**Rationale:**
