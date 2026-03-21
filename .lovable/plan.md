

# Számla Feltöltött Fájlok dialog: lazy query

## Probléma
Az `InvoiceFilesDialog` komponens query-jei (`invoice_uploads_with_invoices`, `company_members_profiles`) azonnal lefutnak, ha van `companyId`. Ugyanúgy kell működnie, mint a bér fájloknál: csak a dialog megnyitásakor.

## Megoldás
`src/components/invoices/InvoiceFilesDialog.tsx` módosítása:

1. `isOpen` state bevezetése (`useState(false)`)
2. `Dialog` komponens kontrolláltra alakítása: `open={isOpen} onOpenChange={setIsOpen}`
3. Mindkét `useQuery` `enabled` feltételébe: `enabled: !!companyId && isOpen`

Egy az egyben ugyanaz a minta, mint a `SalaryFilesTable.tsx`-ben már megvalósítottuk.

