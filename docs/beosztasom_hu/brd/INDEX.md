# Visibill & Beosztásom.hu Integráció — BRD Dokumentáció

> **Modul elnevezése:** eaisyBill / eaisyBooks Munkaidő-nyilvántartó és Beosztáskezelő Modul  
> **Dokumentum típus:** Üzleti Követelmény Dokumentáció (BRD) Csomag  
> **Verzió:** 1.0 | **Dátum:** 2026-10-06 | **Státusz:** Jóváhagyásra kész  
> **Forrásanyag:** [Beosztasom_specifikacio_es_roadmap_v2 (1).docx](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/beosztasom_hu/Beosztasom_specifikacio_es_roadmap_v2%20(1).docx)

---

## 🧭 Navigáció és Dokumentumtérkép

Ez a dokumentációcsomag az **Eaisybill** rendszer új, komplex munkaidő-nyilvántartási és beosztástervezési moduljának üzleti követelményeit (BRD) rögzíti a forrás specifikáció alapján. A dokumentáció szétválasztja az üzleti igényeket a későbbi technikai architektúra és termékszintű megvalósítási részletektől.

| Ssz. | Fájlnév | Téma / Tartalom | Főbb fókuszterületek |
|:---|:---|:---|:---|
| **00** | [00_BRD_OVERVIEW_AND_EXECUTIVE_SUMMARY.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/beosztasom_hu/brd/00_BRD_OVERVIEW_AND_EXECUTIVE_SUMMARY.md) | Vezetői összefoglaló & Üzleti kontextus | Miért építjük? Piaci probléma, Beosztasom.hu tapasztalatok, fájdalompontok, célcsoportok és fő megkülönböztető előnyök. |
| **01** | [01_BRD_GLOSSARY_AND_DOMAIN_MODEL.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/beosztasom_hu/brd/01_BRD_GLOSSARY_AND_DOMAIN_MODEL.md) | Fogalomtár & Üzleti Fogalmi Modell | Munkaügyi és szoftveres definíciók (Mt.), üzleti entitások és kapcsolatok (többcéges működés, cég, műszak, távollét, keret). |
| **02** | [02_BRD_CORE_WORKFLOWS_AND_USER_JOURNEYS.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/beosztasom_hu/brd/02_BRD_CORE_WORKFLOWS_AND_USER_JOURNEYS.md) | Fő Üzleti Folyamatok & Felhasználói Utak | A havi ciklus (hó eleje → hó közepe → hó végi zárás), könyvelői, cégvezetői és dolgozói felhasználói utak. |
| **03** | [03_BRD_FUNCTIONAL_REQUIREMENTS_SCHEDULING.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/beosztasom_hu/brd/03_BRD_FUNCTIONAL_REQUIREMENTS_SCHEDULING.md) | Beosztástervezés & Naptárrács Követelmények | Időszakok, létszámigény, naptárrács, műszakfelvitel, tömeges másolás (Ctrl+C/V), sablonok és automatikus generálás. |
| **04** | [04_BRD_ABSENCE_AND_ATTENDANCE_MANAGEMENT.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/beosztasom_hu/brd/04_BRD_ABSENCE_AND_ATTENDANCE_MANAGEMENT.md) | Távollétek & Jelenlét-igazolás | 28+ Mt. távollét jogcím, 15 napos betegszabadság → táppénz átfordulás, tervezett vs tényleges jelenlét, tömeges igazolás. |
| **05** | [05_BRD_LABOR_LAW_RULES_ENGINE_AND_COMPLIANCE.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/beosztasom_hu/brd/05_BRD_LABOR_LAW_RULES_ENGINE_AND_COMPLIANCE.md) | Munkaügyi Szabálymotor & Mt. Megfelelőség | Magyar Munka Törvénykönyve szabályok, 3-szintű öröklés, védett munkavállalók (fiatalkorú, kismama), munkaidőkeret elszámolás. |
| **06** | [06_BRD_EXPORTS_PAYROLL_AND_INTEGRATION.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/beosztasom_hu/brd/06_BRD_EXPORTS_PAYROLL_AND_INTEGRATION.md) | NAV Exportok, Bérszámfejtés & Rendszerintegráció | Havi Excel munkaidő-jegyzék (dolgozónként külön fül), bérszámfejtési híd (kieső idők, pótlékok), Visibill ökoszisztéma kapcsolat. |
| **07** | [07_BRD_ROADMAP_PHASING_AND_OPEN_QUESTIONS.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/beosztasom_hu/brd/07_BRD_ROADMAP_PHASING_AND_OPEN_QUESTIONS.md) | Fejlesztési Fázisok, MVP & Nyitott Kérdések | 0–9. fázis felosztása, minimális életképes termék (MVP: 0–4. fázis), kockázati mátrix és tisztázandó kérdések jegyzéke. |


---

## 🎨 Vizuális Architektúra és Folyamatábrák (baoyu-diagram)

A BRD csomag kulcsfontosságú üzleti logikáit, adatkapcsolatait és hatósági elszámolási folyamatait dedikált, modern sötét témájú vizuális diagramok és folyamatábrák illusztrálják:

