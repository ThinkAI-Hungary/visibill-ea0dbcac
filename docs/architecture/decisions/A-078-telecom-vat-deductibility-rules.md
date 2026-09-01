# A-078: Telefonszámla ÁFA Részleges Levonhatóság (70/30 Szabály) és Tételszintű Arányosítás

> **Státusz:** ✅ Decided  
> **Dátum:** 2026-09-01  
> **Érintett komponensek:** `nav_invoice_items`, `invoice_items`, `calculate_vat_return` RPC, `InvoiceItemsDialog.tsx`, `VatRowDrillDown.tsx`, `useVatReturnData.ts`  
> **Kapcsolódó PRD:** [P-032](../../product/decisions/P-032-vat-return-workflow.md), [P-060](../../product/decisions/P-060-statutory-reporting-and-vat-return-modular-ux.md)  
> **Kapcsolódó ADR-ek:** [A-051](./A-051-vat-return-auto-seed-and-date-fallback.md), [A-076](./A-076-statutory-reporting-and-vat-return-monolith-modularization.md)

---

## 1. Kontextus és Üzleti Igény

A magyar Áfa törvény (2007. évi CXXVII. törvény 124. § (2) bek. b) és 125. § (1) bek. c)) alapján a vezetékes és mobiltelefon-szolgáltatást terhelő előzetesen felszámított adó összegének **70%-a vonható le**, 30%-a nem helyezhető levonásba (főszabály szerinti vélelmezett magánhasználat miatt). Ugyanakkor az internethozzáférési szolgáltatás (5% ÁFA) 100%-ban levonható, valamint a telefonkészülék, tablet és hardver termékbeszerzés (tárgyi eszköz) szintén 100%-ban levonható.

A valóságban a távközlési szolgáltatók (Magyar Telekom, Yettel, Vodafone / One Magyarország, Digi, Opennetworks) számláin vegyesen szerepelnek:
1. 27%-os telefonszolgáltatási díjak (pl. havidíjak, beszélgetési forgalmi díjak, SMS), amelyek 70%-ban levonhatók.
2. 5%-os internet hozzáférési tételek (pl. mobiladat csomagok), amelyek 100%-ban levonhatók.
3. 27%-os IT eszközbérleti vagy készülékvásárlási tételek (pl. iPhone, telefonkészülék), amelyek 100%-ban levonhatók.

Korábban a Visibill az ÁFA kalkulációt kizárólag a `vat_codes` tábla és az adókulcs (`vat_rate`) alapján végezte, így minden 27%-os bejövő tétel adótartalmát 100%-ban a 66. sorba sorolta be, manuális korrekcióra kényszerítve a könyvelőt az ÁFA bevallás véglegesítésekor.

---

## 2. Döntés

Bevezetésre került a **tételszintű részleges ÁFA levonhatósági arány (`deductible_percentage`)** az adatbázisban, a kalkulációs motorban és a felhasználói felületen:

### A. Adatbázis Séma
- A `nav_invoice_items` és `invoice_items` táblák bővültek:
  `deductible_percentage NUMERIC(5,2) NOT NULL DEFAULT 100.00 CHECK (deductible_percentage >= 0 AND deductible_percentage <= 100)`
- Alapértelmezett értéke `100.00%`, így minden meglévő és új számlatétel kompatibilis marad, regresszió nélkül.

### B. Kalkulációs Motor (`calculate_vat_return` RPC)
- A bejövő számlák aggregációjakor a motor tételenként figyelembe veszi a levonhatósági arányt:
  - Adóalap a 2665 66. sorába: `ROUND(nii.net_amount * (deductible_percentage / 100.0), 2)`
  - Adóösszeg a 2665 66. sorába: `ROUND(nii.vat_amount * (deductible_percentage / 100.0), 2)`
- Ezzel a 66. sorban szereplő adóalap és adó hányadosa pontosan 27%-ot ad ki, megelőzve az ÁNYK XML és ellenőrző modulok matematikai figyelmeztetéseit.
- Az M-lap (`vat_return_m_lines`) adóösszegei és a számlarészletező `invoice_details` JSONB szintén a ténylegesen levonható adót tükrözik.

### C. Felhasználói Élmény és Intelligens Automatizálás (`InvoiceItemsDialog.tsx`)
1. **Csak Bejövő számlákra érvényes:** Kimenő számláknál (`OUTBOUND`) a levonhatósági vezérlők rejtve maradnak, mivel kimenő értékesítésnél a teljes áfa fizetendő adó.
2. **Tételszintű vezérlő:** Minden bejövő számlatétel sorában megjelenik a „Levonhatóság” dropdown/badge (`100%`, `70% (70/30)`, `50%`, `0%`), amellyel azonnal egyénileg módosítható a tétel adójának levonhatósága.
3. **Távközlési számla okos felismerése & Gyorsgomb:** Ha a rendszer távközlési szolgáltatót (Telekom, Yettel, Vodafone, One Magyarország, Digi, Opennetworks, Invitel, Cetin, UPC) vagy telefonszolgáltatási kulcsszót észlel, a fejlécben kiemelt sávban megjelenik a *„70/30 szabály alkalmazása (27%-os tételekre)”* gomb. Rákattintva egyetlen művelettel a 27%-os telefon tételeket 70%-ra állítja, miközben az 5%-os internet tételeket érintetlenül (100%-on) hagyja.
4. **Tömeges művelet:** Kijelölt sorok esetén a láblécben a *Levonhatóság* menüből egy kattintással átállítható a kijelölt tételek aránya.
5. **Drill-down transzparencia (`VatRowDrillDown.tsx`):** A 66. sor részletező nézetében a rendszer jelöli a 70%-os levonhatóságú tételeket és az arányosított adóalapot/adót mutatja.

---

## 3. Következmények

- **Könyvelői hatékonyság:** A vegyes (telefon + internet) távközlési számlák feldolgozása automatizálttá válik, nincs szükség a 2665-ös ÁFA bevallás 66. sorának manuális újraszámolására és felülbírálására.
- **Hivatalos megfelelőség:** A NAV ÁNYK XML export matematikai és strukturális egyezősége garantált.
- **Nulla regresszió:** Az alapértelmezett 100%-os levonhatóság miatt minden nem-telefonszámla és korábbi bevallás változatlanul működik.
