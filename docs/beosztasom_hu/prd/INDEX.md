# Beosztásom Modul — Termékkövetelmény Dokumentáció (PRD)
## (Product Requirements Document Suite & UI Specifications)

Ez a dokumentumcsomag a **Beosztásom** munkaidő-nyilvántartási és beosztástervező modul teljes körű termék- és felületi specifikációját rögzíti az Eaisybill vállalatirányítási ökoszisztémában. A dokumentáció a jóváhagyott [Üzleti Követelmény Dokumentációra (BRD)](../brd/INDEX.md) épülve, képernyőszinten, mezőnként, állapotgépekkel és interakciós folyamatokkal definiálja a termék működését.

---

## 🎯 A Termék Célja és Működési Koncepciója

A Beosztásom modul egy böngészőből és mobil eszközökről használható, többcéges munkaidő- és jelenlét-menedzsment felület.
- **Hó elején:** Tervezi és optimalizálja a havi beosztást a naptárrácsban (létszámigény, munkarend és sablonok alapján).
- **Hó közben:** Rögzíti a távolléteket (szabadság, 15 napos betegszabadság split, táppénz) és kezeli az intelligens partnerhelyettesítést.
- **Hó végén:** A tervezett beosztásból és a tényleges jelenlétből egyetlen kattintással előállítja a **NAV-ellenőrzéseken elfogadott, dolgozónkénti munkalapos aláírható Excel munkaidő-jegyzéket**, valamint a gépi bérszámfejtési exportot.
- **Folyamatosan:** Valós időben felügyeli a Munka Törvénykönyve (Mt.) kógens pihenőidő- és munkaidő-szabályait 4 súlyossági szinten.

---

## 🗺️ A Moduláris PRD Kötetek Navigációs Térképe

A termékspecifikáció 9 önálló, logikailag fókuszált kötetbe rendezve fedi le a teljes funkcionalitást:

| Kötet Azonosító | Kötet Címe és Fájlneve | Fő Képernyők és Felületi Fókusz | Érintett Szereplők |
|:---|:---|:---|:---:|
| **PRD-01** | [PRD-01: Portál Navigáció és Menürendszer](./PRD-01-navigacio-es-menustruktura.md) | Globális fejléc, cégválasztó, időszakválasztó, bal oldali menüstruktúra, 2FA és értesítési központ | Operátor, Vezető, Bérszámfejtő |
| **PRD-02** | [PRD-02: Havi Beosztástervező Naptárrács](./PRD-02-havi-beosztastervezo-naptarracs.md) | Központi naptárrács, swimlanes, cellakártyák, létszámigény sáv, vágólap (Ctrl+C/V), gyorskitöltés | Operátor, Vezető |
| **PRD-03** | [PRD-03: Műszakszerkesztő és Sablonkezelő](./PRD-03-muszakszerkeszto-es-sablonkezelo.md) | Műszak dialógus, nettó munkaidő-számítás, alternatív táblázatos soros nézet, munkarend- és műszaksablonok | Operátor |
| **PRD-04** | [PRD-04: Távollét- és Helyettesítéskezelő](./PRD-04-tavollet-es-helyettesites-kezelo.md) | 30+ Mt. jogcím választó, 15 napos betegszabadság split motor, szabadságkeret egyenleg, partnerhelyettesítés | Operátor, Vezető, Dolgozó |
| **PRD-05** | [PRD-05: Munkaügyi Szabálymotor](./PRD-05-szabalymotor-es-eloe-megfeleloseg.md) | 4 súlyossági szint (Blocker, Hiba, Warn, Info), élő szabálysáv, cellajelölők, részletező fiók (Drawer), felülbírálás | Operátor, Vezető |
| **PRD-06** | [PRD-06: Jelenlét-Igazolás és Bérszámfejtési Export](./PRD-06-jelenlet-zaras-es-berszamfejtesi-export.md) | Tervezett vs. Tényleges igazolás, zárási varázsló (Lock), NAV Excel munkaidő-jegyzék, Nexon/Kulcs béradathíd | Operátor, Bérszámfejtő |
| **PRD-07** | [PRD-07: Törzsadat-kezelés és Munkavállaló Karton](./PRD-07-torzsadat-es-munkavallalo-karton.md) | Dolgozói lista, 6-füles mesterkarton (Mt. szabályok, egyenlegek, munkaidőkeret), telephelyek, színkódos munkakörök | Operátor, Vezető |
| **PRD-08** | [PRD-08: Dolgozói Önkiszolgáló Portál (Mobil)](./PRD-08-dolgozoi-onkiszolgalo-es-mobil-nezet.md) | Reszponzív PWA / mobil nézet, személyes beosztáskártyák, műszakcsere munkafolyamat, mobil távollét-igénylés | Munkavállaló, Vezető |
| **PRD-09** | [PRD-09: Fejlesztési Roadmap és MVP Kiadás](./PRD-09-fejlesztesi-roadmap-es-mvp-kiadas.md) | 10 fejlesztési fázis, éles MVP terjedelem (Fázis 0–4), UX teljesítmény-küszöbök (&lt;1s), Definition of Done | Minden szerepkör |

