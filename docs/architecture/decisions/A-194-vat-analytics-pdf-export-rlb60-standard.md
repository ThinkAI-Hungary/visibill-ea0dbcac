# A-194: ÁFA Analitika PDF Export (NAV 2665 Bevallási Sorok & Gyűjtőkódok) RLB-60 Standard Szerint

**Dátum:** 2026-10-04  
**Státusz:** ELFOGADVA / IMPLEMENTÁLVA  
**Érintett modulok:** `src/features/vat/components/VatCollectorAnalyticsView.tsx`, `src/lib/vatAnalyticsPdf.ts`, `src/lib/glExport.ts`  
**Referencia minta:** `tests/docs/eb0148/07.hó ÁFA lista.pdf`  

---

## 1. Kontextus & Üzleti Igény

A könyvelők és adótanácsadók a havi ÁFA zárások és NAV ellenőrzések során rendszeresen igénylik a bizonylatok és tételek törvényi és könyvelési formátumú kinyomtatását vagy PDF archiválását.
A meglévő Excel export (`exportVatCollectorAnalyticsExcel`) mellett szükségessé vált egy hivatalos, nyomdakész **PDF export**, amely vizuális elrendezésében, oszlopszerkezetében, előjel-konvenciójában és összesítőiben teljes mértékben megfelel a magyar számviteli szoftverek (különösen az RLB-60) által kiállított *„ÁFA LISTA BEVALLÁSI SORONKÉNT”* riportnak.

---

## 2. Döntések (Zero Silent Decisions Jóváhagyással)

1. **A4 Álló (Portrait) formátum és oszlopstruktúra:**
   A minta PDF (`07.hó ÁFA lista.pdf`) alapján 10 oszlopos tömör, áttekinthető struktúrát alkalmazunk:
   - `Naplósorsz.` (Ha lekönyvelt tétel: valós naplósorszám formázva pl. `S26/000127`, `K26/000212`; ha nem könyvelt: üres mező)
   - `ÁFA es.` (Teljesítés dátuma `YYYY.MM.DD` formátumban)
   - `Biz.szám` (Bizonylatszám / számlaszám)
   - `Partner - szöveg` (Partner neve és tétel leírás összefűzve: `{partner}-{leírás}`)
   - `Msz.` (Munkaszám / projektkód)
   - `B/K` (Irány: `bev` = Vevő/kimenő, `kia` = Szállító/bejövő)
   - `Áfa%` (ÁFA kulcs: `mentes`, `27%-os`, `18%-os`, `5%-os` stb.)
   - `Nettó` (Ezres tagolás szóközökkel)
   - `Áfa` (Ezres tagolás szóközökkel)
   - `Bruttó` (Ezres tagolás szóközökkel)

2. **Könyvelési Előjel-konvenció (Pénzügyi Egyenleg):**
   - Vevői (`bev`) bevételek összegei pozitívak (`+`).
   - Szállítói (`kia`) beszerzések és költségek összegei negatívak (`-`).
   - Csoportszintű részösszegek az adott bevallási sor (pl. 07, 66, Nem szerepel a bevallásban) egyenlegét mutatják.
   - A dokumentum végén szereplő `Összesen:` végösszeg a nettó fizetendő / visszaigényelhető ÁFA pozíciót mutatja, tökéletes egyezésben a könyvelési listával.

3. **Csoportosítás & Dinamikus Nézet:**
   - Ha a felhasználó a *Bevallási sor szerint 2665* fülön áll: a fejléc *ÁFA LISTA BEVALLÁSI SORONKÉNT*, a csoportok a 2665 sorok (`07`, `14`, `18`, `27`, `64`, `66`, `67`, `69`, `Nem szerepel a bevallásban`).
   - Ha a *Gyűjtőkód szerint* fülön áll: a fejléc *ÁFA LISTA GYŰJTŐKÓDONKÉNT*, a csoportok a gyűjtőkódok (`25`, `05`, `18`, `FAD`, `AAM`, `TAM`, `ÁHK`).

4. **Technológia & Kliensoldali Generálás:**
   - `jsPDF` és `jspdf-autotable` használata a meglévő frontend dependency-kből.
   - Dedikált utility modul: [`src/lib/vatAnalyticsPdf.ts`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/lib/vatAnalyticsPdf.ts).
   - Magyar karakterkészlet támogatása (`normalizeHungarianForPdf` + ASCII ezres szóközök `\x20` a megbízható Helvetica rendereléshez).

5. **UI Integráció:**
   - A `VatCollectorAnalyticsView` fejlécében az `Export (Excel)` gomb mellé bekerült az `Export (PDF)` gomb, bordó outline stílussal, `FileText` ikonnal és betöltési indikátorral.

---

## 3. Verifikáció & Tesztelés

- Unit tesztek: [`src/test/vat/vatAnalyticsPdf.test.ts`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/test/vat/vatAnalyticsPdf.test.ts) (3 teszteset: méretek, csoportok, részösszegek, gyűjtőkód mód, üres csoportok kezelése, mind PASS).
- Látványterv vizuális ellenőrzése a `view_file` eszközzel: `scratch/generated_test_afa_lista.pdf`.
- `npm run build`: Sikerült, 0 hiba.
