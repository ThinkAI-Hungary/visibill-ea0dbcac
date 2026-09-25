# Session Summary — 2026-09-25

* **Időpont:** 2026-09-25 01:11
* **Azonosító:** `summary-011100-semver-versioning-patchnote-skill`
* **Projekt:** Visibill / eaisybill-prod

---

```text
feat(patchnote): determinisztikus SemVer verziózási rendszer, 2 hetes visszamenőleges changelog idővonal és hárompilléres /visibill-patchnote AI publikációs motor

- Determinisztikus SemVer (vMAJOR.MINOR.PATCH) verziózási architektúra és kódszinkron
  - Központi alkalmazásverzió konfigurációs modul létrehozása (`src/config/version.ts`):
    - `APP_VERSION = 'v2.3.0'` és `APP_BUILD_DATE = '2026.09'` konstansok definiálása
    - Szinkronizáció a `package.json` fájllal (`"version": "2.3.0"`)
  - `src/components/changelog/ChangelogHeader.tsx` dinamizálása:
    - Korábbi statikus string badge (`v2.2.5 • build 2026.09`) kiváltása az új központi `APP_VERSION` és `APP_BUILD_DATE` importra
    - Zéró mellékhatás a rendszer többi moduljára: az architektúra kizárólag a nyilvántartást, fejlécet és a publikációs pipeline-t szolgálja
  - Szigorú SemVer döntési fa:
    - MINOR léptetés (`vX.(Y+1).0`), amennyiben a kiadásban új funkció (`feature` vagy `type: 'new'`) található
    - PATCH léptetés (`vX.Y.(Z+1)`), amennyiben a csomag kizárólag hibajavításokat, gyorsításokat vagy felületi finomhangolásokat (`fix`, `improvement`, `perf`) tartalmaz
    - MAJOR mérföldkő ugrás kizárólag a felhasználó kifejezett jóváhagyásával

- Visszamenőleges 2 hetes Fejlesztői Napló rekonstrukció és adatbázis publikálás
  - Több mint 80 git commit (2026.09.11 – 2026.09.25) mélyelemzése és 13 strukturált kiadás rögzítése a `public.changelog_entries` táblában
  - Kiemelt jogszabályi és szakmai funkciók beépítése az idővonalba:
    - DRS Kötelező Visszaváltási Díj (50 Ft) automatikus ÁFA-mentességi kezelése és analitikai elkülönítése (`v2.2.5`)
    - Számlaláncolat és kapcsolódó bizonylatok (előleg, végszámla, jóváíró) vizuális fa-struktúrája (`v2.2.5`)
    - Többmellékletes számlacsatolás, elcsúszásmentes előnézeti fülek és kötegelt daraboló (`v2.2.5`)
    - Magánszemély vevőnevek automatikus szinkronizációja a NAV OSA számlákhoz (`v2.2.5`)
    - Teljesítési dátum, kiállítás és fizetési határidő szerinti rugalmas számlaszűrés (`v2.2.3`)
    - Részletes számla- és tételszerkesztő modal (`InvoiceFullEditDialog`) automatikus összegrekalkulációval (`v2.2.3`)
    - Bérszámfejtési motor v3, többes jogviszonyok és interaktív bérjegyzék előnézet (`v2.1.7`)
    - Átutalások modul, Kintlévőség dashboard és NAV 08 KIVA/SZOCHO bérimport (`v2.1.0`)
  - Aggreg8 PSD2 Open Banking bejegyzés pontossági korrekciója (`v2.2.4`):
    - Élesítés szöveg cseréje valósághű Sandbox tesztüzemmódra az éles banki API jóváhagyásig

- A `/visibill-patchnote` AI skill továbbfejlesztése és /goal architektúrája
  - Skill átnevezése és könyvtár átmozgatása: `.agents/skills/visibill-patchnote/SKILL.md`
  - Kapcsolódó dokumentációk és döntési nyilvántartások frissítése (`A-149`, `P-112`, `19-platform-ops.md`, `version.ts`)
  - Hárompilléres mélyfeltáró adatgyűjtési motor bevezetése:
    1. Git commitok és kulcsdiffek vizsgálata (alapértelmezetten 48 óra, vagy dinamikusan kijelölt dátumtartomány)
    2. Kapcsolódó döntési dokumentációk (ADR, PRD, DB sémák, dizájn leírók) kötelező fizikai olvasása (`view_file`)
    3. Session summary összefoglalók kötelező feldolgozása a `session-summary/` könyvtárból
  - Információvesztés tilalma (Több bejegyzés elve):
    - Ha a kijelölt időszakban több önálló téma vagy funkciócsoport szerepel, tilos egyetlen bekezdésbe préselni; a skill több önálló changelog rekordot készít és publikál szekvenciális SemVer verziókkal
  - Háromszoros szinkronizáció kötelezettsége:
    - Supabase `changelog_entries` rekord beszúrás
    - `src/config/version.ts` `APP_VERSION` és `APP_BUILD_DATE` felülírása a legújabb kiadás esetén
    - `package.json` `"version"` mező frissítése

- Minőségbiztosítás, tesztelés és verifikáció (QA)
  - Szigorú TypeScript típusellenőrzés: `npx tsc --noEmit` hibátlan (0 hiba)
  - Unit tesztek: `src/test/changelog/changelog.test.tsx` sikeresen lefutott (3/3 passed)
  - Production build: `npm run build` sikeresen lefordult (17.86s, optimalizált bundle méretek)
  - Kódbázis tudásgráf szinkronizáció: `graphify update .` sikeresen frissítette a relációs gráfot (21 219 csomópont, 36 246 él)
```
