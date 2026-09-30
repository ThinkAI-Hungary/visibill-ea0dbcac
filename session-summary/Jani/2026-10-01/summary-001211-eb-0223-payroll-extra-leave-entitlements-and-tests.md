# Session Summary — 2026-10-01 00:25

```text
feat(payroll, support, docs): EB-0223 pótszabadság-jogcímek dinamikus törzsadat-feloldása (Mt. 116-122. §), UI tájékoztató kártya, Vitest tesztek és P-149 / A-186 doc-sync

- Ügyfélszolgálati Jegy Kivizsgálás & Elemzés (EB-0223, VBV Vision Kft.)
  - Beérkező könyvelői kérdés: hol és miként szükséges felvinni a munkavállalók pótszabadságait a törzsbe a havi bérszámfejtéshez
  - Read-only Supabase DB vizsgálat: `accounty_employees` (16 aktív dolgozó), `accounty_dependents`, `accounty_declarations` és `accounty_leaves` táblák feltárása
  - Kétkomponensű szakmai jelentés generálása: közérthető, lépésről lépésre navigáló ügyfélszolgálati választervezet és belső technikai elemzés

- Pótszabadság- és Szabadságmérleg Motor Bővítése (`leaveCalculator.ts`, `index.ts`)
  - Gyökérok: az `EmployeeDetailsPage.tsx` korábban hardkódolt `childrenUnder16: 0` és `disabledChildren: 0` értékekkel hívta meg a szabadságkalkulátort, így a felületen rögzített eltartottak után járó napok nem jelentek meg a Szabadság fülön
  - Új `resolveEmployeeLeaveInput` tiszta architektúrájú feloldó függvény bevezetése a `leaveCalculator.ts`-ben
  - Mt. 117. § (Életkori pótszabadság): automatikus megállapítás a születési dátumból (25 éves kortól 1 nap, 45 éves kortól 10 nap)
  - Mt. 118. § (Gyermekek utáni pótszabadság): 16. életévüket a tárgyévben vagy utána betöltő gyermekek szűrése az `accounty_dependents` táblából (magzatok kizárása), 1 gyermek = 2 nap, 2 gyermek = 4 nap, 3+ gyermek = 7 nap
  - Fallback mechanizmus: ha az eltartottak táblája üres, az aktív `family` adóelőleg-nyilatkozat paramétereiben rögzített gyermekek listájának és darabszámának beolvasása
  - Mt. 118. § (2): Tartósan beteg/fogyatékos gyermekek után járó +2 munkanap pótszabadság feloldása
  - Mt. 120. §: Megváltozott munkaképesség / személyi kedvezmény (`personal` nyilatkozat) esetén évi 5 munkanap pótszabadság automatikus jóváírása
  - Időarányosítás & Napi munkaóra: belépési/kilépési dátumok és részmunkaidős heti óraszámok átadása a törvényes szabadság-időarányosításhoz

- Dolgozói Felület és UI/UX Ergonómia (`EmployeeDetailsPage.tsx`, `EmployeeLeaveTab.tsx`)
  - `usePayrollDependents` hook bekötése a dolgozó adatlapjára és a `leaveBalance` dinamikus összekapcsolása a `resolveEmployeeLeaveInput` segítségével
  - Jogszabályi útmutató kártya beépítése az `EmployeeLeaveTab.tsx`-ben a "Részletes Szabadság Nyilvántartás (Mt.)" táblázat alá (világos magyarázat a könyvelőknek az életkori, gyermek utáni és havi számfejtési elszámolásról)

- Minőségbiztosítás & Vitest Tesztek
  - Átfogó Vitest tesztcsomag létrehozása a `leaveCalculator.test.ts`-ben (8 új teszteset, Mt. 117-122. § összes életszerű esete és határértéke)
  - Vitest teszteredmény: 30/30 teszt zöld (`src/lib/payroll/__tests__/leaveCalculator.test.ts`)
  - Szigorú TypeScript típusellenőrzés: `npx tsc --noEmit` hiba nélkül lefutott (code 0)

- Dokumentáció Szinkronizáció (Doc-Sync: PRD & ADR)
  - Új PRD létrehozása: `docs/product/decisions/P-149-payroll-leave-entitlements-and-guidance-card-ux.md`
  - Új ADR létrehozása: `docs/architecture/decisions/A-186-payroll-leave-entitlements-resolution-engine.md`
  - PRD nyilvántartás frissítése: `docs/product/decisions/index.md` (161 döntés)
  - ADR nyilvántartás frissítése: `docs/architecture/decisions/index.md` (204 döntés)
  - Tudásgráf szinkronizáció: `graphify update .` sikeresen lefutott (23 412 node, 39 144 edge frissítve)

- Git Commit és Push
  - Commit hash: `65c94b8a`
  - Branch: `main` -> `origin/main` (GitHub távoli repó naprakész)
```
