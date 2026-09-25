---
name: visibill-patchnote
description: Generate and publish user-friendly patch notes / changelog entries to the Visibill/eaisybill changelog_entries database table following strict SemVer rules. Employs a goal-oriented tri-source intelligence engine analyzing git commits, corresponding docs (ADRs/PRDs/DB specs), and session-summary files over the past 48 hours (or user-defined date range). Use whenever the user asks to log daily fixes, publish a changelog entry, create patch notes, or update the developer log. Triggers on "/visibill-patchnote", "/patchnote", "/visibill-changelog-publish", "/changelog-publish", "fejlesztői napló bejegyzés", "publikáld a fejlesztői naplót", "írj patch note-ot", "frissítsd a fejlesztői naplót", "napi javítások naplózása", "logold a fejlesztést", "patchnote generálás", "changelog frissítés".
---

# Visibill Changelog & Patch Notes Publish Skill (/visibill-patchnote)

Ez a skill vezérli a Visibill és eaisyBooks **Fejlesztői napló** (`changelog_entries`) bejegyzéseinek automatikus generálását, determinisztikus SemVer verziózását és publikálását.
A cél, hogy a napi kódszintű javítások, refaktorálások és új funkciók ne száraz technikai commit üzenetként, hanem a felhasználók számára élvezetes, érthető és professzionális játék-stílusú patch note formájában kerüljenek az ügyfelek elé.

---

## 🎯 A Skill Célkitűzése (/goal Szemlélet)

A skill egy **kimerítő alaposságú tényfeltáró motor**. A cél:
1. **Teljes kontextus felderítése:** Tilos bármilyen érdemi fejlesztést, hibajavítást vagy funkciót figyelmen kívül hagyni az adott időszakból.
2. **Hárompilléres forráskutatás:** A commitok puszta címe nem elegendő; a skillnek kötelező áttekintenie a commitok diffjét, a kapcsolódó döntési dokumentációkat (ADR, PRD, DB leírók) és a részletes session-summary fájlokat.
3. **Kimerítő felbontás (Több bejegyzés elve):** Ha az időszak több független témát, modult vagy napot ölel fel, **tilos mindent egyetlen bejegyzésbe sűríteni**. A skillnek szükség esetén több különálló, önálló changelog bejegyzést kell terveznie és közzétennie megfelelő SemVer számozással.
4. **Futási garancia:** A skill addig nem zárhatja le a tervezési folyamatot, amíg a kiválasztott időszak összes érdemi módosítását fel nem dolgozta és igazolta a források alapján.

---

## ⏱️ Időablak Meghatározása (Alapértelmezett vs. Dinamikus)

* **Alapértelmezett időablak: Elmúlt 48 óra**
  Ha a felhasználó nem ad meg konkrét időintervallumot, a skill automatikusan az elmúlt 48 óra commitjait és összefoglalóit vizsgálja:
  ```powershell
  git log --since="48 hours ago" --pretty=format:"%h | %ad | %s" --no-merges
  ```
* **Dinamikus időablak (Felhasználói kijelölés):**
  Ha a felhasználó konkrét intervallumot jelöl meg a kérésben (pl. `/visibill-patchnote 2026-09-15..2026-09-20`, `elmúlt 1 hét`, `szeptember 18-tól`), a git lekérdezést az adott időszakra kell korlátozni:
  ```powershell
  git log --since="YYYY-MM-DD" --until="YYYY-MM-DD 23:59:59" --pretty=format:"%h | %ad | %s" --no-merges
  ```

---

## 🏛️ A Hárompilléres Adatgyűjtési Folyamat

```
               [ 1. Git Commitok & Diffek ]
                     (48h vagy egyedi tartomány)
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
[ 2. Dokumentációk Olvasása ]               [ 3. Session Summary Fájlok ]
  • ADR-ek (A-xxx)                            • session-summary/Jani/ & Áron/
  • PRD-k (P-xxx)                             • QA teszteredmények & refaktorok
  • DB sémák (docs/architecture/database/)    • Megvalósított döntések
         │                                               │
         └───────────────────────┬───────────────────────┘
                                 ▼
              [ 4. Szintézis & Teljes Felbontás ]
                  • Témák és modulok csoportosítása
                  • Több bejegyzésre bontás (ha indokolt)
                  • Determinisztikus SemVer léptetés
                                 │
                                 ▼
                     [ 5. Jóváhagyás & Publikálás ]
```

### 1. Pillér: Git Commitok & Fájlváltozások Feltérképezése
1. Kérd le az időszak commitjait a fenti `git log` paranccsal.
2. A jelentősebb commitoknál vizsgáld meg a módosított fájlok listáját és a diff lényegét:
   ```powershell
   git show --stat <commit_hash>
   ```

