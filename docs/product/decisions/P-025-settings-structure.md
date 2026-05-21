# P-025: Settings Oldal Struktúra

**Status:** Decided  
**Category:** Beállítások & Profil  
**BRD Reference:** REQ-4.2

**Question:** Milyen szekciókra osztható a beállítások oldal?

**Decision:** 4 szekció egy oldalon, tab-ok nélkül.

**Current Implementation:**
- BusinessSection: cég adatok szerkesztése, email alias kezelés, share token
- ProfileSection: név, profilkép
- SecuritySection: jelszó módosítás (ChangePasswordDialog)
- SystemSection: rendszer beállítások

**Rationale:** 4 szekció még kezelhető egy oldalon. Tab-ok vagy sidebar navigáció overengineered a jelenlegi mérethez. Ha a szekciók száma nő, tab-alapú megoldásra átállás javasolt.
