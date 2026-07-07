# A-011: Mailgun Email Processing Pipeline

**Status:** Decided  
**Date:** 2025-10  
**Utolsó frissítés:** 2026-07-07

## Context

A felhasználók email-ben kapják számlák nagy részét. Szükségünk van egy automatikus email → számla feldolgozási csatornára.

## Decision

**Mailgun inbound routing** → Supabase Edge Function webhook:

**Flow:**
1. Minden cég kap egy egyedi email alias-t: `cegnev@inbox.visibill.hu`
2. Email beérkezik → Mailgun webhook → `process-mailgun-webhook` Edge Function
3. Edge Function ellenőrzi a webhook aláírást (HMAC-SHA256, ha `MAILGUN_SIGNING_KEY` beállítva)
4. Edge Function kinyeri a csatolmányokat (PDF, JPG, PNG, XLSX)
5. Csatolmányok → Supabase Storage + DB INSERT
6. DB trigger → PGMQ → Worker → OCR + LLM feldolgozás

**Szükséges Supabase Secrets:**
| Secret | Cél | Kötelező? |
|--------|-----|-----------|
| `MAILGUN_API_KEY` | Mailgun API hívásokhoz (alias CRUD, email küldés) | ✅ Igen |
| `MAILGUN_DOMAIN` | Mailgun domain (`in.visibill.hu`) | ✅ Igen |
| `MAILGUN_SIGNING_KEY` | Webhook aláírás ellenőrzés (HMAC-SHA256) | ⚠️ Opcionális — ha nincs, a verification skippelődik |

**Edge Functions:**
- `create-email-alias` — alias létrehozása Mailgun API-n
- `delete-email-alias` — alias törlése
- `process-mailgun-webhook` — bejövő email feldolgozása

**Kimenő email-ek:**
- `send-email` — általános email küldés (Mailgun API)
- `send-dunning-email` — fizetési felszólítás
- `send-weekly-summary` / `send-monthly-summary` — összefoglaló
- `send-welcome-email` — regisztráció utáni üdvözlő

**Csatolmány szűrés:**
Az `isValidInvoiceAttachment()` helper kiszűri a nem-számla csatolmányokat:
- Minimális méret: 1 KB (általános), 100 KB (képeknek — branding logók kiszűrése)
- Junk kulcsszavak: `logo`, `signature`, `facebook`, `banner`, stb.
- Inline képek: `image001.png`, `attachment-N` pattern
- Engedélyezett: PDF, JPG, PNG, XLSX, XLS

## 🔴 Incident: MAILGUN_SIGNING_KEY (2026-05-15 → 2026-06-11)

**Időtartam:** ~4 hét  
**Hatás:** MINDEN email-es számlafeldolgozás leállt (minden cég érintett)  
**Gyökérok:** A `23d68de` commit (2026-06-04, gpt-engineer-app + ledererb) kötelezővé tette a `MAILGUN_SIGNING_KEY` secretet a webhook-ban, de **a secretet soha nem állították be** Supabase-ben.

**Eredeti kód (működött):**
```typescript
// Opcionális — ha nincs key, skip
if (mailgunSigningKey && timestamp && token && signature) {
  // verify...
} else {
  console.log('Signature verification skipped');
}
```

**Módosított kód (eltörte):**
```typescript
// Kötelező — ha nincs key, 500
if (!mailgunSigningKey) {
  return new Response('Signing key not configured', { status: 500 });
}
```

**Javítás:** Visszaállítás opcionálisra (`a30bd62`, 2026-06-11) + Edge Function redeploy.

**Tanulságok:**
1. ⚠️ Biztonsági hardeninget MINDIG a megfelelő secret beállítással EGYÜTT kell deployolni
2. ⚠️ Nincs monitoring/alerting a webhook hibaarányra — a probléma 4 hétig észrevétlen maradt
3. 📋 A `MAILGUN_SIGNING_KEY` secret jövőben is beállítandó (ajánlott), de a kód tolerálja a hiányát

## Consequences

**Pozitív:**
- A felhasználónak csak egy email címre kell átirányítania a számlákat
- Mailgun megbízható, spam szűréssel
- A csatolmány méret és típus szűrhető webhook szinten

**Negatív:**
- Mailgun vendor lock-in (API specifikus)
- ~~Mailgun retry policy nem kezel automatikusan~~ → **Megoldva (2026-07-07):** Message-Id alapú idempotency (ld. lent)
- A spam/phishing emailek is bekerülhetnek feldolgozásra
- ⚠️ **Nincs webhook health monitoring** — ha a signing key eltörik, nincs alert (TODO)

## Cross-company Email Routing (2026-07-02)

Ha egy email alias az A céghez tartozik (`email_aliases.company_id`), de a csatolt számla adószáma
alapján a B céghez kellene kerülnie (mindkét cég ugyanannak a user-nek a tagja a `company_members` alapján),
a worker automatikusan átirányítja a számlát a helyes céghez. A webhook továbbra is az alias `company_id`-jával
dolgozik — a routing a worker AI extract UTÁN történik (`company_router.py`). Nincs "tenant-level" alias (1 alias = 1 cég).

## Mailgun Retry Idempotency (2026-07-07)

A Mailgun automatikusan retry-olja a webhookot ha nem kap 200 OK-t időben (exponential backoff: ~57s, ~130s gap-ok). Ez duplikált feltöltéseket okozott.

**Megoldás:** A `process-mailgun-webhook` EF kinyeri a Mailgun `Message-Id` headert és INSERT előtt ellenőrzi:

1. **Message-Id kinyerése:** A `message-headers` form field JSON string-ként tartalmazza az email MIME headereket (`[["Header-Name", "value"], ...]`). A webhook parse-olja és kiolvassa a `Message-Id` értéket.

2. **Mentés metadata-ba:** Az `emailMetadata` objektumba `mailgun_message_id` kulccsal kerül.
   ```typescript
   const emailMetadata = {
     source: 'email_alias',
     // ...
     mailgun_message_id: messageId,  // pl. "<abc123@mail.gmail.com>"
   };
   ```

3. **Idempotency check:** INSERT előtt a webhook lekérdezi az adott táblát (`invoice_uploads` vagy `transaction_uploads`):
   ```typescript
   .eq('company_id', alias.company_id)
   .eq('file_name', attachment.name)
   .contains('metadata', { mailgun_message_id: messageId })
   ```
   Ha találat van → `continue` (skip INSERT + skip Storage upload).

**Edge case-ek:**
- Ha `Message-Id` hiányzik (régi email client) → az idempotency check skip-elődik, a dedup trigger sem blokkolja (email bypass)
- Különböző email-ek azonos csatolmány névvel → különböző `Message-Id` → mindkettő feldolgozásra kerül
- A `Message-Id` az email-hez tartozik, nem a webhook híváshoz → Mailgun retry-knál UGYANAZ a `Message-Id`

**Kapcsolódó:** [A-023: Upload Dedup Protection](./A-023-upload-dedup-protection.md) — a DB trigger dedup bypass az email_alias source-ra
