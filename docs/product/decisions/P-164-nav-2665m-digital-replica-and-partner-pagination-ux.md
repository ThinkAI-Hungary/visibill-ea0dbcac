# P-164: NAV 2665M Digitális Nyomtatvány Replika és Lapozható/Egybefűzött Partner UX

> **Státusz:** ✅ Decided & Implemented  
> **Dátum:** 2026-10-06  
> **Szerző:** Antigravity Pairing  
> **Érintett területek:** ÁFA Bevallás (`/vat-return`), Tételes M-lapok (NAV 65M), Nyomtatvány Replika (`Nav2665MReplicaContainer.tsx`)  
> **Kapcsolódó döntések:** [A-205](../architecture/decisions/A-205-nav-2665m-digital-replica-and-partner-pagination-architecture.md), [P-158](./P-158-nav-65m-02-k-correction-and-storno-invoices-ux.md), [A-199](../architecture/decisions/A-199-nav-65m-02-k-correction-and-storno-invoices-architecture.md)

---

## 1. Üzleti Háttér és Igény

A magyar ÁFA-bevallás (2665 / 2565) elengedhetetlen része a **65M alnyomtatvány (belföldi összesítő jelentés)**, amely a partnerekkel folytatott forgalom számlaszintű tételes adatszolgáltatását tartalmazza:
1. **2665M Főlap:** partneri összesítő táblázat (04. sor: alapszámlák, 05. sor: korrekciók, 07. sor: összesen, ezer forintban).
2. **2665M-02 lap:** alapszámlák tételes listája (oldalanként max. 36 számla, forintban, 37. sor "Összesen").
3. **2665M-02-K módosító lap:** helyesbítő és sztornó számlák tételes listája (E eredeti pozitív és KT módosító negatív/differencia sorpárok, forintban, 37. sor "Összesen").

Egy aktív cégnél bevallási időszakonként gyakran **több tucat vagy akár több száz partner** szerepel, mindegyik több számlalappal. A könyvelők számára kritikus elvárás volt:
- Legyen **formátumhű, pixel-pontos digitális A4 replika** a NAV ÁNYK nyomtatványképéről (nemcsak táblázat, hanem az eredeti hivatalos lap kinézete).
- Kezelje hatékonyan a nagyszámú partnert anélkül, hogy a böngésző memóriája túlterhelődne.
- Támogassa mind a **laponkénti lapozható módot**, mind az **egybefűzve görgethető folyamatos dokumentumnézetet**.

---

## 2. Felületi Megvalósítás és UX Megoldások

### 2.1. Szegmentált Al-nézet Váltó a Tételes M-lap Fülön
A `teteles_m` fül tetején – az A60 közösségi nyilatkozathoz hasonlóan – modern, 2-állású váltógomb kapott helyet:
- **`[Keresztellenőrzés & Számlák]`**: A meglévő táblázatos, kereshető, rendezhető `VatMLineMasterDetail` nézet.
- **`[Hivatalos 2665M Nyomtatvány Replika]`**: A formátumhű A4 nyomtatványszimuláció.
- **Közvetlen átjáró a 2665A fő replikából:** A 2665A nyomtatvány felső eszköztárában egy kattintható `📄 2665M M-lapok ({partnerCount} partner)` gomb biztosít azonnali átugrást.

### 2.2. Hibrid Nézetmód Kapcsoló: Lapozható ↔ Egybefűzve Görgethető
A felső vezérlősávban egy dedikált hibrid váltó található:
- **Lapozható mód (Paginated):**
  - Egyszerre szigorúan 1 db A4-es oldal jelenik meg nagy méretben, fókuszált olvasáshoz.
  - Gyors gombos pills sáv: `📄 2665M Főlap`, `02 (1. lap)`, `02 (2. lap)`, `02-K (1. lap)`.
  - Alsó/felső léptető vezérlők: `Előző lap` és `Következő lap`.
- **Egybefűzve görgethető mód (Continuous Scroll):**
  - Az aktív partner összes lapja (Főlap + összes 02 lap + összes 02-K lap) folyamatosan egymás alatt gördül le egyetlen összefüggő dokumentumként.
  - A lapok között finom lapszám- és tördelésjelző információs sáv biztosítja az átláthatóságot.

### 2.3. Partner Navigátor és Kereső
- Kereshető legördülő lista a partner nevével, adószámával és számlaszámával.
- `Előző partner` és `Következő partner` gombok, valamint globális billentyűkombinációk (`Alt + Balra`, `Alt + Jobbra`).
- Statisztikai sáv az aktív partner adóalap és adó összegeivel (eFt).
- Zoom vezérlő (60% – 140%) és formátumhű A4 böngészős nyomtatás / PDF mentés gomb (`@media print` optimalizált margókkal és oldaltörésekkel).

---

## 3. Minőségbiztosítás és Eredmények

- **Oxlint & React 19 tisztaság:** 0 hiba, 0 figyelmeztetés a teljes replika komponenscsaládban.
- **Automatizált Vitest tesztek:** 7/7 teszt zöld a `src/test/vat/nav2665MReplica.test.tsx` fájlban; 66/66 teszt zöld a teljes ÁFA modulban.
- **Teljes Build:** `npm run build` hibátlanul lefutott (26.13s).
