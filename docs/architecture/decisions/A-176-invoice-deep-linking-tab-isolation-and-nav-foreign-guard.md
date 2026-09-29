# A-176: Számla Mélyhivatkozás (Deep-Linking) Tab-Izoláció, Fókusz-Visszarántás Védelem és Külföldi Számla NAV Mentesség

**Status:** Decided  
**Date:** 2026-09-29  
**Utoljára frissítve:** 2026-09-29  

---

## Context

A számlakezelő felületen (`/invoices` és `/client/:id/invoices`) három egymással összefüggő navigációs és adatintegritási anomália jelentkezett:

1. **Fókusz-visszarántás fülváltáskor (Tab Focus Hijacking / Yanking):**
   Amikor a felhasználó megnyitott egy számlát vagy annak tételdialógusát (`InvoiceItemsDialog`), az URL megkapta a `?invoice=<id>` mélyhivatkozást (deep-link). Ha a felhasználó ezután másik fülre váltott (pl. Beküldött számlákról Kimenő vagy Bejövő NAV fülre), a `InvoiceContext.tsx` automatikus számlamegnyitó hookja a korábbi `activeTab` függősége és a beragadt `invoice` URL paraméter miatt azonnal visszakényszerítette az aktív fület az előző számla típusára. Ez ellehetetlenítette a fülek közötti navigációt mindaddig, amíg az URL-ből kézzel ki nem törölték a paramétert.

2. **Harmonika és Dialógus URL Szinkronizációs Aszimmetria:**
   A számlasor összecsukásakor (collapse) az `invoice` paraméter az URL-ben maradt, miközben a tétellista modál bezárásakor bizonyos esetekben azonnal törlődött, megakadályozva az oldal újratöltéskori vagy megosztáskori kontextusmegőrzést.

3. **Zsúfolt lenyíló számlasor (Redundáns NAV ÁFA Összesítő):**
   A lenyitható számlasorban (`ExpandedInvoiceRow.tsx`) a tételes adatok mellett megjelent a teljes `NavInvoiceVatSummaryCard` komponens is, amely a részletes `InvoiceItemsDialog` dialógusban már szerepelt, így a sorban redundáns vizuális terhelést és DOM-súlyt képezett.

4. **Külföldi Számlák Téves NAV Figyelmeztetése és Elavult Szövegezés:**
   A magyar jogszabályok és a NAV Online Számla (OSA) rendszer logikája szerint a külföldi partnerektől érkező bizonylatok (pl. Google, Meta, Adobe, külföldi EU-s/harmadik országbeli beszállítók) soha nem kerülnek be az OSA adatszolgáltatásba. Ennek ellenére a rendszer tévesen borostyán színű figyelmeztető jelvénnyel látta el őket, és a könyvelői KPI számlálókba is beleszámolta hibaként. Emellett a badge szövegezése elavult volt.

---

## Decision

### 1. Fülváltási URL Paraméter-Izoláció (`src/lib/navigation.ts`)
A `useUrlTab` hookot felvérteztük egy opcionális `stripSearchParams?: string[]` beállítással.
- Amikor a felhasználó fület vált (pl. `setTab('outgoing')`), a hook automatikusan eltávolítja a megadott paramétereket (különösen: `['invoice', 'action']`) az URL-ből.
- Ez megakadályozza, hogy az egyik fülön kijelölt számla azonosítója átcsorogjon a másik fül munkamenetébe, megszüntetve a keresztfül-szennyeződést (cross-tab state pollution).

### 2. Deep-Link Fókusz-Védőháló (`src/features/invoices/context/InvoiceContext.tsx`)
- Az automatikus számlamegnyitó `useEffect`-ből eltávolítottuk az `activeTab` reaktív függőséget. A hook kizárólag a kezdeti mountoláskor vagy explicit külső URL paraméter változáskor vizsgálja az `invoice` kulcsot.
- **Harmonika és Dialógus életciklus:**
  - A sor lenyitásakor vagy dialógus megnyitásakor az `invoice` bekerül az URL-be.
  - A tétellista dialógus bezárásakor az `invoice` megmarad az URL-ben (támogatva a megosztást és frissítést).
  - Explicit sor-összecsukáskor (`toggleInvoiceExpanded`) vagy fülváltáskor az `invoice` és `action` paraméterek azonnal törlődnek.

