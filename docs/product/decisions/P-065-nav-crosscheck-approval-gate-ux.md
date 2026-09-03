# P-065: NAV Online Számla Ellenőrzés, Vizuális Figyelmeztetések és Könyvelői Jóváhagyási Kapu UX

**Status:** Decided  
**Date:** 2026-09-03  
**Category:** UI / Workflow / Accounting  

---

## Question
Hogyan jelenjen meg a felhasználók (ügyfelek és könyvelők) számára a számlák NAV Online Számla megerősítési státusza anélkül, hogy a felületet feleslegesen túlterhelnénk vizuális zajjal, és hogyan biztosítható a gyors, egykattintásos könyvelői jóváhagyás mind a Visibill fő számlalistában, mind az Accounty (eaisyBooks) felületen?

## Context
A belföldi számlák könyvelési zárlata (BRD 048 és ADR A-084) megköveteli, hogy a felhasználók egyértelműen lássák, ha egy feltöltött számlához nem tartozik online NAV adatszolgáltatás.
A korábbi tervezési körben felmerült a `NAV ok` zöld badge használata a rendben lévő számláknál, azonban a felhasználói visszajelzés alapján a számlák 95%-a rendben van, így a zöld badge-ek tömege szükségtelenül túlterhelte a listát ("karácsonyfa-effektus").
Elvárás volt a tiszta felület: a rendben lévő számlák ne kapjanak feltűnő címkét, a hiányos tételeknél pedig a bizonylatszám mellett egy diszkrét, de informatív felkiáltójel nyújtson közvetlen beavatkozási lehetőséget.

## Decision

### 1. Vizuális Tisztaság és Felkiáltójel Elhelyezés (`SubmittedInvoiceRow`)
- A zöld `NAV ok` badge-eket teljesen eltávolítottuk a listából.
- Ha a számlához **nem tartozik NAV adatszolgáltatás** (`nav_status === 'missing_nav'` vagy `statusz === 'jovahagyasra_var'`):
  - A `BIZ.SZÁM` oszlopban, közvetlenül a számlaszám után egy borostyán színű figyelmeztető gomb (`AlertTriangle`) jelenik meg kerek, enyhén színezett háttérrel (`bg-amber-500/15`).
  - **Hover interakció:** Custom Radix tooltip jelenik meg:  
    *„NAV adatszolgáltatás hiányzik! – A számlához nem tartozik online számla adatszolgáltatás. Kattintson ide a könyvelői jóváhagyáshoz!”*
  - **Kattintás:** Közvetlenül megnyitja a `InvoiceApprovalDialog` jóváhagyási modált.
- Ha a számlát a könyvelő **már jóváhagyta**:
  - A felkiáltójel helyén egy diszkrét kék pipa (`Check`) ikon jelenik meg, amelynek tooltipje részletezi az auditált indoklást és a jóváhagyás tényét.

### 2. Lenyitható Számlasor Banner (`ExpandedInvoiceRow`)
- A számla kibontásakor, a kapcsolódó entitások (NAV pár, banki tranzakciók, futárjelentések) felett egy teljes szélességű borostyán figyelmeztető sáv jelenik meg.
- A sáv tartalmaz egy közvetlen *„Jóváhagyás könyvelésre”* akciógombot.
- Ha a számla már jóváhagyott, egy kék információs kártya mutatja a könyvelői jóváhagyás jogcímét és dátumát.

### 3. Jóváhagyási Dialógus UX (`InvoiceApprovalDialog`)
- **Fejléc:** Figyelmeztető pajzs ikonnal ellátott cím: *„NAV Jóváhagyási Kapu”*.
- **Bizonylat Összesítő:** Strukturált kártyán mutatja a bizonylatszámot, partner nevét (intelligens vevő/eladó iránnyal), kibocsátási dátumát és formázott bruttó összegét devizával.
- **Választható Jogcímek (Rádiógombok):**
  1. *Papíralapú / kézi számlatömbös számla* (nem kötelező az online adatszolgáltatás),
  2. *NAV adatszolgáltatási késés / technikai hiba* (átmeneti késedelem),
  3. *Külföldi vagy mentesített ügylet* (nem adatszolgáltatás-köteles jogcím),
  4. *Egyéb indoklás (saját felelősségre)* (egyedi könyvelői mérlegelés).
- **Egyedi megjegyzés mező:** Opcionális szöveges kiegészítés az audit naplóhoz.
- **Akciók:** *„Mégse”* és *„Jóváhagyás könyvelésre”* (aszinkron töltésjelzővel).

### 4. Accounty (eaisyBooks) Ügyfélszámlák Integráció (`ClientInvoicesPage`)
- **Eszköztár Gyorsszűrő:** A `FAD` és `Hiányzó kép` gombok mellé bekerült a **`⚠️ NAV hiányzik ({count})`** gomb számlálóval, amellyel a könyvelő egy kattintással leszűri az elintézésre váró tételeket.
- **Táblázat Sorok:** Azonos inline felkiáltójel és tooltip a bizonylatszám mellett.
- **Sorvégi Műveleti Menü:** A három pontos menüben új opcióként szerepel a *„Jóváhagyás könyvelésre (NAV kapu)”*.

### 5. Szűrősáv Bővítés (`InvoiceFilterBar`)
- A Feltöltött számlák nézetben a szűrősáv új legördülő menüt kapott a NAV státusz szűrésére:
  * *Mind*,
  * *NAV megerősítve*,
  * *NAV hiányzik*,
  * *Nem alkalmazandó (külföldi)*.
