# P-132: Időszaki Pénztárjelentés, Címletjegyzék, 3-lépéses Zárási Varázsló és Főkönyvi Feladás UX

> **Státusz:** ✅ Decided  
> **Dátum:** 2026-09-28  
> **Szerző:** Antigravity  
> **Kapcsolódó specifikáció:** `Idoszaki_penztarjelentes_funkcionalis_specifikacio.docx`  
> **Kapcsolódó ADR:** [A-172](../architecture/decisions/A-172-periodic-cash-reports-schema-and-accounting-lifecycle.md)  
> **Kapcsolódó korábbi döntések:** [P-092](./P-092-petty-cash-manual-entry-validation-and-settlement-ux.md), [P-115](./P-115-petty-cash-inbound-settlement-and-period-closing-ux.md)

---

## 1. Kontextus és Problémafelvetés

A vállalkozások házipénztárának vezetése a Számviteli törvény (Sztv. 165–168. §) értelmében szigorú számadású folyamat. A korábbi egyszerűsített egyenleg-nyilvántartás nem biztosította a formális időszaki zárásokat, a fizikai készpénzszámlálási címletjegyzéket, a szigorú bizonylatsorszámozást (BPB/KPB), valamint a pénztári eltérések (hiány/többlet) jegyzőkönyvezett lekezelését.

### Felhasználói elvárások:
1. **Konfigurálható pénztárpolitika:** Kasszánként beállítható zárási gyakoriság (napi, heti, dekádonkénti, havi), készpénzlimit és túllépési reakció (figyelmeztetés vs. blokkolás), bizonylatolási szabályzat és felelősségi körök (egyszemélyes kassza vs. külön pénztáros és ellenőr).
2. **3-lépéses Időszaki Zárási Varázsló:**
   - *1. lépés — Könyv szerinti egyenleg és audit ellenőrzés:* Negatív pénztáregyenleg és limit-túllépés valós idejű észlelése.
   - *2. lépés — Tényleges címletszámlálás (Címletjegyzék):* Interaktív HUF/EUR címlet-kalkulátor darabszám-bevitellel, élő részösszegekkel és eltérés ($\Delta = C_{actual} - C_{book}$) kijelzéssel.
   - *3. lépés — Zárási jegyzőkönyv és intézkedés:* Eltérés esetén kötelező indoklás (min. 5 karakter), elrendelt intézkedés kiválasztása (pénztári hiányként 3681-re vagy többletként 4791-re könyvelve, pénztáros megtéríti, stb.), digitális aláírások és jóváhagyás.
3. **Pénztárjelentések Áttekintő Fül:**
   - Szűrés kasszákra, státuszokra (Nyitott, Lezárt, Könyvelve, Újranyitott), és keresés sorszámra/dátumra.
   - Részletes modál tételekkel, címletbontással, jegyzőkönyvvel, SHA-256 integritási kóddal.
4. **Hivatalos Nyomtatványok:**
   - A4 fekvő formátumú, aláírási sorokkal és tételes forgalmi bontással ellátott Időszaki Pénztárjelentés.
   - Számozott, betűvel kiírt összeget tartalmazó Bevételi (BPB) és Kiadási (KPB) Pénztárbizonylatok.
5. **1-Kattintásos Főkönyvi Feladás (381):**
   - Előzetes kontírozási ellenőrzés (hiányzó ellenszámlák jelzése).
   - Automatikus vegyes naplóbejegyzés létrehozása 381 T/K bontásban.
   - Feladás visszavonási lehetőség (sztornó) a zárt státusz megőrzése mellett.

---

## 2. Felületi Kialakítás és Interakciók

### 2.1 Pénztár Beállítások Kártya és Dialógus (`RegistersTab.tsx`)
- Új beállítási mezők:
  - Zárási gyakoriság: Napi, Heti, Dekádonkénti (10 napos), Havi, Egyedi.
  - Maximális készpénzállomány limit (HUF) és Limit túllépési reakció (Figyelmeztetés / Blokkolás).
  - Bizonylatolási szabályzat (Minden tételhez kötelező azonnali bizonylat vs. Időszaki záráskor tömeges).
  - Egyszemélyes kassza kapcsoló (ha be van kapcsolva, a pénztáros végezheti az ellenőrzést is).
  - Főkönyvi számlaszám hozzárendelés (pl. 3811 - Központi forint pénztár).

### 2.2 3-Lépéses Zárási Varázsló (`CashClosingWizardDialog.tsx`)
- **Lépés 1: Időszak & Ellenőrzés**
  - Automatikusan felajánlja a nyitó dátumot (előző zárás vége + 1 nap) és a záró dátumot.
  - Zöld pipa és egyenlegösszesítő ha a könyv szerinti egyenleg pozitív és a limiten belül van.
  - Figyelmeztető kártya ha a kassza túllépi a limitet vagy negatívba fordulna.
- **Lépés 2: Címletjegyzék**
  - HUF bankjegyek (20 000, 10 000, 5 000, 2 000, 1 000, 500) és érmék (200, 100, 50, 20, 10, 5), valamint EUR címletek.
  - Tab billentyűvel gyorsan kitölthető darabszám mezők.
  - Valós idejű eltérés kártya:
    - 0 Ft eltérés: Zöld "Egyezik" jelvény.
    - Negatív eltérés: Piros "Pénztárhiány" kiemelés javasolt 3681-es számlával.
    - Pozitív eltérés: Kék "Pénztártöbblet" kiemelés javasolt 4791-es számlával.
- **Lépés 3: Zárási Jegyzőkönyv**
  - Eltérés indoklása és intézkedés kijelölése.
  - Pénztáros, pénztári ellenőr és utalványozó aláírás-jóváhagyás.
  - Zárás véglegesítése gomb: Meghívja a tranzakcionális PostgreSQL RPC-t, amely lezárja a jelentést, legenerálja az SHA-256 hash-t, és bizonylatszámot rendel a záráshoz.

### 2.3 Pénztárjelentések Lista és Részlet Dialógus (`CashReportsTab.tsx`, `CashReportDetailDialog.tsx`)
- Tételes böngésző táblázat KPI kártyákkal.
- Részletnézet tabjai:
  - *Tételek (BPB/KPB bizonylatnyomtató gombokkal).*
  - *Címletjegyzék (címletenkénti bontás és darabszámok).*
  - *Zárási jegyzőkönyv (megállapított tények, intézkedés).*
- Főkönyvi feladás (381) indítása modális ellenőrző ablakkal:
  - Validációs checklist: tételszám, lezárt státusz, hiányzó ellenszámlák.
  - Sikeres ellenőrzés után azonnali könyvelés.

---

## 3. Következmények és Eredmények

- **Sztv. Konformitás:** A zárás bizonylati elve teljes mértékben megfelel a magyar számviteli jogszabályoknak.
- **Nulla Manuális Hiba:** A címletszámláló és a tranzakcionális RPC megakadályozza az elírásokat és az utólagos észrevétlen manipulációt.
- **Közvetlen Könyvelési Kapcsolat:** A lezárt pénztárjelentések egy kattintással átkerülnek a kettős könyvvitel 381-es naplójába.
