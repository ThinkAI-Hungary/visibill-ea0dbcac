# P-002: Product Tour + Onboarding Checklist

**Status:** Decided  
**Category:** Onboarding

**Question:** Milyen onboarding élményt kapjon az új felhasználó?

**Decision:** 13 lépéses interaktív Product Tour (react-joyride) + opcionális onboarding checklist.

**Tour lépések (13):**
1. Üdvözlés (center overlay)
2. Cégválasztó
3. Irányítópult
4. Kategóriák
5. Projektek
6. Partnertörzs
7. Számlák
8. Feltöltés
9. Bérek/járulékok
10. Integrációk
11. Árfolyamok
12. Előfizetés
13. Befejezés (center overlay)

**Implementáció:** ProductTour.tsx, `user_profiles.has_completed_tour` flag.

**TODO:** Onboarding checklist implementálás ("Tölts fel 1 számlát", "Kösd össze a NAV-ot", "Importálj bank kivonatot").

**Rationale:** A tour gyorsan végigvezeti a usert a fő funkciókon. A checklist opcionális, de segít az aktivációban.
