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
  * Bármilyen implementáció befejezésekor **kötelező kattintható markdown linkkel** hivatkozni a ténylegesen módosított fájlra és sorszámokra (pl. `[CompanySwitcher.tsx](file:///d:/ThinkAI/visibill/eaisybill-prod/src/components/accounty/CompanySwitcher.tsx#L45-L60)`).
* **Részleges Teljesítés Őszinte Kommunikációja:**
  * Ha egy kérés több lépésből állt, és csak egy része készült el, vagy technikai akadályba ütköztél, **tilos azt mondani, hogy "Kész van"**. Pontosan és transzparensen le kell írni: mi az, ami fizikailag elkészült, és mi az, ami még hátravan vagy további döntést igényel.

---

## 🔍 2. Kötelező Ellenőrzési Lépések (Verifikációs Kapu)
Mielőtt bármilyen kódolási feladatot befejezettnek jelentesz a felhasználónak:

1. **TypeScript Típusellenőrzés:**
   * Futtasd le és győződj meg a hibamentességről:
     ```powershell
     npm run build
     # vagy
     npx tsc --noEmit
     ```
   * Ha a parancs fordítási vagy típussérülést jelez, javítsd ki mielőtt válaszolsz.
2. **Konzol- és Kódtisztaság:**
   * Ellenőrizd, hogy nem hagytál hátra elfelejtett `console.log` debug sorokat, fel nem használt importokat vagy szintaktikai hibákat.
3. **UI és Működési Útmutatás:**
   * Ha felületet módosítottál, pontosan írd le, hogy a felhasználó hol (melyik útvonalon, melyik gombra kattintva) és hogyan tudja ellenőrizni az eredményt.

---

## 🛡️ 3. Senior Quality Gate (/morfi-implementation-review)
* Ha a feladat **komplexitása nagy** (5+ fájlt érint, adatbázis-sémát vagy kritikus üzleti/számítási logikát módosít), vagy egy **előző session munkáját / handoff dokumentumát** veszed át:
  * A sima szintaktikai ellenőrzésen túl kötelező felajánlani vagy lefuttatni a `/morfi-implementation-review` mélyauditi eljárást, amely szisztematikusan átvizsgálja a lefelé irányuló adatfolyamokat, a "Falsy Zero" veszélyeket és az élő adatbázis integritást.
