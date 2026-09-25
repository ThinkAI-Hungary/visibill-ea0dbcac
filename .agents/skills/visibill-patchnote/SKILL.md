---
name: visibill-patchnote
description: Generate and publish user-friendly patch notes / changelog entries to the Visibill/eaisybill changelog_entries database table following strict SemVer rules. Employs a goal-oriented tri-source intelligence engine analyzing git commits, corresponding docs (ADRs/PRDs/DB specs), and session-summary files over the past 48 hours (or user-defined date range). Supports multi-entry chunking, splitting independent features, bugfixes, and modules into separate, sequentially versioned changelog entries based on context and scope size. Use whenever the user asks to log daily fixes, publish a changelog entry, create patch notes, or update the developer log. Triggers on "/visibill-patchnote", "/patchnote", "/visibill-changelog-publish", "/changelog-publish", "fejlesztői napló bejegyzés", "publikáld a fejlesztői naplót", "írj patch note-ot", "frissítsd a fejlesztői naplót", "napi javítások naplózása", "logold a fejlesztést", "patchnote generálás", "changelog frissítés".
---

# Visibill Changelog & Patch Notes Publish Skill (/visibill-patchnote)

Ez a skill vezérli a Visibill és eaisyBooks **Fejlesztői napló** (`changelog_entries`) bejegyzéseinek automatikus generálását, determinisztikus SemVer verziózását, több-bejegyzéses logikai darabolását és publikálását.
A cél, hogy a napi kódszintű javítások, refaktorálások és új funkciók ne száraz technikai commit üzenetként, hanem a felhasználók számára élvezetes, érthető és professzionális játék-stílusú patch note formájában kerüljenek az ügyfelek elé.

---

## 🎯 A Skill Célkitűzése (/goal Szemlélet)

A skill egy **kimerítő alaposságú tényfeltáró és kontextus-kiértékelő motor**. A cél:
1. **Teljes kontextus felderítése:** Tilos bármilyen érdemi fejlesztést, hibajavítást vagy funkciót figyelmen kívül hagyni az adott időszakból.
2. **Hárompilléres forráskutatás:** A commitok puszta címe nem elegendő; a skillnek kötelező áttekintenie a commitok diffjét, a kapcsolódó döntési dokumentációkat (ADR, PRD, DB leírók) és mindkét fejlesztő (Jani és Áron) részletes session-summary fájljait.
3. **Dinamikus Kontextus & Terjedelem szerinti Felbontás (Multi-Entry Chunking):** 
   Ha az időszak több független témát, modult vagy nagyobb mennyiségű módosítást ölel fel, **szigorúan tilos mindent egyetlen gigantikus bejegyzésbe sűríteni**. A skillnek a kontextus mérete és logikai összefüggései alapján **akár 2, 3 vagy több különálló, önálló changelog bejegyzést** kell terveznie, szekvenciális SemVer számozással.
4. **Futási garancia:** A skill addig nem zárhatja le a tervezési folyamatot, amíg a kiválasztott időszak összes érdemi módosítását fel nem dolgozta és igazolta a források alapján.

---

## 🧩 Logikai Darabolási Szabályzat (Multi-Entry Chunking Heuristics)

A changelog célja a tiszta felhasználói tájékoztatás. A felbontási motor az alábbi heurisztikák alapján dönti el, hogy egyetlen vagy több különálló bejegyzést javasoljon:

```
                          [ Napi Változások Halmaza ]
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
      [ 1 Bejegyzés Elegendő ]                     [ Több Bejegyzésre Bontás ]
  • Egyetlen összefüggő téma                   • Több külön modul (pl. eaisybill vs eaisybooks)
  • Legfeljebb 3-5 fókuszált pont              • Témaköri divergencia (pl. ÁFA vs DB RPC vs UI fix)
  • Nincs éles modul-különbség                 • 6+ különálló, nem azonos célú módosítás
                                               • Jani és Áron független nagy fejlesztései
                                               • Új nagy funkció + független gyorsjavítások
```

### 1. Mikor elegendő 1 bejegyzés?
* A nap/időszak minden módosítása egyetlen funkcionális területre vagy fókuszra irányult (pl. kizárólag a Számlaszerkesztő modal optimalizálása és kapcsolódó apró javításai).
* A kinyert bullet pointok száma **3–5 pont között van**, amelyek logikailag egyetlen átfogó cím alá rendezhetők anélkül, hogy a téma szétesne.

