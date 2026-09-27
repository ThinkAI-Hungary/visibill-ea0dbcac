# A-167: NAV 2665 Hivatalos Nyomtatvány Digitális Replika Architektúra

**Állapot:** Elfogadva (Accepted)  
**Dátum:** 2026-09-27  
**Döntéshozó:** Architecture, Tax & Frontend Engineering Team  
**Kapcsolódó döntések:** P-126, A-080, A-131, A-156, A-159, P-097  

---

## 1. Döntési Kontextus és Felhasználói Igény

A magyar vállalkozások és könyvelők az ÁFA bevallásaikat (2665 / 2565 / 2465) a Nemzeti Adó- és Vámhivatal (NAV) Általános Nyomtatványkitöltő (ÁNYK) programjában nyújtják be.
Bár a rendszer képes volt ÁNYK-kompatibilis XML és PDF export generálására (ADR A-080, A-131), a könyvelők számára a korábbi egyszerűsített kártyás megjelenítés nem nyújtott elégséges biztonságérzetet:
1. **Megszokott vizuális formátum hiánya:** A könyvelők évtizedek óta az ÁNYK hivatalos rovatait, sorait (01–95. sorok), karakterdobozait és többoldalas lapstruktúráját (Főlap, 01-01, 01-02, 01-03, 01-05, 07, 08) használják a zárás ellenőrzésére.
2. **Statikus PDF-generálás lassúsága és merevsége:** A szerveroldali PDF generálás másodperceket vesz igénybe, nem reagál azonnal a könyvelési módosításokra, és nehezen navigálható laponként.
3. **"Semmit a kéznek, mindent a szemnek" alapelv:** A könyvelőnek nem egy újabb szerkeszthető beviteli űrlapra van szüksége, hanem egy determinisztikus, kizárólag olvasásra szolgáló digitális tükörképre, amely közvetlenül az adatbázisból (`vat_returns`, `vat_return_lines`, `vat_return_m_lines`, `companies`) töltődik fel és 1-kattintással azonnal újraszámolható.

---

## 2. Architektúra Döntés

Úgy döntöttünk, hogy a `src/features/vat/components/replica/` modularizált feature modulban felépítünk egy **100%-ban natív React / HTML / CSS alapú, hivatalos ÁNYK 2665 digitális nyomtatvány replikát**, amely pixelpontosan modellezi az állami nyomtatványt, miközben teljes mértékben reaktív és valós idejű.

### 2.1 Komponens Hierarchia és Felelősségek

```
src/features/vat/components/replica/
├── Nav2665CoatOfArms.tsx       # Hivatalos Magyar Címer SVG vektoros grafika (Főlap fejrész)
├── Nav2665CharBox.tsx          # Szegmentált karakterdobozok (adószám 8-1-2, bankszámla 3x8, dátumok)
├── Nav2665TableRow.tsx         # Standard ÁNYK sorkomponens (b/c oszlopok, ezer Ft felirat, sraffozott mezők)
├── Nav2665PageFrame.tsx        # A4 nyomtatvány keret (ÁNYK fej- és lábléc, hivatalos figyelmeztetés)
├── Nav2665SheetFolap.tsx       # 2665A Főlap (Rovat A, B, C, D, F kötelező mezőkkel)
├── Nav2665Sheet0101.tsx        # 2665A-01-01 Fizetendő adó (01–36. sorok, 27%, 18%, 5%, FAD 29, 36. összesen)
├── Nav2665Sheet0102.tsx        # 2665A-01-02 Tájékoztató adatok (37–62) és levonható adó kezdete (63–71)
├── Nav2665Sheet0103.tsx        # 2665A-01-03 Levonható adó folytatása (72–79), elszámolás (82–86) és 88–95
├── Nav2665Sheet0105.tsx        # 2665A-01-05 6/A, 6/B melléklet (100–103) és 2665M partner/számla összesítő
├── Nav2665Sheet07.tsx          # 2665A-07 Fordított adózású acéltermék értékesítés (04. sor részletező)
├── Nav2665Sheet08.tsx          # 2665A-08 Fordított adózású acéltermék beszerzés (66. sor részletező)
├── Nav2665ReplicaContainer.tsx # Vezérlő sáv (Toolbar), lapfülek, zoom (80-125%), KPI banner, DB újraszámítás
└── index.ts                    # Tiszta publikus barrel export
```

