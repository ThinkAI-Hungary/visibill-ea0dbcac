# Decision 062: DRS Kötelező Visszaváltási Díj (Kupakdíj / Betétdíj) Kizárása az ÁFA Bevallásból

**Status:** Decided  
**Category:** ÁFA, Számlázás, Jogszabályi Megfelelőség  
**Date:** 2026-09-24  

---

## Question
Hogyan kell kezelni a DRS (MOHU kötelező visszaváltási rendszer) szerinti 50 Ft-os visszaváltási díjat (köznyelvben kupakdíj, palackdíj, betétdíj) az ÁFA bevallásban (NAV 65-ös bevallás sorai és M-lapok) és a belső gyűjtőkódos analitikában?

---

## Decision

Az Áfa törvény 71. § (1) bekezdése alapján a kötelező visszaváltási díj nem képezi az adó alapját (*ÁFA tárgyi hatályán kívüli* / ATK tétel). Ezért a rendszer az alábbi szabályokat alkalmazza:

### 1. Hivatalos NAV 65 ÁFA Bevallásból Való Teljes Kizárás
- A DRS visszaváltási díj tételek **100%-ban kizárásra kerülnek** a hivatalos NAV 65-ös ÁFA bevallás kalkulációjából (`calculate_vat_return`), sem az adómentes (pl. 63-as sor), sem az adóköteles (pl. 66-os vagy 07-es sor) bevallási sorokba nem kerülhetnek bele.
- A belföldi partnerösszesítő M-lapokról (`vat_return_m_lines`) szintén kizárásra kerülnek a DRS tételek; az M-lap számlaösszesítő alap- és áfaösszegeit a tétel-összegzésből képezi a rendszer a DRS sorok kihagyásával.

### 2. Sor Drilldown (Részletező) Védelem
- A `VatRowDrillDown.tsx` komponensben a drilldown tételszűrő (`isItemForThisRow`) automatikusan kiszűri a DRS tételeket.
- A kibontott tételes táblázatban a bizonylathoz tartozó tétel-bontás kizárólag az adott bevallási sorhoz tartozó érvényes tételeket jeleníti meg (`displayItems`).

### 3. ÁFA Gyűjtőkódos Analitika
- A belső ellenőrzési és audit célú ÁFA Gyűjtőkódos Analitikában (`VatCollectorAnalyticsView.tsx`) a DRS tételek nem vesznek el, hanem egy dedikált **'ÁHK'** (*Áfa hatályán kívüli / DRS kupakdíj*) csoportba sorolódnak 0 Ft ÁFA összeggel és megkülönböztetett borostyán (amber) badge vizuális jelöléssel.
- Ezáltal a könyvelő a gyűjtőkódos kimutatásban látja a teljes bizonylat-egyezést, miközben a hivatalos ÁFA bevallást a tétel nem torzítja.

### 4. Tétel-Felismerési Szabály (False Positive Védelem)
- Egy tétel kizárólag akkor minősül DRS betétdíjnak, ha:
  1. `vat_amount == 0` (vagy null / nem adóköteles kulcs), **ÉS**
  2. A tételleírás tartalmazza a DRS kulcsszavakat (`visszavált%`, `visszavalt%`, `drs%`, `betétdíj%`, `betetdij%`, `kupakdíj%`, `kupakdij%`, `palackdíj%`, `palackdij%`).
- Az olyan valós 27%-os termékek, amelyek nevében szerepel a DRS (pl. *"Hell energiaital Classic DRS"*, *"0,5L PET Pepsi Cola DRS"*), `vat_amount > 0` adótartalommal rendelkeznek, így ezek maradnak a normál 27%-os adóalapban.

---

## Rationale
A 2024-ben bevezetett MOHU DRS visszaváltási rendszer díja jogszabályilag nem képezheti az áfa alapját. Ha a DRS tétel bekerülne a 63-as (mentes) vagy 66-os (27%) sorba, az torzítaná a bevallást és adóhatósági ellentmondást eredményezne. Az elkülönített 'ÁHK' gyűjtőkód biztosítja a könyvelési teljességet a NAV 65 bevallási sorok érintetlenül hagyása mellett.

---

## Kapcsolódó
- **Jogszabály**: Áfa tv. 71. § (1) bekezdés (Adóalapba nem tartozó tételek)
- **Migráció**: `supabase/migrations/20260924140000_exclude_drs_deposit_fee_from_vat_return.sql`
- **Frontend komponensek**:
  - `src/components/vat/VatRowDrillDown.tsx`
  - `src/features/vat/components/VatCollectorAnalyticsView.tsx`
- **Tesztek**: `src/test/vat/drsExclusion.test.ts`
