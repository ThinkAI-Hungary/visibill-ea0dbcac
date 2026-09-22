---
name: visibill-pm-task-creator
description: Use when a Product Manager (PM) or user provides a rough, ambiguous, or brief task description, UI feature idea, bug report, or screenshot for Visibill / eaisyBill / eaisyBooks and needs a clear, professional, lean Task Brief / Ticket specification. Triggers on "új task", "task készítés", "írj egy taskot", "task leírás", "PM task", "pontosítsd a taskot", "task brief", "user story", "ticket", "funkció specifikáció", or when the user drops a vague feature idea (e.g. "lehessen legfelül váltani...", "kellene egy gomb a számlákhoz", "oldjuk meg a szűrést") or attaches UI screenshots/mockups for a new feature. Mandatorily inspects docs/ (GLOSSARY, PRD, BRD, ADR, Design docs) in the background, automatically saves the resulting task brief into a tasks/YYYY-MM-DD-<slug>.md file, and offers to create and assign the task directly in Asana via Asana API.
---

# Visibill PM Task Creator — Letisztult Task Brief & Asana Generátor

Ez a skill a **Product Managertől (PM)** vagy felhasználótól érkező vázlatos, hiányos vagy köznapi nyelven megfogalmazott ötleteket és csatolt képernyőképeket alakítja át **letisztult, átlátható, azonnal megérthető és tesztelhető Task Briefekké**, elmenti azokat `.md` fájlba, és **automatikusan létrehozza őket az Asanában a kijelölt fejlesztőhöz rendelve**.

---

## 🎯 A Skill Küldetése & Alapelvei

1. **Viszlát, felesleges tisztázó meetingek:**  
   A PM-ek gyakran röviden, vázlatosan írják le az ötletet (pl. *„lehessen legfelül váltani, hogy keltezésre vagy telejesítésre szűrjek Időszaknál”*). A fejlesztők és a csapat számára ebből egyértelmű, funkcionális leírást kell készíteni, elkerülve az időrabló egyeztetéseket.
2. **KÖTELEZŐ Háttér-Docs Keresés (`docs/` olvasása):**  
   ⛔ **Szigorúan tilos a levegőből specifikálni!** Az asszisztens a háttérben **KÖTELES** átnézni a `docs/` dokumentációt (különösen a `docs/GLOSSARY.md`, a PRD-ket `docs/product/decisions/`, a BRD-ket `docs/business/decisions/`, és a Design rendszert `docs/design/`), hogy megértse a meglévő működést, szabályokat és a hivatalos kifejezéseket.
3. **SZIGORÚAN TILOS A TECHNIKAI ZSARGON ÉS KÓD A BRIEFBEN:**  
   ⛔ **Ne terheld a PM-et fejlesztői részletekkel!**  
   A briefbe **TILOS** kódblokkokat, SQL lekérdezéseket (`SELECT`, `WHERE`), React hookokat (`useContext`, `useState`), belső fájlútvonalakat vagy specifikációs kódokat (pl. *„P-066”*, *„A-085”*, *„Fejlesztői háttér-infó”*) beleírni! A brief tisztán funkcionális és felhasználó-központú legyen.
4. **KÖTELEZŐ MENTÉS MARKDOWN FÁJLBA (`tasks/` mappa):**  
   Az elkészült task briefet az ágens **KÖTELES azonnal elmenteni** a projekt `tasks/YYYY-MM-DD-<slug>.md` fájljába, és a chat válaszban kattintható hivatkozást adni rá.
5. **ASANA TASK LÉTREHOZÁS FELAJÁNLÁSA & ASSIGN:**  
   A brief kiadása és mentése után az ágens felajánlja a feladat létrehozását Asanában, és a PM jóváhagyása/felelős megadása után azonnal létrehozza azt az Asana API-n keresztül.

---

## 🔄 A Teljes Munkafolyamat (6 Lépés)

```
1. BEMENET & KÉP ──► 2. HÁTTÉR DOCS ──► 3. TISZTÁZÁS (HA KELL) ──► 4. TASK BRIEF ──► 5. MENTÉS .MD-BE ──► 6. ASANA LÉTREHOZÁS
  (Vázlat + Kép)      (Csendes olvasás)      (Tömör A/B kérdés)        (Letisztult)       (tasks/YYYY-MM-DD-*.md)      (Felelős hozzárendelés)
```

---

## 1. LÉPÉS: Bemenet Elemzés & Kép-Kiértékelés

1. **Szöveges szándék kibontása:** Mi a kért funkcionalitás lényege hétköznapi szavakkal?
2. **Csatolt képek / mockupok átvizsgálása:**
   - Melyik oldal és milyen nézet látható a képen?
   - Milyen vezérlők vannak a képen (pl. fejléc időszakszűrő, táblázat lapozó)?
   - Van-e jelölés, nyíl vagy megjegyzés a képen?
