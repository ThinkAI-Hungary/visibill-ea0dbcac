# 🏷️ Brands & Naming (Márkanevek és Elnevezések)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [GLOSSARY Index](../index.md)

---

## 📋 Megnevezések Mátrixa

| Brand Név | Leírás | DB prefix | Kód prefix | URL Path |
|-----------|--------|-----------|------------|----------|
| **eaisyBill** | Fő alkalmazás — Cégvezetői pénzügyi asszisztens | — | — | `/` |
| **eaisyBooks** | Könyvelői nézet (korábban "Accounty") | `accounty_*` | `Accounty*` | `/accounty/` |
| **Visibill** | A teljes platform / projekt gyűjtőneve | — | — | — |

---

## 🔀 Terminológia Mapping

| Ha ezt mondod / olvasod... | Erre gondolsz... | Kódbeli / Adatbázisbeli Azonosító |
|------------------|-------------------|---------------------|
| **"eaisyBooks"** | Könyvelői modul / felület | `accounty_*` táblák, `Accounty*` komponensek |
| **"Accounty"** | Ugyanaz mint eaisyBooks (korábbi név) | `accounty_*` táblák, `Accounty*` komponensek |
| **"könyvelői nézet"** | eaisyBooks modul | `/accounty/` útvonal |
| **"könyvelő iroda"** | eaisyBooks irodai funkciók | `accounty_assignments`, `accounty_sites` |
| **"eaisyBill"** | Fő alkalmazás (KKV cégvezetői dashboard) | `invoices`, `transactions`, `salary` |

---

## 🤖 Kötelező Szabályok AI Agent-eknek

1. **`eaisyBooks = Accounty` (Legfontosabb szabály):**  
   A könyvelői modul 2026 júniusában kapta meg az **eaisyBooks** nevet. A kódban és az adatbázisban továbbra is `accounty_*` (táblák) és `Accounty*` (React komponensek) szerepelnek. Ez **SZÁNDÉKOS** döntés, NE javasolj tábla- vagy kód-átnevezést!

2. **Nincs szükség DB migration-re elnevezés miatt:**  
   Az `accounty_*` prefix technikai azonosítóként funkcionál.

3. **Edge Function-ök neve változatlan:**  
   Meglévő funkciók: `accounty-seed`, `accounty-detect-missing`, `accounty-detect-bank`, `accounty-generate-deadlines`, `accounty-ai-phone`. Ezen Edge Function-ök neve nem módosul a rebrand miatt.

4. **URL path nem változott:**  
   A könyvelői modul elérése változatlanul a `/accounty/` URL címen érhető el.
