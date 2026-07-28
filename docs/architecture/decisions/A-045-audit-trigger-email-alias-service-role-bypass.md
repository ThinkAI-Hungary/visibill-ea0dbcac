# A-045: Audit Trigger Email-Alias Bypass a Service Role Guard Alatt

**Status:** Decided
**Date:** 2026-07-24
**Utoljára frissítve:** 2026-07-24

## Context

A `global_audit_trigger_func()` DB trigger az `audit_logs` táblába ír minden releváns
fájlmozgást (feltöltés, feldolgozás, törlés), hogy az Eseménynapló (`ActivityLogSheet`)
valós idejű visszajelzést adjon a felhasználóknak.

A trigger funkcióban egy guard volt:

```sql
IF (v_company_id IS NOT NULL AND v_entity_name IS NOT NULL
    AND auth.role() <> 'service_role') THEN
    INSERT INTO audit_logs ...
```

**Célja:** Megakadályozni, hogy a management dashboard háttérfolyamatai (státuszváltások,
soft-delete-ek) felesleges bejegyzéseket írjanak az audit_logs-ba.

**Nem várt mellékhatás:** A Mailgun webhook Edge Function (`process-mailgun-webhook`) is
`service_role`-lal fut (RLS bypass szükséges a fájl mentéshez), ezért **minden
email-aliasból érkező feltöltés ki volt zárva az audit loggolásból**. Az Eseménynapló
emiatt júl.13 után leállt a Think Ai Kft-nél — azóta csak Mailgun-feltöltések érkeztek.

Tovább súlyosbított a helyzeten, hogy a `tr_audit_global` trigger csak az `invoice_uploads`
táblán volt felrakva — `transaction_uploads` és `report_uploads` teljesen hiányzott.

## Decision

### 1. Targeted bypass az `email_alias` INSERT-ekre

A guard módosítva lett, hogy a `service_role` blokkolása alól kivételt tegyen, **kizárólag
ha** az adott INSERT egy email_alias forrású feltöltés:

```sql
IF (
    v_company_id IS NOT NULL
    AND v_entity_name IS NOT NULL
    AND (
        auth.role() <> 'service_role'                          -- normál frontend akciók
        OR (TG_OP = 'INSERT' AND v_upload_source = 'email_alias')  -- Mailgun EF bypass
    )
) THEN
    INSERT INTO audit_logs ...
```

A `TG_OP = 'INSERT'` feltétel kulcsfontosságú: megakadályozza, hogy UPDATE vagy DELETE
service_role műveletek is átjussanak (pl. ha valaki metadata-ban módosítja a source mezőt).

### 2. Trigger hozzáadása hiányzó táblákra

```sql
CREATE TRIGGER tr_audit_global
AFTER INSERT OR UPDATE OR DELETE ON public.transaction_uploads
FOR EACH ROW EXECUTE FUNCTION public.global_audit_trigger_func();

CREATE TRIGGER tr_audit_global
AFTER INSERT OR UPDATE OR DELETE ON public.report_uploads
FOR EACH ROW EXECUTE FUNCTION public.global_audit_trigger_func();
```

### 3. Trigger function bővítése

A `TG_TABLE_NAME IN (...)` feltételek kibővítve a két új táblával:

```sql
ELSIF (TG_TABLE_NAME IN ('invoice_uploads', 'transaction_uploads', 'report_uploads', 'salary_files')) THEN
    v_entity_type := 'dokumentum'::audit_entity_type;
    v_entity_name := NEW.file_name;
```

Valamint az `upload_source` extrakció is kiterjesztve mindhárom upload táblára.

## Biztonsági elemzés

| Kockázat | Értékelés |
|---------|-----------|
| Normál user fake `email_alias` source-t injektál | ❌ Nem lehetséges — `invoice_uploads`-ba INSERT-hez RLS-en kell átmenni, `authenticated` role esetén `auth.role() <> 'service_role'` feltétel egyébként is igaz |
| Service_role UPDATE bypass | ❌ Blokkolva — `TG_OP = 'INSERT'` feltétel kizárja az UPDATE-eket |
| Service_role DELETE bypass | ❌ Blokkolva — ugyanaz |
| Management dashboard dupla audit bejegyzés | ❌ Nem — dashboard service_role UPDATE-eket végez, nem INSERT-eket |
| Worker (Python) dupla bejegyzés | ❌ Nem — worker nem `invoice_uploads`-ba ir, hanem olvassa |

**Konklúzió:** A bypass kizárólag az általunk kontrollált server-side Edge Function kódot
érinti, amelyre az `email_alias` source-t mi magunk állítjuk be.

## Alternatívák

**B opció: Az EF maga írja az audit_logs-ba** — Az Edge Function explicit INSERT-et
hajtott volna végre az `audit_logs` táblába a feltöltés után.

*Miért nem ezt választottuk:* Az EF akkor is fut, ha a trigger nem fut, de fordítva nem
igaz. Trigger alapú audit konzisztensebb, mert az adatbázis garantálja a végrehajtást
— az EF kód viszont crashelhet, timeout-olhat, vagy jövőbeli módosítással ki is maradhat.
A trigger az egyetlen igazságforrás.

## Consequences

**Pozitív:**
- Az Eseménynapló ismét mutat minden email-aliasból érkező feltöltést
- `transaction_uploads` és `report_uploads` feltöltések is loggolva vannak
- A biztonsági guard (management dashboard UPDATEk blokkolása) érintetlen maradt
- `SECURITY DEFINER` és `search_path` megőrizve (A-020 compliance)

**Negatív:**
- A `global_audit_trigger_func()` logikája összetettebb lett
- A jövőbeli EF-fejlesztőknek tudniuk kell, hogy `email_alias` source INSERT-ek
  automatikusan audit_logs-ba kerülnek — ezt nem kell explicit implementálni

## Migrációs fájl

`supabase/migrations/20260724_fix_audit_trigger_email_alias_bypass.sql`

## Kapcsolódó

- [A-011: Mailgun Webhook Feldolgozás](./A-011-mailgun-webhook-email-processing.md)
- [A-017: Biztonsági Architektúra](./A-017-security-architecture.md)
- [A-020: Auth Trigger Chain Incident](./A-020-auth-trigger-chain-incident.md)
- [A-031: Mailgun Retry és Deduplication](./A-031-mailgun-retry-dedup.md)
