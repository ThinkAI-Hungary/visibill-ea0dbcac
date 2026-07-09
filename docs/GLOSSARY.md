# eaisybill Glossary & Terminológia

> **Utoljára frissítve:** 2026-06-23

---

## Brand Nevek

| Brand Név | Leírás | DB prefix | Kód prefix | URL |
|-----------|--------|-----------|------------|-----|
| **eaisyBill** | Fő alkalmazás — KKV pénzügyi asszisztens | — | — | `/` |
| **eaisyBooks** | Könyvelői nézet (korábban "Accounty") | `accounty_*` | `Accounty*` | `/accounty/` |
| **Visibill** | Platform / projekt név | — | — | — |

---

## Terminológia Mapping

| Ha ezt mondod... | Erre gondolsz... | Technikai azonosító |
|------------------|-------------------|---------------------|
| "eaisyBooks" | Könyvelői modul / nézet | `accounty_*` táblák, `Accounty*` komponensek |
| "Accounty" | Ugyanaz mint eaisyBooks (legacy név) | `accounty_*` táblák, `Accounty*` komponensek |
| "könyvelői nézet" | eaisyBooks modul | `/accounty/` útvonal |
| "könyvelő iroda" | eaisyBooks irodai funkciók | `accounty_assignments`, `accounty_sites` |
| "eaisyBill" | Fő alkalmazás (cégvezető nézet) | `invoices`, `transactions`, stb. |

---

## Fontos szabályok AI agent-eknek

1. **eaisyBooks = Accounty:** A könyvelői modul rebrandelve lett 2026 júniusában. A kódban és DB-ben továbbra is `accounty_*` / `Accounty*` prefix szerepel — ez NEM hiba, hanem szándékos technikai döntés.

2. **Mindkét név valid:** Ha a felhasználó "accounty"-t, "eaisybooks"-t, "easybooks"-t, vagy "könyvelői nézet"-et mond, mindig ugyanarra a modulra gondol.

3. **DB táblák NEM lettek átnevezve:** Az `accounty_*` prefix technikai azonosító, nem brand név. Ne javasolj migration-t az átnevezésre.

4. **Edge Function nevek NEM változtak:** `accounty-seed`, `accounty-detect-missing`, `accounty-detect-bank`, `accounty-generate-deadlines`, `accounty-ai-phone` — ezek deployed function-ök, a legacy nevükön futnak.

5. **URL path nem változott:** A `/accounty/` útvonal továbbra is aktív.

---

## EV (Egyéni Vállalkozó) Terminológia

| Kifejezés | Jelentés | Technikai azonosító |
|-----------|---------|---------------------|
| **Átalányadó** | Egyszerűsített adózási forma, fix költséghányaddal (45/80/90%) | `atalany` |
| **VSZJA** | Vállalkozói személyi jövedelemadó (9% + osztalék utáni SZJA/szocho) | `vszja` |
| **KATA** | Kisadózó vállalkozások tételes adója (50.000 Ft/hó) | `kata` |
| **TB-járulék** | Társadalombiztosítási járulék (18,5%) | `tbJarulek` / `tb_amount` |
| **Szocho** | Szociális hozzájárulási adó (13%) | `szocho` / `szocho_amount` |
| **Minimumjárulék** | Főfoglalkozásúaknál: járulékalap nem lehet kevesebb mint minimálbér/garBérmin × hónapok | `minimumBaseApplied` |
| **Garantált bérminimum** | Szakképzettséget igénylő tevékenység esetén magasabb járulékalap | `garantaltBerminimum` |
| **Főfoglalkozású** | Az EV a fő jövedelemforrás → teljes járulékfizetési kötelezettség | `foallasu` |
| **Mellékállású** | Más főállás mellett → járulékfizetés tényleges jövedelem után | `mellekallasu` |
| **Kiegészítő** | Nyugdíj mellett → járulékmentes | `kiegeszito` |
| **Pénztárkönyv** | Egyszeres könyvvitel fő nyilvántartása | `accounty_penztarkonyv_tetel` |

