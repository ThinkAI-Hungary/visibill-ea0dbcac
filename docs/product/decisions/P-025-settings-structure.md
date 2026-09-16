# P-025: Settings Oldal Struktúra

**Status:** Decided  
**Category:** Beállítások & Profil  
**BRD Reference:** REQ-4.2

**Question:** Milyen szekciókra osztható a beállítások oldal?

**Decision:** 4 szekció egy oldalon, tab-ok nélkül.

**Current Implementation:**
- BusinessSection: cég adatok szerkesztése, email alias kezelés, share token
- ProfileSection: név, profilkép
- SecuritySection: jelszó módosítás (ChangePasswordDialog), email cím változtatás, adatexport, és Programozói Hozzáférés & API Kulcsok Kezelése (ApiKeysCard, lásd: [P-086](./P-086-customer-api-keys-management-ux.md))
- SystemSection: rendszer beállítások

**Rationale:** 4 szekció még kezelhető egy oldalon. Tab-ok vagy sidebar navigáció overengineered a jelenlegi mérethez. Ha a szekciók száma nő, tab-alapú megoldásra átállás javasolt.

## Kapcsolódó
- [P-086: Programozói Hozzáférés & API Kulcsok Kezelése (ApiKeysCard) UX](./P-086-customer-api-keys-management-ux.md)
- [A-117: Hivatalos Ügyfél REST API és Többcéges Kulcsok](../../architecture/decisions/A-117-customer-rest-api-and-multi-company-keys.md)
