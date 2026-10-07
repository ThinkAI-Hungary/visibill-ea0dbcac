# P-136: Folyószámla és Analitika Kezelőfelület, Különbözet-Rendezés és Nyomtatási Kimutatások UX

- **Státusz:** ✅ Decided
- **Dátum:** 2026-09-28
- **Érintett komponensek:** `SubledgerPage.tsx`, `AppSidebar.tsx`, `SubledgerItemMatchesModal.tsx`, `WriteOffSettlementModal.tsx`, `SubledgerExportDialog.tsx`, `useSubledger.ts`

---

## 1. Felhasználói Igény és Célkitűzés

Lendvai Ádám könyvelői fejlesztési javaslata alapján a könyvelők számára a napi munkában elengedhetetlen, hogy:
1. Egy helyen lássák a partnerek és analitikus számlák nyitott, zárt és teljes tételeit.
2. A tételeket pipálással (checkbox) ki lehessen jelölni, és a felület azonnal mutassa a kijelölt Tartozik és Követel összegek egyenlegét (`∑T - ∑K`).
3. Ha az egyenleg 0 (vagy $\le 10$ Ft kerekítésen belül van), egyetlen gombnyomással össze lehessen párosítani a tételeket.
4. Ha egy tételen minimális kerekítés vagy realizált árfolyamkülönbözet van, ne kelljen manuálisan bizonylatokat létrehozni, hanem egy egyszerű varázslóval (Write-off modal) lehessen azt leírni.
5. Folyószámla kivonatot, nyitott tételek listáját, valamint esedékesség szerinti korosított listát (Aging report) lehessen exportálni Excelbe vagy kinyomtatni PDF formátumban.

---

## 2. Megvalósított Felületi Élmény (UX)

### 2.1 Navigáció és Elhelyezés
- **Menüpont:** A bal oldali főmenüben a **„Könyvelés”** csoportban kapott helyet közvetlenül a „Főkönyv” alatt, **„Folyószámla”** néven (`Layers` ikon).
- **URL struktúra:**
  - Scoped URL: `/:companyId/:dateRange/subledger`
  - Legacy redirect: `/subledger`

### 2.2 Főképernyő Felépítése (`SubledgerPage.tsx`)
1. **Fejléc & KPI kártyák:**
   - Nyitott tételek száma
   - Bruttó nyitott összeg (HUF)
   - Lejárt tartozások / követelések (kiemelt piros figyelmeztetés a határidőn túli tételekre)
   - Rendezett forgalom összege

2. **Állandó Felső Műveleti Sáv (Permanent Action Bar Controls):**
   - **⚡ Automatikus Párosítás:** 1-kattintásos batch művelet, amely bizonylatszám vagy banki hivatkozás alapján azonnal összerendezi és lezárja az egyező T/K tételeket.
   - **✨ Kerekítések leírása (≤10 Ft):** Dinamikus számlálóval ellátott gomb (`stats.smallRoundingCount`), amely megnyitja a kötegelt leíró modalt (`BulkRoundingWriteOffModal.tsx`).
   - **Kimutatás Export:** Megnyitja a szűrt analitika export dialógust.
   - **Útmutató:** Egy kattintással lenyitható beépített segítség a munkafolyamat lépéseiről.

3. **Nézetváltó fülek (Tabs):**
   - `Nyitott tételek`: alapértelmezett, kizárólag a kiegyenlítetlen vagy részben kiegyenlített sorokat mutatja.
   - `Zárt tételek`: a 100%-ban kiegyenlített tételek.
   - `Teljes analitika`: minden könyvelt tétel a kiválasztott szűrési intervallumban.

4. **Szűrősáv és Könyvelési Státusz:**
   - Főkönyvi számla választó (3111, 4541, 361, 161 stb. analitikus számlák).
   - Partner kereső és választó.
   - **Könyvelési státusz szűrő:**
     - `Összes (Könyvelt + Javaslat)`: alapértelmezett, láthatóvá teszi a frissen importált, még jóváhagyásra váró tételeket is sárga „Javaslat” jelvénykével.
     - `Csak véglegesen könyvelt`: kizárólag a lekönyvelt tételek.
     - `Csak javaslatok`: kizárólag a függő könyvelési javaslatok.
   - Keresőmező (bizonylatszám, leírás, partnernév).
   - Dátumszűrés a globális DateRangeContext alapján.

