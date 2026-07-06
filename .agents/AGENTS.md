# Visibill Development & Escalation Rules

## 🔄 Eszkalációs Fejlesztési Folyamat (Escalation Workflow)

Minden fejlesztési feladatot egy szigorú, komplexitás alapú eszkalációs folyamaton kell végigvezetni:

```
                  [ Feladat Indítása ]
                           │
                           ▼
               1. visibill-spec-lookup
           (Specifikációk & kontextus keresése)
                           │
                           ├────────────────────────┐
                           ▼                        ▼
                [ Egyszerű / Közepes ]          [ Komplex ]
                    (1-5 érintett fájl,      (5+ érintett fájl, új táblák,
                     ismert UI/kód minták)    migrációk, új architektúra)
                           │                        │
                           ▼                        ▼
                  2. visibill-dev           2. visibill-feature-planner
                (Lite TDD fejlesztés)      (Nagy tervezési & végrehajtási skill)
```

---

## 📋 Szabályok & Irányelvek

### 1. Első lépés: Specifikáció és Kontextus Keresés (`visibill-spec-lookup`)
* **Kötelező:** Bármilyen kérésnél az első lépés a `visibill-spec-lookup` beolvasása és a specifikációk felkutatása. Ekkor határozza meg az Agent a feladat komplexitását és a követendő mintákat (patterns).

### 2. Kis és Közepes skálás feladatok: `visibill-dev` (Lite)
* Ha a feladat 1-5 fájlt érint, és nem vezet be új adatbázis-táblákat, Edge Function-öket vagy mélyreható strukturális változásokat:
  * **Kötelező** a [visibill-dev](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-dev/SKILL.md) skill betöltése.
  * Ugyanazt a szigort képviseli, mint a feature-planner (baseline build, TDD / Prove-It pattern tesztelés, smoke testing), de a kisebb skálához igazított, gyorsabb ciklussal.

### 3. Nagy skálás / Komplex feladatok: `visibill-feature-planner`
* Ha a feladat 5+-nál több fájlt érint, új DB táblát/migrációt hoz be, vagy nem definiált architektúra döntést igényel:
  * **Kötelező** a [visibill-feature-planner](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-feature-planner/SKILL.md) skill betöltése.
  * Ebben a fázisban kötelező az implementation plan (tervezési dokumentum) elkészítése, döntési mátrixok felállítása a user felé és a micro-modulokra bontott, sub-agent alapú megvalósítás.

### 4. Adatbázis-módosítások és döntések (Database Operations)
* **Kötelező:** Bármilyen olyan feladatnál, döntéspontnál vagy kódolásnál, ami **adatbázishoz nyúl** (új tábla, migráció, RPC függvény, RLS szabályok, frontend vagy worker Supabase lekérdezések):
  * **Kötelező** beolvasni és végrehajtani a [visibill-db-checklist](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-db-checklist/SKILL.md) ellenőrző listáit.
  * A checklist használata során **kötelező** betölteni és követni a **`supabase`** ([supabase/SKILL.md](file:///~/.gemini/config/skills/supabase/SKILL.md)) és a **`supabase-postgres-best-practices`** ([supabase-postgres-best-practices/SKILL.md](file:///~/.gemini/config/skills/supabase-postgres-best-practices/SKILL.md)) skillek biztonsági és teljesítménybeli irányelveit. No silent decisions elv érvényes az adatbázis sémák és indexek módosítására is.

### 5. React Frontend Fejlesztés (React Frontend Development)
* **Kötelező:** Bármilyen olyan feladatnál, ami **React frontend kódhoz nyúl** (komponensek, oldalak, hookok, állapotkezelés, styling):
  * **Kötelező** betölteni és követni a **`vercel-react-best-practices`** ([react-best-practices/SKILL.md](file:///C:/Users/Morfi/.gemini/config/skills/react-best-practices/SKILL.md)) skillben található Vercel és React best practices irányelveket (különös tekintettel a felesleges re-renderelések megelőzésére, a helyes state management-re és a teljesítmény-optimalizációra).