### 2. Pillér: Kapcsolódó Dokumentumok Kötelező Olvasása (Spec-Lookup)
* **Kódok azonosítása:** Figyeld a commit üzenetekben szereplő hivatkozásokat (pl. `A-147`, `P-111`, `EB-0178`, `BRD 058`).
* **Dokumentumok felkeresése és elolvasása:**
  - Architektúrális döntések: `docs/architecture/decisions/A-*.md`
  - Termékdöntések: `docs/product/decisions/P-*.md`
  - Adatbázis sémák: `docs/architecture/database/*.md` (pl. `19-platform-ops.md`, `20-tickets.md`, `06-invoices.md`)
  - Felületi tervek: `docs/design/*.md`
* **Kötelező akció:** A skill **fizikailag olvassa be a vonatkozó fájlt a `view_file` eszközzel**, hogy megértse a valós üzleti hátteret, az ügyféloldali hasznot és a lehetséges mellékhatásokat.

### 3. Pillér: Session Summary Bejegyzések Beolvasása (Csapat-szintű Összefoglalók)
* A Visibill projekten két fejlesztő dolgozik: **Jani** (`session-summary/Jani/`) és **Áron** (`session-summary/Áron/`).
* A skillnek a vizsgált időszakban (pl. 48 óra vagy a megadott dátumtartomány) **mindkét fejlesztő** aznapi mappáit kötelezően fel kell térképeznie és beolvasnia:
  - `session-summary/Jani/YYYY-MM-DD/*.md`
  - `session-summary/Áron/YYYY-MM-DD/*.md`
  *(Valamint a `session-summary/` bármely más almappáját, ha új fejlesztő csatlakozik).*
* **Miért kritikus a kétirányú beolvasás:** Jani minden nap végén futtatja a `/visibill-patchnote` parancsot a napi kiadás publikálásához. Áron lokálisan a saját `Áron` mappájába logol, majd felpusholja a repóba. A skill Áron összefoglalóinak beolvasásával teljes képet kap a csapattárs által elvégzett backend/frontend javításokról, így az ő munkája is azonnal, hiánytalanul bekerül a termékfrissítések közé.
* A session összefoglalók tartalmazzák a pontos hibaleírásokat, lefuttatott teszteket, refaktorált komponenseket és a döntési elveket.

### 4. Pillér: Már Publikált Bejegyzések Kiszűrése
Kérdezd le az adatbázis legfrissebb bejegyzéseit, hogy megelőzd a duplikációt:
```sql
SELECT id, version, release_date, title FROM public.changelog_entries ORDER BY release_date DESC, created_at DESC LIMIT 5;
```

---

## 🎯 SemVer Verziózási Szabályzat (`vX.Y.Z`)

A rendszer szigorú Szemantikus Verziózást (Semantic Versioning) követ: **`vMAJOR.MINOR.PATCH`** (pl. `v2.3.0`, `v2.3.1`).

### 1. Bázis Verzió Beolvasása (Single Source of Truth)
1. Kódbázisból: `src/config/version.ts` (`APP_VERSION`).
2. Adatbázisból:
   ```sql
   SELECT version FROM public.changelog_entries ORDER BY release_date DESC, created_at DESC LIMIT 1;
   ```
   Ha `vX.Y.Z` formátumú: `major = X`, `minor = Y`, `patch = Z`.

### 2. Determinisztikus Léptetési Döntési Fa
* **MINOR léptetés (`vX.(Y+1).0`):**
  * **Mikor:** Ha a kiadás **legalább 1 új felhasználói funkciót** tartalmaz (`category === 'feature'` VAGY az `items` listában van legalább egy `type: 'new'` bejegyzés).
  * **Szabály:** A `minor` eggyel nő, a `patch` nullázódik (pl. `v2.2.5` $\to$ `v2.3.0`).
* **PATCH léptetés (`vX.Y.(Z+1)`):**
  * **Mikor:** Ha a kiadás **kizárólag hibajavításokat, stabilitási javításokat vagy sebességoptimalizálásokat** tartalmaz (csak `fix`, `improvement`, `perf` és **nincs** új funkció).
  * **Szabály:** A `patch` eggyel nő, a `minor` változatlan marad (pl. `v2.3.0` $\to$ `v2.3.1`).
* **MAJOR léptetés (`v(X+1).0.0`):**
  * **Mikor:** Korszakos platform-mérföldkő esetén. **Az AI soha nem léptet önhatalmúan MAJOR-t**, kizárólag a felhasználó kifejezett jóváhagyásával.
* **Több bejegyzés egymás utáni léptetése:**
  * Ha az időszak 2 vagy több különálló kiadásra bomlik, a SemVer léptetést szekvenciálisan kell végrehajtani (pl. 1. bejegyzés: `v2.3.1`, 2. bejegyzés: `v2.3.2` vagy új funkció esetén `v2.4.0`).

---

## 💎 Fogalmazási Szabályok & Invariánsok

