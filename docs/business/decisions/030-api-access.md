# Decision 030: API & Third-party Hozzáférés

**Status:** Open

**Category:** Platform & Terjeszkedés

**Question:** Tervezünk-e nyilvános API-t harmadik fél számára? Ha igen, milyen funkciókra (számlák lekérdezése, tranzakciók, NAV adatok)? Szükséges-e API kulcs kezelés, rate limiting, dokumentáció?

**Decision:**

**Jelenlegi implementáció:** Nincs nyilvános API. Minden funkció a Supabase Edge Functions-ön és RLS-en keresztül érhető el, kizárólag autentikált felhasználók számára.

**Rationale:**