| Ssz. | Ábra Megnevezése | Típus / Téma | SVG Vektoros Ábra | Nagyfelbontású PNG (@2x) |
|:---:|:---|:---|:---:|:---:|
| **00** | Rendszer- és Portálarchitektúra | Architektúra | [00_rendszer_attekintes.svg](./diagramms/00_rendszer_attekintes.svg) | [00_rendszer_attekintes@2x.png](./diagramms/00_rendszer_attekintes@2x.png) |
| **01** | Konceptuális Üzleti Adatmodell | ER / Strukturális | [01_konceptualis_domain_modell.svg](./diagramms/01_konceptualis_domain_modell.svg) | [01_konceptualis_domain_modell@2x.png](./diagramms/01_konceptualis_domain_modell@2x.png) |
| **02a**| Havi Munkafolyamat Életciklus (E2E) | 5-Fázisú Folyamatábra | [02_havi_munkafolyamat_e2e.svg](./diagramms/02_havi_munkafolyamat_e2e.svg) | [02_havi_munkafolyamat_e2e@2x.png](./diagramms/02_havi_munkafolyamat_e2e@2x.png) |
| **02b**| Távollét és Partnerhelyettesítés | Szekvenciadiagram | [02_helyettesitesi_folyamat_sequence.svg](./diagramms/02_helyettesitesi_folyamat_sequence.svg) | [02_helyettesitesi_folyamat_sequence@2x.png](./diagramms/02_helyettesitesi_folyamat_sequence@2x.png) |
| **03** | Naptárrács & Gyorskitöltő Motor | UI / Interakciós | [03_naptarracs_es_gyorskitoltes_architektura.svg](./diagramms/03_naptarracs_es_gyorskitoltes_architektura.svg) | [03_naptarracs_es_gyorskitoltes_architektura@2x.png](./diagramms/03_naptarracs_es_gyorskitoltes_architektura@2x.png) |
| **04** | 15 Napos Betegszabi → Táppénz Split | Döntési Folyamatábra | [04_betegszabadsag_tappenzen_atfordulas_flowchart.svg](./diagramms/04_betegszabadsag_tappenzen_atfordulas_flowchart.svg) | [04_betegszabadsag_tappenzen_atfordulas_flowchart@2x.png](./diagramms/04_betegszabadsag_tappenzen_atfordulas_flowchart@2x.png) |
| **05** | Munkaügyi Szabálymotor & 4 Súlyosság | Döntési Hierarchia | [05_munkaugyi_szabalyomotor_hierarchia.svg](./diagramms/05_munkaugyi_szabalyomotor_hierarchia.svg) | [05_munkaugyi_szabalyomotor_hierarchia@2x.png](./diagramms/05_munkaugyi_szabalyomotor_hierarchia@2x.png) |
| **06** | Bérszámfejtési Híd & Export Pipeline | Adatfolyam Architektúra | [06_berszamfejtesi_hid_integracio.svg](./diagramms/06_berszamfejtesi_hid_integracio.svg) | [06_berszamfejtesi_hid_integracio@2x.png](./diagramms/06_berszamfejtesi_hid_integracio@2x.png) |
| **07** | 10 Fejlesztési Fázis & MVP Idővonal | Roadmap & Timeline | [07_roadmap_fazisok_timeline.svg](./diagramms/07_roadmap_fazisok_timeline.svg) | [07_roadmap_fazisok_timeline@2x.png](./diagramms/07_roadmap_fazisok_timeline@2x.png) |

---

## 🎯 A Projekt Célja 1 Mondatban
Az **Eaisybill / eaisyBooks** rendszer kibővítése egy olyan hatósági (NAV / Munkaügyi Felügyelet) szempontból 100%-ban megfelelő, szabályalapú, automatizált havi beosztástervező és hiteles jelenléti ív modullal, amely drasztikusan lecsökkenti a könyvelőirodák és KKV cégvezetők havi adminisztrációs idejét, kiküszöböli a manuális hibákat, és közvetlen adatátadást biztosít a bérszámfejtés felé.

---

## 📌 Hogyan Olvasd Ezt a Dokumentációt?
1. Kezdd a **[00_BRD_OVERVIEW_AND_EXECUTIVE_SUMMARY.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/beosztasom_hu/brd/00_BRD_OVERVIEW_AND_EXECUTIVE_SUMMARY.md)** dokumentummal az üzleti vízió és a piaci háttér megértéséhez.
2. Ismerd meg az egységes terminológiát az **[01_BRD_GLOSSARY_AND_DOMAIN_MODEL.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/beosztasom_hu/brd/01_BRD_GLOSSARY_AND_DOMAIN_MODEL.md)** alapján.
3. Nézd át az end-to-end havi munkafolyamatokat a **[02_BRD_CORE_WORKFLOWS_AND_USER_JOURNEYS.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/beosztasom_hu/brd/02_BRD_CORE_WORKFLOWS_AND_USER_JOURNEYS.md)** fejezetben.
4. Mélyedj el a részletes üzleti és funkcionális követelményekben a **03**, **04**, **05**, **06** modulokban.
5. Végezetül ellenőrizd az MVP ütemezést és a tisztázandó kérdéseket a **[07_BRD_ROADMAP_PHASING_AND_OPEN_QUESTIONS.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/beosztasom_hu/brd/07_BRD_ROADMAP_PHASING_AND_OPEN_QUESTIONS.md)** dokumentumban.
