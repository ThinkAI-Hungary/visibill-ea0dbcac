# P-094: Activity Log E-mail Ingestion & Invoice Linking UX

**Status:** Decided  
**Date:** 2026-09-18  
**Author:** Pair Programming Agent & Morfi  
**Kapcsolódó ADR:** [A-126](../../architecture/decisions/A-126-audit-trail-email-ingestion-and-invoice-linking.md)

---

## 1. Felhasználói Igény és Célkitűzés

A cégvezetők és a könyvelők számára a Műveleti Naplóban (`ActivityLogSheet`) eddig csak általános "dokumentum feltöltés" sorok jelentek meg, és nem volt egyértelmű:
- Milyen forrásból érkezett a számla vagy bizonylat (manuális vagy e-mail)?
- Ha e-mailből érkezett, ki volt a feladó és mi volt a levél tárgya?
- Mi lett az e-mail csatolmányából: létrejött-e belőle számla, milyen bizonylatszámmal, és mekkora összeggel?
- Hogyan lehet közvetlenül megnézni a számla adatait anélkül, hogy a számlák menüben külön ki kellene keresni azt?

A cél a bejövő e-mailes folyamatok 100%-os transzparenciája és kétirányú átjárhatósága.

---

## 2. Terméktervezési Döntések (UX)

### 2.1 Kétlépcsős Folyamat és Tiszta Szétválasztás (Two-step Timeline)
A folyamat két diszkrét, tiszta lépésben jelenik meg:
1. **Beérkezés (E-mail érkezése csatolmánnyal):**
   - Amber (borostyán) `Mail` ikonnal jelölt naplósor.
   - Szöveg: *"A rendszer felé érkezett egy dokumentum e-mailből"* (vagy N dokumentum több csatolmány esetén).
   - Részletes kártya:
     - ✉️ **Feladó:** Az e-mail küldő címe (pl. `szamlazas@partner.hu`).
     - 📋 **Tárgy:** Az e-mail tárgysora idézőjelben.
     - 📄 **Csatolmány(ok):** A beérkezett melléklet(ek) neve saját kattintható PDF/dokumentum előnézettel.
     - *(A beérkezési kártyán szándékosan nem szerepel számla hivatkozás, így tisztán csak a levél és mellékletei láthatóak).*
2. **Feldolgozás (A rendszer feldolgozott egy dokumentumot):**
   - Zöld `CheckCircle2` ikonnal jelölt önálló esemény a timeline-on.
   - Szöveg: *"A rendszer feldolgozott egy dokumentumot"*.
   - Részletes kártya (szigorú sorrend):
     - ✉️ **Feladó:** Az e-mail küldő címe (pl. `support@websupport.hu`), ha e-mailből érkezett.
     - 📋 **Tárgy:** Az e-mail tárgysora (ha elérhető).
     - 📄 **Csatolmány:** Az eredeti fájl neve kattintható PDF előnézet gombbal.
     - ➡️ **Létrejött számla:** Kiemelt, kattintható számlajelvény (számlaszám, eladó partner, bruttó összeg és deviza), amelyre kattintva felugrik az `<InvoiceDetailPopup />`.
     - *(Manuális feltöltés esetén: "Manuális feltöltésből" forrásjelölő).*

### 2.2 Közvetlen Számla Interaktivitás (`InvoiceDetailPopup`)
Bármely számlajelvényre vagy bizonylatszámra kattintva az alkalmazás helyben felnyitja a teljes `<InvoiceDetailPopup />` modált, ahol megtekinthető a partner, fizetési határidő, tételes sorok, és a jóváhagyási állapot.

### 2.3 Retrospektív Működés
Nemcsak az új, hanem az összes korábbi (múltbeli) e-mailes feltöltésnél is megjelennek a metaadatok és a számlahivatkozások a kliensoldali batch enricher segítségével.

### 2.4 Szűrés és Keresés
- A művelet szűrők közé felkerült az **"E-mailek"** kategória.
- A gyorskereső mező nemcsak a fájlnévre, hanem a feladó címére, az e-mail tárgyára, a partner nevére és a számlaszámra is szűr.

### 2.5 Multi-Attachment Aggregáció és Fallback Zajszűrés (Deduplication)
- **Probléma:** Ha egy e-mailben több melléklet érkezett (pl. egy számla + tájékoztató PDF-ek), vagy ha a szekvenciális pipeline fallback futott, a felhasználó korábban 4-5 ismétlődő bejegyzést látott ugyanarról a fájlról.
- **UX Megoldás:**
  - **Zéró duplikáció:** Az azonos e-mailből származó azonos fájlneveket a felület összevonja, a fallback redundanciát kiszűri.
  - **Egyesített e-mail kártya:**
    - Ha 1 csatolmány van: *"A rendszer felé érkezett egy dokumentum e-mailből"*, alatta a csatolmány és a számla link.
    - Ha több csatolmány van: *"A rendszer felé érkezett N dokumentum e-mailből"*, alatta a feladó, a tárgy és egy rendezett *"Csatolmányok (N db)"* blokk.
    - Minden egyes csatolmánynak külön PDF megtekintési gombja van, és amelyikből számla lett, ott közvetlenül mellette jelenik meg a számla badge.
  - **2 külön lépés:** A számla feldolgozása továbbra is önálló 2. lépésként jelenik meg a timeline-on ("A rendszer sikeresen feldolgozott egy dokumentumot").

### 2.6 Időrendi Stabilitás és Determinisztikus Sorrend (Szintetikus Eltolás Nélkül)
- **Tiszta idővonal:** A felület a valós adatbázis időbélyegeket használja, megszüntetve a szintetikus `+15_000` ms időtorzítást.
- **Leapfrogging kizárása:** Gyors egymásutánban érkező leveleknél a levelek nem csúsznak egymás alá/fölé. Ha egy levél beérkezése és feldolgozása azonos másodpercre esik, a hierarchikus prioritás révén a lezárt feldolgozás mindig felül, a beérkezés alatta jelenik meg.
- **Dátumegyezések magyarázata:** A számla részletekben a Létrehozva, Utolsó frissítés és Feldolgozva mezők megegyezése a valós háttérfolyamatot tükrözi (a worker egyetlen atomi lépésben menti a számlát a feldolgozás lezárásakor).

### 2.7 Modularizált Felületi Komponensek és Ergonómia
- Az `ActivityLogSheet` belső architektúrája 3 önálló komponensre tagolódott:
  - `ActivityLogFilters`: Áttekinthető, rendezett szűrőpanel tiszta dropdownokkal és aktív szűrőszámlálóval.
  - `ActivityLogTimelineItem`: Letisztult vizuális kártyák a beérkezési és feldolgozási eseményekhez, jól elkülönülő színvilággal és ikonográfiával.
  - `ActivityLogPdfDialog`: Szélesvásznú, görgetésmentes PDF és kép előnézeti modal közvetlen letöltési lehetőséggel és hiba-újrapróbálkozással.

---

## 3. Verifikáció és Minőségbiztosítás
- Unit tesztek fedik le az e-mail detektálást, a fallback deduplikációt, a többcsatolmányos aggregálást, a hierarchikus időrendi komparátort és a keresési illeszkedést (`src/test/activityLogEmailEvents.test.ts`, 8/8 teszt sikeres).
- Teljes modularizált komponens felbontás (`ActivityLogFilters`, `ActivityLogTimelineItem`, `ActivityLogPdfDialog`).
- Teljes production build (`npm run build` és `npx tsc --noEmit`) hibátlanul lefutott.
