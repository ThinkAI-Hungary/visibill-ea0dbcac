# P-162: NAV 2665 ÁFA Bevallás: 77. Sor (Közösségi Értékesítés) Adóalap és 01-03 Lap UX

**Status:** Decided  
**Date:** 2026-10-05  
**Utoljára frissítve:** 2026-10-05  
**Kategória:** UI / Adózás & NAV Replika  
**Kapcsolódó ADR:** [A-203](../../architecture/decisions/A-203-nav-2665-vat-return-row77-base-amount.md)  
**Kapcsolódó PRD:** [P-160](./P-160-nav-2665-vat-return-row43-and-row45-tax-amount-ux.md) · [P-032](./P-032-vat-return-module.md)

---

## 1. Kérdés és Felhasználói Kontextus
Hogyan jelenjen meg a 2665-ös ÁFA bevallás hivatalos nyomtatvány replikájában a 77. sor (Közösségi adómentes termékértékesítés), tekintettel arra, hogy ennél a sornál kizárólag adóalap rovat létezik a hivatalos NAV nyomtatványon, és a bevallás 77–94. sorai a 2665A-01-03 lapon helyezkednek el?

---

## 2. Termékdöntés és Megoldás

### 1. 2665A-01-03 Nyomtatvány Lap Bevezetése (`Nav2665Sheet0103.tsx`)
A digitális replika felületét kibővítettük a hivatalos harmadik belső lappal:
- Megjeleníti a 77–94. sorokat (közösségi ügyletek, mezőgazdasági kompenzáció, egyéb mentességek).
- Lapozható tabként érhető el a `01-01` és `01-02` lapok mellett.

### 2. Egyrovatos Adóalap Mező a 77. Sornál
- A hivatalos NAV ÁNYK nyomtatvány logikáját követve a 77. sornál **kizárólag az adóalap mező** aktív.
- Nincs felesleges vagy letiltott ÁFA összeg mező a sorban, megelőzve a felhasználói félreértéseket (mivel adómentes értékesítésről van szó, az ÁFA összege 0 és nem szerepel a NAV rovatában).

### 3. Összefüggés a Tételes Analitikával és az A60 Összesítővel
- A 77. sorra kattintva a felugró tételes analitika listázza az érintett közösségi partnereknek kiállított számlákat és tételeket.
- Az összeg forintra megegyezik a 26A60-as összesítő nyilatkozatban szereplő partner-összesítőkkel.

---

## 3. Kapcsolódó
- [A-203: NAV 2665 77. Sor Adóalap Implementáció](../../architecture/decisions/A-203-nav-2665-vat-return-row77-base-amount.md)
- [P-160: NAV 2665 43. és 45. Sorok Adóösszeg UX](./P-160-nav-2665-vat-return-row43-and-row45-tax-amount-ux.md)
