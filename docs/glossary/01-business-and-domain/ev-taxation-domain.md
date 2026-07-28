# 🧾 EV (Egyéni Vállalkozó) & Adózási Domain Glossary

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [GLOSSARY Index](../index.md)

---

## 📊 Adózási Kifejezések Katalógusa

| Kifejezés | Jelentés / Üzleti Háttér | Technikai / Kódbeli Azonosító |
|-----------|-------------------------|-------------------------------|
| **Átalányadó** | Egyszerűsített adózási forma egyéni vállalkozóknak, fix költséghányaddal (45%, 80%, vagy 90%). Az adóalap a bevételből levont költséghányad utáni rész. | `atalany` |
| **VSZJA** | Vállalkozói Személyi Jövedelemadó (9% vállalkozói SZJA a nyereség után + vállalkozói osztalékalap utáni 15% SZJA és SZOCHO). | `vszja` |
| **KATA** | Kisadózó vállalkozások tételes adója (havi fix 50.000 Ft adó, főállású egyéni vállalkozóknak lakossági ügyfélkörrel). | `kata` |
| **TB-járulék** | Társadalombiztosítási járulék (18,5%), amelyet a vállalkozói jövedelem vagy a minimum járulékalap után kell megfizetni. | `tbJarulek` / `tb_amount` |
| **Szocho** | Szociális hozzájárulási adó (13%), a vállalkozói jövedelem vagy minimum járulékalap után fizetendő. | `szocho` / `szocho_amount` |
| **Minimumjárulék** | Főfoglalkozású EV-knél: a járulékalap nem lehet kevesebb a minimálbérnél (SZOCHO esetén 112.5%-ánál), illetve garantált bérminimmumnál (112.5%). | `minimumBaseApplied` |
| **Garantált Bérminimum** | Szakképzettséget igénylő főtevékenység esetén a magasabb összegű járulékalap. | `garantaltBerminimum` |
| **Főfoglalkozású EV** | Az egyéni vállalkozás a fő jövedelemforrás → kötelező minimumjárulék fizetés akkor is, ha nincs bevétel. | `foallasu` |
| **Mellékállású EV** | Legalább heti 36 órás munkaviszony melletti EV → nincs minimumjárulék, csak a tényleges jövedelem után adózik. | `mellekallasu` |
| **Kiegészítő EV** | Saját jogú nyugdíjas egyéni vállalkozó → mentesül a TB és Szocho megfizetése alól. | `kiegeszito` |
| **Pénztárkönyv** | Az egyszeres könyvvitelt vezető egyéni vállalkozók hivatalos pénzügyi nyilvántartása. | `accounty_penztarkonyv_tetel` |

---

## 💼 Use Case-ek a Visibillben

1. **eaisyBooks (Accounty) Adómodell Számítás:**
   A rendszer automatikusan kalkulálja a negyedéves adó- és járulékbevallások (NAV 2458/2558) becsült összegeit az `accounty_tax_profiles` és `accounty_penztarkonyv_tetel` adatai alapján.

2. **Garantált Bérminimum Check:**
   Az `accounty_tax_profiles` táblában eltárolt `requires_qualification` flag alapján a járulékot a minimálbér helyett automatikusan a garantált bérminimum 112.5%-ára emeli a számítási logika.
