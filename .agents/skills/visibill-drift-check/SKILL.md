---
name: visibill-drift-check
description: Automatikus spec vs kód drift detektálás. Aktiválódik a visibill-spec-lookup-ból, az érintett terület azonosítása UTÁN, mielőtt bármilyen implementáció vagy tervezés elkezdődik. Lefuttatható önállóan is "/drift-check <terület>" paranccsal. Ne aktiválódjon csak dokumentáció módosításoknál, kizárólag styling-jellegű kéréseknél.
---

# Visibill Drift Check — Spec vs Kód Konzisztencia

> **Cél:** Mielőtt bármi tervbe kerül, ellenőrizd hogy a releváns specifikáció állításai még mindig igazak-e a kódban. A drift nem hiba — természetes következménye a fejlesztésnek. A cél: tudatosan kezeljük, ne véletlenszerűen fedeztük fel.

---

## Mikor fut le?

**Automatikusan** — a `visibill-spec-lookup` 2.5-ös lépéseként, miután:
1. Az érintett terület azonosítva (pl. "számlák", "auth", "tranzakciók")
2. A releváns spec(ek) kiválasztva

**Manuálisan** — ha a user kéri: "/drift-check <terület>" vagy "ellenőrizd a specet"

**NE fusson** ha:
- Csak dokumentáció módosítás (ADR/PRD szöveg javítás)
- Kizárólag styling-jellegű kérés (szín, betűméret, ikon csere)
- A task kifejezetten a spec frissítése (nem a kód ellenőrzése)

---

## A 5 Verifikálható Claim Típus

Ezeket KELL ellenőrizni — a többit (UX leírások, "legyen intuitív", business értelmezések) NEM.

| # | Típus | Példa spec-ből | Mit keresünk a kódban |
|---|-------|-----------------|----------------------|
| **1** | **Enum értékek** | status: pending/processing/paid | TypeScript típus, DB enum, React szűrő opciók |
| **2** | **Tábla / mező nevek** | invoices.company_id, company_members | migration fájl, supabase query, RPC input |
| **3** | **RLS / jogosultsági szabály** | "Csak az owner látja" | migration SQL, auth.uid() check |
| **4** | **API / Edge Function path** | /functions/v1/send-email | Edge Function index.ts, frontend fetch URL |
| **5** | **TypeScript interface nevek** | Invoice, Company, UserRole | src/types/, hook return típusok |

---

## A Drift Check Folyamata

### Lépés 1: Terület vs Spec Mapping

Az érintett területből határozd meg melyik spec(ek)-et kell ellenőrizni:

```
view_file d:\ThinkAI\Visibill\eaisybill-prod\.agents\skills\visibill-drift-check\references\area-spec-map.md
```

### Lépés 2: Verifikálható Claim-ek Kinyerése

Olvasd el a releváns spec-et (csak a szükséges szekciókat — ne töltsd be az egészet).

**Keresési sablon spec-ben:**
```
enum-re: "lehet" / "típus" / "státusz" / "|" karakterrel elválasztott lista
mező névre: backtick-es snake_case / "tábla:" / "mező:"
RLS-re: "csak" / "jogosult" / "látja" / "hozzáférhet"
EF path-ra: "/functions/v1/" / "edge function" / "endpoint:"
TS típusra: "interface" / "típus neve:" / PascalCase
```

Rögzítsd a kinyert claim-eket:
```
EXTRACTED CLAIMS:
C1: [claim szövege — spec forrás: P-010, sor ~45]
C2: [claim szövege — spec forrás: A-003, sor ~12]
```

### Lépés 3: Kód Ellenőrzés (claim-enként)

Minden claim-re grep vagy view_file a releváns kód területen.

**Keresési sorrendek típus szerint:**

| Claim típus | Hol keressünk |
|-------------|---------------|
| Enum | src/types/, src/hooks/, supabase/migrations/ |
| Mező nevek | supabase/migrations/, src/hooks/, supabase/functions/ |
| RLS | supabase/migrations/ (legújabb policies migration) |
| EF path | supabase/functions/*/index.ts, src/ fetch hívások |
| TS típus | src/types/, src/hooks/, src/components/ |

> **Max 3-4 grep / 2 view_file claim-enként** — ha nem találod 3 lépésen belül, jelöld NEMELLENOrizHETO.

### Lépés 4: Drift Riport Összeállítása

```markdown
## Drift Check — [Terület neve] ([spec referenciák])

| Claim | Spec állítás | Kód állapot | Eredmény |
|-------|-------------|-------------|----------|
| C1 | status: pending/processing/paid | draft/sent/paid/overdue (useInvoices.ts:23) | DRIFT |
| C2 | company_id kötelező mező | invoices.company_id NOT NULL (migration) | STIMMEL |
| C3 | Csak owner látja a számláit | auth.uid() = company_members.user_id (policy) | STIMMEL |
| C4 | "Legyen intuitív" | — | NEM VERIFIKÁLHATÓ |

**Összesítés:**
- STIMMEL: X claim
- DRIFT: Y claim
- NEM VERIFIKÁLHATÓ: Z claim
```

### Lépés 5: Döntés

```
Ha DRIFT = 0:
  Spec konzisztens — folytasd a tervezéssel.
  Megjegyzés: "Spec verified — [X] claim ellenőrizve"

Ha DRIFT > 0:
  STOP — Drift megtalálva! NE tervezz a driftes spec alapján.
  Kérdezd a usert:
  "A [spec forrás] szerint [claim], de a kódban [valóság].
   Melyik a helyes kiindulópont?
   a) A spec helyes — frissítjük a kódot
   b) A kód helyes — frissítjük a specet
   c) Mindkettő részben helyes — egyeztessük"
```

---

## Riport Formátumok (kontextus alapján)

### Teljes riport (ha drift van, vagy first-time check területen)
A teljes táblázatot add ki — minden claim-mel.

### Gyors összefoglaló (ha nincs drift)
```
Spec Drift Check: [Terület] — [X] claim ellenőrizve, 0 drift. Tervezés folytatható.
```

### Drift esetén (mindig blokkoló)
```
DRIFT DETECTED — [N] eltérés ([spec]) — Tisztázás szükséges tervezés előtt.
```

---

## Mire NEM pazaroljuk az időt

```
Nem ellenőrzendő:
- Abstract UX claims ("legyen egyszerű", "intuitív")
- Business context leírások ("a könyvelők számára hasznos")
- Jövőbeli tervek ("majd később hozzáadjuk")
- Nem a task-kal kapcsolatos spec területek
- Teljes spec fájl végigolvasása — csak a verifikálható claim-ek
```

---

## Verification

Drift check után:

- [ ] Az érintett terület spec-jeinek verifikálható claim-jei mind megvizsgálva
- [ ] Minden DRIFT eset felszínre került a usernek döntésre
- [ ] Ha 0 DRIFT — "Spec verified" megjegyezve a session kontextusban
- [ ] Ha DRIFT — implementáció NEM indult a user döntése előtt
- [ ] Nem-verifikálható claim-ek nem blokkolják a folyamatot
