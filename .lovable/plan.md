

## Plan: Signed URL for invoice image hover preview

### Problem
The current hover preview uses the raw `image_url` / `melleklet_url` directly as `<img src>`. These are Supabase storage URLs that require authentication -- so the preview shows a broken image. The `get-invoice-image-url` edge function exists and generates signed URLs, but it's not being used here.

### Solution
Create a small wrapper component (`InvoiceImagePreview`) that:
1. On mount (when HoverCard opens), calls the `get-invoice-image-url` edge function with the invoice ID
2. Shows a loading spinner while fetching
3. Displays the actual image using the returned signed URL
4. Caches the signed URL in a `Map` so repeated hovers don't re-fetch

### Changes

**File: `src/pages/InvoicesPage.tsx`**
- Add state: `imageUrlCache: Record<string, string>` to cache signed URLs
- Create an inline `InvoiceImagePreview` component (or extract to separate file) that:
  - Takes `invoiceId`, `imageUrl`, `mellekletUrl` as props
  - On open, checks cache first; if miss, calls `supabase.functions.invoke('get-invoice-image-url', { body: { invoiceId } })`
  - Renders: loading skeleton -> actual image or PDF placeholder
- Replace the current direct `<img src={...}>` in HoverCardContent with this component
- Use HoverCard's `onOpenChange` to trigger the fetch

### Technical detail
The edge function `get-invoice-image-url` accepts `{ invoiceId }` in the POST body and returns `{ signedUrl }`. It verifies ownership and generates a 1-hour signed URL. However, this function queries the `invoices` table (submitted invoices), not `nav_invoices`. The hover preview is on the **Beküldött** tabs where `invoice.id` maps to the `invoices` table, so this will work correctly for those tabs.

