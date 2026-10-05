# A-203: NAV 2665 ÁFA Bevallás: 77. Sor (Közösségi Adómentes Termékértékesítés) Adóalap Implementáció és 2665A-01-03 Nyomtatvány Replika

**Status:** Decided  
**Date:** 2026-10-05  
**Utoljára frissítve:** 2026-10-05  
**Kapcsolódó döntések:** [A-051: ÁFA Bevallás Kalkuláció Robusztusság](./A-051-vat-return-auto-seed-and-date-fallback.md) · [A-080: NAV ÁNYK 2665 ÁFA-Bevallás](./A-080-nav-anyk-vat-return-xml-standardization.md) · [A-131: NAV 2665 ÁFA Bevallás Sormegfeleltetés](./A-131-nav-2665-vat-return-restructuring-and-steel-reporting.md) · [A-167: NAV 2665 Hivatalos Nyomtatvány Digitális Replika](./A-167-nav-2665-official-tax-form-digital-replica.md) · [A-201: NAV 2665 43. és 45. Sorok Adóösszeg](./A-201-nav-2665-vat-return-row43-and-row45-tax-amount.md) · [P-162: NAV 2665 77. Sor Adóalap UX](../../product/decisions/P-162-nav-2665-vat-return-row77-base-amount-ux.md)

---

## Context

Az EB-0117-es ügyfélszolgálati hibajegy folytatásában a könyvelő jelezte, hogy a 2665-ös ÁFA bevallás nem hozta az adóalap összeget a 77. sorba (Közösségen belüli adómentes termékértékesítés, Áfa tv. 89. §).

A hivatalos Nemzeti Adó- és Vámhivatal (NAV) 2665 nyomtatvány (2665A-01-03 lap) és a kapcsolódó kitöltési útmutató tüzetes vizsgálata megerősítette:
1. A 77. sor mint adómentes jogcím **kizárólag adóalap rovattal** rendelkezik a NAV nyomtatványon (ÁNYK mezőkód: `0C0001C0077BA`). Adó rovat ennél a sornál nincs, és az ÁNYK-ban sincs hozzá adóösszeg mező.
2. A `vat_form_rows` táblában korábban tévesen `has_base = false` és `has_tax = false` szerepelt erre a sorra, és a `calculate_hungarian_vat_return` adatbázis RPC-ben hiányzott a 77. sor gyűjtése, így fix 0 került beszúrásra a `vat_return_lines`-ba.
3. A frontend nyomtatvány replikában korábban csak a 01-01 és 01-02-es lapok léteztek (`Nav2665Sheet0101.tsx`, `Nav2665Sheet0102.tsx`), a 77–94. sorokat tartalmazó 2665A-01-03-as lap replika komponense hiányzott.

---

## Decision

1. **Adatbázis séma metaadatok frissítése (`vat_form_rows`):**
   A `public.vat_form_rows` táblában a `row_number = '77'` sornál a `has_base` mezőt `true` értékre állítottuk a magyar joghatóságra (`country_code = 'HU'`), rögzítve, hogy a sornak kötelező adóalap rovata van.

2. **Számítási motor kibővítése (`calculate_hungarian_vat_return`):**
   - Változók bevezetése: `v_line77_net NUMERIC := 0;`.
   - Tételszintű akkumuláció: amennyiben a tétel adómentes közösségi értékesítéshez tartozik (ÁFA kód szerinti cél-sor = '77' vagy kézi felülbírálás `vat_row_override = '77'`), a nettó összeg akkumulálódik `v_line77_net`-be.
   - Sorbeszúrás: a `vat_return_lines` táblába beszúrásra kerül a 77-es sor a számított adóalappal és a kerekített eFt értékkel (`ROUND(v_line77_net/1000)::int`), míg az adóösszeg 0 marad.

3. **Frontend nyomtatvány replika modul (`Nav2665Sheet0103.tsx`):**
   - Létrehoztuk a hivatalos 2665A-01-03 lap hű digitális másolatát (`src/components/vat/Nav2665Sheet0103.tsx`), amely megjeleníti a 77–94. sorokat.
   - A 77. sornál kizárólag az adóalap mező szerkeszthető/megjeleníthető (`hasBase={true}`, `hasTax={false}`), a hivatalos nyomtatvány elrendezésével megegyezően.
   - Integráltuk a `Nav2665FormReplica.tsx` nézetbe lapozható fülként.

---

## Consequences

### Pozitív
- A 2665-ös ÁFA bevallásban a közösségi adómentes értékesítések adóalapja hibátlanul bekerül a 77. sorba.
- Teljes vizuális összhang a NAV ÁNYK 2665A-01-03 lapjával.
- Az A60-as összesítő nyilatkozat és a 65-ös bevallás 77. sora közötti rekonciliáció automatikusan egyezést mutat.

---

## Kapcsolódó
- [P-162: NAV 2665 77. Sor Adóalap UX](../../product/decisions/P-162-nav-2665-vat-return-row77-base-amount-ux.md)
- [A-201: NAV 2665 43. és 45. Sorok Adóösszeg](./A-201-nav-2665-vat-return-row43-and-row45-tax-amount.md)
- [A-167: NAV 2665 Hivatalos Nyomtatvány Digitális Replika](./A-167-nav-2665-official-tax-form-digital-replica.md)
