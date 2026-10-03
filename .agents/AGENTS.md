# Visibill Development & Escalation Protocol

## 🎯 4 Nem-alkuképes Alapelv (Core Invariants)
1. **Zero Silent Decisions:** Architektúrális, adatbázis- vagy üzleti logikai döntést soha ne hozz önhatalmúan; mindig vázold fel az opciókat a felhasználónak.
2. **Evidence Before Assertions:** Soha ne állítsd, hogy egy módosítás működik vagy kész van, amíg meg nem bizonyosodtál róla (típusellenőrzés: `npm run build` vagy `npx tsc --noEmit`, valamint kötelező tesztek futtatása: `npm test`).
3. **Docs & Spec Integrity:** Ha a kód struktúrája, sémája vagy üzleti logikája változik, a kapcsolódó specifikációknak és ADR-eknek szinkronban kell maradniuk.
4. **Zero Workspace Clutter & Scratch Folder Discipline:** Szigorúan tilos bármilyen átmeneti segédfüggvényt, ellenőrző vagy debug szkriptet (`.js`, `.cjs`, `.ts`, `.py`), adatbázis dumpot vagy ideiglenes SQL-t (`.sql`), kinyert riportot vagy szövegfájlt a projekt gyökérkönyvtárába (`/`) létrehozni! Minden ilyen segédanyagot kötelezően és kizárólag a `scratch/` mappába (`d:\ThinkAI\Visibill\eaisybill-prod\scratch\`) kell menteni, amelyet a `.gitignore` automatikusan kezel. A projekt gyökere kizárólag a tényleges, konfigurációs és forrásfájlokat tartalmazhatja.

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
| **Adatbázis / Migráció / RPC / RLS / Edge Function** | Tilos azonnal SQL-t futtatni. Sématerv felvázolása, checklist és kliensvédelem. | [rules/database.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/database.md), [rules/edge-functions.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/edge-functions.md), [visibill-db-checklist](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-db-checklist/SKILL.md), [supabase](file:///C:/Users/Morfi/.gemini/config/skills/supabase/SKILL.md), [supabase-postgres-best-practices](file:///C:/Users/Morfi/.gemini/config/skills/supabase-postgres-best-practices/SKILL.md) |
| **Rendszerhiba audit / Log elemzés** | Hibatáblák lekérdezése, zajszűrés, osztályozás és javítási terv készítés. | [visibill-error-hunter](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-error-hunter/SKILL.md) |
| **Git Push / Supabase Deploy előtt** | Migrációk szinkronizálása és verziózási integritás ellenőrzése a távoli DB-vel. | [visibill-migration-sync](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-migration-sync/SKILL.md) |
| **Nagy léptékű feladat (5+ fájl, új modul)** | Specifikációk feltérképezése, `implementation_plan.md` készítése és jóváhagyatása kötelező. | [visibill-spec-lookup](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-spec-lookup/SKILL.md), [visibill-feature-planner](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-feature-planner/SKILL.md) |

---

## 📋 Szakterületi Szabályok és Minőségbiztosítás

* **Frontend szabályzat:** Komponens kompozíció, Tailwind, Vercel optimalizációk és TypeScript típusbiztonság → [rules/frontend.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/frontend.md)
* **UI & UX szabályzat:** 4 kötelező állapot, double-submit védelem, pénzügyi formázás és villogásvédelem → [rules/ui-ux.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/ui-ux.md)
* **Adatbázis szabályzat:** RLS, indexelés, Supabase típusok és biztonsági előírások → [rules/database.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/database.md)
* **Edge Functions szabályzat:** Deno runtime, kötelező `checkAutomationShield` és hibakezelés → [rules/edge-functions.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/edge-functions.md)
* **Verifikáció és Lezárás:** Kötelező build, típusellenőrzés és tesztek futtatása bejelentés előtt → [rules/verification.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/verification.md)
* **Design Rendszer & Dokumentáció (ADR/PRD):** Új komponensek létrehozása design tokenekkel és döntési nyilvántartás → [rules/documentation.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/documentation.md)
* **Kódbázis Tudásgráf:** Architektúrális összefüggések felderítése és AST frissítés → [rules/graphify.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/graphify.md)

---

## ✍️ Formázási és Kommunikációs Szabály
* **Tiszta Unicode szimbólumok:** Válaszokban, felületeken és dokumentációban szigorúan tilos LaTeX matematikai formázást (pl. `$\rightarrow$`, `\approx`, `\le`) használni; helyette mindig a tiszta Unicode szimbólumokat használd (`→`, `≈`, `≤`).

