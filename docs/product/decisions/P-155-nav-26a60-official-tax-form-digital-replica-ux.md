# P-155: NAV 26A60 Hivatalos Nyomtatvány Digitális Replika UX

**Status:** Decided  
**Category:** eaisyBooks / ÁFA / Törvényi Riportok / Közösségi Adózás  
**Updated:** 2026-10-04  

---

## Question
Hogyan biztosítható a könyvelők számára a maximális biztonságérzet és a megszokott ÁNYK-élmény a havi/negyedéves Európai Közösségi Összesítő Nyilatkozat (26A60) ellenőrzése és NAV beküldése során?

---

## Decision

### 1. „Semmit a kéznek, mindent a szemnek” Read-Only Elv
A NAV 2665 ÁFA bevallás mintájára (P-126) a 26A60 digitális nyomtatvány replika (`VatNavA60Replica` / `Nav26A60ReplicaContainer`) szigorúan **csak olvasható (read-only)** ellenőrző felület.
- Nem tartalmaz manuális beviteli mezőket vagy deszinkronizálható inputokat.
- Az adatok determinisztikusan a rögzített EU-s kimenő és bejövő számlákból (`calculateA60Aggregations`) és a cégtörzsből származnak.

### 2. Hivatalos ÁNYK 26A60 Vizuális Lapszerkezet
A felület pixelpontosan modellezi a NAV által kiadott 6 lapos 26A60 nyomtatványt:
- **Magyar Címer és Hivatalos Fejléc:** Eredeti vektoros grafika a Nemzeti Adó- és Vámhivatal megnevezésével és a 26A60 formkóddal.
- **Karakterdobozos Mezők (Segmented Character Boxes):** Az adózó közösségi adószáma (`HU` + 8 karakterdoboz), dátumok és 2-karakteres EU országkódok (`[D][E]`, `[I][E]`).
- **Lapstruktúra:**
  - **Főlap (26A60):** Adózó neve, közösségi adószáma, ügyintéző neve és formázott telefonszáma, bevallási időszak (C rovat) és gyakoriság (`H` = havi, `N` = negyedéves, `É` = éves).
  - **26A60-01 Lap:** Közösségi termékértékesítések részletezése (`goods_out`, 24 sor + 25. Összesen eFt-ban).
  - **26A60-02 Lap:** Közösségi termékbeszerzések részletezése (`goods_in`, 24 sor + 25. Összesen eFt-ban).
  - **26A60-03 Lap:** Közösségi szolgáltatásnyújtások részletezése (`services_out`, 24 sor + 25. Összesen eFt-ban).
  - **26A60-04 Lap:** Közösségi szolgáltatás igénybevételek részletezése (`services_in`, 24 sor + 25. Összesen eFt-ban).
  - **26A60-05 Lap:** Közösségi vevői készlet átmozgatás.

### 3. Eszköztár és Felületi Integráció
- **Kétirányú elérés:**
  1. Az **A60 Közösségi** fülön belül beépített sub-toggle-lel: „Keresztellenőrzés & Számlák” vs „Hivatalos 26A60 Nyomtatvány Replika”.
  2. A 65-ös ÁFA bevallás fül felső **Export** legördülő menüjéből: „NAV A60 nyomtatvány replika megnyitása”.
- **Lapváltó gombok (Pills):** Tételszám badge-dzsel ellátott gyorslapozók (`Főlap`, `01`, `02`, `03`, `04`, `05`).
- **„📑 Összes lap egyben” nézet:** Folyamatos többoldalas A4 dokumentum, amelyben alapértelmezetten a Főlap és az adattal rendelkező ívek jelennek meg.
- **Zoom & Nyomtatás:** 65%–130% skálázás és `@media print` szerinti laponkénti tördelés A4 papírra és PDF-be.

---

## Kapcsolódó
- [A-195: NAV 26A60 Hivatalos Nyomtatvány Digitális Replika Architektúra](../../architecture/decisions/A-195-nav-26a60-official-tax-form-digital-replica.md)
- [P-126: NAV 2665 Hivatalos Nyomtatvány Digitális Replika UX](./P-126-nav-2665-official-tax-form-digital-replica-ux.md)
- [P-144: A60 Közösségi Összesítő és VIES Keresztellenőrzés](./P-144-vat-a60-community-summary-and-vies-crosscheck-ux.md)
