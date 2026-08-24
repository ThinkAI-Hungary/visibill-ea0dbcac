# A-041: Mailgun Webhook Concurrent Dedup — Háromrétegű Idempotency

**Status:** Decided  
**Date:** 2026-07-20  
**Utoljára frissítve:** 2026-07-20

## Context

A `process-mailgun-webhook` Edge Function fogadja a Mailgun webhookjait, amelyek emailből beérkező fájlokat dolgoznak fel. Mailgun retry-mechanizmusa esetén **ugyanaz a webhook több párhuzamos HTTP kérésként érkezhet** (nem szekvenciálisan, hanem egyszerre — azonos `received_at` timestamp-pel). Az egyidejű kérések megelőzik az alkalmazás-szintű "check-then-act" deduplikációt, így mindegyik feldolgozó EF instance egyszerre insertál, és **N duplikált upload sor keletkezik** egyetlen emailből.

Ráadásul az A-035-ös háromirányú pipeline fallback a worker futása közben a `cleanup_email_file_siblings` mechanizmussal törli az eredeti upload sorokat — ez megnyit egy ablakot, ahol egy késői webhook már "nem találja" a már feldolgozott sorokat.

**Konkrét incidens (2026-07-20):** `olzdoofti.jpeg` spam email 3× párhuzamos webhookból → 3 duplikált `invoice_uploads` sor keletkezett ugyanazzal a `mailgun_message_id`-val.

## Decision

Háromrétegű idempotency védelmi rendszer:

### Layer 1: Alkalmazás szintű check (EF, upload táblák)

Minden attachment INSERT előtt, per-attachment loop-ban:

```typescript
const tablesToCheck = ['transaction_uploads', 'invoice_uploads', 'report_uploads'];
for (const table of tablesToCheck) {
  const { data } = await supabase.from(table)
    .select('id')
    .eq('company_id', alias.company_id)
    .eq('file_name', attachment.name)
    .contains('metadata', { mailgun_message_id: messageId })
    .limit(1);
  if (data && data.length > 0) continue; // skip
}
```

**Lefedett eset:** Szekvenciális webhook retry (webhook 2 webhook 1 teljes befejezése UTÁN érkezik).

### Layer 2: Alkalmazás szintű check — llm_koltsegek (permanent audit log)

Ha L1 nem talál (mert a cleanup_email_file_siblings már törölte az upload sorokat):

```typescript
const { data: llmRow } = await supabase.from('llm_koltsegek')
  .select('id').eq('company_id', alias.company_id)
  .eq('file_name', attachment.name)
  .contains('metadata', { mailgun_message_id: messageId }).limit(1);
if (llmRow && llmRow.length > 0) {
  console.log('[IDEMPOTENCY-L2] duplicate skipped'); // skip
}
```

**Lefedett eset:** Cleanup-race condition — a sibling cleanup eltávolította az upload sorokat a worker után, de `llm_koltsegek` soha nem törlődik.

### Layer 3: DB-szintű UNIQUE partial index (atomi garancia)

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_uploads_mailgun_dedup
  ON invoice_uploads (company_id, file_name, (metadata->>'mailgun_message_id'))
  WHERE metadata->>'mailgun_message_id' IS NOT NULL;
-- (ugyanígy: transaction_uploads, report_uploads)
```

Az EF graceful-an kezeli a 23505 PostgreSQL unique_violation kódot:

```typescript
const isUniqueViolation = (err: any): boolean =>
  err?.code === '23505' || err?.message?.includes('unique');

if (isUniqueViolation(insertError)) {
  console.log('[IDEMPOTENCY-DB] duplicate skipped (unique_violation)');
}
```

**Lefedett eset:** Párhuzamos concurrent webhook — mind a három EF instance egyszerre ellenőriz (L1+L2 mind üres), mind a három INSERT-et kísérli meg; a PostgreSQL atomi szinten enged egyet, a többi 23505-öt kap — graceful skip — 200 OK Mailgunnak — nincs további retry.

**A WHERE IS NOT NULL partial index** biztosítja, hogy manuálisan feltöltött fájloknál (ahol nincs mailgun_message_id) a constraint ne érvényesüljön.

### Meglévő duplikátumok cleanup (2026-07-20 migration)

Az index létrehozása előtt 11 duplikált csoport (~31 sor) került eltávolításra PROD-on. A legrégebbi sor maradt meg minden (company_id, file_name, mailgun_message_id) csoportból.

Migration fájl: supabase/migrations/20260720161534_mailgun_message_id_dedup_index.sql

## Consequences

**Pozitív:**
- Párhuzamos Mailgun webhook retry teljes mértékben megelőzött
- Cleanup-race condition lefedett (L2 llm_koltsegek check)
- Graceful 23505 skip → Mailgun 200 OK-t kap → nincs retry
- Manuális feltöltések érintetlenek (partial index WHERE IS NOT NULL)
- Mindkét DB-n alkalmazva: PROD + VSWEB

**Negatív:**
- Minimális overhead: L2 check egy extra DB query per attachment (csak ha L1 nem talált)
- Ha a jövőben a llm_koltsegek tábla archívált/törölt lesz, az L2 check érintett lesz

## Kapcsolódó

- [A-031: Mailgun Webhook Robustness](./A-031-mailgun-webhook-robustness.md)
- [A-035: Háromirányú Pipeline Fallback](./A-035-three-way-fallback-redirection.md)
- [A-011: Mailgun Email Processing](./A-011-email-processing.md)
- [A-005: Edge Functions](./A-005-edge-functions.md)
- [A-050: Server-Side Aggregation & N+1 Query Optimization](./A-050-server-side-aggregation-and-n-plus-1-optimization.md)
- Migration: `supabase/migrations/20260720161534_mailgun_message_id_dedup_index.sql`
- Migration: `supabase/migrations/20260824_add_metadata_to_llm_koltsegek.sql` (Layer 2 metadata jsonb oszlop & GIN index)