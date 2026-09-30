# P-144: ÁFA A60 Közösségi Összesítő és VIES Keresztellenőrzés UX

**Status:** Decided  
**Date:** 2026-09-30  
**Category:** Adózás & ÁFA Modul (`/vat-return`)  
**Scope:** `src/features/vat/components/VatA60Table.tsx`, `src/features/vat/components/VatCalculatorView.tsx`, `src/features/vat/components/VatRowDrillDown.tsx`  

---

## 1. Üzleti Háttér és Probléma

A határon átnyúló Közösségen belüli kereskedelmet vagy szolgáltatásnyújtást végző magyar vállalkozásoknak kötelező benyújtaniuk a havi/negyedéves A60-as összesítő nyilatkozatot. A NAV kockázatelemző rendszere automatikusan összeveti a benyújtott 65-ös ÁFA bevallás adóalapjait az A60 nyilatkozaton szereplő partner-szintű összesítésekkel. Eltérés esetén azonnali adóhatósági megkeresés és felszólítás következik.

A könyvelők számára a korábbi folyamat az alábbi akadályokat okozta:
1. **Szétszórt adatok és hiányzó bizonylatok:** A külföldi technológiai számlák (Google Ireland, Meta, Hetzner, AWS) nem a NAV Online Számlából, hanem közvetlen PDF feltöltésekből érkeznek. Ha az A60 felület nem jeleníti meg a bejövő számlákat, a könyvelő kénytelen külön Excel táblákban kézzel összesíteni a tételeket.
2. **Sorbesorolási bizonytalanság:** Nem volt egyértelmű, hogy egy adott közösségi tétel a 65-ös bevallás melyik sorára (02, 11–16, 91–92, vagy 18/67) tartozik.
3. **Kényelmetlen VIES ellenőrzés:** Az uniós adószámok érvényességének vizsgálatához a könyvelőnek egyenként át kellett másolnia a partner adószámokat az Európai Bizottság külső VIES weboldalára.

---

## 2. Megoldás és Felületi Működés

### 2.1 Dedikált „A60 Közösségi” Fül az ÁFA Rendszerben (`VatCalculatorView.tsx`)
Az ÁFA bevallási felületen a megszokott lapfülek (65-ös főlap, Éves mátrix, Tételes M-lap, Fordított adózás) mellett önálló fülként jelenik meg az **„A60 Közösségi”** összesítő modul.

### 2.2 4-Kártyás Összefüggés-vizsgálati Fejléc
A felület legfelső sávjában 4 interaktív KPI kártya jelenik meg, amelyek azonnal összevetik az A60 analitika összegeit a 65-ös bevallás megfelelő soraival:

```
┌─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┐
│ 1. 02. Sor          │ 2. 11–16. Sor       │ 3. 91–92. Sor       │ 4. 18. Sor          │
│ Közösségi termék    │ Közösségi termék    │ Közösségi szolg.    │ Közösségi szolg.    │
│ értékesítés         │ beszerzés           │ nyújtás (export)    │ igénybevétel        │
├─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤
│ 1 250 000 Ft        │ 3 420 000 Ft        │ 5 800 000 Ft        │ 850 000 Ft          │
│ [ ✓ Teljes egyezés] │ [ ✓ Teljes egyezés] │ [ ⚠️ -120 000 Ft ]  │ [ ✓ Teljes egyezés] │
└─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘
```

- **Teljes egyezés (Zöld jelvény):** Ha az A60-as összesített adóalap fillérre megegyezik a 65-ös bevallás adott sorának összegével.
- **Eltérés figyelmeztetés (Borostyán badge):** Ha eltérés van a két kimutatás között, a kártya kiemeli a számszaki különbséget, és tooltipben megmagyarázza a lehetséges okokat (pl. még nem jóváhagyott számla, hiányzó közösségi adószám formátum).

### 2.3 4-Lapfüles Belső Szerkezet (`VatA60Table.tsx`)
Az A60 nyilatkozat hivatalos felépítését tükröző 4 lapfül választható a táblázat felett:
1. **01-es lap — Közösségi termékértékesítés (`goods_out`):** Értékesített termékek adómentes értékesítése EU-s adóalany felé.
2. **02-es lap — Közösségi termékbeszerzés (`goods_in`):** EU tagállamból beszerzett termékek önadózása.
3. **03-as lap — Közösségi szolgáltatásnyújtás (`services_out`):** Áfa tv. 37. § (1) szerinti export szolgáltatások.
4. **04-es lap — Közösségi szolgáltatás igénybevétele (`services_in`):** Külföldi szolgáltatóktól (Google, Meta, Hetzner, AWS) igénybe vett szoftverek és szolgáltatások fordított adózása.

### 2.4 Valós Idejű VIES Ellenőrzés és Partner Jelvények
- **„VIES ellenőrzés” Akciógomb:** A táblázat eszköztárában elhelyezett dedikált gomb mindig aktív és kattintható.
- **Kötegelt Ellenőrzés:** Egyetlen kattintásra a rendszer végigmegy az adott lapfülön szereplő összes partner adószámán, és meghívja az Európai Bizottság REST API-ját.
- **Vizuális Státuszok a Partner Táblázatban:**
  - `Érvényes VIES` (Zöld badge): Az adószám érvényes, hivatalos regisztrált cégnév és cím jelenik meg a tooltipben.
  - `Érvénytelen VIES` (Piros badge): Az adószám nem létezik az uniós adatbázisban vagy megszűnt, azonnali könyvelői beavatkozás szükséges.
  - `Nincs ellenőrizve` (Szürke badge): Még nem futott le az ellenőrzés az aktuális munkamenetben.
  - `VIES hiba` (Sárga badge): Az uniós központi szerver átmenetileg nem érhető el vagy időtúllépés lépett fel.

### 2.5 Partner Összesítés és Tételes Számlafúrás (Drill-Down)
- A táblázat partnerek szerint összesítve mutatja a sorokat: Partner neve, Közösségi adószám, Tagállam kódja, Számlák darabszáma, Nettó adóalap forintban, VIES státusz.
- **Sorlenyitás (Expandable Row):** A partner sora lenyitható, ahol azonnal láthatóvá válik az összes érintett számla: bizonylatszám, teljesítés kelte, devizanem, devizás összeg és forint adóalap.
- **1-kattintásos Bizonylatmegnyitás:** A számlaszámra kattintva azonnal megnyílik a számlakép előnézet a `VatRowDrillDown` komponensen keresztül.

---

## 3. Kapcsolódó
- [BDR 064: A60 Közösségi ÁFA Összesítő és 65-ös Bevallás Összefüggés-vizsgálat](../../business/decisions/064-a60-community-vat-and-vies-crosscheck.md)
- [ADR A-181: A60 Közösségi ÁFA Összesítő, VIES Integráció és 65-ös Bevallás Összefüggés-Architektúra](../../architecture/decisions/A-181-a60-community-vat-and-vies-crosscheck.md)
- [PRD P-093: ÁFA Analitika Oszlopelrendezés és Valós Nettó Megjelenítés UX](./P-093-vat-analytics-net-revenue-and-column-layout-ux.md)
