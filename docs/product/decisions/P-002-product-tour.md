# P-002: Product Tour + Onboarding Checklist

**Status:** Decided  
**Category:** Onboarding

**Question:** Milyen onboarding élményt kapjon az új felhasználó?

**Decision:** Dinamikus, maximum 11 lépéses interaktív Product Tour (react-joyride), amely automatikusan igazodik a felhasználói szerepkörökhöz és modul jogosultságokhoz (pl. eaisyBooks / Accounty hozzáférés).

**Túra lépések (11 maximum):**
1. Üdvözlés (center overlay)
2. Alkalmazás váltó (Modulváltó eaisyBill / eaisyBooks között — dinamikus)
3. Cégválasztó (dinamikus, employee-nél átugorva)
4. Irányítópult
5. Számlák (Pénzügyek csoport)
6. Kategóriák (Áttekintés csoport)
7. Bizonylat Feltöltés (manuális / e-mail feltöltő)
8. Könyvelési Riportok (Főkönyv stb. — dinamikus)
9. Beállítások (dinamikus, employee-nél átugorva)
10. Menü elrejtése (SidebarTrigger a sáv összecsukásához)
11. Befejezés (center overlay)

**Implementáció:** `ProductTour.tsx`, `AppSidebar.tsx`, `user_profiles.has_completed_tour` flag. A túra futása alatt a sidebar automatikusan kibomlik és minden menücsoport kinyílik. A tooltip pozicionálás a Floating UI/Popper viewport-szegélyeire van korlátozva a képernyőről való lelógás ellen.

**TODO:** Onboarding checklist implementálás ("Tölts fel 1 számlát", "Kösd össze a NAV-ot", "Importálj bank kivonatot").

**Rationale:** A tour gyorsan végigvezeti a usert a fő funkciókon. A checklist opcionális, de segít az aktivációban.