3. **Köznyelvi kifejezések leképezése:**
   - Nézd át a segédletet:
     `view_file d:\ThinkAI\Visibill\eaisybill-prod\.agents\skills\visibill-pm-task-creator\references\pm-glossary-mapping.md`

---

## 2. LÉPÉS: Kötelező Háttér-Docs Keresés (CSENDBEN, A HÁTTÉRBEN)

> ⚠️ **Házirend:** A `docs/` specifikációkat mindig olvasd el a háttérben, hogy megértsd a működési logikát, de a talált technikai kódneveket és spec-számokat NE másold bele a briefbe!

- **Glossary & Terminológia:** `docs/GLOSSARY.md` (pl. keltezés = kiállítás dátuma, teljesítés = teljesítés napja).
- **Termék- és üzleti döntések:** `docs/product/decisions/` és `docs/business/decisions/` (megérteni a korábbi logikát és szabályokat).
- **Design & Layout:** `docs/design/05-layout-navigation.md` (megérteni, hol van a felső sáv, a fejléc vagy az oldalsáv).

---

## 3. LÉPÉS: Tisztázó Kérdések (Csak ha valóban elágazás van!)

Ha van egy kritikus termékdöntés, tedd fel a brief legelején 1 tömör A/B kérdésben:

*Példa:*
> **❓ Kérdés a pontosításhoz:**  
> A szűrő csak a Számlák és Dashboard nézetre vonatkozzon, vagy teljesen globálisan minden nézetre?  
> - **A)** Csak a Számlák és Dashboard oldalakra.  
> - **B)** Univerzálisan minden oldalra.

---

## 4. LÉPÉS: A Letisztult PM Task Brief Generálása

Generáld le a feladatot a `references/task-brief-template.md` alapján.

### A brief KIZÁRÓLAG az alábbi 4 blokkból állhat:

```markdown
# 🎫 [Task] [Feladat tömör megnevezése]

### 🎯 Cél és Funkció
[1-2 bekezdés: mi a jelenlegi hiányosság és mit akarunk elérni emberi nyelven.]

### 📍 Felületi elhelyezkedés
* **Hol:** [A képernyő és a felületi blokk pontos helye hétköznapi nyelven.]
* **Megjelenés:** [Hogyan nézzen ki vizuálisan, pl. gombcsoport, kapcsoló.]

### ⚙️ Működési logika
1. **Alapértelmezés:** [Mi az alapállapot az oldal megnyitásakor.]
2. **Kattintáskor / Használatkor:** [Mi történik pontosan a felületen.]
3. **Időszak / Szűrők megőrzése:** [Hogyan viselkednek az egyéb kapcsolódó mezők.]
4. **Megjegyzés:** [pl. Maradjon meg az URL-ben frissítéskor.]

### ✅ Elfogadási kritériumok (Teszteléshez)
- [ ] [1. ellenőrizhető feltétel]
- [ ] [2. ellenőrizhető feltétel]
- [ ] [3. ellenőrizhető feltétel]
- [ ] [4. ellenőrizhető feltétel]
- [ ] [5. ellenőrizhető feltétel]
```

⛔ **Emlékeztető:** Se kód, se SQL, se fejlesztői jegyzet nem szerepelhet a briefben!

---

## 5. LÉPÉS: Automatikus Mentés `.md` Fájlba (`tasks/`)

1. **Fájl mentése:**
   - Mentés helye: `tasks/YYYY-MM-DD-<slug>.md` (a projekt gyökerében lévő `tasks/` mappába).
   - *Példa:* `tasks/2026-09-21-globalis-teljesites-keltezes-datumszuro.md`.
2. **Kattintható link a válaszban:**
   - A chat válaszban a brief felett **kötelező feltüntetni a mentett fájl kattintható linkjét**:
     `💾 **Mentve:** [YYYY-MM-DD-<slug>.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/tasks/YYYY-MM-DD-<slug>.md)`

---

## 6. LÉPÉS: Asana Task Létrehozás, Szekció, Felelős & Határidő Hozzárendelése

A mentett brief után az ágens megkérdezi a PM-et a 3 kulcsfontosságú adatról:
> *„Szeretnéd, hogy létrehozzam a feladatot az Asanában?*  
> *Ha igen, kérlek add meg:*  
> *1. 📁 **Projekt & Szekció:** Melyik projektbe és kategóriába kerüljön? (Alapértelmezett: Visibill Dev / ACCOUNTY ÉS VISIBILL BŐVÍTÉS vagy ÚJ feature-ök)*  
> *2. 👤 **Felelős (Assignee):** Kire assignoljam a fejlesztők közül? (pl. Jani, Vali, Simi, Dani, Zombi)*  
> *3. 📅 **Határidő (Due date):** Mi legyen a task határideje? (pl. péntek, jövő hétfő, 3 nap, vagy konkrét dátum: YYYY-MM-DD)”*

