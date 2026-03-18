

## Fix Plan: Petty Cash Route + InvoicesPage Build Error

### 1. Add `/petty-cash` route — `src/App.tsx`
- Import `PettyCashPage` (already exists at `src/pages/PettyCashPage.tsx`)
- Add route inside the `ProtectedLayout` block:
  ```
  <Route path="/petty-cash" element={<ProtectedPage><PettyCashPage /></ProtectedPage>} />
  ```

### 2. Fix `fetchData` references — `src/pages/InvoicesPage.tsx`
- Line 526: Replace `fetchData()` with `fetchInvoiceData()` (the actual function defined at line 308)
- Line 1291: Replace `fetchData()` with `fetchInvoiceData()`

No changes to the `send-email` edge function.

