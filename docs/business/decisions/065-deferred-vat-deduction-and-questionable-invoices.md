# BDR-065: ÁFA Levonásba Helyezés Halasztása és Kérdéses Számlák Üzleti Szabályzata

## 📋 Státusz
- **Dátum:** 2026-10-09
- **Státusz:** ✅ Elfogadva & Élesítve
- **Jogszabályi Hivatkozás:** Áfa tv. 153/A. § (1) bek., 137. § (adózói döntési jogkör a 2 naptári éven belüli levonhatóságra), 120. §

---

## 🎯 Kontextus és Üzleti Probléma
Gyakran előfordul, hogy egy bejövő ÁFÁs költségszámla esetén a vállalkozás és a könyvelője nem tudja a teljesítés hónapjában azonnal eldönteni, hogy az elszámolható-e vállalkozási célú költségként, illetve az ÁFA levonásba helyezhető-e (pl. bizonytalan gazdasági indokoltság, hiányzó szerződés vagy teljesítésigazolás, könyvelői egyeztetés alatt álló jogcím).

Az ÁFA törvény 153/A. § (1) bekezdése és a 137. § alapján az adóalanynak a teljesítést követő **két naptári éven belül bármelyik adómegállapítási időszakban joga van levonásba helyezni a bejövő számla előzetesen felszámított adóját**, nem kötelező a teljesítés hónapjában szerepeltetni azt.

A Visibillben eddig csak egy bináris „Kizárás a könyvelésből” kapcsoló létezett, amely a tételt végleg eltávolította a könyvelésből és az ÁFA kalkulációból, elveszítve a számlát a későbbi felülvizsgálat elől.

---

## 💡 Döntés & Megoldási Architektúra

### 1. Kétpólusú Kizárási Rendszer (`accounting_exclusion_type`)
Amikor a felhasználó kizár egy bejövő számlát a könyvelésből, explicit döntést hoz egy modális ablakban:
1. **Halasztott ÁFA levonás & Kérdéses számla (`DEFERRED_VAT`):**
   - A tétel kérdésesként nyilvántartásba kerül.
   - Indoklás adható meg (pl. „Könyvelői egyeztetés szükséges”, „Nem tisztázott üzleti cél”).
   - Nem kerül levonásra az eredeti teljesítési hónap ÁFA bevallásában.
   - Elindul a törvényi 2 éves jogvesztő határidő visszaszámlálása (`days_remaining_statutory`).
2. **Végleges kizárás (`PERMANENT`):**
   - Magánhasználat, reprezentáció vagy nem a vállalkozás érdekében felmerült költség.
   - Véglegesen kimarad a kettős könyvvitelből és az ÁFA bevallásokból.

### 2. Műszerfali "Kérdéses Számlák" Vezérlőpult (`DeferredInvoicesWidget.tsx`)
A Műszerfalon (`/`) kiemelt szekció jelenik meg az aktív kérdéses számlákról:
- KPI metrikák: Kérdéses számlák darabszáma, Függőben lévő ÁFA összeg, Függőben lévő nettó költség.
- 2 éves törvényi jogvesztő határidő visszaszámlálás:
  - 🟢 **Zöld:** > 365 nap van hátra
  - 🟡 **Sárga:** 180 - 365 nap van hátra
  - 🔴 **Piros (Kritikus):** < 180 nap van hátra
- Soronkénti gyorsműveletek:
  - **Beemelés aktuális időszakba:** egy kattintással elszámolja a kiválasztott célidőszakban.
  - **Végleges kizárás:** átváltja `PERMANENT` típusra.
  - **Tételek megtekintése:** tételes sorok átnézése.
- Tömeges beemelési funkció a kijelölt számlákra.

### 3. ÁFA Bevallás & Hónapzárási Kapu (`DeferredVatPromptBanner.tsx`, `DeferredVatPromptDialog.tsx`)
A 2665-ös ÁFA bevallás felületére (`/vat-return`) lépve, vagy bevallás lezárásakor/véglegesítésekor a rendszer automatikusan ellenőrzi, hogy vannak-e függőben lévő kérdéses számlák:
- Figyelmeztető banner jelzi a függő tételeket és az ÁFA összeget.
- Egy interaktív dialógusban a felhasználó kijelölheti, mely számlákat kívánja beemelni a vizsgált havi bevallásba (`target_period = 'YYYY-MM'`).
- A beemelt számlák azonnal megjelennek a 65-ös bevallás 64–66. soraiban, a 65M belföldi tételes összesítő lapon, és a kettős könyvvitelben költségként elszámolásra kerülnek.

### 4. Adatbázis & RPC Motor
- Oszlopok: `accounting_exclusion_type`, `deferred_vat_reason`, `deferred_vat_since`, `deferred_vat_target_period` a `nav_invoices`, `invoices`, `nav_invoice_items`, `invoice_items` táblákon.
- RPC-k:
  - `public.set_invoice_accounting_exclusion(p_company_id, p_invoice_id, p_is_submitted, p_exclusion_type, p_reason)`
  - `public.include_deferred_invoice_in_period(p_company_id, p_invoice_id, p_is_submitted, p_target_period)`
  - `public.get_questionable_invoices(p_company_id)`
  - `public.calculate_hungarian_vat_return`: a célidőszakra beemelt halasztott számlákat az adott időszak levonható soraiban (64-66) és 65M-ben automatikusan szerepelteti.

---

## 🔒 Biztonság és Jogosultság
- RLS & SECURITY DEFINER védelem: csak a cég tagjai és belső support adminisztrátorok módosíthatják vagy tekinthetik meg a kérdéses számlákat.
- Anonim végrehajtás szigorúan tiltva (`REVOKE ALL FROM anon, PUBLIC`).

---

## 🔗 Kapcsolódó
- **ADR:** [A-234: ÁFA Levonásba Helyezés Halasztása és Kérdéses Számlák Architektúrája](../../architecture/decisions/A-234-deferred-vat-deduction-and-questionable-invoices-architecture.md)
- **PRD:** [P-172: ÁFA Levonásba Helyezés Halasztása és Kérdéses Számlák UX](../../product/decisions/P-172-deferred-vat-deduction-and-questionable-invoices-ux.md)
- **Adatbázis Séma:** [04-invoices.md](../../architecture/database/04-invoices.md) · [05-nav.md](../../architecture/database/05-nav.md)

