# A-012: NAV Online Számla API v3 Integráció

**Status:** Decided  
**Date:** 2025-10

## Context

A magyar adórendszer megköveteli a NAV Online Számla rendszer használatát. A Visibill-nek kétirányú integrációra van szüksége: bejövő + kimenő számlák lekérdezése.

## Decision

**NAV Online Számla API v3** — közvetlen REST API integráció Edge Function-ökön keresztül.

**Edge Functions:**
| Function | Feladat |
|----------|---------|
| `nav-token` | Token csere (XML → AES-128-ECB aláírás) |
| `nav-sync` | Bejövő számlák lekérdezése (manuális trigger) |
| `nav-auto-sync` | Automatikus napi szinkronizáció (cron) |
| `nav-query-outbound-invoices` | Kimenő számlák lekérdezése |
| `query-nav-invoices` | NAV számlák keresése szűrőkkel |
| `nav-tax-profile-sync` | Adóalany profil szinkronizálás |
| `delete-nav-credentials` | NAV kapcsolat bontása |

**Auth flow:**
1. Felhasználó megadja: technikai felhasználó login + jelszó + aláírókulcs + cserekulcs
2. Credentials titkosítva tárolva (lásd A-010)
3. API híváskor: token generálás → AES-128-ECB aláírás → NAV REST API

**Adatfolyam:**
- NAV-ból kapott számlák → `nav_invoices` tábla (+ `nav_invoice_items`)
- A számlák automatikusan GL kategorizálást kapnak (PGMQ → Worker)

## Consequences

**Pozitív:**
- Kétirányú szinkronizáció — a felhasználó nem kell manuálisan bevinnie a NAV számlákat
- Automatikus napi szinkron — mindig naprakész adatok
- XML ↔ JSON konverzió az Edge Function-ben — a frontend JSON-t kap

**Negatív:**
- A NAV API instabil (időnként 500-as hibákat dob, lassú válaszidő)
- Az XML aláírás komplex (AES-128-ECB, SHA-512 hash, RequestSignature)
- A NAV API rate limit-eket alkalmaz (nem dokumentált)