1. **Szigorúan Tilos Emojik Használata:**
   - Sem a címekben, sem a leírásokban, sem a felsorolásokban NEM használunk emojikat (tilos a rakéta, villám, csavarkulcs stb. emoji karakter).
   - A felhasználói felület kizárólag Lucide SVG ikonokkal (`Sparkles`, `Wrench`, `Zap`, `CheckCircle2`, `Layers`, `Search`) és tiszta tipográfiával dolgozik.
2. **Felhasználó-Központú Nyelvezet:**
   - Rossz példa: "Refaktoráltuk a `can_access_ticket` RPC-t, lefutott az `npm run build`, fixed unhandled promise rejection a mutation hookban."
   - Helyes példa: "Stabilabbá és gyorsabbá tettük a könyvelőirodai jogosultság-kezelést, így a munkatársak zavartalanul és azonnal láthatják a közös hibajegyeket."
3. **Előny-Orientált Megfogalmazás:**
   - Mindig emeld ki, miért jó ez a felhasználónak (pl. időt spórol, nem akad el a felület, nem ragad be az ablak, tisztább adatok).
4. **Strukturált Kategóriák & Típusok:**
   - `new` (Új funkció): vadonatúj képesség, menüpont vagy gomb. (Lucide: `Sparkles`)
   - `fix` (Hibajavítás): elhárított bug, korábbi hibaüzenet vagy elakadás megoldása. (Lucide: `Wrench`)
   - `perf` / `improvement` (Gyorsítás & Fejlesztés): gördülékenyebb működés, kényelmi finomhangolás. (Lucide: `Zap`)
5. **Zero Silent Decisions:**
   - Az adatbázisba szúrás és kódmódosítás előtt a generált szövegtervezeteket és verziószámokat **mindig mutasd be a felhasználónak jóváhagyásra**.

---

## 🔄 Végrehajtási Lépések (Execution Protocol)

### 1. Lépés: Mélyreható Anyaggyűjtés
Futtasd le a 3 pillér lekérdezéseit:
- Git commitok és kulcsdiffek
- Releváns specifikációk olvasása (`docs/architecture/decisions/`, `docs/product/decisions/`, stb.)
- Releváns `session-summary/` fájlok olvasása

### 2. Lépés: Szintézis és Csoportosítás
- Döntsd el, hogy egyetlen kiadásba tömöríthető az anyag, vagy logikailag/időrendileg indokolt **több külön bejegyzésre bontani** (pl. dátumonként vagy funkcióterületenként).
- Határozd meg a SemVer verzió(ka)t.

### 3. Lépés: Tervezet Összeállítása és Jóváhagyás
Mutasd be a felhasználónak az összes tervezett bejegyzést:

```markdown
### Tervezett Fejlesztői Napló Bejegyzés(ek):

#### 1. Kiadás: v2.3.1 (2026.09.25) [PATCH léptetés]
* **Cím:** [Kiadás címe]
* **Összefoglaló:** [1-2 mondatos bevezető]
* **Főbb pontok:**
  - [Új funkció] **[Cím]:** [Rövid magyarázat]
  - [Javítás] **[Cím]:** [Rövid magyarázat]

Publikálhatom ezt a bejegyzést és szinkronizálhatom a verziót (`src/config/version.ts` és `package.json`)?
```

### 4. Lépés: Háromszoros Publikálás & Kódszinkron
A jóváhagyás után hajtsd végre mindhárom lépést:

#### A) Adatbázis beszúrás (`supabase-visibill` execute_sql):
Beszúrás a `public.changelog_entries` táblába a jóváhagyott adatokkal és `is_published: true` értékkel.

#### B) Kódbázis verzió szinkronizáció ([src/config/version.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/config/version.ts)):
* **Mikor frissül:** Ha a publikált kiadás az aktuális legfrissebb termékverzió (vagyis nem egy múltbeli elmaradt dátum pótlása), akkor **kötelező átírni az `APP_VERSION`-t és az `APP_BUILD_DATE`-et**:
  ```ts
  export const APP_VERSION = 'vX.Y.Z';
  export const APP_BUILD_DATE = 'YYYY.MM';
  ```
  *(Ez azonnal és dinamikusan frissíti a ChangelogHeader fejlécben lévő badge-et is).*

#### C) Projekt csomagverzió szinkronizáció ([package.json](file:///d:/ThinkAI/Visibill/eaisybill-prod/package.json)):
* A `package.json` fájlban a `"version"` mezőt frissítsd a megfelelő SemVer értékre:
  ```json
  "version": "X.Y.Z",
  ```

### 5. Lépés: Minőségellenőrzés & Verifikáció
1. Rekord lekérdezése adatbázisból ellenőrzésképpen.
2. Típusellenőrzés: `npx tsc --noEmit`.
3. Kattintható visszajelzés a felhasználónak a [/changelog](http://localhost:8080/changelog) elérési útvonalról.
