# Visibill Development & Escalation Protocol

## 🎯 3 Nem-alkuképes Alapelv (Core Invariants)
1. **Zero Silent Decisions:** Architektúrális, adatbázis- vagy üzleti logikai döntést soha ne hozz önhatalmúan; mindig vázold fel az opciókat a felhasználónak.
2. **Evidence Before Assertions:** Soha ne állítsd, hogy egy módosítás működik vagy kész van, amíg meg nem bizonyosodtál róla (típusellenőrzés: `npm run build` vagy `npx tsc --noEmit`).
3. **Docs & Spec Integrity:** Ha a kód struktúrája, sémája vagy üzleti logikája változik, a kapcsolódó specifikációknak és ADR-eknek szinkronban kell maradniuk.

---

## 🔄 Eszkalációs Döntési Mátrix (Escalation Workflow)

Ne használj feleslegesen nehéz tervezési fázist egyszerű kérdésekre, de ne kódolj vakon komplex feladatoknál:

```
                          [ Feladat Érkezése ]
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
[ Kérdés / Tájékozódás ]  [ Egyszerű / Közepes (1-4 fájl) ]  [ Komplex (5+ fájl / DB / Új Modul) ]
  • Direkt válasz           • Fókuszált módosítás               • visibill-spec-lookup (Spec keresés)
  • Grep / Graphify         • visibill-dev                      • visibill-feature-planner (Terv)
  • Nincs skill overhead    • Típusellenőrzés                   • Jóváhagyás után Subagent kivitelezés
```

| Feladat Jellege | Teendő | Hivatkozott Szabály / Skill |
| :--- | :--- | :--- |
| **Kérdés / Keresés / Olvasás** | Válaszolj közvetlenül; használd a fájlolvasást vagy Graphify-t. **Ne tölts be felesleges skilleket.** | [rules/graphify.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/graphify.md) |
| **Egyszerű / Közepes módosítás (1–4 fájl)** | Célzott fejlesztés, TDD szemlélet, majd build validáció. | [rules/frontend.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/frontend.md), [visibill-dev](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-dev/SKILL.md) |
| **Adatbázis / Migráció / RPC / RLS / Edge Function** | Tilos azonnal SQL-t futtatni. Sématerv felvázolása, checklist és kliensvédelem. | [rules/database.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/database.md), [rules/edge-functions.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/edge-functions.md), [visibill-db-checklist](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-db-checklist/SKILL.md) |
| **Rendszerhiba audit / Log elemzés** | Hibatáblák lekérdezése, zajszűrés, osztályozás és javítási terv készítés. | [visibill-error-hunter](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-error-hunter/SKILL.md) |
| **Nagy léptékű feladat (5+ fájl, új modul)** | Specifikációk feltérképezése, `implementation_plan.md` készítése és jóváhagyatása kötelező. | [visibill-spec-lookup](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-spec-lookup/SKILL.md), [visibill-feature-planner](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-feature-planner/SKILL.md) |

---

## 📋 Szakterületi Szabályok és Minőségbiztosítás

* **Frontend szabályzat:** Komponens kompozíció, Tailwind, Vercel optimalizációk és TypeScript típusbiztonság $\rightarrow$ [rules/frontend.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/frontend.md)
* **UI & UX szabályzat:** 4 kötelező állapot, double-submit védelem, pénzügyi formázás és villogásvédelem $\rightarrow$ [rules/ui-ux.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/ui-ux.md)
* **Adatbázis szabályzat:** RLS, indexelés, Supabase típusok és biztonsági előírások $\rightarrow$ [rules/database.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/database.md)
* **Edge Functions szabályzat:** Deno runtime, kötelező `checkAutomationShield` és hibakezelés $\rightarrow$ [rules/edge-functions.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/edge-functions.md)
* **Verifikáció és Lezárás:** Kötelező build és típusellenőrzés bejelentés előtt $\rightarrow$ [rules/verification.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/verification.md)
* **Design Rendszer & Dokumentáció (ADR/PRD):** Új komponensek létrehozása design tokenekkel és döntési nyilvántartás $\rightarrow$ [rules/documentation.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/documentation.md)
* **Kódbázis Tudásgráf:** Architektúrális összefüggések felderítése és AST frissítés $\rightarrow$ [rules/graphify.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/graphify.md)
