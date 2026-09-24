# A-149: In-App Fejlesztői Napló (Patchnotes) Rendszer és Publikációs Pipeline

* **Státusz:** Elfogadva (Accepted)
* **Dátum:** 2026-09-24
* **Terület:** Platform Üzemeltetés / UI/UX / Adatbázis / AI Automatizáció

---

## 1. Kontextus és Problémafelvetés

Az eaisybill és eaisyBooks platformon a fejlesztői csapat napi szinten javít hibákat, optimalizálja az algoritmusokat és vezet be új képességeket.
A felhasználók (KKV tulajdonosok, könyvelők, asszisztensek) azonban korábban nem kaptak transzparens és közérthető visszajelzést a platform folyamatos fejlődéséről:
* A Git commit üzenetek szárazak, technikai zsargonnal telítettek, az ügyfelek számára érthetetlenek.
* Szükségessé vált egy beépített, játék-szerű **patch note** rendszer, amely közvetlenül az applikációban tájékoztatja a felhasználókat arról, mi változott, milyen hibák hárultak el, és milyen előnyöket élvezhetnek napról napra.

## 2. Megoldási Opciók Mérlegelése

1. **Opció 1: Statikus Markdown / JSON fájl a kódbázisban**
   * *Előny:* Egyszerű fájlolvasás.
   * *Hátrány:* Minden egyes napi bejegyzés publikálásához git commit és frontend build/deploy folyamat szükséges. Az AI ágens nem tudja dinamikusan frissíteni a tartalmat a szerveren.
2. **Opció 2: Dinamikus PostgreSQL Adatbázis Tábla (`changelog_entries`) és RLS (Kiválasztott ⭐)**
   * *Előny:* Teljesen független a kódverziózástól; az AI ágensek vagy a menedzsment közvetlenül SQL-en / API-n keresztül tudnak új patch note-ot rögzíteni.
   * *Biztonság:* RLS védi az adatokat (bárki olvashatja a publikáltakat, de kizárólag adminisztrátorok írhatják).

## 3. Megvalósítás Részletei

### 3.1 Adatmodell (`public.changelog_entries`)
* **Migrációs fájl:** `supabase/migrations/20260924235000_create_changelog_entries.sql`
* **Mezők:**
  * `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  * `version text NOT NULL` (pl. `v2.2.5` vagy `2026.09.24`)
  * `release_date date NOT NULL DEFAULT current_date`
  * `title text NOT NULL` (Közérthető kiadási cím)
  * `summary text NOT NULL` (Előny-központú összefoglaló szöveg)
  * `category text NOT NULL DEFAULT 'feature'` (`feature` | `fix` | `improvement` | `perf`)
  * `app_scope text NOT NULL DEFAULT 'all'` (`all` | `eaisybill` | `eaisybooks`)
  * `items jsonb NOT NULL DEFAULT '[]'::jsonb` (Strukturált pontok: `type`, `title`, `description`)
  * `is_published boolean NOT NULL DEFAULT true`
* **Indexek:** `release_date DESC`, `is_published`, `category`, `app_scope`.

### 3.2 Hozzáférés-szabályozás (RLS)
* `SELECT`: Minden bejelentkezett felhasználó láthatja az `is_published = true` bejegyzéseket (illetve az adminok a vázlatokat is).
* `INSERT / UPDATE / DELETE`: Kizárólag Support Admin / Management szerepkör vagy Service Role.

### 3.3 Felhasználói Felület & Navigáció
* **Oldal:** [ChangelogPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/ChangelogPage.tsx)
* **Elrendezés:** Linear / Raycast stílusú vertikális idővonal (Timeline): bal oldalon a dátum és a verzió jelvény, jobb oldalon a strukturált kártya kiemelt pontokkal.
* **Menüpont ([AppSidebar.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx)):**
  * Pontosan a Tudástár (`/knowledge-base`) és a Hibajegyek (`/tickets`) között helyezkedik el.
  * Ikon: Lucide `Sparkles` (szigorúan emoji-mentes kód és megjelenítés).
  * Név: `Fejlesztői napló`
  * Értesítési pont / badge: `localStorage` utolsó látogatási időbélyeg alapján jelzi, ha új frissítés érkezett (`ÚJ` badge).

### 3.4 Teljes Magasságú Héj és Belső Flex Görgetés (Full-Height Shell & Scroll Containment)
A felület asztali élményének maximalizálása és a dupla görgetősávok elkerülése érdekében zárt flex-lánc került bevezetésre:
* **AppLayout ([AppLayout.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppLayout.tsx)):** A `<ContentArea>` a `location.pathname.includes('/changelog')` alapján deklaratívan `min-h-0 overflow-hidden flex flex-col p-6 h-full` osztályokat kap.
* **ScopedLayout ([ScopedLayout.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ScopedLayout.tsx)):** A belső burkoló `div` megkapta a `h-full flex flex-col flex-1 min-h-0` osztályokat, elkerülve a flex-lánc megszakadását a route-váltások során.
* **Timeline görgetés:** A fejléc (`ChangelogHeader`) rögzített (`shrink-0`), az alatta elhelyezkedő [ChangelogTimeline.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/changelog/ChangelogTimeline.tsx) pedig `flex-1 min-h-0 h-full overflow-y-auto` osztályt kap vékony görgetősávval (`[scrollbar-width:thin]`).
* **Skeleton placeholder:** Adatbetöltés közben a [ChangelogTimelineSkeleton.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/changelog/ChangelogTimelineSkeleton.tsx) shimmer animációval tölti ki a teret, megelőzve a layout ugrálásokat.

### 3.5 Automatizált AI Skill (`visibill-patchnote`)
* Készült egy dedikált ágens skill: [.agents/skills/visibill-patchnote/SKILL.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-patchnote/SKILL.md).
* A skill a commit üzenetekből vagy session logokból kinyeri az érdemi változásokat, átfordítja emberi nyelvre, és egyetlen jóváhagyási lépéssel közzéteszi a `changelog_entries` táblában (szigorúan emojik nélkül, Lucide ikonokkal).

---

## 4. Kapcsolódó
- [P-112: Fejlesztői Napló Idővonal UX](../../product/decisions/P-112-in-app-changelog-timeline-ux.md)
- [A-018: Hibajegy Rendszer Architektúra](./A-018-ticket-system.md)
- [A-105: Tudástár Adatmodell és RAG](./A-105-knowledge-base-schema-and-fts.md)
