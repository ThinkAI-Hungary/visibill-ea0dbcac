

## Feltöltési státusz logika átdolgozása

### Jelenlegi probléma
A `statusMap` nem ismeri a `webhook_sent` és `webhook_failed` státuszokat, ezért nyers szöveg jelenik meg. Az `error_message` mező nem törlődik sikeres webhook küldéskor, ami hamis hibaüzenetet mutat.

### Változtatások

**1. `src/components/UploadHistory.tsx` -- statusMap frissítése**

Új státusz-leképezés:
- `pending` / `processing` / `uploaded` → "Feltöltve" (secondary)
- `webhook_sent` → "Feltöltve" (secondary) -- a webhook sikeresen elküldte n8n-nek
- `completed` / `done` → "Feldolgozva" (default/green)
- `webhook_failed` / `failed` / `error` → "A feltöltés sikertelen" (destructive)

Az `error_message` csak akkor jelenik meg, ha a státusz `webhook_failed`, `failed` vagy `error`.

**2. `supabase/functions/trigger-invoice-processing/index.ts` -- error_message nullázása**

A sikeres webhook küldésnél `error_message: null` beállítása, hogy korábbi hibák ne maradjanak bent.

**3. Adattisztítás (SQL UPDATE)**

Meglévő `invoice_uploads` rekordok `error_message` mezőjének nullázása ahol `processing_status = 'webhook_sent'`:
```sql
UPDATE invoice_uploads SET error_message = NULL WHERE processing_status = 'webhook_sent';
```

### Megjegyzés
A "Feldolgozva" státusz akkor jelenik meg, amikor az n8n visszaírja a `processing_status`-t `completed`-re az `invoice_uploads` táblában. Ha az n8n jelenleg nem frissíti ezt a mezőt, azt az n8n workflow oldalán kell beállítani.

