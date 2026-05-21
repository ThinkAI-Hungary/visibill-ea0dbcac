# P-001: Regisztrációs Flow

**Status:** Decided  
**Category:** Onboarding & Első Élmény  
**BRD Reference:** REQ-4.1

**Question:** Hogyan regisztrál egy új felhasználó?

**Decision:** Email + jelszó regisztráció, social login nélkül.

**Current Implementation:**
- Email + jelszó regisztráció (Auth.tsx)
- Email verifikáció (verify-email Edge Function)
- Automatikus profiles rekord létrehozás (role = 'user')
- Első cég létrehozása (CompanySelector dialógus)
- company_members rekord (role = 'owner')
- Employee regisztráció: külön flow, registration_token alapú (EmployeeRegister.tsx)

**Rationale:** Egyszerű, gyors, nincs third-party függőség. Social login (Google) bevezetése akkor lesz aktuális ha a konverziós ráta alacsonynak bizonyul.