### 2.3 Lebegő Kijelölési és Mérlegsáv (Sticky Balancing Bar)
Ha a könyvelő kijelöl egy vagy több sort:
- Valós időben összegzi a kijelölt sorok számát, Tartozik összegét (`∑T`), Követel összegét (`∑K`), és a kettő egyenlegét.
- **Zöld egyenleg esetén (∑T == ∑K):** Azonnal aktívvá válik a **„Kijelöltek párosítása”** gomb.
- **$\le 10$ Ft különbség esetén:** Külön megjelenik a **„Kerekítés leírása”** gomb, amely felkínálja az egyszerűsített Sztv. szerinti leírást.
- **Javaslat státuszú sorok kijelölésekor:** Megjelenik a **„Könyvelés (X db)”** gomb, amellyel a javaslatok közvetlenül a folyószámla felületről véglegesíthetők.
- **Részletfizetés és M:N párosítás:** Automatikus mohó algoritmus osztja szét a részösszegeket a bizonylatok között.

### 2.4 Különbözet-leírási Varázslók
1. **Egyedi tételes leírás (`WriteOffSettlementModal.tsx`):**
   - Bármely sor végén lévő műveleti menüből elérhető.
   - Választható indoklás: Kerekítés ($\le 10$ Ft, 8755/9779) vagy Árfolyamkülönbözet (8762/9762).
2. **Kötegelt kerekítés leírás (`BulkRoundingWriteOffModal.tsx`):**
   - A felső fejlécből elérhető dedikált táblázatos felület, amely összegyűjti a cég összes $\le 10$ Ft maradványos tételét, és egyetlen kattintással rendezi őket.

### 2.5 Kapcsolódó Párosítások Megtekintése és Felbontása (`SubledgerItemMatchesModal.tsx`)
- Bármely tétel mellől elérhető a párosítások száma badge (`ArrowRightLeft` ikon).
- Megnyitáskor listázza: melyik másik bizonylattal, mikor, mekkora összeggel lett rendezve.
- Minden kapcsolathoz biztosított a **„Párosítás felbontása”** (Trash ikon) gomb megerősítő kérdéssel.

### 2.6 Kimutatások és Exportok (`SubledgerExportDialog.tsx`)
- **Folyószámla kivonat:** Teljes tétel-részletezés HUF és deviza összegekkel.
- **Nyitott tételek listája:** Csak a kiegyenlítetlen tételek.
- **Korosított kimutatás (Aging report):** Lejárat szerinti csoportosítás: Még nem járt le, 1-30 napja, 31-60 napja, 61-90 napja, 90 napon túl lejárt.
- **Formátumok:** Letölthető Excel/CSV (UTF-8 BOM az ékezetek helyes megnyitásához Excelben) és nyomtatásra kész, elegáns PDF/HTML nézet.

---

## 3. Üzleti Hatás és Elfogadás

- A könyvelők a korábbi nehézkes, manuális ellenőrzés helyett egy modern, vizuális, bank-számla párosításra optimalizált felületen dolgozhatnak.
- Megszűnik a könyvelési hibákból eredő analitika ↔ főkönyv eltérés kockázata.
- A Lendvai Ádám által megfogalmazott minden funkcionális és ergonómiai elvárás maradéktalanul teljesült.

---

## 4. Kapcsolódó Dokumentumok
- [A-175: Folyószámla és Analitika Architektúra](../../architecture/decisions/A-175-subledger-and-open-items-architecture.md)
- [BRD 063: Folyószámla és Analitika Számviteli Szabályzat és Integritás](../../business/decisions/063-subledger-and-open-items-accounting-policy.md)
- [P-055: Könyvelési Napló UX](./P-055-accounting-journals-ux.md)
- [P-135: Főkönyvi Kivonat Klasszikus Nézet Oszlopszélességek és Összesítő Sáv UX](./P-135-general-ledger-classic-view-column-widths-and-totals-ux.md)
- [P-152: Folyószámla Kettős Devizamegjelenítés, Árfolyam Tooltip és Vegyes Devizás Kijelölés UX](./P-152-subledger-dual-currency-display-and-multicurrency-selection-ux.md)
- [P-165: Folyószámla 50-es Lapozás (UnifiedPagination) és Főkönyv Lekérdezési Vihar UX](./P-165-general-ledger-and-subledger-pagination-and-concurrency-ux.md)
- [A-226: Főkönyvi és Folyószámlai Lekérdezési Vihar Felszámolása, Sémajavítás és Folyószámla Pagináció](../../architecture/decisions/A-226-gl-subledger-concurrency-storm-and-analytic-reconciliation-schema-fix.md)