### 2.2 Determinisztikus Adatkötés (Data Binding)

A komponensek semmilyen belső származtatott számítási logikát nem rejtenek el; kizárólag a már kiszámított adatbázis rekordokból és a társasági adatokból dolgoznak:
- **`vat_return_lines` map:** `getVal(row, col)` segédfüggvény O(1) sebességgel olvassa ki az adott sorszám alapját (`base_amount`) és adóját (`tax_amount`).
- **eFt Kerekítés:** Az ÁNYK szabályai szerint a nyomtatvány minden forint adatot ezer forintra kerekítve (`Math.round(val / 1000)`) jelenít meg.
- **Sraffozott (nem kitölthető) mezők:** Az ÁNYK-ban a nem kitölthető mezők diagonális sraffozással jelennek meg; a komponens tiszta SVG diagonális mintát alkalmaz (`pattern id="hatch"`).

### 2.3 Vezérlés és Ergonómia

1. **Lapválasztó fülek (Sheet Switcher Pills):**
   - Főlap, 01-01, 01-02, 01-03, 01-05.
   - Feltételes lapfülek: a 07-es lap és 08-as lap fülek automatikusan aktiválódnak, ha az időszakban szerepelnek Áfa tv. 6/B szerinti acéltermék adatok (`useSteelProductsData`).
   - „📑 Összes lap egyben” nézet: folyamatos görgethető áttekintést nyújt a teljes 5–7 lapos nyomtatványcsomagról.
2. **Skálázás & Zoom:**
   - 80%, 90%, 100%, 110%, 125% skálázó gombok CSS `scale()` és `transform-origin: top center` segítségével.
3. **Élő Adatbázis Újraszámítás (`calculate_vat_return` RPC):**
   - Az eszköztár tartalmaz egy közvetlen "Adatok frissítése DB-ből" gombot, amely meghívja a Supabase tárolt eljárást, és az onSuccess eseményével azonnal újratölti a nézetet anélkül, hogy a böngészőablak újratöltődne.
4. **Nyomtatási Stíluslapok (`@media print`):**
   - Az eszközsáv és a navigációs elemek nyomtatáskor eltűnnek (`print:hidden`).
   - Minden egyes `Nav2665PageFrame` lap `page-break-after: always; break-after: page;` direktívát kap, így közvetlenül a böngésző Nyomtatás dialógusából szabványos A4-es papírlapokra nyomtatható.

---

## 3. Következmények és Előnyök

### Pozitív
- **100%-os könyvelői bizalom:** A könyvelő a saját megszokott hivatali környezetében ellenőrizheti a számokat az ÁNYK XML letöltése és beküldése előtt.
- **Azonnali reakcióidő:** Nulla szerveroldali PDF renderelési késleltetés; a lapok közötti váltás 0ms-os SPA tranzakció.
- **Nulla beviteli hiba:** A felület szigorúan olvasható (`read-only`), megelőzve az ÁNYK XML és a könyvelési nyilvántartás közötti deszinkronizációt.
- **FAD Acélipari integráció:** Az acélipari fordított adózású tételek automatikusan kitöltik a 01-05 lap összefoglalóját, valamint a 07/08 részletező íveket.

### Negatív / Kockázatok
- **Törvényi formanyomtatvány-változások:** Éves NAV nyomtatványváltáskor (pl. 2665 -> 2765) a rovat- és sorszám-struktúrát felül kell vizsgálni. A komponensek modularitása miatt ez laponként izoláltan elvégezhető.

---

## 4. Kapcsolódó Dokumentáció
- **PRD:** [P-126: NAV 2665 Hivatalos Nyomtatvány Digitális Replika UX](../../product/decisions/P-126-nav-2665-official-tax-form-digital-replica-ux.md)
- **Kapcsolódó ADR:** [A-080: NAV ÁNYK 2665 XML Export](./A-080-nav-anyk-vat-return-xml-standardization.md)
- **Kapcsolódó ADR:** [A-131: NAV 2665 Sormegfeleltetés és 6/B Acélipar](./A-131-nav-2665-vat-return-restructuring-and-steel-reporting.md)
- **Kapcsolódó ADR:** [A-156: Horvát Obrazac PDV Replika](./A-156-croatian-vat-return-obrazac-pdv-and-tax-codes.md)
