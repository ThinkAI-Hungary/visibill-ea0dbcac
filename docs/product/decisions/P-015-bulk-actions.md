# P-015: Tömeges Műveletek (Bulk Actions)

**Status:** Decided  
**Category:** Számla Kezelés

**Question:** Lehet-e több számlát/tranzakciót egyszerre kezelni?

**Decision:** Checkbox-alapú bulk actions: törlés, kategorizálás, export. Confirm dialógus a "select all" műveleteknél.

**TODO:**
- Checkbox select a számla és tranzakció listákban
- Bulk műveletek: törlés, GL kategorizálás, export (CSV/Excel)
- "Select all" + confirm dialógus a véletlen tömeges módosítás ellen
- Bulk action toolbar (kijelölés után megjelenik)

**Rationale:** Standard UX pattern, hatékony nagy listáknál. A confirm dialógus megvédi a véletlen tömeges módosítástól.
