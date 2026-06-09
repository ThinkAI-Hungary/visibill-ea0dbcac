# A-011: Mailgun Email Processing Pipeline

**Status:** Decided  
**Date:** 2025-10

## Context

A felhasználók email-ben kapják számlák nagy részét. Szükségünk van egy automatikus email → számla feldolgozási csatornára.

## Decision

**Mailgun inbound routing** → Supabase Edge Function webhook:

**Flow:**
1. Minden cég kap egy egyedi email alias-t: `cegnev@inbox.visibill.hu`
2. Email beérkezik → Mailgun webhook → `process-mailgun-webhook` Edge Function
3. Edge Function kinyeri a csatolmányokat (PDF, JPG, PNG)
4. Csatolmányok → Supabase Storage + DB INSERT
5. DB trigger → PGMQ → Worker → OCR + LLM feldolgozás

**Edge Functions:**
- `create-email-alias` — alias létrehozása Mailgun API-n
- `delete-email-alias` — alias törlése
- `process-mailgun-webhook` — bejövő email feldolgozása

**Kimenő email-ek:**
- `send-email` — általános email küldés (Mailgun API)
- `send-dunning-email` — fizetési felszólítás
- `send-weekly-summary` / `send-monthly-summary` — összefoglaló
- `send-welcome-email` — regisztráció utáni üdvözlő

## Consequences

**Pozitív:**
- A felhasználónak csak egy email címre kell átirányítania a számlákat
- Mailgun megbízható, spam szűréssel
- A csatolmány méret és típus szűrhető webhook szinten

**Negatív:**
- Mailgun vendor lock-in (API specifikus)
- A webhook sikertelen kézbesítése esetén nincs automatikus retry (Mailgun retry policy)
- A spam/phishing emailek is bekerülhetnek feldolgozásra