Amikor a PM megadja az adatokat (pl. *„Igen, mehet a Visibill Dev-be az ÚJ feature-ök alá, assignold Simire jövő hétfőre”*), az ágens futtatja a segédszkriptet:
```bash
node .agents/skills/visibill-pm-task-creator/scripts/asana.cjs create-task \
  --file tasks/YYYY-MM-DD-<slug>.md \
  --project "Visibill Dev" \
  --section "ÚJ feature-ök" \
  --assignee "Simi" \
  --due "jövő hétfő"
```

> 👑 **Kollaborátor szabály:** A rendszer **Schwarczinger János** felhasználót **MINDIG automatikusan hozzáadja kollaborátorként (collaborator / follower)** a taskhoz, ha nem ő maga a kijelölt felelős (assignee)!
> 🌐 **Dinamikus Élő API Lekérdezés:** Az asszisztens és a szkript **mindig közvetlenül az Asana API-t kérdezi le** futásidőben (`list-users`, `list-sections`, `list-projects`). Nem használ merev, beégetett felhasználó- vagy szekciólistákat.
> 🛡️ **Dinamikus 1-2 Karakteres Typo Tolerancia & Nulla Téves Assign (Zero Wrong Assign):**
>   - Ha a PM elgépeli a nevet vagy toldalékot használ (pl. *„Schwartzinger”*, *„Valntin”*, *„Fekes Ati”*, *„Simire”*, *„Daninak”*), a rendszer intelligens token és Levenshtein távolság alapján dinamikusan feloldja a helyes Asana tagot.
>   - **Biztonsági korlát:** Ha egy megadott név nem azonosítható biztonsággal (vagy több személyre egyaránt illeszkedne), a rendszer **SOHA nem rendel hozzá véletlenszerű vagy téves fejlesztőt**, hanem figyelmeztetést ad és tisztázást kér a PM-től!
>   - *„Jani” / „Janira” / „Janinak” / „Morfi”* $\rightarrow$ **Schwarczinger János**
>   - *„Vali” / „Valentinre” / „Valentin”* $\rightarrow$ **valentin.varga@skyrocketgroup.hu**
>   - *„Dani” / „Danira” / „Dániel”* $\rightarrow$ **Dániel Nagy**
>   - *„Robi” / „Robira” / „Róbert” / „Simi” / „Simire”* $\rightarrow$ **Róbert Simon**
>   - *„Zombi” / „Zombira” / „Zombinak” / „Márk”* $\rightarrow$ **Zombi (Zombori Márk)**
>   - *„Ati” / „Atira” / „Atinak” / „Attila”* $\rightarrow$ **Fekecs Attila**
> 📅 **Dinamikus & Elgépelés-biztos Határidő-kezelés (Zero Wrong Date):**
>   - A rendszer felismeri és pontos dátummá alakítja a magyar természetes nyelvű kifejezéseket, még 1-2 karakteres elgépelés vagy írásjel-eltérés esetén is:
>     - *„ma”*, *„holnap”*, *„holnp”*, *„holnapután”*
>     - *„hétfő”*, *„kedd”*, *„szerda”*, *„csütörtök”*, *„csutortk”*, *„péntek”*, *„péntk”*, *„péntekre”*, *„péntekig”*
>     - *„jövő hétfő”*, *„jövő péntek”*
>     - *„3 nap”*, *„+3 nap”*, *„3 nap múlva”*, *„1 hét”*, *„2 hét”*
>     - *„szeptember 25.”*, *„szept. 28”*, *„szeptemnbr 25”*, *„09.28.”*, *„2026. 09. 25.”*, *„2026-09-30”*
>   - **Biztonsági korlát:** Ha a megadott szöveg nem értelmezhető dátumként, a rendszer **SOHA nem állít be téves dátumot** (nem állít be mai napot vagy véletlen évet), hanem figyelmeztet!
> 📑 **Dinamikus Szekció-feloldás:** Az Asanában a kategóriákat **Szekcióknak (Sections)** hívják. A szkript az API-ból kéri le a projekt aktuális szekcióit, és elgépelés esetén is a legmegfelelőbb kategóriába rendezi a feladatot (pl. *„accounty bovites”* $\rightarrow$ **ACCOUNTY ÉS VISIBILL BŐVÍTÉS**, *„uj feture”* $\rightarrow$ **ÚJ feature-ök**, *„reported bug”* $\rightarrow$ **Reported Bugs**).

A sikeres lefutás után az ágens visszadja az Asana linket és a feloldott adatokat:
> *„✅ Task sikeresen létrehozva az Asanában:*  
> *🔗 **[Feladat Neve](https://app.asana.com/1/.../task/...)**  
> *📁 **Projekt:** Visibill Dev  
> *📑 **Kategória / Szekció:** ACCOUNTY ÉS VISIBILL BŐVÍTÉS  
> *👤 **Felelős:** Schwarczinger János (notbyalongway@gmail.com)  
> *📅 **Határidő:** 2026-09-25 (Péntek)  
> *👥 **Kollaborátor:** Schwarczinger János”*
