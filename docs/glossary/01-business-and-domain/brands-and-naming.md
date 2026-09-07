# 🏷️ Brands & Naming (Márkanevek és Elnevezések)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [GLOSSARY Index](../index.md)

---

## 📋 Megnevezések Mátrixa

| Brand Név | Leírás | DB prefix | Kód prefix | URL Path |
|-----------|--------|-----------|------------|----------|
| **eaisyBill** | Fő alkalmazás — Cégvezetői pénzügyi asszisztens | — | — | `/` vagy `/:companyId/:dateRange/` |
| **eaisyBooks** | Könyvelői modul & ERP (korábban "Accounty") | `accounty_*` | `Accounty*` | `/eaisybooks/` |
| **Visibill** | A teljes platform / projekt gyűjtőneve | — | — | — |

---

## 🔀 Terminológia Mapping

| Ha ezt mondod / olvasod... | Erre gondolsz... | Kódbeli / Adatbázisbeli Azonosító |
|------------------|-------------------|---------------------|
| **"eaisyBooks"** | Könyvelői modul / ERP alrendszer | `accounty_*` táblák, `Accounty*` komponensek |
| **"Accounty"** | Ugyanaz mint eaisyBooks (korábbi név) | `accounty_*` táblák, `Accounty*` komponensek |
| **"könyvelői nézet"** | eaisyBooks modul | `/eaisybooks/` útvonal (legacy: `/accounty/`) |
| **"könyvelő iroda"** | eaisyBooks irodai funkciók | `accounty_assignments`, `accounty_module_permissions` |
| **"eaisyBill"** | Fő alkalmazás (KKV cégvezetői dashboard) | `invoices`, `transactions`, `salary` |

---

## 🤖 Kötelező Szabályok AI Agent-eknek

1. **`eaisyBooks = Accounty` (Legfontosabb szabály):**  
   A könyvelői modul 2026 júniusában kapta meg az **eaisyBooks** nevet. A kódban és az adatbázisban továbbra is `accounty_*` (táblák) és `Accounty*` (React komponensek) szerepelnek. Ez **SZÁNDÉKOS** döntés, NE javasolj tábla- vagy kód-átnevezést!

2. **Nincs szükség DB migration-re elnevezés miatt:**  
   Az `accounty_*` prefix technikai azonosítóként funkcionál.

3. **Edge Function-ök neve változatlan:**  
   Meglévő funkciók: `accounty-seed`, `accounty-detect-missing`, `accounty-detect-bank`, `accounty-generate-deadlines`, `accounty-ai-phone`. Ezen Edge Function-ök neve nem módosul a rebrand miatt.

4. **URL Path és Útvonalszerkezet:**  
   A könyvelői modul elsődleges hivatalos URL útvonala a `/eaisybooks/` (Portfólió Mód: `/eaisybooks/*`, Ügyfél Kontextus Mód: `/eaisybooks/:companyId/:dateRange/*`). A korábbi `/accounty/*` útvonalak automatikusan átirányításra kerülnek a megfelelő `/eaisybooks/*` címre.
