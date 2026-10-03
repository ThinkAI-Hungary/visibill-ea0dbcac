---
trigger: always_on
description: Quality gates, type checking, phantom claim prevention, and verification rules before marking any task as complete in eaisybill-prod.
---

# Pre-Completion Verification & Quality Gates

## 🛑 1. Zero Phantom Claims & Evidence Before Assertions
* **Szigorúan tilos a "Fantom-állapot" (Phantom Implementation):**
  * Soha ne állítsd a felhasználónak, hogy létrehoztál, módosítottál vagy töröltél egy kódrészletet, függvényt vagy komponenst, amíg arról **nincs fizikai bizonyítékod**!
  * Nem elég a szándék: a fájlszerkesztő eszköznek (`write_to_file` vagy `replace_file_content`) fizikailag le kell futnia, és a módosításnak ténylegesen szerepelnie kell a fájlban.
* **Tilos a "Láthatatlan Verifikáció" (No Phantom Testing):**
  * Szigorúan tilos azt állítani, hogy *"a build sikeres"*, *"lefutottak a tesztek"* vagy *"nincs típushiba"*, ha a jelenlegi lépésben NEM futtattad le ténylegesen az ellenőrző parancsot (`npx tsc --noEmit` vagy `npm run build`), és nem láttad a parancs valós kimenetét.
* **Fizikai Hivatkozás Kötelezettsége:**
  * Bármilyen implementáció befejezésekor **kötelező kattintható markdown linkkel** hivatkozni a ténylegesen módosított fájlra és sorszámokra (pl. `[CompanySwitcher.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/accounty/CompanySwitcher.tsx#L45-L60)`).
* **Részleges Teljesítés Őszinte Kommunikációja:**
  * Ha egy kérés több lépésből állt, és csak egy része készült el, vagy technikai akadályba ütköztél, **tilos azt mondani, hogy "Kész van"**. Pontosan és transzparensen le kell írni: mi az, ami fizikailag elkészült, és mi az, ami még hátravan vagy további döntést igényel.

---

## 🔍 2. Kötelező Ellenőrzési Lépések (Verifikációs Kapu)
Mielőtt bármilyen kódolási feladatot befejezettnek jelentesz a felhasználónak:

1. **Gyors Kódminőség és Linter Ellenőrzés (Oxlint):**
   * Kódmódosítások után (különösen React komponensek és hookok érintettsége esetén) kötelező lefuttatni a gyors lint vizsgálatot:
     ```powershell
     # Célzottan a módosított fájl(ok)ra (azonnali, <50ms):
     npx oxlint src/components/.../MyComponent.tsx
     # Vagy a teljes projektre:
     npm run lint:fast
     ```
   * Ha a módosításodhoz kapcsolódó hiba/figyelmeztetés van (pl. hook dependency hiány, impure render, reaktív bug), javítsd ki, vagy futtasd: `npm run lint:fast:fix`.
2. **TypeScript Típusellenőrzés:**
   * Futtasd le és győződj meg a hibamentességről:
     ```powershell
     npm run build
     # vagy
     npx tsc --noEmit
     ```
   * Ha a parancs fordítási vagy típussérülést jelez, javítsd ki mielőtt válaszolsz.
3. **Kötelező Tesztelés & Tesztek Futtatása (Különösen RPC és Edge Function esetén):**
   * **Kötelező tesztírás:** Bármilyen RPC-t vagy Edge Function-t hozol létre vagy módosítasz, **szigorúan kötelező automatizált tesztet írni hozzá** (Vitest kliensoldali regressziós/szerződésteszt a `src/test/` alatt, vagy Deno teszt az Edge Function mellett).
   * **Kötelező futtatási kapu:** A verifikáció kötelező része a tesztek fizikai lefuttatása:
     ```powershell
     npm test
     # vagy célzottan:
     npx vitest run src/test/rpcPerformanceAndResilience.test.ts
     ```
   * Szigorúan tilos késznek nyilvánítani a feladatot a tesztek fizikai lefutása és zöld státusza nélkül!
4. **RPC és Adatbázis Katalógus Ellenőrzés (Élő DB):**
   * Ha RPC-t módosítottál, a katalógus lekérdezéssel (`pg_proc`) igazolni kell a volatilitást (`provolatile = 's'`) és a jogosultság-megvonást (`anon_can_execute = false`), valamint teszthívást kell futtatni egy valós adathalmazon.
5. **Konzol- és Kódtisztaság:**
   * Ellenőrizd, hogy nem hagytál hátra elfelejtett `console.log` debug sorokat, fel nem használt importokat vagy szintaktikai hibákat.
6. **Windows PowerShell Szintaxis Fegyelem:**
   * A projekt Windows alatt fut PowerShell shellben. Szigorúan tilos POSIX / Bash stílusú `&&` parancsláncolást használni, mert szintaktikai hibát dob! Mindig a pontosvesszőt (`;`) használd parancsok egymás utáni futtatásakor (pl. `git add . ; git commit -m '...' ; git push`).
7. **UI és Működési Útmutatás:**
   * Ha felületet módosítottál, pontosan írd le, hogy a felhasználó hol (melyik útvonalon, melyik gombra kattintva) és hogyan tudja ellenőrizni az eredményt.
8. **Scratch Mappa és Gyökérkönyvtár Fegyelem (Zero Workspace Clutter):**
   * Minden átmeneti segéd- vagy tesztszkriptet (`.js`, `.cjs`, `.ts`, `.py`), ideiglenes adatdumpot (`.sql`), vizsgálati kimenetet vagy szövegfájlt kötelezően a `scratch/` mappába (`d:\ThinkAI\Visibill\eaisybill-prod\scratch\`) kell elhelyezni.
   * Szigorúan tilos bármilyen egyszer használatos vagy vizsgálati fájlt a projekt gyökérkönyvtárába menteni vagy ott hagyni. A munkakönyvtárnak és a git státusznak mindig rendezettnek és tisztának kell maradnia.

---

## 🛡️ 3. Senior Quality Gate (/morfi-implementation-review)
* Ha a feladat **komplexitása nagy** (5+ fájlt érint, adatbázis-sémát vagy kritikus üzleti/számítási logikát módosít), vagy egy **előző session munkáját / handoff dokumentumát** veszed át:
  * A sima szintaktikai ellenőrzésen túl kötelező felajánlani vagy lefuttatni a `/morfi-implementation-review` mélyauditi eljárást, amely szisztematikusan átvizsgálja a lefelé irányuló adatfolyamokat, a "Falsy Zero" veszélyeket és az élő adatbázis integritást.
