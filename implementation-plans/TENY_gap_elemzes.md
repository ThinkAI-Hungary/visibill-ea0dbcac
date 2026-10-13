# Tárgyi Eszköz Nyilvántartó (TENY) – Teljes GAP Elemzés és Megvalósítási Terv

> **Dokumentum célja:** Az [implementation-plans/TENY_fejlesztes.md](file:///d:/ThinkAI/Visibill/eaisybill/implementation-plans/TENY_fejlesztes.md) fejlesztési specifikációban megfogalmazott követelmények kimerítő, forráskód- és adatbázis-szintű összevetése az **eaisybill-dev** kódbázis jelenlegi állapotával, a meglévő, részben kész és hiányzó funkciók feltárása, valamint a megvalósításukhoz szükséges teljes technikai és számviteli specifikáció rögzítése.  
> **Környezet:** `eaisybill-dev` (`dev.visibill.hu`, Supabase DB: `qhvcdqkqpgpdxogqqvyr`) · **Git ág:** `develop` · **Dátum:** 2026-10-13  

---

## 🧭 1. Vezetői Összefoglaló és Érettségi Mátrix

A VisiBill / eaisyBooks rendszer már rendelkezik egy megbízható, matematikai és számviteli szempontból precíz **Tárgyi Eszköz Nyilvántartó (TENY)** modullal ([FixedAssetsPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/pages/FixedAssetsPage.tsx)). A jelenlegi kódbázis stabil alapot nyújt az alapvető kartonozáshoz és a havi értékcsökkenés elszámolásához.

A [TENY_fejlesztes.md](file:///d:/ThinkAI/Visibill/eaisybill/implementation-plans/TENY_fejlesztes.md) célja azonban egy **minőségi ugrás**: az egyszerű analitikai nyilvántartóból egy **zárt, auditbiztos, valós idejű Főkönyv ↔ TENY egyezőségi rendszert**, automatizált kivezetési kontírozást, pályázati/támogatási projektmenedzsmentet, valamint komponens-szintű nyilvántartást létrehozni.

### Rendszer Érettségi Szint (Current vs Target State)

| Funkcionális Terület | Jelenlegi Érettség | Célállapot ([TENY_fejlesztes.md](file:///d:/ThinkAI/Visibill/eaisybill/implementation-plans/TENY_fejlesztes.md)) | GAP Értékelés |
| :--- | :---: | :--- | :---: |
| **1.1 Analitika és Főkönyvi Egyezőség** | 🟡 30% | Valós idejű Főkönyv ↔ TENY mérlegegyezőség, 3-as root-cause analízis munkalap, 1-kattintásos szinkronizáló varázsló | 🔴 Magas GAP |
| **1.2 Párhuzamos Értékcsökkenés** | 🟢 80% | Számítás működik; hiányzik a többéves párhuzamos értéktábla és a cégvezetői öregedési grafikon | 🟡 Közepes GAP |
| **1.3 Leltár és Tárolóhely** | 🟡 35% | Csak lapos telephely van; hiányzik a hierarchikus tárolóhely, a felelős személy, a 2-nyelvű átadási PDF és a mobil leltár | 🔴 Magas GAP |
| **1.4 Fejlesztési Tartalék & Kedvezmények** | 🟢 70% | Képzés/feloldás/ÉCS alap nullázás működik; hiányzik a 3-4. évi pótlék-monitoring és a kisvállalkozói kedvezmény (22/A. §) | 🟡 Közepes GAP |
| **1.5 Kivezetés, Selejtezés, Hiány** | 🟡 25% | Csak státuszállítás; hiányzik a 4 jogcím automatikus könyvelése, a jóváhagyási kapu és a hivatalos jegyzőkönyv PDF | 🔴 Kritikus GAP |
| **1.6 Támogatásból Megvalósított Eszközök** | 🔴 5% | Egy eszköz egy rekord; hiányzik a több finanszírozási forrást kezelő komponens-karton és az audit export | 🔴 Kritikus GAP |
| **1.7 Integrált Támogatási Nyilvántartás** | 🔴 0% | Nincs pályázati modul; hiányzik a PIE (483) képzés, az ÉCS-arányos feloldás (964) és a 4-oldalú rekonciliáció | 🔴 Kritikus GAP |

---

## 📊 2. Részletes Tételes GAP Elemzés (1.1 – 1.7)

### 2.1. Tárgyi eszköz analitika és főkönyvi egyezőség

> **Alapkövetelmény:** Teljes, tételes tárgyi eszköz analitika, amely automatikusan egyezik a főkönyvvel. Az eltérést a rendszer ne csak jelezze, hanem eszközre és könyvelési tételre bontva vezesse le.

#### 🏢 Visibill (eaisyBill) – Operatív réteg:
* **Számla alapú eszköz-előkészítés:**
  * ✅ *Ami megvan:* Az [InvoiceItemsDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/InvoiceItemsDialog.tsx) tételsorainál elérhető egy manuális gomb, amely megnyitja az [AssetActivationDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/AssetActivationDialog.tsx)-ot a számla alapadataival.
  * ❌ *Ami hiányzik:* **Proaktív automatizmus.** Ha egy bejövő számla vagy tételsora 161-es (Beruházások) főkönyvi számlára kerül kontírozásra, a rendszer számlamentéskor automatikusan ajánlja fel az eszközkarton létrehozását és az aktiválási előkészítést.
* **Eszköz-állapotlap és digitális dosszié:**
  * ✅ *Ami megvan:* Az [AssetDetailPanel.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/AssetDetailPanel.tsx) dokumentumkezelője feltölt fájlokat a Supabase Storage `asset-documents` vödrébe, és az [assetActivationProtocolPdf.ts](file:///d:/ThinkAI/Visibill/eaisybill/src/lib/assetActivationProtocolPdf.ts) révén generál aktiválási jegyzőkönyvet.
  * ❌ *Ami hiányzik:* Strukturált digitális dosszié kategóriák: **Fotók az eszközről**, **Üzembe helyezési jegyzőkönyv**, **Jótállási jegy / Garancialevél**, **Szállítólevél**, előnézeti kártyákkal és közvetlen csatolással.
* **Fizikai azonosító és címkézés:**
  * ✅ *Ami megvan:* A [QrLabelDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/QrLabelDialog.tsx) generál QR-kódot a mélyhivatkozáshoz (`/teny?asset={id}`), és egyszerű nyomtatási nézetet ad.
  * ❌ *Ami hiányzik:* **Vonalkód (Code128)** generálása a leltári számból; szabványos matricaméretek támogatása (50×30 mm, 70×36 mm címkenyomtatókhoz, valamint A4-es többcímkés etikett ív).

#### 📚 eaisyBooks – Könyvelői és főkönyvi réteg:
* **Valós idejű Főkönyv ↔ TENY Rekonciliációs Motor:**
  * 🟡 *Ami megvan:* A [GlAnalyticReconciliationView.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/general-ledger/GlAnalyticReconciliationView.tsx) mindössze egyetlen durva összesítést végez (`sum(acquisition_value)` vs 1-es főkönyvi számlák egyenlege).
  * ❌ *Ami hiányzik:* **Tételes mérlegegyezőség-vizsgálat.** Az 1-es számlaosztály számláinak pontos megfeleltetése az analitikával:
    * 12 (Ingatlanok), 13 (Műszaki gépek), 14 (Egyéb berendezések) bruttó egyenlege ↔ TENY bruttó értékek,
    * 129, 139, 149 (Terv szerinti halmozott ÉCS) követel egyenlege ↔ TENY halmozott számviteli ÉCS,
    * 161 (Befejezetlen beruházások) egyenlege ↔ Még nem aktivált számlatételek.
* **Tételes Eltérés-levezető Munkalap (Root-cause Analysis):**
  * ❌ *Ami hiányzik (Teljesen új):* Ha eltérés ≠ 0 Ft, a rendszer felbontja az okokat 3 kategóriára:
    1. *Könyveletlen eszközök:* TENY-ben aktivált eszköz, amelyhez még nem készült el az aktiválási vegyes tétel (T 12-14 → K 161).
    2. *Analitika nélküli könyvelés:* 1-es számlaosztályban lévő sor az `acc_journal_lines`-ban, amelyhez nincs `fixed_asset_id` rendelve.
    3. *Periódus-eltérés:* A beruházási számla teljesítése és az eszköz aktiválása eltérő hónapra/évre esik.
* **1-kattintásos szinkronizáló varázsló:**
  * ❌ *Ami hiányzik (Teljesen új):* A feltárt hiányzó tételek kötegelt lekönyvelése a Vegyes naplóba a rekonciliációs munkalapról.

---

### 2.2. Párhuzamos értékcsökkenési nyilvántartás

> **Alapkövetelmény:** Számviteli és társaságiadó-törvény szerinti értékcsökkenés párhuzamos kezelése ugyanazon eszközön. Beszerzési érték, módszer, kulcs, tárgyévi és halmozott értékcsökkenés, számviteli és adó szerinti nettó érték egy helyen.

#### 🏢 Visibill (eaisyBill) – Operatív réteg:
* **Vállalkozói hasznos élettartam és maradványérték:**
  * ✅ *Ami megvan:* A [CreateFixedAssetDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/CreateFixedAssetDialog.tsx) és az adatbázis tárolja az éveket/hónapokat (`useful_life_months`) és a maradványértéket (`residual_value`).
* **Teljesítményarányos ÉCS adatbevitel:**
  * 🟡 *Ami megvan:* Az [AssetDetailPanel.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/AssetDetailPanel.tsx) tud `performance_log` eseményt rögzíteni és a [useDepreciation.ts](file:///d:/ThinkAI/Visibill/eaisybill/src/hooks/useDepreciation.ts) kiszámolja az arányos ÉCS-t.
  * ❌ *Ami hiányzik:* Dedikált, ergonomikus havi adatbeviteli felület gépjárműveknél km-óra állásra, termelőgépeknél üzemórára vagy gyártott darabszámra.
* **Cégvezetői vagyonkimutatás:**
  * ❌ *Ami hiányzik (Teljesen új):* Vezetői grafikonok `recharts` alapon a TENY fejlécében: számviteli nettó vagyon alakulása, eszköz-öregedési piramis (0–1 év, 1–3 év, 3–5 év, 5+ év), kategóriánkénti megoszlási tortadiagram.

#### 📚 eaisyBooks – Könyvelői és adózási réteg:
* **Kettős ÉCS Motor ugyanazon az eszközkartonon:**
  * ✅ *Ami megvan:* A [useDepreciation.ts](file:///d:/ThinkAI/Visibill/eaisybill/src/hooks/useDepreciation.ts) párhuzamosan számolja az Sztv. és a Tao szerinti ÉCS-t. A feladás a [depreciationPostingService.ts](file:///d:/ThinkAI/Visibill/eaisybill/src/lib/fixed-assets/depreciationPostingService.ts) révén automatikusan a Vegyes naplóba történik (T 5711 → K 119/129/139/149).
* **Párhuzamos Értéktábla és Mozgáskarton:**
  * 🟡 *Ami megvan:* A [DepreciationCards.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/DepreciationCards.tsx) két kártyán egymás mellett mutatja a könyv szerinti értéket és a TAO értéket.
  * ❌ *Ami hiányzik:* **Többéves, oszlopos párhuzamos mozgástáblázat:** Évről évre bemutatva a bruttó értéket, a tárgyévi és halmozott számviteli ÉCS-t a tárgyévi és halmozott Tao ÉCS mellett, valamint a számviteli nettó könyv szerinti értéket az adótörvény szerinti számított nyilvántartási értékkel szemben.
* **Automatikus TAO Éves Adóalap-korrekció Integráció:**
  * 🟡 *Ami megvan:* A [TaoYearEndWizardPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/pages/Accounty/Tao/TaoYearEndWizardPage.tsx) beemeli a számviteli ÉCS-t növelő tételként (Tao 8. § (1) b)) és a Tao ÉCS-t csökkentő tételként (Tao 7. § (1) b)).
  * ❌ *Ami hiányzik:* Közvetlen bekötés a hivatalos NAV 2629-es bevallás digitális replikájába, valamint tételes eszközszintű adóalap-levezető PDF/Excel export.

---

### 2.3. Leltár és tárolóhely

> **Alapkövetelmény:** Automatikus eszközleltár telephely, tárolóhely, szervezeti egység és felelős személy szerint. Áthelyezések történetének megőrzése.

#### 🏢 Visibill (eaisyBill) – Operatív réteg:
* **Hierarchikus elhelyezkedési törzs:**
  * ❌ *Ami hiányzik (Teljesen új):* A `company_locations` jelenleg csak egy szintű telephelyeket tárol (`headquarters` / `branch`). Szükséges a fa-struktúra: **Telephely → Épület/Szint → Tárolóhely / Iroda / Raktár** (`company_sub_locations`).
* **Szervezeti egység és Felelős személy hozzárendelés:**
  * ❌ *Ami hiányzik (Teljesen új):* A `fixed_assets` táblához hozzá kell kötni az `accounty_employees` táblát (`custodian_id` – felelős dolgozó) és az `accounty_cost_centers` táblát (`cost_center_id` – költségviselő szervezeti egység).
* **Eszköz-áthelyezési munkafolyamat és Átadási jegyzőkönyv:**
  * 🟡 *Ami megvan:* A [TransferDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/TransferDialog.tsx) módosítja a telephelyet és projektet, naplózva az `asset_events`-be.
  * ❌ *Ami hiányzik:* Felelős személy és tárolóhely váltása; **kétnyelvű (magyar-angol) Átadás-Átvételi Nyilatkozat PDF** automatikus generálása aláírásra.
* **Idősoros Mozgástörténet (Audit Trail):**
  * ✅ *Ami megvan:* Az `asset_events` tábla és az [AssetDetailPanel.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/AssetDetailPanel.tsx) időrendben naplózza az eseményeket.
* **Mobil Leltározási Felület:**
  * ❌ *Ami hiányzik (Teljesen új):* Az [InventoryCheckDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/InventoryCheckDialog.tsx) asztali pipálós táblázata helyett/mellett egy **mobilra optimalizált kamerás vonalkód/QR olvasó felület**, hangjelzéssel, fellelt/hiányzó számlálóval és helyszíni státuszrögzítéssel.

#### 📚 eaisyBooks – Könyvelői réteg:
* **Költséghelyi ÉCS könyvelés:**
  * ❌ *Ami hiányzik:* Az eszközhöz rendelt költséghely (`cost_center_id`) alapján a [depreciationPostingService.ts](file:///d:/ThinkAI/Visibill/eaisybill/src/lib/fixed-assets/depreciationPostingService.ts) vegyes napló soraiban a `cost_center_id` mező kitöltése, és igény szerint 6-os/7-es számlaosztályú felosztás könyvelése.
* **Hivatalos leltárív és leltárösszesítő generálás:**
  * ❌ *Ami hiányzik:* A Számviteli törvény előírásai szerinti hivatalos fordulónapi analitikus leltárkimutatás (PDF és Excel) előállítása.
* **Kiegészítő melléklet záradék:**
  * ❌ *Ami hiányzik:* Az éves beszámolóhoz csatolandó, leltározási szabályzatnak megfelelő törvényi igazolás előállítása.

---

### 2.4. Fejlesztési tartalék és adókedvezmények

> **Alapkövetelmény:** A fejlesztési tartalék képzésének és felhasználásának eszközhöz kötött nyilvántartása, határidőfigyeléssel. A tárgyi eszközhöz kapcsolódó kisvállalkozói adókedvezmény elkülönített nyilvántartása és monitoringja.

#### 🏢 Visibill (eaisyBill) – Operatív réteg:
* **Fejlesztési tartalék keretfigyelő sáv:**
  * 🟡 *Ami megvan:* A [DevelopmentReservesTab.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/DevelopmentReservesTab.tsx) mutatja a felhasznált és hátralévő kereteket.
  * ❌ *Ami hiányzik:* Kiemelt vezetői figyelmeztető sáv a TENY dashboard tetején a hamarosan lejáró keretekről.
* **Beruházáskor tartalék-kijelölés:**
  * ✅ *Ami megvan:* A [CreateFixedAssetDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/CreateFixedAssetDialog.tsx) felületén bepipálható a fejlesztési tartalék felhasználása keretválasztással.

#### 📚 eaisyBooks – Könyvelői és adózási réteg:
* **Törvényi 4 adóéves határidő-monitoring (Tao tv. 7. § (1) f)):**
  * 🟡 *Ami megvan:* Az `expiration_date` rögzítésre kerül (`creation_year + 4`).
  * ❌ *Ami hiányzik:* **Proaktív figyelmeztetés a 3. és 4. évben**, valamint a fel nem használt keret után **fizetendő társasági adó és késedelmi pótlék automatikus kiszámítása**.
* **Automatikus feloldás és könyvelési tétel aktiváláskor:**
  * ✅ *Ami megvan:* A [developmentReserveAutoPoster.ts](file:///d:/ThinkAI/Visibill/eaisybill/src/lib/fixed-assets/developmentReserveAutoPoster.ts) aktiváláskor automatikusan lekönyveli a **T 414 → K 413** tételt a Vegyes naplóban, és a [useDepreciation.ts](file:///d:/ThinkAI/Visibill/eaisybill/src/hooks/useDepreciation.ts) 0 Ft-ra állítja a Tao ÉCS alapot a felhasznált összeg erejéig.
* **Kisvállalkozói Adókedvezmény Monitoring (Tao tv. 7. § (1) zs) és 22/A. §):**
  * ❌ *Ami hiányzik (Teljesen új):*
    1. *Beruházási hitelkamat adókedvezmény (Tao tv. 22/A. §):* A hitelkamat 40%-ának adókedvezménykénti nyilvántartása közvetlenül a fizetendő társasági adóból.
    2. *Kisvállalkozói beruházási adóalap-kedvezmény (Tao tv. 7. § (1) zs)):* Eszközhöz kötött nyilvántartás.
* **Elidegenítési tilalom figyelése:**
  * ❌ *Ami hiányzik (Teljesen új):* Törvényi 4–5 éves elidegenítési és üzemeltetésből kivonási korlát felügyelete; riasztás az eszköz kivezetésekor vagy értékesítésekor a védelmi időn belül, és a visszafizetendő adó + késedelmi pótlék automatikus kiszámítása.

---

### 2.5. Kivezetés, értékesítés, selejtezés, leltárhiány

> **Alapkövetelmény:** Értékesítéskor az eszköz automatikus felismerése és a kivezetési tételek előkészítése. Selejtezési és leltárhiány-jegyzőkönyv automatikus, szerkeszthető előállítása; könyvelés csak jóváhagyás után.

#### 🏢 Visibill (eaisyBill) – Operatív réteg:
* **Értékesítéskori Eszközfelismerés:**
  * ❌ *Ami hiányzik (Teljesen új):* Kimenő számla kiállításakor vagy beérkezésekor az eszköz neve / leltári száma alapján a rendszer felajánlja a kapcsolódó tárgyi eszköz kiválasztását és a kivezetési folyamat indítását.
* **Szerkeszthető Selejtezési Jegyzőkönyv Űrlap:**
  * 🟡 *Ami megvan:* A [DisposalDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/DisposalDialog.tsx) csak egy egyszerű indoklás- és dátummező.
  * ❌ *Ami hiányzik:* **Hivatalos selejtezési űrlap:** Selejtezési bizottság (elnök, tagok), részletes műszaki indoklás (fizikai/erkölcsi elavulás, gazdaságtalan javítás, töréskár), hulladékkezelési / veszélyes hulladék átadási adatok, valamint digitálisan aláírható, nyomtatható Selejtezési Jegyzőkönyv PDF generálása.
* **Leltárhiány és Káreset Jegyzőkönyv:**
  * ❌ *Ami hiányzik (Teljesen új):* Leltárhiány dokumentálása, dolgozói felelősségvizsgálat és térítési kötelezettség rögzítése.
* **Vezetői / Könyvelői Jóváhagyási Kapu:**
  * ❌ *Ami hiányzik:* A kivezetés státusza legyen `pending_approval` ("Jóváhagyásra vár"), amíg az illetékes jóvá nem hagyja; addig ne történjen főkönyvi könyvelés.

#### 📚 eaisyBooks – Könyvelői és könyvviteli réteg:
* **Feltételes Kivezetési Könyvelő Motor (Csak jóváhagyás után):**
  * ❌ *Ami hiányzik (Kritikus funkció):* Jelenleg a kivezetés csak státuszt állít, **semmit nem könyvel a főkönyvbe**! Meg kell valósítani a 4 jogcím szerinti automatikus kontírozást:
    1. **Értékesítés:**
       - Törtidőszaki ÉCS lekönyvelése az eladás napjáig: **T 5711 → K 1x9**
       - Halmozott ÉCS kivezetése: **T 1x9 → K 1x**
       - Könyv szerinti nettó érték egyéb ráfordításként: **T 861 → K 1x**
       - Értékesítési árbevétel könyvelése egyéb bevételként: **T 311/384 → K 961**
    2. **Selejtezés:**
       - Halmozott ÉCS kivezetése: **T 1x9 → K 1x**
       - Maradványérték terven felüli ÉCS-ként / egyéb ráfordításként: **T 869 / 1x9 → K 1x**
    3. **Leltárhiány:**
       - Eszköz kivezetése: **T 869 → K 1x**
       - Megtéríttetett kár előírása dolgozóval szemben: **T 361 → K 969**
    4. **TAO adóalap kivezetési korrekció levezetése:**
       - Könyv szerinti nettó érték (Tao növelő) és adótörvény szerinti számított nettó érték (Tao csökkentő) különbségének automatikus átadása a társasági adó zárásnak.

---

### 2.6. Támogatásból megvalósított eszközök

> **Alapkövetelmény:** Egy eszköz egy eszközkarton maradjon, de több értékkomponenst és finanszírozási forrást kezelhessen. Támogatási forrás, saját forrás, későbbi ráaktiválás, eltérő aktiválási dátum és projektkapcsolat komponensenként is nyilvántartható legyen. Alapelv: Egy gazdasági eszköz ne szakadjon szét több mesterséges kartonra csak azért, mert több forrásból finanszírozták.

#### 🏢 Visibill (eaisyBill) – Operatív réteg:
* **Komponens-elvű Eszközkarton:**
  * ❌ *Ami hiányzik (Teljesen új architektúra):* A `fixed_assets` tábla jelenleg egyetlen rekordként kezeli az eszközt. Létre kell hozni a `fixed_asset_components` táblát, amely lehetővé teszi több forráskomponens rögzítését egyetlen fizikai eszköz alatt:
    * *Komponens 1 (Eredeti beszerzés):* 70% GINOP támogatás + 30% saját erő, aktiválás: 2024.03.01.
    * *Komponens 2 (Ráaktivált vezérlőegység 1 évvel később):* 100% saját erő, aktiválás: 2025.04.15.
* **Komponensenkénti aktiválási dátum és projekt:**
  * ❌ *Ami hiányzik:* Komponensenként eltérő üzembe helyezési nap és pályázati projekt hozzárendelés.

#### 📚 eaisyBooks – Könyvelői réteg:
* **Komponens-szintű ÉCS és Forráskalkuláció:**
  * ❌ *Ami hiányzik:* A leírási motor a háttérben komponensenként számítja az amortizációt az eltérő aktiválási dátumok és finanszírozási források alapján, miközben a főkönyvben az eszköz egyetlen egységként jelenik meg.
* **Pályázati Audit Eszközkarton Export:**
  * ❌ *Ami hiányzik:* Olyan hivatalos mozgáskimutatás (PDF/Excel), amely bemutatja az ellenőröknek a teljes gép értékét, a támogatott hányadot és az önerőt.

---

### 2.7. Integrált támogatási nyilvántartás

> **Alapkövetelmény:** Az Excel-alapú támogatási tábla kiváltása projektlappal: támogatási döntés, szerződés, projektköltség, támogatási intenzitás, megítélt és kifizetett támogatás, előleg, saját forrás, kapcsolódó eszközök. A támogatás időbeli elhatárolásának és az értékcsökkenéssel arányos feloldásának automatikus kezelése. Támogatási nyilvántartás ↔ tárgyi eszköz analitika ↔ főkönyv ↔ elhatárolások automatikus egyeztetése.

#### 🏢 Visibill (eaisyBill) – Operatív réteg:
* **Digitális Támogatási Projektlap (Pályázati Modul):**
  * ❌ *Ami hiányzik (Teljesen új modul):* `grant_projects` tábla és felület:
    * Támogató szervezet (NGM, MVH), pályázati kód (GINOP-Plusz), szerződésszám,
    * Projekt elszámolható összköltsége, megítélt támogatási összeg, támogatási intenzitás (%),
    * Pénzügyi mérföldkövek: kapott előleg, benyújtott kifizetési kérelmek (PEK), kiutalt támogatás, önerő ráfordítások.
* **Kapcsolt eszközök és számlák hálója:**
  * ❌ *Ami hiányzik:* A projektlapon közvetlenül megjeleníteni a kapcsolt beruházási számlákat, tárgyi eszközöket és szerződéseket.
* **Kötelező fenntartási időszak monitoring:**
  * ❌ *Ami hiányzik:* A támogatási szerződés szerinti 3 vagy 5 éves fenntartási kötelezettség figyelése (eszköz-eladási tiltás riasztásokkal).

#### 📚 eaisyBooks – Könyvelői és könyvviteli réteg:
* **Támogatások Automatizált Passzív Időbeli Elhatárolása (PIE):**
  * ❌ *Ami hiányzik:* Fejlesztési/beruházási célra kapott vissza nem térítendő támogatás azonnali elhatárolása a jóváíráskor:
    * Banki jóváírás és egyéb bevétel: **T 384 → K 96**
    * Passzív időbeli elhatárolás képzése: **T 96 → K 483** (Támogatások passzív időbeli elhatárolása)
* **ÉCS-vel Arányos Automatikus Év Végi Feloldó Motor:**
  * ❌ *Ami hiányzik:* Amikor a támogatásból vásárolt eszközre ÉCS számolódik el (T 5711 → K 1x9), a rendszer a támogatási intenzitás arányában automatikusan könyveli az elhatárolás feloldását egyéb bevételként:
    $$\text{Feloldott összeg} = \text{Tárgyidőszaki ÉCS} \times \left(\frac{\text{Támogatás összege}}{\text{Bekerülési érték}}\right)$$
    Könyvelési tétel: **T 483 → K 964** (Költségek ellentételezésére kapott támogatások feloldása).
* **Négyoldalú Automatikus Rekonciliáció (Zero-Error Guard):**
  * ❌ *Ami hiányzik:* Folyamatos számszaki egyeztetés a 4 pillér között:
    $$\text{Támogatási Projektlap} \longleftrightarrow \text{Tárgyi Eszköz Analitika} \longleftrightarrow \text{Főkönyv (161, 1x, 483, 964)} \longleftrightarrow \text{Passzív Elhatárolások}$$
    Eltérés esetén automatikus hibaüzenet (pl. feloldatlan elhatárolás, vagy ÉCS nélkül feloldott összeg).

---

## 🏛️ 3. Kiegészítő Terület: KIVA és Áttérés (Katv. 28. §)

A projekt checklistjében szereplő 34. fejezet (`K34.01` – `K34.11`) szorosan összefügg a TENY fejlesztéssel, mivel a magyar KKV-k jelentős része KIVA alany:
1. **KIVA előtti vs. alatti eszközök:** A Katv. 28. § alapján nyilván kell tartani, hogy az eszközt KIVA előtt vagy KIVA alatt szerezték be. A KIVA alatti beruházás azonnal csökkenti a KIVA alapot (Katv. 20. §), így kilépéskor erre az eszközre már nem számolható el Tao ÉCS!
2. **KIVA alatti számviteli ÉCS:** A KIVA alatti számviteli ÉCS nem keletkeztethet adózási duplikációt.
3. **KIVA kilépési kimutatás:** KIVA-ból TAO-ba visszalépéskor eszközönkénti áttérési analitikát kell képezni.

---

## 📖 4. Számviteli Kontírozási Tételpárok Kódexe (Cheat Sheet)

A leendő fejlesztés során az alábbi szigorú kettős könyvviteli szabályok szerint kell kontírozni a Vegyes naplóban:

| Gazdasági Esemény | Tartozik (T) Számla | Követel (K) Számla | Jogszabályi / Számviteli Hivatkozás |
| :--- | :--- | :--- | :--- |
| **Aktiválás (Üzembe helyezés)** | `121-144` Tárgyi eszköz | `161` Befejezetlen beruházások | Sztv. 47. § (1) |
| **Időszaki terv szerinti ÉCS** | `5711` Terv szerinti ÉCS | `119, 129, 139, 149` Halmozott ÉCS | Sztv. 52. § (1) |
| **Fejlesztési tartalék feloldása** | `414` Lekötött tartalék | `413` Eredménytartalék | Tao tv. 7. § (15), Sztv. 38. § |
| **Értékesítés – Tört ÉCS** | `5711` Terv szerinti ÉCS | `1x9` Halmozott ÉCS | Sztv. 52. § (1) |
| **Értékesítés – Halmozott ÉCS kivezetés** | `1x9` Halmozott ÉCS | `1x` Tárgyi eszköz bruttó | Sztv. 86. § |
| **Értékesítés – Nettó érték kivezetése** | `861` Értékesített immat./tárgyi e. nettó | `1x` Tárgyi eszköz bruttó | Sztv. 86. § (3) b) |
| **Értékesítés – Árbevétel jóváírás** | `311` Vevők / `384` Bank | `961` Értékesített immat./tárgyi e. bevétele | Sztv. 72. § |
| **Selejtezés – Halmozott ÉCS kivezetés** | `1x9` Halmozott ÉCS | `1x` Tárgyi eszköz bruttó | Sztv. 86. § |
| **Selejtezés – Maradványérték leírása** | `869` Egyéb ráfordítás / `1x9` Terven felüli ÉCS | `1x` Tárgyi eszköz bruttó | Sztv. 53. § (1) |
| **Leltárhiány kivezetése** | `869` Egyéb ráfordítás (hiány) | `1x` Tárgyi eszköz bruttó | Sztv. 86. § |
| **Leltárhiány – Dolgozói kártérítés** | `361` Munkavállalókkal szembeni köv. | `969` Egyéb bevételek (megtérített kár) | Sztv. 77. § |
| **Támogatás jóváírása** | `384` Elszámolási számla | `96` Egyéb bevételek | Sztv. 77. § (2) |
| **Támogatás PIE képzése** | `96` Egyéb bevételek | `483` Támogatások passzív elhatárolása | Sztv. 45. § (2) |
| **Támogatás PIE feloldása (ÉCS arányos)** | `483` Támogatások passzív elhatárolása | `964` Költségek ellentételezésére kapott tám. | Sztv. 45. § (2) |

---

## 🗄️ 5. Teljes Adatbázis DDL Architektúra (Supabase PostgreSQL)

A feltárt hiányosságok pótlásához szükséges végleges, indexelt és RLS-védett sématerv:

```sql
-- ============================================================================
-- 1. HIERARCHIKUS TÁROLÓHELYEK ÉS RAKTÁRAK
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.company_sub_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.company_locations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.company_sub_locations(id) ON DELETE CASCADE,
  level_type TEXT NOT NULL CHECK (level_type IN ('building', 'floor', 'room', 'storage', 'workstation')),
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_locations_company ON public.company_sub_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_sub_locations_location ON public.company_sub_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_sub_locations_parent ON public.company_sub_locations(parent_id);

ALTER TABLE public.company_sub_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_locations_all ON public.company_sub_locations
  FOR ALL USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 2. PÁLYÁZATI ÉS TÁMOGATÁSI PROJEKTEK
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.grant_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  grant_code TEXT NOT NULL, -- pl. GINOP-Plusz-1.2.3-21-2022-00045
  grant_name TEXT NOT NULL,
  grantor_name TEXT NOT NULL,
  contract_number TEXT,
  contract_date DATE,
  total_eligible_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
  granted_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  intensity_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  advance_received NUMERIC(15, 2) DEFAULT 0,
  payout_received NUMERIC(15, 2) DEFAULT 0,
  own_funds_spent NUMERIC(15, 2) DEFAULT 0,
  start_date DATE,
  completion_date DATE,
  maintenance_end_date DATE NOT NULL, -- fenntartási kötelezettség vége
  pie_gl_account_id UUID REFERENCES public.gl_accounts(id), -- 483 számla
  income_gl_account_id UUID REFERENCES public.gl_accounts(id), -- 964 számla
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'in_maintenance', 'closed', 'audited')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_grant_projects_company ON public.grant_projects(company_id);
CREATE INDEX IF NOT EXISTS idx_grant_projects_maint_date ON public.grant_projects(maintenance_end_date);

ALTER TABLE public.grant_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY grant_projects_all ON public.grant_projects
  FOR ALL USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 3. KOMPONENS-ELVŰ TÁRGYI ESZKÖZÖK
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fixed_asset_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  component_code TEXT,
  name TEXT NOT NULL,
  acquisition_value NUMERIC(15, 2) NOT NULL CHECK (acquisition_value >= 0),
  residual_value NUMERIC(15, 2) DEFAULT 0,
  activation_date DATE NOT NULL,
  useful_life_months INTEGER NOT NULL CHECK (useful_life_months >= 0),
  grant_project_id UUID REFERENCES public.grant_projects(id) ON DELETE SET NULL,
  funding_source TEXT NOT NULL DEFAULT 'own_funds' CHECK (funding_source IN ('own_funds', 'grant', 'mixed', 'loan')),
  grant_amount NUMERIC(15, 2) DEFAULT 0,
  own_amount NUMERIC(15, 2) DEFAULT 0,
  is_subsequent_addition BOOLEAN NOT NULL DEFAULT false, -- ráaktiválás
  source_invoice_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disposed', 'sold')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_components_asset ON public.fixed_asset_components(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_components_company ON public.fixed_asset_components(company_id);
CREATE INDEX IF NOT EXISTS idx_asset_components_grant ON public.fixed_asset_components(grant_project_id);

ALTER TABLE public.fixed_asset_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY asset_components_all ON public.fixed_asset_components
  FOR ALL USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 4. FIXED_ASSETS TÁBLA BŐVÍTÉSE
-- ============================================================================
ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS custodian_id UUID REFERENCES public.accounty_employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.accounty_cost_centers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sub_location_id UUID REFERENCES public.company_sub_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grant_project_id UUID REFERENCES public.grant_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_incentive_type TEXT, -- pl. 'small_business_investment', 'loan_interest'
  ADD COLUMN IF NOT EXISTS tax_incentive_year INTEGER,
  ADD COLUMN IF NOT EXISTS holding_period_end_date DATE, -- elidegenítési korlát
  ADD COLUMN IF NOT EXISTS disposal_status TEXT DEFAULT 'none' CHECK (disposal_status IN ('none', 'pending_approval', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS disposal_reason_type TEXT CHECK (disposal_reason_type IN ('sale', 'scrapping', 'inventory_shortage', 'donation')),
  ADD COLUMN IF NOT EXISTS disposal_committee JSONB, -- bizottsági tagok
  ADD COLUMN IF NOT EXISTS disposal_waste_info JSONB, -- hulladékkezelési adatok
  ADD COLUMN IF NOT EXISTS disposal_journal_entry_id UUID REFERENCES public.acc_journal_headers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kiva_pre_acquisition BOOLEAN DEFAULT false, -- KIVA előtt beszerzett
  ADD COLUMN IF NOT EXISTS kiva_depreciation_total NUMERIC(15, 2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_fixed_assets_custodian ON public.fixed_assets(custodian_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_cost_center ON public.fixed_assets(cost_center_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_sub_location ON public.fixed_assets(sub_location_id);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_holding_period ON public.fixed_assets(holding_period_end_date);

-- ============================================================================
-- 5. ACC_JOURNAL_LINES KÖZVETLEN ESZKÖZKAPCSOLAT
-- ============================================================================
ALTER TABLE public.acc_journal_lines
  ADD COLUMN IF NOT EXISTS fixed_asset_id UUID REFERENCES public.fixed_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS asset_component_id UUID REFERENCES public.fixed_asset_components(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS grant_project_id UUID REFERENCES public.grant_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_journal_lines_fixed_asset ON public.acc_journal_lines(fixed_asset_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_component ON public.acc_journal_lines(asset_component_id);
```

---

## 💻 6. Új Backend Szolgáltatások Specifikációja

### 1. Főkönyv ↔ TENY Rekonciliációs Szolgáltatás (`assetReconciliationService.ts`)
* **Bemenet:** `companyId`, `date` (fordulónap).
* **Működés:**
  1. Lekérdezi az 1-es főkönyvi számlák záró egyenlegét (`gl_accounts` ahol `gl_number LIKE '1%'`), szétbontva Bruttó (12, 13, 14), Halmozott ÉCS (129, 139, 149) és Beruházások (161) csoportokra.
  2. Kiszámítja a TENY analitika fordulónapi értékeit (aktív eszközök bekerülési értéke, halmozott számviteli ÉCS).
  3. Tételes root-cause lekérdezést futtat:
     - `unposted_activations`: olyan eszközök, ahol `activation_date <= date`, de nincs kapcsolódó `acc_journal_lines` tétel.
     - `orphan_gl_entries`: olyan 1-es számlára könyvelt sorok, ahol `fixed_asset_id IS NULL`.
     - `period_mismatches`: ahol a számla könyvelési dátuma és az aktiválási nap eltérő adóévbe esik.
* **Kimenet:** Rekonciliációs mérlegadatok és a hibás tételek listája.

### 2. Kivezetési Könyvelő Motor (`assetDisposalPostingService.ts`)
* **Bemenet:** `assetId`, `disposalType`, `disposalDate`, `saleValue`, `wasteInfo`, `committee`.
* **Működés:**
  1. Kiszámítja az eladás/selejtezés napjáig járó törtidőszaki ÉCS-t.
  2. Létrehozza a jóváhagyott kivezetési bizonylatot a Vegyes naplóban a 4. pontban definiált számlapárokkal.
  3. Meghívja az `acc_post_journal_entry` RPC-t a véglegesítéshez és sorszámozáshoz.
  4. Generálja és tárolja a hivatalos Selejtezési Jegyzőkönyv PDF-et.

### 3. Pályázati PIE Feloldó Motor (`grantDeferralPostingService.ts`)
* **Bemenet:** `companyId`, `year`, `month`.
* **Működés:**
  1. Megkeresi az összes olyan eszközt és komponenst, amelyhez `grant_project_id` tartozik.
  2. Az adott időszakra elszámolt ÉCS összegét beszorozza a pályázat támogatási intenzitásával (`intensity_percent`).
  3. Létrehoz egy feloldási tételt a Vegyes naplóban: **T 483 → K 964**.

---

## 🎨 7. Frontend Felhasználói Felületek Terve

```
+------------------------------------------------------------------------------------------------------------------------+
| TENY (Tárgyi Eszköz Nyilvántartó) — [Eszközök (28)]  [Fejlesztési Tartalékok]  [Pályázatok & Projektek]  [Rekonciliáció] |
+------------------------------------------------------------------------------------------------------------------------+
| [ Vezetői Műszerfal: Nettó vagyon: 48,2M Ft | Átlagéletkor: 2,4 év | Lejáró tartalék (2026): 4,5M Ft | Egyezőség: OK ]  |
+------------------------------------------------------------------------------------------------------------------------+
| BAL OLDAL (60%): Eszközök Táblázata                               | JOBB OLDAL (40%): Eszközkarton & Digitális Dosszié |
| Szűrők: [Összes] [Gépek] [IT] [Járművek] [Telephely/Tárolóhely]  | • Alapadatok, Felelős dolgozó (ÚJ!), Tárolóhely   |
| Kereső: [ Leltári szám / Név / QR... ]                           | • Komponensek & Finanszírozási források (ÚJ!)      |
|                                                                    | • Kettős ÉCS kártyák (Sztv. vs Tao)               |
| Táblázat oszlopok:                                                 | • Többéves párhuzamos mozgáskarton tábla          |
| • Leltári szám (Code128 vonalkóddal)                              | • Digitális Dosszié (Fotók, Garancia, Szállító)   |
| • Megnevezés & Kategória                                          | • Műveletek:                                       |
| • Felelős dolgozó (Új!) & Tárolóhely (Új!)                        |   [ Áthelyezés & Átadási PDF ]                     |
| • Bruttó érték / Könyv szerinti nettó érték                       |   [ Selejtezési Varázsló & Jegyzőkönyv ]           |
| • Pályázati címke (Új!)                                           |   [ Code128 / QR Címke Nyomtatás ]                 |
+------------------------------------------------------------------------------------------------------------------------+
```

### Új és Bővített Képernyők:
1. **[FixedAssetsPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/pages/FixedAssetsPage.tsx) Felső Tabok:**
   - `assets` (Eszközök)
   - `development_reserves` (Fejlesztési Tartalékok)
   - `grant_projects` (Pályázatok és Támogatások – **ÚJ**)
   - `reconciliation` (Főkönyvi Rekonciliációs Munkalap – **ÚJ**)
2. **[QrLabelDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/QrLabelDialog.tsx) Upgrade:**
   - SVG Code128 vonalkód renderelő a leltári számból,
   - Matrica formátumválasztó (50×30 mm etikett, Raktári címke, A4 íves).
3. **[TransferDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/TransferDialog.tsx) Upgrade:**
   - Dolgozó választó (`accounty_employees`), hierarchikus tárolóhely választó (`company_sub_locations`),
   - Kétnyelvű átadás-átvételi nyilatkozat PDF letöltés.
4. **[DisposalDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/DisposalDialog.tsx) Upgrade:**
   - 4-es jogcímválasztó (Értékesítés, Selejtezés, Hiány, Adomány), bizottsági tagok, veszélyes hulladék adatok,
   - Jóváhagyási munkafolyamat és hivatalos Selejtezési Jegyzőkönyv PDF.

---

## 🚀 8. Megvalósítási Ütemterv (Roadmap) és Fázisok

```
[ Phase 1: Főkönyvi Integritás & Kivezetési Motor ]
  └── Cél: Zárt könyvvitel, mérlegegyezőség, automatikus kivezetési kontírozás.
  
[ Phase 2: Szervezeti Mozgások, Felelősök & Leltár ]
  └── Cél: Hierarchikus tárolóhelyek, felelős dolgozók, átadási PDF, Code128 címkék.
  
[ Phase 3: Pályázati Modul, Komponensek & PIE Elhatárolások ]
  └── Cél: Grant projektek, komponens-alapú karton, ÉCS-arányos 483->964 feloldás.
```

### Phase 1: Főkönyvi Integritás és Kivezetési Motor (Prioritás: P1)
1. Adatbázis migráció: `acc_journal_lines.fixed_asset_id` idegen kulcs hozzáadása.
2. `assetReconciliationService.ts`: Főkönyv ↔ TENY egyezőség és 3-as root-cause analízis.
3. `AssetReconciliationTab.tsx`: Rekonciliációs munkalap és 1-kattintásos szinkronizáló varázsló.
4. `assetDisposalPostingService.ts`: 4 jogcím szerinti kivezetési kontírozás és selejtezési jegyzőkönyv PDF.

### Phase 2: Mozgások, Felelősök és Leltározás (Prioritás: P2)
1. Adatbázis migráció: `company_sub_locations` tábla és `fixed_assets.custodian_id`, `cost_center_id` mezők.
2. [TransferDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/TransferDialog.tsx) bővítése és kétnyelvű átadás-átvételi nyilatkozat PDF készítése.
3. [QrLabelDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill/src/components/fixed-assets/QrLabelDialog.tsx) bővítése Code128 vonalkóddal és etikett sablonokkal.
4. Hivatalos fordulónapi analitikus leltárív és leltárösszesítő PDF/Excel generálása.

### Phase 3: Támogatások, Komponensek és PIE Elhatárolás (Prioritás: P3)
1. Adatbázis migráció: `grant_projects` és `fixed_asset_components` táblák létrehozása.
2. Komponens-alapú ÉCS számítás kiterjesztése a [useDepreciation.ts](file:///d:/ThinkAI/Visibill/eaisybill/src/hooks/useDepreciation.ts)-ben.
3. Pályázati PIE feloldó motor (T 483 → K 964) integrálása az időszaki zárásba ([depreciationPostingService.ts](file:///d:/ThinkAI/Visibill/eaisybill/src/lib/fixed-assets/depreciationPostingService.ts)).
4. Pályázati projektlap nézet és négyoldalú rekonciliáció megvalósítása.

---

*Ez a dokumentum képezi a hivatalos, 100%-os lefedettségű fejlesztési tervet a Tárgyi Eszköz Nyilvántartó felkészítésére a teljes körű vállalati és könyvvizsgálói megfelelőségre.*
