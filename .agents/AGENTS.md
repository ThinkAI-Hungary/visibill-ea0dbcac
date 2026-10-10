# Visibill Development & Escalation Protocol

## 🎯 5 Nem-alkuképes Alapelv (Core Invariants)
1. **Zero Silent Decisions:** Architektúrális, adatbázis- vagy üzleti logikai döntést soha ne hozz önhatalmúan; mindig vázold fel az opciókat a felhasználónak.
2. **Evidence Before Assertions:** Soha ne állítsd, hogy egy módosítás működik vagy kész van, amíg meg nem bizonyosodtál róla (gyors oxlint ellenőrzés: `npm run lint:fast` vagy `npx oxlint <fájl>`, típusellenőrzés: `npm run build` vagy `npx tsc --noEmit`, valamint kötelező tesztek futtatása: `npm test`).
3. **Docs & Spec Integrity (Thin Rule + Deep Spec):** Ha a kód struktúrája, sémája vagy üzleti logikája változik, a kapcsolódó specifikációknak és ADR-eknek szinkronban kell maradniuk. A szabályok (`.agents/rules/`) kizárólag a tömör védőkorlátokat és invariánsokat rögzítik, a mély háttérmagyarázatokat és döntéseket kötelező ADR-be vagy Design specifikációba kivezetni.
4. **Zero Workspace Clutter & Scratch Folder Discipline:** Szigorúan tilos bármilyen átmeneti segédfüggvényt, ellenőrző vagy debug szkriptet (`.js`, `.cjs`, `.ts`, `.py`), adatbázis dumpot vagy ideiglenes SQL-t (`.sql`), kinyert riportot vagy szövegfájlt a projekt gyökérkönyvtárába (`/`) létrehozni! Minden ilyen segédanyagot kötelezően és kizárólag a `scratch/` mappába (`d:\ThinkAI\Visibill\eaisybill-prod\scratch\`) kell menteni, amelyet a `.gitignore` automatikusan kezel. A projekt gyökere kizárólag a tényleges, konfigurációs és forrásfájlokat tartalmazhatja.
5. **Environment & Branch Isolation (Dev vs Prod Boundary):** Amikor a `develop` ágon vagy az eaisybill-dev környezetben dolgozol, KÖTELEZŐ elolvasni a `docs/DEV/` dokumentációt, a `develop` ágra váltáskor KÖTELEZŐ azonnal `git pull`-lal indítani, minden adatbázis-műveletet KIZÁRÓLAG a Dev DB-be (`qhvcdqkqpgpdxogqqvyr`) szabad végezni, és AZONNAL meg kell állnod és figyelmeztetned kell a felhasználót, ha `develop` ágon állva éles DB-t vagy `main` ágat érintő utasítás érkezik! Hibajegyek (`/ticket-support`) és rendszerhibák (`/visibill-error-hunter`) javítása esetén KÖTELEZŐ a `develop` ágon dolgozni és a Dev DB-ben tesztelni az élesítés előtt! **A `main` ágba történő merge-eléskor, ha a diffben adatbázis-migrációk szerepelnek, azokat KÖTELEZŐ elvégezni az éles (Prod) adatbázison is a feladat lezárása előtt!**

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
| **Develop ág / eaisybill-dev munka** | docs/DEV/ kötelező elolvasása, kizárólag Dev DB használat, Prod művelet esetén kötelező azonnali figyelmeztetés. | [rules/dev-environment.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/dev-environment.md) |
| **Egyszerű / Közepes módosítás (1–4 fájl)** | Célzott fejlesztés, TDD szemlélet, majd build validáció. | [rules/frontend.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/frontend.md), [visibill-dev](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-dev/SKILL.md) |
| **Adatbázis / Migráció / RPC / RLS / Edge Function** | Tilos azonnal SQL-t futtatni. Sématerv felvázolása, checklist és kliensvédelem. | [rules/database.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/database.md), [rules/edge-functions.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/edge-functions.md), [visibill-db-checklist](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-db-checklist/SKILL.md), [supabase](file:///C:/Users/Morfi/.gemini/config/skills/supabase/SKILL.md), [supabase-postgres-best-practices](file:///C:/Users/Morfi/.gemini/config/skills/supabase-postgres-best-practices/SKILL.md) |
| **Rendszerhiba audit / Log elemzés (`/visibill-error-hunter`)** | Éles naplók és hibatáblák feltárása (read-only), javítás és tesztelés KÖTELEZŐEN a `develop` ágon és Dev DB-ben. | [visibill-error-hunter](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-error-hunter/SKILL.md), [rules/dev-environment.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/dev-environment.md) |
| **Hibajegy kezelés / Support (`/ticket-support`)** | Éles adatok read-only feltárása, kód/RPC/séma javítás KÖTELEZŐEN a `develop` ágon és Dev DB-ben, tesztelés és jóváhagyás után merge `main`-re. | [visibill-ticket-support](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-ticket-support/SKILL.md), [rules/dev-environment.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/dev-environment.md) |
| **Merge main ágba (Production Release)** | Migrációs diff ellenőrzés (`supabase/migrations/`), éles DB migrációk KÖTELEZŐ futtatása és schema reload. | [rules/database.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/database.md), [rules/dev-environment.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/dev-environment.md), [visibill-migration-sync](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-migration-sync/SKILL.md) |
| **Git Push / Supabase Deploy előtt** | Migrációk szinkronizálása és verziózási integritás ellenőrzése a távoli DB-vel. | [visibill-migration-sync](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-migration-sync/SKILL.md) |
| **Nagy léptékű feladat (5+ fájl, új modul)** | Specifikációk feltérképezése, `implementation_plan.md` készítése és jóváhagyatása kötelező. | [visibill-spec-lookup](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-spec-lookup/SKILL.md), [visibill-feature-planner](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-feature-planner/SKILL.md) |

---

## 📋 Szakterületi Szabályok és Minőségbiztosítás

* **Fejlesztői környezet (DEV) és ágkezelési szabályzat:** docs/DEV/ kötelező olvasás, Dev Supabase határvonal, mismatch figyelmeztetési protokoll → [rules/dev-environment.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/dev-environment.md)
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

