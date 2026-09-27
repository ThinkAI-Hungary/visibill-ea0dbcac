# Design Spec: Legutóbbi Számlák & Projekt Összefoglaló Layout Újratervezés

## 1. Előzmények és Konzisztencia Problémák
A korábbi elrendezésben a Dashboard alsó munkaterülete az alábbi strukturális hiányosságokkal küzdött:
1. **Magassági Aszimmetria (Height Mismatch & Dead Space):**
   - A bal oldali "Legutóbbi számlák" lista 7-10 tétel esetén ~800px+ magasra nyúlt.
   - A jobb oldali "Projekt összefoglaló" kártya mindössze ~220px volt, így alatta egy hatalmas (~580px) üres, kihasználatlan tér tátongott.
2. **„Doboz a dobozban” vizuális zaj (Card in Card Clutter):**
   - Minden egyes számlatétel vastag szegélyű kártyaként (`p-4 border rounded-lg`) jelent meg, ami feleslegesen sok függőleges helyet pazarolt és nehezítette a gyors áttekintést.
3. **Belső görgetés (ScrollArea) hiánya:**
   - A beérkező számlák korlátlanul nyújtották lefelé az egész Dashboard oldalt.

---

## 2. Megvalósított Megoldás: „Fintech Dense Split” (1. Opció)

### A. Rács Elrendezés (Grid Layout)
- **3 : 2 aszimmetrikus hasábos arány (`lg:grid-cols-5`):**
  - Bal oldal (`lg:col-span-3`, 60% szélesség): Legutóbbi számlák.
  - Jobb oldal (`lg:col-span-2`, 40% szélesség): Projekt összefoglaló.
- **Szinkronizált Fix Magasság:** Mindkét panel pontosan **520px** magasságú (`h-[520px] flex flex-col overflow-hidden`), így a fejlécük és a láblécük tökéletesen egy vonalba esik, és a korábbi üres lyuk megszűnt.

### B. Legutóbbi Számlák (`RecentInvoices.tsx`)
- **Fix Fejléc (Header Bar):**
  - KPI kártyákkal harmonizáló 28x28px ikon box (`bg-primary-subtle text-primary`).
  - Cím és leírás.
  - Jobb oldali "Összes megtekintése" gomb (`scopedNavigate('invoices')`).
- **Tiszta tranzakciós lista (No Bulky Boxes):**
  - A dobozok helyett tiszta sorok, halvány belső elválasztó vonallal (`divide-y divide-border/30`) és finom lebegő hoverrel (`hover:bg-muted/40`).
- **Irányjelző Badge-ek (Direction Badges):**
  - ↗ Zöld kimenő számla ikon (`ArrowUpRight`, `bg-success-subtle text-success`).
  - ↙ Kék bejövő költségszámla ikon (`ArrowDownLeft`, `bg-info-subtle text-info`).
- **Belső zökkenőmentes görgetés:** Radix `ScrollArea` segítségével a számlák görgethetők anélkül, hogy a fejléc vagy az oldal többi része elmozdulna.
- **Gyors műveletek:** Számlakép megtekintése gomb (`Eye`) és tételre kattintás integrált előnézeti dialógussal.

### C. Projekt Összefoglaló (`ProjectBreakdown.tsx`)
- **Fix Fejléc:** 28x28px `FolderOpen` ikon doboz + "Projektek" gyorslink gomb.
- **Projekt Kártyák:**
  - Költségkeret, számlaszám badge, százalékos arány és progress bar.
- **2x2 Mini KPI Összegző Grid (Kitölti a korábbi üres helyet hasznos üzleti mutatókkal):**
  1. *Átlag bizonylatérték:* Projektekhez tartozó számlák átlaga.
  2. *Allokáció státusz:* Lefedettségi szint (pl. "100% Lefedve").
  3. *Aktív projektek:* Élő projektek darabszáma.
  4. *Összes keret:* Allokált költségek összege.
- **Alsó Akció Sáv (Bottom CTA Banner):**
  - Szaggatott primary szegélyű kártya: "+ Új projekt" gomb, amely azonnal a projektek modulra navigál.

---

## 3. Érintett Kódfájlok
- [`src/components/dashboard/RecentInvoices.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/RecentInvoices.tsx)
- [`src/components/dashboard/ProjectBreakdown.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/dashboard/ProjectBreakdown.tsx)
- [`src/pages/Index.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Index.tsx)
- [`src/hooks/useDashboardData.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useDashboardData.ts)
- [`src/test/recentInvoicesAndProjects.test.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/test/recentInvoicesAndProjects.test.tsx)
- [`docs/design/mockups/recent-invoices-and-projects-redesign.html`](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/mockups/recent-invoices-and-projects-redesign.html)