---

## 🎨 Vizuális Felületi Diagramok Katalógusa

Minden diagram közvetlenül a [diagramms/](./diagramms/) alkönyvtárban érhető el sötét témájú vektoros SVG és nagyfelbontású `@2x.png` formátumban:

| Ábra ID | Képernyő / Diagram Megnevezése | Típus | Vektoros Formátum | Nagyfelbontású Kép | Kapcsolódó Kötet |
|:---:|:---|:---:|:---:|:---:|:---:|
| **01** | Portál Navigáció és Képernyőrendszer | Architektúra | [01_portal_navigacio_es_nezetrendszer.svg](./diagramms/01_portal_navigacio_es_nezetrendszer.svg) | [01_portal_navigacio_es_nezetrendszer@2x.png](./diagramms/01_portal_navigacio_es_nezetrendszer@2x.png) | [PRD-01](./PRD-01-navigacio-es-menustruktura.md) |
| **02** | Naptárrács UI Mockup és Interakciók | Felületi Mockup | [02_naptarracs_interakcios_ui_mockup.svg](./diagramms/02_naptarracs_interakcios_ui_mockup.svg) | [02_naptarracs_interakcios_ui_mockup@2x.png](./diagramms/02_naptarracs_interakcios_ui_mockup@2x.png) | [PRD-02](./PRD-02-havi-beosztastervezo-naptarracs.md) |
| **03** | Műszakszerkesztő Modal és Állapotgép | Modal &amp; Flow | [03_muszakszerkeszto_modal_es_allapotgep.svg](./diagramms/03_muszakszerkeszto_modal_es_allapotgep.svg) | [03_muszakszerkeszto_modal_es_allapotgep@2x.png](./diagramms/03_muszakszerkeszto_modal_es_allapotgep@2x.png) | [PRD-03](./PRD-03-muszakszerkeszto-es-sablonkezelo.md) |
| **04** | Távollét és Helyettesítés UI Flow | Folyamatábra | [04_tavollet_es_helyettesites_ui_flow.svg](./diagramms/04_tavollet_es_helyettesites_ui_flow.svg) | [04_tavollet_es_helyettesites_ui_flow@2x.png](./diagramms/04_tavollet_es_helyettesites_ui_flow@2x.png) | [PRD-04](./PRD-04-tavollet-es-helyettesites-kezelo.md) |
| **05** | Szabálymotor Visszajelzés Hierarchia | Hierarchia | [05_szabalymotor_feluleti_visszajelzes_hierarchia.svg](./diagramms/05_szabalymotor_feluleti_visszajelzes_hierarchia.svg) | [05_szabalymotor_feluleti_visszajelzes_hierarchia@2x.png](./diagramms/05_szabalymotor_feluleti_visszajelzes_hierarchia@2x.png) | [PRD-05](./PRD-05-szabalymotor-es-eloe-megfeleloseg.md) |
| **06** | Havi Zárás és Export Varázsló Flow | Folyamat / Wizard | [06_havi_zaras_es_export_varazslo_flow.svg](./diagramms/06_havi_zaras_es_export_varazslo_flow.svg) | [06_havi_zaras_es_export_varazslo_flow@2x.png](./diagramms/06_havi_zaras_es_export_varazslo_flow@2x.png) | [PRD-06](./PRD-06-jelenlet-zaras-es-berszamfejtesi-export.md) |
| **07** | Dolgozói Mobil Önkiszolgáló Wireframe | Wireframe | [07_dolgozoi_mobil_onkiszolgalo_wireframe.svg](./diagramms/07_dolgozoi_mobil_onkiszolgalo_wireframe.svg) | [07_dolgozoi_mobil_onkiszolgalo_wireframe@2x.png](./diagramms/07_dolgozoi_mobil_onkiszolgalo_wireframe@2x.png) | [PRD-08](./PRD-08-dolgozoi-onkiszolgalo-es-mobil-nezet.md) |

---

## 👥 Szerepkör-alapú Olvasási Útmutató

- **Frontend Fejlesztőknek:** [PRD-01](./PRD-01-navigacio-es-menustruktura.md), [PRD-02](./PRD-02-havi-beosztastervezo-naptarracs.md), [PRD-03](./PRD-03-muszakszerkeszto-es-sablonkezelo.md) (komponens hierarchia, vágólap, állapotok, tokenek).
- **Üzleti Elemzőknek & Könyvelőknek:** [PRD-04](./PRD-04-tavollet-es-helyettesites-kezelo.md), [PRD-05](./PRD-05-szabalymotor-es-eloe-megfeleloseg.md), [PRD-06](./PRD-06-jelenlet-zaras-es-berszamfejtesi-export.md) (Mt. jogcímek, 15 napos split, bérprogram adathíd).
- **Termékmenedzsernek (PM):** [PRD-07](./PRD-07-torzsadat-es-munkavallalo-karton.md), [PRD-08](./PRD-08-dolgozoi-onkiszolgalo-es-mobil-nezet.md), [PRD-09](./PRD-09-fejlesztesi-roadmap-es-mvp-kiadas.md) (MVP határok, ütemezés, mobilos képességek).