### 3. Lenyitható Sor Letisztítása (`ExpandedInvoiceRow.tsx`)
- A `NavInvoiceVatSummaryCard` komponenst teljesen eltávolítottuk az inline harmonika sorból.
- A hivatalos NAV adatközlő összesítő kártya kizárólag a dedikált `InvoiceItemsDialog` felületen érhető el, ezáltal a táblázat sora lényegesen kompaktabbá és gyorsabban renderelhetővé vált.

### 4. Külföldi Számlák NAV Mentessége és Szövegfrissítés
- **Lokalizáció:** Az `src/locales/hu/invoices.json` állományban a figyelmeztetés új, pontos szöveget kapott:
  - Cím: *„NAV Számlakép hiányzik!”*
  - Leírás: *„A számlaképhez nem sikerült NAV számlát párosítani. Kattintson ide a könyvelői jóváhagyáshoz!”*
- **Külföldi Bizonylat Detektálás (`src/lib/invoiceMatchingUtils.ts`):**
  - A `isForeignSubmittedInvoice` segédfüggvényt megerősítettük: a nem `HU` kezdetű kétbetűs országprefixeket (`DE`, `AT`, `US`, `RO`, `FOREIGN:` stb.) azonnal külföldinek tekinti, függetlenül az adószám karakterhosszától.
- **Jelvény és NAV Hiány Szűrő Védelem:**
  - Mind a `SubmittedInvoiceRow.tsx`, mind a `ClientInvoicesPage.tsx` felületén a figyelmeztető badge renderelését és a `⚠️ NAV hiányzik ({count})` gomb számlálóját kötelezően védjük a `!isForeign` feltétellel (mivel a külföldi bizonylatok sosem fognak a NAV OSA rendszerében szerepelni).
  - **FONTOS:** A rendszer összes általános pénzügyi KPI kártyája (Számlák száma, Bruttó összesen devizánként, ÁFA összesen, FAD, `/invoices` Összes találat és tranzakciós párosítási KPI-k), valamint a könyvelési és ÁFA analitikák a külföldi számlákat **maradéktalanul és 100%-ban tartalmazzák és számolják**.

### 5. Supabase Auth GoTrue Null Token Adatbázis Sanity
- Alkalmaztuk a `20260929023000_fix_gotrue_null_tokens.sql` migrációt, amely megszüntette az `auth.users` táblában beragadt NULL tokenrekordok által kiváltott 500-as Internal Server Error hibákat, garantálva az adminisztrátori és tesztelői munkamenetek stabilitását.

---

## Consequences

### Pozitív
- **Zökkenőmentes Tab-Navigáció:** A fülek közötti váltás 100%-ban stabil; a felület sosem rántja vissza a felhasználót egy korábbi fülre.
- **Tiszta és Konzisztens URL Állapot:** Az URL mélyhivatkozása pontosan tükrözi a felhasználó szándékát: megnyitáskor rögzül, összecsukáskor és fülváltáskor automatikusan megtisztul.
- **Jobb Felületi Ergonómia:** A lenyitott számlasor nem zsúfolt felesleges összesítőkkel, a fókusz a releváns tételeken és csatolt fájlokon marad.
- **Zéró Álpozitív Figyelmeztetés:** A könyvelők nem kapnak megtévesztő hiányjelzést a külföldi szállítói számlákra (pl. Google, Meta), a KPI statisztikák valós hazai NAV eltéréseket mutatnak.

### Negatív / Kockázat
- Külföldi számla feltöltésekor a könyvelőnek nem a NAV keresztellenőrzés, hanem a partneradatok manuális áttekintése az irányadó (ami az ÁFA törvénynek megfelelően természetes üzleti folyamat).

---

## Kapcsolódó
- [A-084: NAV Online Számla Cross-Check & Könyvelői Jóváhagyási Kapu](./A-084-nav-crosscheck-approval-gate.md)
- [A-127: Számlatáblázat Tab-Váltási Render-Skálázás és Accordion Re-Render Retesz](./A-127-invoice-table-tab-switch-scaling-and-accordion-re-render-latch.md)
- [P-065: NAV Online Számla Ellenőrzés, Vizuális Figyelmeztetések és Könyvelői Jóváhagyási Kapu UX](../../product/decisions/P-065-nav-crosscheck-approval-gate-ux.md)
- [P-057: Számla Kezelő Moduláris Felület (Invoices Feature Slice) UX](../../product/decisions/P-057-invoices-feature-slice-ux.md)
