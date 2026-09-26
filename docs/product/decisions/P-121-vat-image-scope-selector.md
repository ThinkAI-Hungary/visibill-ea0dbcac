# P-121: ÁFA Bevallás és Analitikák Bizonylatköri Adatkör Választó (Számlaképpel Rendelkező vs. Teljes OSA) UX

> **Státusz:** ✅ Decided  
> **Dátum:** 2026-09-26  
> **Szerző:** Antigravity Pairing  
> **Érintett területek:** ÁFA Bevallás (`/vat-return`), 2665 Nyomtatvány, Éves Mátrix, Tételes M-lapok (65M), ÁFA Tétellista (Analitikus napló), Gyűjtőkódos Analitika  
> **Kapcsolódó döntések:** [P-099](./P-099-official-vat-summary-ui.md), [P-101](./P-101-invoice-vat-code-overrides-and-dual-display-ux.md), [P-119](./P-119-statutory-vat-views-and-analytics-suite.md), [A-159](../architecture/decisions/A-159-statutory-vat-views-upgrade-and-osa-reconciliation.md), [A-161](../architecture/decisions/A-161-vat-image-scope-filtering.md)

---

## 1. Háttér és Problémafelvetés

Az Online Számla (NAV OSA) rendszerből érkező szállítói (bejövő) számlák automatikusan bekerülnek a Visibill adatbázisába. A könyvelési gyakorlatban azonban két alapvető megközelítés létezik az adóbevallások és analitikák előkészítése során:

1. **Adóhatósági teljesség (Minden számla - `all`):**
   Minden, a NAV rendszerében a cég nevére kiállított szállítói számla azonnal szerepel a kimutatásokban, biztosítva a teljes adóhatósági összhangot, még akkor is, ha az ügyfél még nem töltötte fel a fizikai/elektronikus számlaképet (PDF/szkennelés).
2. **Szigorú számviteli bizonylatolt mód (Csak számlaképpel - `with_image`):**
   A számviteli törvény és a belső könyvvizsgálati szabályzatok értelmében csak az a szállítói számla vonható le, amelyhez tényleges, hiteles bizonylat (számlakép) áll rendelkezésre az irodában. Amennyiben a számlakép hiányzik, a tétel nem szerepelhet a levonható ÁFA analitikában.

A felhasználók számára elengedhetetlen volt egy **kiemelt, nagy és azonnal áttekinthető vizuális kapcsoló** a bevallás felső részén, amely azonnal láthatóvá teszi a feltöltött számlaképek és a NAV adatok közötti eltérést, és egyetlen kattintással átszámítja a teljes ÁFA bevallást és az összes analitikai nézetet.

---

## 2. Üzleti és Felületi Követelmények

1. **Kiemelt, vizuálisan hangsúlyos elhelyezés ("NAGY rádiógomb"):**
   - Közvetlenül a címsor (`PageHeader`) alatt, a 9 füles navigációs sáv (`TabsList`) felett helyezkedik el.
   - 2-kártyás szegmentált kártya-választó modern ikonográfiával (`Globe` vs. `FileCheck2`), kiemelt tipográfiával és aktív státuszjelző fénnyel/gyűrűvel (`ring-2 ring-primary`).
2. **Élő darabszám és badge indikátorok:**
   - Opció 1: **Minden számla könyvelése** (`{totalCount} bejövő számla` badge).
   - Opció 2: **Csak számlaképpel rendelkező számlák** (`{withImageCount} számlaképes` badge, illetve `-X számlakép hiányzik` figyelmeztető badge).
3. **Hiányzó számlakép riasztási sáv & Gyorsakció:**
   - Ha van olyan bejövő számla a választott időszakban, amihez nincs feltöltött kép, a vezérlő alsó sávjában sárga figyelmeztetés jelenik meg: `X db bejövő számlához még nem érkezett feltöltött számlakép...`
   - Közvetlen gyorsgomb: `[OSA egyeztetés megnyitása ->]`, amely azonnal átirányít a Tételes M-lap fülre és megnyitja az OSA számlaegyeztető modált.
4. **Visszamenőleges szigorú szabály: Értékesítési (Kimenő) számlák sérthetetlensége:**
   - A fizetendő ÁFÁ-t képviselő vevői (kimenő) számlákat a szűrés **soha nem ejtheti ki**, mivel a fizetendő adókötelezettség a bizonylat meglététől függetlenül törvényi kötelesség. A szűrő kizárólag a **szállítói (bejövő) levonható** számlákra érvényesül.
5. **Teljes körű reaktivitás (0 ms kliens oldali szinkronizáció + szerveroldali tárolás):**
   - Az állapot automatikusan szinkronizál a böngésző URL-címével (`?vat_scope=all|with_image`) és cégre szabott `localStorage`-el (`visibill_vat_scope_${companyId}`).
   - Az opcióváltás automatikusan újraszámolja a `vat_returns` rekordot a backend RPC-n keresztül, és valós időben frissíti az összes analitikát:
     - 65-ös Főlap & Nyomtatványreplika
     - 12 havi Éves ÁFA Mátrix
     - Tételes 65M lapok
     - Tételes ÁFA analitikus napló
     - Gyűjtőkódos analitika

---

## 3. Felhasználói Interakciók & Állapotok

| Esemény | Reakció |
|---|---|
| Betöltés | URL paraméter ellenőrzése (`vat_scope`), ha nincs, `localStorage`, fallback: `all`. |
| "Csak számlaképpel" kiválasztása | Kártya zöldre vált, URL frissül `?vat_scope=with_image`-re, RPC elindul, analitikák azonnal szűrik a kép nélküli bejövő számlákat. |
| "Minden számla" kiválasztása | Kártya kékre vált, URL paraméter törlődik, RPC elindul, minden OSA számla megjelenik. |
| [OSA egyeztetés megnyitása] kattintás | Automatikusan a `teteles_m` fülre vált és felnyitja az OSA egyeztető dialógust. |
