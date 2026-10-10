# A-240: ÁFA Számítási Regresszióvédelmi Kapu: Golden Master Szerződésteszt és Élő Adatbázis Snapshot Guard Architektúra

**Status:** Decided  
**Date:** 2026-10-10  
**Utoljára frissítve:** 2026-10-10  

---

## 🏛️ Context
A Visibill / eaisyBooks pénzügyi motorjának legkritikusabb számítási komponense az ÁFA bevallási motor (`calculate_vat_return` és a kapcsolódó frontend aggregációk), amely a NAV 2665 főlap, 65A részletező lapok, 65M belföldi tételes lapok, valamint az import áfa és turizmusfejlesztési hozzájárulás adatait kalkulálja.

Bármilyen adatbázis trigger, RPC módosítás, indexelés vagy frontend refaktorálás közvetlen veszélyt jelent a korábbi adóidőszakok számítási pontosságára. A manuális tesztelés vagy a nehézkes, instabil böngészős E2E tesztek (Playwright / Puppeteer) lassúak, flaky viselkedésűek és nem adnak azonnali visszajelzést a kódolás pillanatában.

Szükség volt egy olyan kétlépcsős, ultragyors (<150ms és <5s), determinisztikus védelmi rendszerre, amely:
1. Zéró böngészős E2E függőséggel fut.
2. Hiteles, lezárt és a NAV-hoz ténylegesen benyújtott bevallási adatokon (Taxology Kft. 2026-07) alapul.
3. Fizikai minőségbiztosítási kapuként (`Quality Gate`) megakadályozza bármilyen ÁFA logikát érintő feladat késznek nyilvánítását elmozdulás esetén.

---

## 💡 Decision

### 1. Kétszintű Hibrid Védelmi Architektúra

```
┌─────────────────────────────────────────────────────────────┐
│              ÁFA Regresszióvédelmi Kapu                     │
├──────────────────────────────┬──────────────────────────────┤
│ 1. Szint: Vitest GM Teszt    │ 2. Szint: DB Snapshot Guard  │
│ (vatRegressionTaxology)      │ (npm run vat:guard)          │
│                              │                              │
│ • Idő: < 10 ms               │ • Idő: < 5 mp                │
│ • Offline / Kliens mock      │ • Élő Supabase DB RPC hívás  │
│ • 14 db egzakt vizsgálat     │ • Teljes JSON diff összevetés│
│ • NAV XML baseline           │ • 0 tolerancia eltérésre     │
└──────────────────────────────┴──────────────────────────────┘
```

### 2. Vitest Golden Master Szerződésteszt (`src/test/vat/vatRegressionTaxology.test.ts`)
- A Taxology Kft. 2026/07 időszaki, NAV által befogadott XML bevallásának számszaki sarokpontjait rögzíti kőbe vésett állításokként:
  - Főlap 9 db kulcsfontosságú sora (fizetendő áfa, levonható áfa, göngyölt különbözet).
  - Fizetendő ÁFA: pontosan `1 007 921 Ft`.
  - Levonható ÁFA: pontosan `1 259 510,81 Ft`.
  - Különbözet: pontosan `-251 589,81 Ft`.
  - 65M belföldi összesítő lapok tételes adószámai és adóalapjai (10 partner).
- A teszt futási ideje kevesebb mint 15 ms, azonnal futtatható lokálisan és CI pipeline-ban.

### 3. Élő Adatbázis Snapshot Guard CLI Script (`scripts/vat-snapshot-guard.mjs`, `npm run vat:guard`)
- **Működési mechanizmus:**
  - A script a Supabase JavaScript SDK-n keresztül közvetlenül meghívja a `calculate_vat_return` PostgreSQL tárolt eljárást a Taxology Kft cégazonosítójával (`acc22ca9-e9ff-4f9f-9495-ca7612b2e5e2`) és a 2026-07 időszakra.
  - A kapott válaszobjektumot normalizálja (kerekítések, mezősorrend), majd karakterre összeveti a `scripts/snapshots/vat-taxology-2026-07.json` referencia snapshot állománnyal.
  - Ha akár 1 Ft eltérés, hiányzó sor vagy módosult partner adószám van, a parancs azonnal nem-nulla hibakóddal (exit code 1) elbukik és színes ANSI formázással kirajzolja az eltérést.
  - Támogatja a snapshot frissítési módot (`node scripts/vat-snapshot-guard.mjs snapshot`), ami kizárólag tudatos, dokumentált törvényi szabályváltozáskor engedélyezett.

### 4. Kötelező Verifikációs Kapu (`.agents/rules/verification.md`)
A szabályzat 2. pontjában rögzítettük a kötelező lépést:
- Bármilyen ÁFA számítást, modult, migrációt vagy RPC-t érintő fejlesztés lezárása előtt kötelező lefuttatni:
  1. `npx vitest run src/test/vat/vatRegressionTaxology.test.ts`
  2. `npm run vat:guard`
- Szigorúan tilos a feladatot sikeresnek nyilvánítani, amíg mindkét ellenőrzés nem zárul 100%-os zöld eredménnyel.

---

## ⚡ Consequences

### Pozitív
- **100%-os Garancia a Korábbi Időszakok Sértetlenségére:** Kiküszöböli a csendes pénzügyi regressziókat.
- **Rendkívüli Sebesség:** A teljes ellenőrzés lefut 5 másodperc alatt a korábbi percekig tartó böngészős E2E tesztek helyett.
- **Zéró Flakiness:** Mivel nincs DOM renderelés, szelektor-időzítés vagy böngésző-összeomlás, a teszt megbízhatósága 100%.
- **Önálló Automatizáció:** A fejlesztő és az AI ágens egyaránt egyetlen gombnyomással igazolni tudja a módosítások biztonságát.

### Negatív & Kockázatok
- Ha a Taxology Kft tesztadatbázisbeli alapszámláit valaki közvetlen SQL-lel módosítja vagy törli a Supabase-ben, a snapshot guard jelezni fog (ez azonban szándékolt védelem az adatmódosulások ellen).

---

## 🔗 Kapcsolódó
- **BDR:** [033: ÁFA Bevallás Modul](../../business/decisions/033-vat-return-module.md)
- **BDR:** [068: Áfa tv. Szerinti Adófizetési Kötelezettség és Levonási Jog Keletkezése](../../business/decisions/068-vat-effective-tax-date-regime-rules.md)
- **ADR:** [A-167: NAV 2665 Hivatalos Nyomtatvány Digitális Replika Architektúra](./A-167-nav-2665-official-tax-form-digital-replica.md)
- **Szabályzat:** [.agents/rules/verification.md](../../../.agents/rules/verification.md)
