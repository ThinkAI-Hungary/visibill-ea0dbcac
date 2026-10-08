# P-171: Utalások Tömeges Rendezés, Kiállítási Dátum Alapértelmezés és Alsó Akciósáv UX

**Status:** Decided  
**Date:** 2026-10-08  
**Category:** UI / Workflow  
**Kapcsolódó ADR:** [A-233: Kézi Készpénzes Számlarendezések Automatikus Házipénztár Integrációja és GLS Kompenzációs Normalizálás](../../architecture/decisions/A-233-transfers-manual-cash-settlement-to-petty-cash-and-gls-compensation-normalization.md)

---

## 1. Problémafelvetés & Felhasználói Igények

Az **Utalások** (`/transfers`) felület célja, hogy a felhasználók egy pillantással átlássák a kifizetésre váró bejövő számlákat és banki átutalási csomagokat generálhassanak. A gyakorlatban azonban sok számla nem banki utalással, hanem egyéb módokon (készpénz, magánkártya, kompenzáció) rendeződik. Ezzel kapcsolatban az alábbi felhasználói akadályok merültek fel:

1. **Hiányzó tömeges művelet:** Több tucat vagy több száz számla kézi rendezésekor a felhasználónak minden egyes tételnél külön-külön meg kellett nyitnia a rendezési modált, ami extrém időigényes és hibalehetőségekkel teli volt.
2. **Kényszerített mai fizetési dátum:** A kézi rendezés modál a fizetés napját mereven a mai napra állította be, miközben a múltban rendezett számláknál (pl. hetekkel ezelőtt kiegyenlített készpénzes számláknál) a számla eredeti kiállítási vagy esedékességi napja lett volna a könyvelésileg helyes dátum.
3. **Akciógombok zsúfoltsága:** A tömeges rendezés gomb elhelyezése a felső statisztikai kártyán vizuálisan zsúfolttá tette a fejlécet és elszakadt a táblázatban kijelölt tételektől.

---

## 2. Termékdöntések (UX & Workflow)

### 2.1 Alapértelmezett Kiállítási Dátum & Dátumváltó Gyorsgombok
1. Amikor a felhasználó a táblázat soraiban a **Kézi rendezés** gombra kattint:
   - A fizetés dátuma alapértelmezetten a számla eredeti **kiállítási dátumára** (`issue_date`) áll be (ha nincs, az esedékességre / mai napra).
   - A dátumválasztó mező fölé két dedikált gyorsgomb került: **`[Kiállítás napja]`** és **`[Mai nap]`**.
   - Egyetlen kattintással válthat a felhasználó a valós kiállítási nap és a mai nap között manuális naptári keresgélés nélkül.

### 2.2 Lebegő Alsó Akciósáv (Sticky Action Bar) Integráció
1. A tömeges művelet gombja kikerült a felső statisztikai kártyáról.
2. Amikor a táblázatban a felhasználó egy vagy több számlát kipipál:
   - A képernyő alján megjelenik a lebegő akciósáv (**Sticky Action Bar**).
   - A sáv bal oldalán látható a kijelölt tételek száma és a fizetendő bruttó végösszeg.
   - A sáv jobb oldalán az **`Utalási lista letöltése`** gomb mellett helyet kap a zöld szegéllyel kiemelt **`Tömeges rendezés`** gomb.

### 2.3 Tömeges Kézi Rendezés Modál
A gombra kattintva felugró modálban:
1. **Összesítő kártya:** Kijelölt partnerek száma, érintett számlák összesített darabszáma és végösszege.
2. **Rendezés dátuma (RadioGroup):**
   - **Számlák kiállítási dátuma:** Minden kijelölt számla a saját eredeti kiállítási napjával kerül lezárásra (ajánlott múltbeli számlákhoz).
   - **Mai nap:** Minden számla a mai nappal zárul le.
   - **Egyedi megadott dátum:** Egyetlen közös egyedi nap adható meg az összes kijelölt számlához.
3. **Fizetési mód kiválasztása:**
   - Készpénz / Házipénztár (`cash`) -> automatikusan házipénztári tételt generál (A-233).
   - Magánkártya / Tulajdonosi elszámolás (`private_card`).
   - Kompenzáció / Beszámítás (`compensation`).
   - Egyéb (`other`).
4. **Megjegyzés mező:** Opcionális közös megjegyzés (alapértelmezetten: *Tömeges rendezés (<Partner neve>)*).

---

## 3. Megvalósítás és Érintett Fájlok

- `src/pages/TransfersPage.tsx`: Tömeges rendezési modál, lebegő akciósáv gombok, quick-toggle dátumkezelés.
- `src/locales/hu/transfers.json`: `bulk_settle`, `floating_bar` lokalizációs kulcsok.
- `src/test/bulkSettleAndCompensationNormalization.test.ts`: Vitest tesztcsomag.