### 2. Mikor KÖTELEZŐ vagy ERŐSEN AJÁNLOTT több bejegyzésre bontani?
1. **Modul-divergencia (`app_scope` eltérés):**
   * Ha a módosítások között van tisztán **Könyvelés / Pénzügy** (`eaisybooks`: főkönyv, ÁFA kalkulátor, naplók, horvát adózás) ÉS tisztán **Számlázás** (`eaisybill`: NAV OSA számlaszinkron, számlaszerkesztő, PDF splitter) vagy **Platform / Adatbázis** (`all`: CTE refaktorálás, RLS, auth jogosultságok, rate limiter).
   * Ezek összevonása zavaros lenne a felhasználónak, így külön bejegyzést érdemelnek a saját `app_scope` mezőjükkel.
2. **Kognitív Terhelés & Tételszám korlát (Cognitive Load Limit):**
   * Ha az időszak összegyűjtött javításai és funkciói meghaladják az **5-6 érdemi elemet**, a skill felbontja az anyagot 2 vagy több fókuszált kiadásra (pl. "ÁFA és Könyvelési modul" + "Rendszerstabilitás & Partnertörzs javítások").
3. **Új Funkció (`feature`) vs. Rendszer Hotfixek:**
   * Egy jelentős új modul megjelenését (pl. Új Horvát ÁFA bevallás nyomtatvány) nem szabad elnyomni az apróbb adatbázis hibajavításokkal; az új funkció kapjon önálló kiadást, a hotfixek pedig egy különálló stabilitási kiadást.
4. **Párhuzamos Csapatmunka (Jani & Áron):**
   * Ha Jani és Áron a nap során két teljesen különböző területen végzett mélyreható munkát (pl. Jani adatbázis RPC-t refaktorált és partnertörzs görgetést javított, Áron pedig a bérszámfejtési exporton vagy NAV parseren dolgozott), a skill javasolja a két munkacsoport külön bejegyzésbe rendezését.

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
              [ 4. Szintézis & Multi-Entry Chunking ]
                  • Témák és modulok szétválogatása
                  • 1 vs. Több bejegyzés kalkulációja
                  • Szekvenciális SemVer léptetés
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

### 2. Determinisztikus Léptetési Szabályok
* **MINOR léptetés (`vX.(Y+1).0`):**
  * **Mikor:** Ha a kiadás **legalább 1 új felhasználói funkciót** tartalmaz (`category === 'feature'` VAGY az `items` listában van legalább egy `type: 'new'` bejegyzés).
  * **Szabály:** A `minor` eggyel nő, a `patch` nullázódik (pl. `v2.2.5` $\to$ `v2.3.0`).
* **PATCH léptetés (`vX.Y.(Z+1)`):**
  * **Mikor:** Ha a kiadás **kizárólag hibajavításokat, stabilitási javításokat vagy sebességoptimalizálásokat** tartalmaz (csak `fix`, `improvement`, `perf` és **nincs** új funkció).
  * **Szabály:** A `patch` eggyel nő, a `minor` változatlan marad (pl. `v2.3.0` $\to$ `v2.3.1`).
* **MAJOR léptetés (`v(X+1).0.0`):**
  * **Mikor:** Korszakos platform-mérföldkő esetén. **Az AI soha nem léptet önhatalmúan MAJOR-t**, kizárólag a felhasználó kifejezett jóváhagyásával.

### 3. Szekvenciális SemVer Kezelés Több Bejegyzés Esetén
Amennyiben a skill 2 vagy több bejegyzésre bontja a napi termést, a verziószámokat **egymást követően (szekvenciálisan)** kell inkrementálni:
* *Példa A (Két hibajavító csomag):*
  * Bázis verzió: `v2.3.0`
  * 1. Bejegyzés (Adatbázis CTE refaktor): `v2.3.1` (PATCH)
  * 2. Bejegyzés (Partnertörzs görgetés & layout fix): `v2.3.2` (PATCH)
* *Példa B (Új funkció + Hibajavítás):*
  * Bázis verzió: `v2.3.0`
  * 1. Bejegyzés (Horvát ÁFA bevallás modul - új funkció): `v2.4.0` (MINOR)
  * 2. Bejegyzés (Platform stabilitási javítások): `v2.4.1` (PATCH)
* **Kódszinkron Invariáns:** A kódbázis (`version.ts` és `package.json`) a legmagasabb sorszámú (utolsó) kiadás verzióját kapja meg (pl. `v2.3.2` vagy `v2.4.1`).

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
   - Az adatbázisba szúrás és kódmódosítás előtt a generált szövegtervezeteket, a darabolási struktúrát és a verziószámokat **mindig mutasd be a felhasználónak jóváhagyásra**.

---

## 🔄 Végrehajtási Lépések (Execution Protocol)

### 1. Lépés: Mélyreható Anyaggyűjtés
Futtasd le a 3 pillér lekérdezéseit:
- Git commitok és kulcsdiffek
- Releváns specifikációk olvasása (`docs/architecture/decisions/`, `docs/product/decisions/`, stb.)
- Releváns `session-summary/Jani/` és `session-summary/Áron/` fájlok olvasása

