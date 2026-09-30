# A-181: A60 Közösségi ÁFA Összesítő, VIES Integráció és 65-ös Bevallás Összefüggés-Architektúra

**Status:** Decided  
**Date:** 2026-09-30  
**Utoljára frissítve:** 2026-09-30  
**Érintett modulok:** `src/features/vat/components/VatA60Table.tsx`, `src/features/vat/core/vatEngine.ts`, `src/features/vat/hooks/useVatReturnData.ts`, `src/features/vat/types.ts`, `supabase/migrations/20260930120000_fix_vat_a60_community_and_vies.sql`  

---

## 1. Context

A magyar általános forgalmi adó törvény (Áfa tv.) és az európai uniós irányelvek alapján az áfa-alanyoknak a Közösségen belüli termékértékesítéseikről, termékbeszerzéseikről, valamint határon átnyúló szolgáltatásnyújtásaikról és szolgáltatás-igénybevételeikről havi/negyedéves A60-as összesítő nyilatkozatot kell benyújtaniuk. Ezzel egyidejűleg a havi 65-ös (NAV 2665) ÁFA bevallás megfelelő soraiban szereplő adóalapoknak kötelezően meg kell egyezniük az A60-as nyilatkozat összesített adataival.

A korábbi rendszerben három kritikus technológiai és adatkonzisztencia-probléma állt fenn:
1. **NAV OSA Aszimmetria és Hiányzó Külföldi Számlák:** A külföldi közösségi partnerek (különösen a globális technológiai szolgáltatók, pl. Google Ireland UC, Meta Platforms Ireland, Hetzner Online GmbH, Adobe Systems Software Ireland, Amazon Web Services EMEA) nem jelentenek a magyar NAV Online Számla (OSA) rendszerbe. Ezen bizonylatok kizárólag a kézi feltöltésű `invoices` táblában szerepelnek. Az A60 lekérdező motor korábban csak a `nav_invoices` táblát vizsgálta, és kizárta az `INBOUND` (bejövő) tételeket.
2. **Sorbesorolási Inkonzisztenciák a 65-ös Bevallásban:**
   - A közösségi szolgáltatásnyújtás (pl. külföldi megrendelőnek nyújtott szoftverfejlesztés vagy tanácsadás ATHK jelzéssel) tévesen a 02. sorra (termékértékesítés) került a 91–92. sorok helyett.
   - A közösségi szolgáltatás igénybevétele (pl. Google Ads, Hetzner hosting) esetén nem képződött le automatikusan a 18. sor (27% fizetendő fordított adó) és a 67. sor (27% levonható adó) kettős önadózási tétele.
3. **Kliensoldali VIES Validációs Blokkolás:** Üres kezdeti lista esetén a VIES ellenőrzési folyamat inaktív maradt, hálózati timeout vagy CORS hiba esetén pedig nem létezett robusztus tartalék stratégia.

---

## 2. Decision

### 2.1 Kétirányú Dual-Source Adatgyűjtés és Deduplikáció
Az A60 analitikai lekérdezést (`useVatReturnData.ts`) és a backend számítási logikát (`20260930120000_fix_vat_a60_community_and_vies.sql`) kétforrásúvá tettük:
- **Párhuzamos lekérdezés:** Egyidejűleg lekérdezzük a `nav_invoices` és az `invoices` táblákat a megadott adóidőszakra és cégre (`company_id`).
- **Determinisztikus Deduplikáció:** A manuálisan feltöltött `invoices` rekordok közül automatikusan kiszűrjük azokat, amelyek bizonylatszám és partner adószám / név alapján már szerepelnek a `nav_invoices` adatai között (`NOT EXISTS`).
- **Automatikus Közösségi Partner Detektálás:** A nemzetközi tech szolgáltatók adószámai (pl. Google `IE6388047V`, Meta `IE9692928F`, Hetzner `DE202897834`, Adobe `IE4994993E`) alapján a rendszer automatikusan feloldja a 2-betűs országkódot és a közösségi adószámot, még akkor is, ha a felhasználó kezdetben csak a belföldi névre keresett rá.

### 2.2 Törvényi Sorbesorolási Mátrix a Számítási Motorban (`vatEngine.ts`)
A számítási motort kiegészítettük a 4 standard A60 ügylettípus és a 65-ös bevallási sorok determinisztikus összerendelésével:

```typescript
// Közösségi termékértékesítés (01-es lap) -> 65-ös 02. sor
if (direction === 'OUTBOUND' && isCommunity && isGoods) {
  row02_base += netAmount;
  a60_goods_out.push(item);
}
// Közösségi termékbeszerzés (02-es lap) -> 65-ös 11-16. sor (fizetendő) & 69. sor (levonható)
else if (direction === 'INBOUND' && isCommunity && isGoods) {
  row11_16_base += netAmount;
  row69_base += netAmount;
  a60_goods_in.push(item);
}
// Közösségi szolgáltatásnyújtás (03-as lap) -> 65-ös 91-92. sor (Áfa tv. 37. § (1))
else if (direction === 'OUTBOUND' && isCommunity && !isGoods) {
  row91_92_base += netAmount;
  a60_services_out.push(item);
}
// Közösségi szolgáltatás igénybevétele (04-es lap) -> 65-ös 18. sor (fizetendő) & 67. sor (levonható)
else if (direction === 'INBOUND' && isCommunity && !isGoods) {
  row18_base += netAmount;
  row67_base += netAmount;
  a60_services_in.push(item);
}
```

### 2.3 Élő Európai Bizottsági VIES REST API Integráció
A VIES adószám-érvényességi ellenőrzést az Európai Bizottság hivatalos REST API végpontjára (`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{countryCode}/vat/{vatNumber}`) alapoztuk:
- **Aszinkron Párhuzamosítás:** A partnerek adószámait kötegelten, de rate-limit védett párhuzamos lekérésekkel (`Promise.allSettled`) validáljuk.
- **Állapot Perzisztencia a Kliensen:** A válaszokat memóriában gyorsítótárazzuk (`viesCache`), amely az adószám státuszát (`valid: boolean`, `name: string`, `address: string`, `requestDate: string`) tárolja.
- **Hálózati Hibatűrés:** Timeout (5000ms) vagy átmeneti VIES szerver túlterheltség esetén `error` vagy `unverified` státuszt kap a tétel anélkül, hogy megakasztaná az ÁFA bevallás szerkesztését.

### 2.4 4-Kártyás Összefüggés-vizsgálati Fejléc és Eltérés-Jelzés
A `VatA60Table.tsx` komponens tetején 4 KPI kártya mutatja a 65-ös bevallás sorai és az A60 analitika egyezését:
- Ha az A60 tételek összege fillérre egyezik a 65-ös bevallás megfelelő sorával: Zöld pipa és "Teljes egyezés" felirat.
- Ha eltérés mutatkozik: Sárga/borostyán jelvény a numerikus különbözettel és részletes magyarázó tooltippel (pl. hiányzó külföldi számlakép, tévesen belföldiként kezelt közösségi adószám).

---

## 3. Consequences

### Pozitív
- **100%-os Adatfedettség:** A külföldi tech óriások (Google, Meta, AWS, Hetzner) számlái többé nem vesznek el az A60 és a 65-ös bevallás készítésekor.
- **Könyvelői Biztonság:** Az automatikus 4-kártyás összefüggés-ellenőrzés azonnal kiszűri a sorbesorolási tévesztéseket még a NAV ÁNYK / ONYA beküldés előtt.
- **Azonnali VIES Validáció:** Egyetlen gombnyomással ellenőrizhető az összes EU partner közösségi adószáma hivatalos uniós forrásból.

### Negatív / Kockázatok
- **VIES REST API Rendelkezésre Állás:** Az Európai Bizottság VIES szolgáltatása időnként karbantartás alatt áll vagy túlterhelt, amit hálózati timeout kezeléssel és állapotjelzővel kellett kompenzálni.
- **Többforrású Lekérdezési Terhelés:** A `nav_invoices` és az `invoices` táblák párhuzamos olvasása nagyobb sávszélességet igényel, ezért a kliensen `React Query` gyorsítótárazást és szerveroldali indexelést alkalmazunk.

---

## 4. Kapcsolódó
- [BDR 064: A60 Közösségi ÁFA Összesítő és 65-ös Bevallás Összefüggés-vizsgálat](../../business/decisions/064-a60-community-vat-and-vies-crosscheck.md)
- [PRD P-144: ÁFA A60 Közösségi Összesítő és VIES Keresztellenőrzés UX](../../product/decisions/P-144-vat-a60-community-summary-and-vies-crosscheck-ux.md)
- [ADR A-159: Hivatalos ÁFA Analitika Upgrade, M-lap Master–Detail és NAV OSA Keresztellenőrzés](./A-159-statutory-vat-views-upgrade-and-osa-reconciliation.md)
- [ADR A-076: Statutory Reporting & VAT Return Monolith Deepening](./A-076-statutory-reporting-and-vat-return-monolith-modularization.md)
