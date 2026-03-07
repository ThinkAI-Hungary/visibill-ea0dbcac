

## Beküldött (Kimenő) sorok zöld színezésének javítása

### Probléma

A `src/pages/InvoicesPage.tsx` **2022. sorában** a `SUBMITTED_OUTBOUND` fül minden sora feltétel nélkül zöld hátteret kap:

```typescript
!selectedSubmittedIds.has(invoice.id) && activeTab === 'SUBMITTED_OUTBOUND' && "bg-[hsl(var(--success-row-bg))]..."
```

Ez helytelen: a zöld szín csak akkor kellene, ha van párosított banki tranzakció (ahogy a `SUBMITTED_INBOUND` fülnél is `matchedInvoiceIds` alapján történik).

### Megoldás

**Egyetlen sor módosítás** az `InvoicesPage.tsx` 2022. sorában:

A jelenlegi feltétel nélküli zöld (`activeTab === 'SUBMITTED_OUTBOUND'`) helyett ugyanazt a `matchedInvoiceIds.has(invoice.id)` logikát kell alkalmazni, mint a `SUBMITTED_INBOUND` fülnél:

- Ha `matchedInvoiceIds` tartalmazza az invoice ID-t -> zöld sor (van tranzakció)
- Ha nem -> piros sor (nincs tranzakció)

Ez a `SUBMITTED_INBOUND` 2020-2021. sorainak mintáját követi, csak az `activeTab` feltétel lesz `'SUBMITTED_OUTBOUND'`.

