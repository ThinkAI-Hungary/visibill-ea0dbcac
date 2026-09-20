# P-099: Hivatalos NAV ÁFA Összesítő és Adókulcs-Megbontás Felületi Élmény (UX)

> **Státusz:** Decided  
> **Dátum:** 2026-09-20  
> **Szerző:** ThinkAI / Morfi  
> **Érintett komponensek:** `NavInvoiceVatSummaryCard.tsx`, `InvoiceItemsDialog.tsx`, `ExpandedInvoiceRow.tsx`  
> **Kapcsolódó:** [ADR A-133](../../architecture/decisions/A-133-nav-official-invoice-summary-vat-breakdown.md)  

---

## 🎯 Problémafelvetés és Célkitűzés

A számlák ellenőrzése és könyvelése során a pénzügyesek és könyvelők számára a legkritikusabb kérdés:
*„Milyen adómértékek, adóalapok és ÁFA összegek szerepelnek hivatalosan a számlán a NAV nyilvántartásában?”*

Korábban a felhasználóknak:
1. Egyenként kellett végignézniük a számla tételeit a tételek dialógusban.
2. Fejben vagy külső számológéppel kellett összegezniük a különböző ÁFA kulcsokhoz tartozó alapokat és adóösszegeket.
3. Különleges adózási eseteknél (pl. belföldi fordított adózás, alanyi mentesség, közösségi értékesítés) nem látszott azonnal a hatósági jogszabályi hivatkozás, ami bizonytalanságot szült a 2665-ös ÁFA bevallási sorok kiválasztásakor.

A cél egy **azonnal látható, prémium, hatóságilag hitelesített NAV ÁFA összefoglaló kártya** létrehozása volt, amely mind a számla kibontott sorában, mind a tételes részletező felugró ablakban egy pillantás alatt biztosítja a teljes tisztánlátást.

---

## 💡 Termék és Felületi Tervezés (UX)

### 1. Kettős Megjelenítési Szint (Dual-Layer Presentation)
- **Kompakt Fejléc (Collapsed State):**
  - Egyetlen diszkrét sor a bizonylat felett / lenyitott sorában.
  - Zöld nyugta ikonnal és `Hivatalos NAV ÁFA Összesítő` felirattal, zöld pipás `NAV v3.0` hitelesítési jelvénnyel.
  - Színes ÁFA kategória badge-ek (`[27%]`, `[5%]`, `[AAM]`, `[TAM]`, `[FAD]`) már az összecsukott kártya fejlécében láthatóak, így kattintás nélkül is azonnal ellenőrizhető a számla adózási jellege.
  - A teljes fejléc kattintható felületként funkcionál a lenyitáshoz.
- **Részletes Megbontás (Expanded State):**
  - Tisztán strukturált táblázat:
    - **Áfakulcs / Jogcím:** Kategória szerinti színes badge (zöld: normál %, borostyán: mentességek, lila: fordított adózás, szürke: hatályon kívüli, kék: adótartalom).
    - **Adóalap (Nettó):** Eredeti devizában formázva.
    - **ÁFA összege:** Forintban és devizában.
    - **Bruttó érték:** Összesített sorérték.
  - **Devizás számla kezelés:** Ha a számla nem HUF-ban lett kiállítva (pl. EUR vagy USD), a táblázat automatikusan megjeleníti a külön oszlopokban a NAV által nyilvántartott hivatalos forint (HUF) adóalapot és forint ÁFA összeget is.
  - **Összesítő lábléc:** Félkövér összegző sor a számla teljes nettó, ÁFA és bruttó értékével.

### 2. Különleges Adózási Esetek és Jogszabályi Hivatkozások
- **Fordított adózás (FAD):** Kiemelt lila badge (`Belföldi fordított adózás (Áfa tv. 142. §)`) hívja fel a figyelmet, hogy a bizonylat után a vevőnek kell az ÁFÁ-t megállapítania.
- **Adómentesség (AAM, TAM, KBAET, EAM, NAM):** A kód mellett információs ikonnal ellátott tooltip jeleníti meg a kibocsátó által megadott törvényi hivatkozást (pl. *„Áfa tv. XIII. fejezet (Alanyi adómentesség)”*).
- **Különbözet szerinti adózás:** Egyértelmű jelölés használtautó-, utazás- vagy műalkotás-kereskedelem esetén.

---

## 📍 Megjelenési Helyek

1. **`InvoiceItemsDialog` (Számlatételek Dialógus):**
   - Közvetlenül a dialógus fejléce alatt, a számlatételek táblázatát megelőzve helyezkedik el.
   - Itt a kártya alapértelmezetten nyitott állapotban jelenik meg, hiszen a felhasználó éppen a mély bizonylat-részleteket kívánja vizsgálni.

2. **`ExpandedInvoiceRow` (Számlalista Kibontott Sor):**
   - A fő számlatáblázatban a bizonylat bal oldali nyilára kattintva a könyvelési és ÁFA sorok közvetlen szomszédságában jelenik meg.
   - Itt alapértelmezetten kompakt (összecsukott) állapotban szerepel a kártya, így csupán 38 pixel magasságot foglal, miközben a fejlécében lévő badge-ek azonnal elárulják a számla adózási összetételét. Kattintásra a teljes táblázat helyben lenyílik.

---

## 🔍 Ellenőrzési és Használati Útmutató

1. Nyissa meg az alkalmazást a `http://localhost:8080` címen.
2. Válassza ki a céget (pl. **Think Ai Kft**).
3. Navigáljon a **Pénzügyek -> Számlák** menüpontba.
4. Kattintson bármelyik NAV számla sorának bal szélén lévő nyílra (kibontás):
   - Megjelenik a zöld szegélyes *„Hivatalos NAV ÁFA Összesítő”* sáv a színes ÁFA kulcs jelvényekkel.
   - A sávra kattintva lenyílik a részletes adóalap és ÁFA összeg táblázat.
5. Kattintson a sor végén lévő **Csomag ikonra** (Számlatételek):
   - A felugró ablak tetején a táblázat felett azonnal látható a teljes hivatalos ÁFA bontás.
