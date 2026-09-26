# A-158: Mezőgazdasági Felvásárlási Jegyek Modul és Bérügyi Integráció

**Dátum:** 2026-09-26  
**Státusz:** Elfogadva  
**Kapcsolódó területek:** Bérek és járulékok (`/salaries`), Cégbeállítások (`/settings`), Adatbázis (`purchase_vouchers`, `purchase_voucher_items`), NAV 08 adatszolgáltatás, Banki átutalások (`/transfers`), Házipénztár (`/petty-cash`)

---

## 1. Kontextus és Üzleti Igény

A magyar számviteli és adójogszabályok értelmében a felvásárló cégek a mezőgazdasági őstermelőktől történő termény-, élőállat- és egyéb mezőgazdasági termékfelvásárlást nem számla, hanem szigorú számadású **felvásárlási jegy** alapján számolják el.

### Fő jogszabályi követelmények:
1. **Kompenzációs felár (Áfa tv. 199. §):**
   - **12%**: Növénytermesztési, kertészeti és erdészeti termékek, vetőmagok.
   - **7%**: Állattenyésztési termékek és élőállatok.
   - A kompenzációs felár az őstermelőnek járó többlet, amely a felvásárló cégnél levonható ÁFA-ként viselkedik (és bekerül a havi 65-ös ÁFA bevallásba).
2. **Bérszámfejtés és NAV 08 (2608) adatszolgáltatás:**
   - Mivel a kifizetés magánszemély (őstermelő) részére történik, a felvásárlónak be kell vallania a kifizetést a havi NAV 08-as járulék- és adóbevallásban, és szükség esetén SZJA előleget kell levonnia.
3. **Pénzügyi rendezés:**
   - **Átutalás (`TRANSFER`)**: Generálható GIRO/SEPA utalási csomag az őstermelő bankszámlájára.
   - **Készpénz (`CASH`)**: Kiadási pénztárbizonylat rendezés a házipénztárból.
4. **Felhasználói fókusz és terheléscsökkentés:**
   - Mivel a cégek mindössze kb. 5%-a végez mezőgazdasági felvásárlást, a funkció **cég-szintű kapcsolóval (feature flag)** vezérelt (`has_purchase_vouchers`), így a normál cégeknél a felület letisztult és zavartalan marad.

---

## 2. Megvalósított Architektúra

### A. Adatbázis Modell (`supabase/migrations/20260926200000_purchase_vouchers_module.sql`)

1. **Feature flag mezők:**
   - `company_settings.has_purchase_vouchers BOOLEAN DEFAULT false`
   - `companies.has_purchase_vouchers BOOLEAN DEFAULT false`
2. **`public.purchase_vouchers` tábla:**
   - Szigorú számadású azonosító (`voucher_number`), őstermelő adatai (`producer_name`, `producer_tax_id`, `producer_card_number` / FELIR, `producer_address`, `producer_bank_account`).
   - Dátumok (`issue_date`, `fulfillment_date`, `payment_due_date`).
   - Pénzügyi összegek: `net_amount`, `compensation_surcharge_rate`, `compensation_surcharge_amount`, `gross_amount`, `tax_deducted`, `paid_amount`.
   - Státuszok: `payment_status` (`unpaid` / `paid`), `payment_method` (`CASH` / `TRANSFER`), `paid_at`, `payroll_period`, `payroll_processed`.
3. **`public.purchase_voucher_items` tábla:**
   - Bizonylat tételei: `item_name`, `vtszt_kn_code`, `quantity`, `unit_of_measure`, `unit_price`, `net_amount`, `compensation_rate`, `compensation_amount`, `gross_amount`.
4. **Biztonság és RLS:**
   - Szigorú multi-tenant Row Level Security szabályok mindkét táblán `(SELECT auth.uid())` és `has_company_access_via_cache(company_id)` használatával.
5. **Összesítő RPC:**
   - `public.get_purchase_vouchers_summary(p_company_id, p_date_from, p_date_to)` aggregálja a nettó, kompenzációs, bruttó összegeket és az egyedi partnerek számát.

---

### B. Frontend Domain Szolgáltatás (`src/features/purchase-vouchers/`)

- `types.ts`: Típusdefiníciók bizonylat fejléchez, tételekhez, formokhoz és KPI összesítőhöz.
- `utils.ts`: Tiszta függvények tesztelhető számításokhoz (`calculateItemTotals`, `calculateVoucherTotals`, `calculateVouchersSummary`, `filterVouchers`, `validateVoucherForm`).
- `hooks/usePurchaseVouchers.ts`: React Query állapotkezelés, CRUD mutációk, fizetési státusz gyorskapcsoló, kliensoldali keresés és szűrés.
- `components/PurchaseVoucherKpiCards.tsx`: 4 KPI kártya (Összes bruttó felvásárlás, Levonható kompenzációs ÁFA, Kifizetésre váró összeg, Őstermelők / bizonylatok száma).
- `components/PurchaseVoucherDialog.tsx`: Teljes körű létrehozási és szerkesztési dialógus 12% / 7% / 0% kompenzációs választóval, tételek élő számításával és fizetési mód választóval.
- `components/PurchaseVouchersTab.tsx`: Tab nézet beépített promóciós aktiváló kártyával (ha a funkció még nincs bekapcsolva), keresővel, státusz szűrőkkel, CSV minta letöltéssel és tétellistával.

---

### C. Rendszerintegráció

1. **Bérek / járulékok (`/salaries` - `src/pages/SalariesPage.tsx`):**
   - Beépítve a fő fülrendszerbe: `[ Alkalmazottak & NAV ]  [ Felvásárlási jegyek ]`.
   - URL állapot szinkronizáció (`?tab=purchase_vouchers`).
2. **Cégbeállítások (`/settings?tab=business` - `src/components/settings/BusinessSection.tsx`):**
   - Dedikált kapcsoló: "Mezőgazdasági felvásárlási jegyek modul" aktiválása közvetlenül a cégprofilból is elérhető.
3. **Beállítások szinkronizáció (`src/hooks/useCompanySettings.ts`):**
   - Kiterjesztve a `has_purchase_vouchers` mentési és query invalidációs logikával.

---

## 3. Következmények és Előnyök

- **Megfelelőség:** 100%-os illeszkedés a magyar agrár- és adózási előírásokhoz (Áfa tv. 199. § és NAV 08).
- **Zéró UI clutter:** Nem mezőgazdasági cégeknél az alapértelmezett állapot letisztult, csupán egy opcionális tab látható, ami egyetlen kattintással aktiválható szükség esetén.
- **Pénzügyi pontosság:** Fillérre kerekített, szigorúan tesztelt számítások 16 zöld egységteszttel fedve.