- A NAV számlák nézetben (Kimenő és Bejövő fülön egyaránt) elérhető a Számlakép szűrő:
  * *Számlakép: Mind* (összes számla),
  * *Számlakép: Van* (rendelkezik feltöltött/párosított beküldött számlaképpel),
  * *Számlakép: Hiányzik* (nincs hozzá csatolt számlakép).

### 6. NAV Számlasor Javasolt Csatolmány & Összerendelés UX (`SuggestedInvoiceLinkDialog`)
- **Probléma:** Ha a beküldött számlakép OCR során levágta a sorszám prefixét (pl. `SZJE-2026-1` helyett `JE-2026-1`), a NAV számla sora üres csatolmánnyal (szürke inaktív ikon) jelent meg, holott a számlakép ott volt a rendszerben.
- **Megoldás és Szigorú Feltételrendszer:**
  - **Külföldi számlák kizárása:** Külföldi bizonylatok (pl. Mailgun, AWS) sosem kapnak javaslatot, mivel azok nincsenek a NAV-ban.
  - **Determinisztikus egyezési feltétel:** A csatolmány oszlopban szürke ikon helyett **borostyán színű javaslat gomb** (`Sparkles` + `FileText`) **KIZÁRÓLAG AKKOR** jelenik meg, ha:
    1. A külső partner adószáma (törzsszám) mindkét oldalon egyezik.
    2. A partner neve megegyezik.
    3. A bruttó végösszeg és a deviza megegyezik.
    4. A kibocsátás dátuma napra pontosan megegyezik (`YYYY-MM-DD`). Ezzel megelőzhető az azonos összegű havi átalánydíjak (pl. Trend-Art havi számlák) téves összekapcsolása.
    5. A számlairány azonos, és kizárólag a bizonylatsorszám tér el.
  - **Interakció:**
    - **Hover:** Tooltip tájékoztat: *„Javasolt számlakép ({score}%) – Kinyert sorszám: {sorszám} – Kattintson az összerendeléshez!”*
    - **Kattintás:** Megnyitja a `SuggestedInvoiceLinkDialog` előnézeti és jóváhagyási modált.
  - **Modál kialakítása:**
    - **Fejléc & Jelvények:** A százalékos egyezés (`{score}% egyezés`) és az esetleges `Sorszám prefix eltérés` badge közvetlenül a modál főcíme (`DialogTitle`) mellett, azzal egy sorban helyezkedik el, elkerülve a jobb felső sarok túlzsúfoltságát és teret engedve a bezáró gombnak.
    - **Háttér-interakció és Sorcsukódás Védelem:** A modál a központi `InvoiceDialogManager`-en keresztül jelenik meg (`modal={true}` és esemény-leállítás), garantálva, hogy a modál belső kattintásai vagy a háttérre kattintás ne okozzon véletlen sor-kinyitást vagy összecsukódást a mögöttes táblázatban.
    - Két egymás melletti összehasonlító kártya: bal oldalon a hivatalos NAV adatok, jobb oldalon a feltöltött bizonylat kinyert adatai.
    - Sorszám prefix-eltérés jelvény (`Badge`), ha a sorszám csonkolt volt.
    - **Interaktív, Görgethető Számlakép Előnézet (`InvoiceImagePreview`):** 340px magas, görgethető felületen jeleníti meg a csatolt bizonylatot. PDF formátum esetén a natív böngésző görgetősávval és kurzor-interakcióval (`pointer-events-auto`), képformátumoknál vertikálisan görgethető tárolóban vizsgálható a teljes dokumentum, közvetlen „Megnyitás új lapon” gombbal.
    - Opcionális könyvelői audit megjegyzés beviteli mező.
    - *„Összerendelés és jóváhagyás”* smaragdzöld akciógomb, amely egyetlen tranzakcióban felülírja a sorszámot, összekapcsolja a csatolmányt a NAV sorral, és feloldja a számlát könyvelésre.

### 7. Bizonylatszám Kézi Szerkesztése & Automatikus Feloldása UX
- **InvoiceDetailPopup (Gyorsnézet):**
  - Az Alapadatok kártyán a Bizonylatsorszám mellett egy diszkrét ceruza ikon (`Pencil`) jelenik meg.
  - Rákattintva inline beviteli mezővé alakul Enter mentéssel és Escape elvetéssel.
  - Mentéskor automatikus ellenőrzés fut: ha a javított sorszám megegyezik egy létező NAV számlával, a rendszer azonnal feloldja a `missing_nav` zárlatot, és a számlát jóváhagyottnak tekinti.
- **InvoiceFullEditDialog (Részletes Szerkesztő):**
  - A „Számla adatok” fül bal oszlopának legtetején közvetlenül szerkeszthetővé vált a `Bizonylatsorszám` mező.
  - Magyarázó szöveg segíti a felhasználót: *„A sorszám módosítása automatikusan feloldja a NAV státuszt és összekapcsolja a számlát a NAV tétellel.”*

## Rationale
A koncepció tökéletes egyensúlyt teremt a zavaró vizuális elemek minimalizálása és az azonnali, érthető hibajelzés között. A könyvelőnek nem kell keresgélnie a problémás számlákat: mindkét felületen egyetlen kattintással elérheti és feloldhatja őket.

## Kapcsolódó
- ADR: [A-084: NAV Online Számla Cross-Check & Könyvelői Jóváhagyási Kapu](../../architecture/decisions/A-084-nav-crosscheck-approval-gate.md)
- BRD: [048: NAV Online Számla Megfelelőség és Könyvelői Zárlat](../../business/decisions/048-nav-crosscheck-approval-gate.md)
- PRD: [P-010: Számla lista nézet & szűrők](./P-010-invoice-list.md)
- PRD: [P-057: Számla Kezelő Moduláris Felület (Invoices Feature Slice) UX](./P-057-invoices-feature-slice-ux.md)
