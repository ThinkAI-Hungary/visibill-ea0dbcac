# Session Summary — 2026-09-25

* **Időpont:** 2026-09-25 00:42
* **Azonosító:** `summary-004218-changelog-patchnotes`
* **Projekt:** Visibill / eaisybill-prod

---

```text
feat(changelog): In-App Fejlesztői Napló (Patchnotes) rendszer, deklaratív belső flex-scroll és automatizált AI publikációs pipeline

- In-App Fejlesztői Napló (Changelog & Patchnotes) teljes end-to-end megvalósítása
  - PostgreSQL adatbázis séma és RLS migráció (`supabase/migrations/20260924235000_create_changelog_entries.sql`):
    - `public.changelog_entries` tábla létrehozása (id, version, release_date, title, summary, category, app_scope, items JSONB, is_published, created_by)
    - Row Level Security (RLS) házirendek: publikált bejegyzések olvasása minden bejelentkezett felhasználónak, módosítás kizárólag support admin / service role számára
    - Teljesítmény-optimalizált B-Tree indexek: `release_date DESC`, `category`, `app_scope`, `is_published`
  - Teljes magasságú, deklaratív héj és elszigetelt belső görgetés (Full-Height Shell & Internal Scroll Containment):
    - Gyökérok elhárítása: a `ScopedLayout` és `AppLayout` közötti meg nem határozott blokk-magasság miatt korábban a külső oldal görgött vagy a viewport alja levágódott
    - `src/components/AppLayout.tsx`: `<ContentArea>` deklaratív adaptációja (`location.pathname.includes('/changelog')` esetén `min-h-0 overflow-hidden flex flex-col p-6 h-full`)
    - `src/components/ScopedLayout.tsx` és `src/pages/Accounty/AccountyScopedLayout.tsx`: a burkoló konténer felkészítése a teljes magasságú flex-láncra (`h-full flex flex-col flex-1 min-h-0`)
    - `src/components/changelog/ChangelogTimeline.tsx`: a fejléc rögzített marad (`shrink-0`), kizárólag a timeline kap függetlenített belső görgetést (`flex-1 min-h-0 overflow-y-auto`) finom zöld scrollbar stílusokkal (`[scrollbar-width:thin]`)
  - Vizuális stabilitás és elcsúszásmentes (Layout Shift-free) UI vezérlők:
    - Modulválasztó tabok (`Mindkét modul`, `eaisyBill`, `eaisyBooks`) ugrálásának megszüntetése: egységes `font-medium` betűsúly, állandó 1px alapkeret és `transition-colors`
    - Kategória szűrőbadge-ek eltolódásának kiküszöbölése: dinamikus `Összes (X)` számláló kiváltása statikus `Összes` feliratra és `transition-colors` alkalmazása
    - Felesleges "Aktuális" szöveges badge eltávolítása a kártyákról, helyette diszkrét zöld kiemelő szegély és árnyék (`border-primary/50 ring-1 ring-primary/20`)
    - Szigorú emoji-mentesség: a felületen és a kódokban kizárólag tiszta Lucide SVG ikonok használata (`Sparkles`, `Wrench`, `Zap`, `Plus`, `CheckCircle2`, `Layers`, `Tag`)
  - Animált csontváz-betöltő (`src/components/changelog/ChangelogTimelineSkeleton.tsx`):
    - Shimmer effektes placeholder a dátumok, vertikális pontok és strukturált kártyaelemek számára, megelőzve az aszinkron betöltéskori villanást
  - Navigációs és oldalsáv integráció:
    - `src/components/AppSidebar.tsx`: új "Fejlesztői napló" menüpont elhelyezése pontosan a Tudásbázis és a Hibajegyek között, olvasatlan állapotot jelző pulzáló zöld `ÚJ` kapszulajelvénnyel
    - `src/routes/eaisybillRoutes.tsx` és `src/routes/accountyRoutes.tsx`: `/changelog` route regisztrálása
  - Automatizált AI publikációs skill (`.agents/skills/visibill-changelog-publish/SKILL.md`):
    - Dedikált prompt és publikációs protokoll, amely git commmitokból közvetlenül közérthető, játék-stílusú patchnote rekordokat hoz létre Supabase-ben frontend újradeploy nélkül

- Hibajavítások és kódkarbantartás
  - `src/pages/Accounty/ProfileSettingsPage.tsx`: hiányzó `onChangeEmail` prop implementálása és összekötése `ChangeEmailDialog` komponenssel a `SecuritySection`-ben
  - `src/components/ScopedLayout.tsx`: hiányzó `common:` i18n névtér prefixek pótlása (`common:access_denied.*`), megszüntetve a fordítási hibákat

- Minőségbiztosítás és tesztelés (QA)
  - `src/test/changelog/changelog.test.tsx`: 3/3 unit teszt sikeresen lefutott (szűrések, üres állapot és bejegyzés renderelés)
  - `src/test/layoutPersistence.test.tsx`: 1/1 navigációs layout teszt sikeres
  - Szigorú TypeScript típusellenőrzés: `npx tsc --noEmit` hibátlanul lefutott (0 hiba)

- Dokumentáció szinkronizáció (/visibill-doc-sync)
  - Új PRD létrehozása és regisztrálása: `docs/product/decisions/P-112-in-app-changelog-timeline-ux.md` és `docs/product/decisions/index.md` (107 döntésre frissítve)
  - Új ADR pontosítása: `docs/architecture/decisions/A-149-in-app-changelog-and-patchnotes-system.md` (full-height flex shell, RLS, emoji-mentesség)
  - Adatbázis séma leíró frissítése: `docs/architecture/database/19-platform-ops.md` (`changelog_entries` tábla, 14 táblára bővítve)
  - Oldalstruktúra és navigáció: `docs/product/information-architecture.md` (védett `/changelog` route) és `docs/design/05-layout-navigation.md` (AppLayout és ScopedLayout flex-containment)
  - Tudásgráf frissítése: `graphify update .` lefutott (21 208 csomópont, 36 235 él frissítve)
```
