# Decision 078: Főkönyvi Számlamódosítás, Csoportszámla Kényszerek és Évközi/Év Végi Devizás Értékelés Számviteli Szabályzata

**Dátum:** 2026-10-17  
**Státusz:** ✅ Decided  
**Kategória:** Pénzügyi Modulok / Főkönyv & Számviteli Szabályzat  
**Szerző:** Áron & Antigravity  
**Érintett modulok:** Számlatükör Menedzsment (`EditGlAccountModal`), Főkönyvi Kivonat (`GeneralLedgerTable`), Számlakarton (`GlAccountCardView`), Hóközi Devizás Átértékelés (`MonthlyFxRevaluationModal`, `calculate_monthly_fx_revaluation`, `post_monthly_fx_revaluation`)  
**Kapcsolódó döntések:** [021](./021-general-ledger.md), [063](./063-subledger-and-open-items-accounting-policy.md), [076](./076-rlb-foktorzs-rft-dbf-chart-of-accounts-parsing-and-import.md), [A-143](../architecture/decisions/A-143-multicurrency-chart-of-accounts-and-general-ledger.md), [A-265](../architecture/decisions/A-265-szamlatukor-extended-gl-account-mutation-cascading-settings-rlb-dbf-parser-and-fx-reval.md), [P-198](../product/decisions/P-198-szamlatukor-extended-gl-account-editing-and-monthly-fx-reval-ux.md)

---

## 1. Számviteli Háttér és Jogszabályi Hivatkozás

A számvitelről szóló 2000. évi C. törvény (Sztv.) rendelkezései alapján:
1. **Sztv. 160–161. § (Számlatükör és Analitika Összhangja):** A gazdálkodó a kettős könyvvitel rendszerében olyan számlatükröt köteles készíteni és karbantartani, amely biztosítja az éves beszámoló tételeinek alátámasztását, a szintetikus és analitikus elszámolások zárt logikai összefüggését. Ha egy számlacsoportban partnertételes elszámolást követel meg a jogszabály (pl. Vevők, Szállítók, Előlegek, Kölcsönök), annak az összes alszámlára vonatkoznia kell.
2. **Sztv. 60. § (Devizás Eszközök és Kötelezettségek Értékelése):**
   - A külföldi pénzértékre szóló pénzeszközöket (devizaszámla, valutapénztár), követeléseket és kötelezettségeket a mérlegfordulónapon (valamint a számviteli politika szerint hóközi / negyedéves zárások alkalmával) át kell értékelni a választott hitelintézet vagy a Magyar Nemzeti Bank (MNB) hivatalos devizaárfolyamán.
   - Az átértékelés során keletkező nem realizált árfolyamnyereséget a pénzügyi műveletek egyéb bevételei (976), az árfolyamveszteséget pedig a pénzügyi műveletek egyéb ráfordításai (876) között kötelező elszámolni a fordulónappal.

---

## 2. Üzleti és Számviteli Szabályok

### 1. Főkönyvi Számlák Szerkeszthetősége
- A könyvelőnek joga van meglévő főkönyvi számlák nevének (`short_name`), szakmai leírásának (`description`), devizabeállításainak és validációs kényszereinek módosítására.
- A számlaszám (`gl_number`) nem írható felül szabadon olyan számláknál, amelyekre már történt könyvelés, megvédve a korábbi könyvelési bizonylatok integritását.

### 2. Csoportszámla Beállítás-öröklődési Kényszer (Kaszkádolás)
- Ha egy szintetikus számlán (pl. `311 Belföldi vevők`) a könyvelő módosítja a partner-kényszert (`requires_partner`), a projekt-kényszert (`requires_project`) vagy a folyószámla kezelést (`is_reconcilable`), a rendszer felajánlja a beállítások kaszkádolt leörökítését.
- A jóváhagyott öröklődés kötelezően lefut az összes közvetlen és közvetett alszámlára (`3111`, `3112`...), garantálva, hogy a számlatükörön belül ne alakulhassanak ki vegyes szabályozású, anomáliás alszámlák.

### 3. Fordulónapi és Hóközi Devizás Átértékelés (Sztv. 60. §)
- **Érintett számlakör:** Valamennyi olyan számla, amelynél a törzsben az `is_monthly_fx_reval = true` jelző be van állítva (jellemzően `382 Valutapénztár`, `386 Devizabetétszámla`, `316 Devizás vevők`, `4542 Devizás szállítók`, `455 Külföldi rövid lejáratú kötelezettségek`).
- **Értékelési Módszer:**
  - A rendszer adott fordulónapra (`cutoff_date`) lekérdezi a nyitott tételek devizaegyenlegét és a devizaszámlák pillanatnyi devizakészletét.
  - Lekéri az MNB hivatalos fordulónapi középárfolyamát.
  - Kiszámítja az átértékelt forintösszeget: $\text{Devizaegyenleg} \times \text{MNB árfolyam}$.
  - Képzi a könyv szerinti forintértékkel való különbözetet.
- **Könyvelési Szabály:**
  - Az eredeti számlabizonylatok devizaösszege és forintértéke nem módosul (bizonylati fegyelem elve).
  - A különbözetekről a rendszer automatikusan egyetlen összevont vegyes könyvelési bizonylatot generál a cég `ARF` (vagy `VE`) naplójába:
    - Vevőkövetelés nyeresége / Szállítói kötelezettség csökkenése: `T 316 / T 4542 → K 976`
    - Vevőkövetelés vesztesége / Szállítói kötelezettség növekedése: `T 876 → K 316 / K 4542`
    - Devizaszámla/valutapénztár felértékelése: `T 386/382 → K 976`
    - Devizaszámla/valutapénztár leértékelése: `T 876 → K 386/382`

---

## 3. Hatás és Eredmények

* **Havi és Éves Zárlat Időtartamának Csökkenése:** Az exceles deviza-újraszámolás és a manuális vegyes tételek gépelése helyett a teljes folyamat 1-kattintásos varázslóval elvégezhető.
* **Könyvvizsgálói Megfelelőség:** Az átértékelés tételes kimutatása (`calculate_monthly_fx_revaluation`) közvetlenül csatolható a zárási dokumentációhoz és az éves beszámoló kiegészítő mellékletéhez.