### 2. Lépés: Szintézis és Csoportosítás (Chunking & SemVer Tervezés)
- Vizsgáld meg a módosítások sokszínűségét és tételszámát a fenti **Logikai Darabolási Szabályzat** alapján.
- Határozd meg, hogy **1 vagy több (2, 3...) különálló kiadás** szolgálja a felhasználói érthetőséget a legjobban.
- Rendezd az elemeket logikai klaszterekbe (pl. Modul, Funkció vs Fix).
- Számítsd ki a szekvenciális SemVer verziókat (`vX.Y.Z`).

### 3. Lépés: Tervezet Összeállítása és Jóváhagyás
Mutasd be a felhasználónak az összes tervezett bejegyzést egyetlen áttekinthető blokkban:

```markdown
### 📋 Elemzési javaslat: 2 különálló Fejlesztői Napló bejegyzés

A mai módosítások két független területet érintenek, ezért az alábbi 2 fókuszált bejegyzés közzétételét javaslom:

---

#### 1. Kiadás: v2.3.1 (2026.09.25) [PATCH léptetés]
* **Modul (`app_scope`):** `eaisybooks` (Könyvelés & Pénzügy)
* **Kategória (`category`):** `improvement`
* **Cím:** Horvát ÁFA bevallási modul és adókód támogatás
* **Összefoglaló:** Bevezettük a horvát partnerek könyveléséhez és ÁFA kalkulációjához szükséges Obrazac PDV struktúrát...
* **Főbb pontok:**
  - [Új funkció] **Obrazac PDV nyomtatvány:** Automatikus ÁFA analitika generálás horvát jogszabályok szerint.
  - [Fejlesztés] **Többnyelvű könyvelési címkék:** Dinamikus horvát és magyar lokalizáció.

---

#### 2. Kiadás: v2.3.2 (2026.09.25) [PATCH léptetés]
* **Modul (`app_scope`):** `all` (Platform & Partnertörzs)
* **Kategória (`category`):** `fix`
* **Cím:** Adatbázis CTE stabilitás és gördülékeny Partnertörzs görgetés
* **Összefoglaló:** Megszüntettük a fájlböngésző 0A000 adatbázis hibáját, és feloldottuk a partnertörzs nézet merev konténer-korlátait...
* **Főbb pontok:**
  - [Hibajavítás] **Fájlböngésző memóriában futó CTE-k:** Megszűnt a PostgreSQL 0A000 DDL hiba, gyorsabb lapozás.
  - [Hibajavítás] **Partnertörzs felületi görgetés:** Megszűnt a lapozó és a cégadatok alsó levágása kisebb képernyőkön.

---
**Kódszinkronizáció:** A jóváhagyás után az alkalmazás verziója `v2.3.0` -> `v2.3.2`-re ugrik.
Publikálhatom a fenti bejegyzéseket az adatbázisba és frissíthetem a verziószámokat?
```

### 4. Lépés: Publikálás & Kódszinkron
A jóváhagyás után hajtsd végre a közzétételt:

#### A) Adatbázis beszúrás (`supabase-visibill` execute_sql):
Szúrd be az összes bejegyzést a `public.changelog_entries` táblába. Több bejegyzés esetén futtatható egyetlen SQL tranzakcióban vagy bejegyzésenként külön `INSERT` paranccsal:
```sql
INSERT INTO public.changelog_entries (
  version, release_date, title, summary, category, app_scope, items, is_published
) VALUES 
  (
    'v2.3.1', CURRENT_DATE, '...', '...', 'improvement', 'eaisybooks', '[...]'::jsonb, true
  ),
  (
    'v2.3.2', CURRENT_DATE, '...', '...', 'fix', 'all', '[...]'::jsonb, true
  );
```

#### B) Kódbázis verzió szinkronizáció ([src/config/version.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/config/version.ts)):
* **A legmagasabb (végső) SemVer verzió kerül be:**
  ```ts
  export const APP_VERSION = 'v2.3.2';
  export const APP_BUILD_DATE = '2026.09';
  ```

#### C) Projekt csomagverzió szinkronizáció ([package.json](file:///d:/ThinkAI/Visibill/eaisybill-prod/package.json)):
* A `package.json` fájlban a `"version"` mezőt frissítsd a végső SemVer értékre:
  ```json
  "version": "2.3.2",
  ```

### 5. Lépés: Minőségellenőrzés & Verifikáció
1. Rekordok lekérdezése adatbázisból ellenőrzésképpen.
2. Típusellenőrzés: `npx tsc --noEmit`.
3. Kattintható visszajelzés a felhasználónak a [/changelog](http://localhost:8080/changelog) elérési útvonalról.
