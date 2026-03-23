

# Build Error Fixes

## Problem 1: `send-invoice-notification/index.ts` — `npm:` imports
Lines 3-4 use `npm:resend@4.0.0` and `npm:@react-email/components@0.0.22` which fail in the Deno build. Replace with `esm.sh` imports (same pattern as `send-email/index.ts`).

## Problem 2: `ManualUpload.tsx` — `id` not in Toast type
The `Toast` type is `Omit<ToasterToast, "id">`, so passing `id` is a TS error. The `id` was used for deduplication, but the `toast()` function auto-generates IDs. Fix: remove `id` from all 6 toast calls (lines 410, 428, 695, 715, 921, 938).

## Problem 3: AuthContext — Already correct
The 4h gate is already fully implemented with pre-flight check, `expiredRef`, `gateCheckedRef`, silent signOut, login reset, and PASSWORD_RECOVERY bypass. No changes needed.

---

## Files to edit

| File | Change |
|---|---|
| `supabase/functions/send-invoice-notification/index.ts` | `npm:resend@4.0.0` → `https://esm.sh/resend@4.0.0`, `npm:@react-email/components@0.0.22` → `https://esm.sh/@react-email/components@0.0.22`, `npm:react@18.3.1` → `https://esm.sh/react@18.3.1` |
| `src/pages/ManualUpload.tsx` | Remove `id` property from 6 toast calls (lines 410, 428, 695, 715, 921, 938) |

No AuthContext changes needed — the implementation is already complete and correct.

