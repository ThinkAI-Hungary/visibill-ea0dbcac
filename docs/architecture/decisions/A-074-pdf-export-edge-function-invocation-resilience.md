# A-074: PDF Export Edge Function Invocation Resilience

**Status:** Decided  
**Date:** 2026-08-31  
**Category:** Edge Functions & Hibatűrés  
**Related Decisions:** [A-028](./A-028-pdf-export-lifecycle.md), [A-047](./A-047-pdf-export-enhancements-and-posting-slips.md), [A-069](./A-069-frontend-error-reporting-and-context-inspection.md), [A-073](./A-073-defensive-prop-normalization-and-settings-resilience.md)

---

## 1. Context

A számlák oldalon a PDF export indításakor a következő frontend hiba jelentkezett:
`[usePdfExport/error] Export start failed`
`SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON`

A vizsgálat feltárta, hogy a `usePdfExport.ts` közvetlen low-level `fetch()` hívást végzett a `${supabaseUrl}/functions/v1/generate-pdf-export` végpontra, majd közvetlenül meghívta a `resp.json()` metódust. Ha a Supabase Gateway vagy az Edge runtime nem-200 JSON-t, hanem HTML hibaoldalt (pl. átmeneti gateway timeout, proxy hiba) adott vissza, a JSON parser azonnal összeomlott.

---

## 2. Decision

1. **Supabase SDK `functions.invoke` standardizáció:**
   - A manuális `fetch()` hívást lecseréltük a standard és típusbiztos `supabase.functions.invoke('generate-pdf-export', { body: ... })` metódusra.
2. **Automatikus Token & Gateway Kezelés:**
   - A `functions.invoke` natívan kezeli a session token frissítést, a CORS headereket és az API kulcsokat, valamint strukturált `invokeError` objektumba csomagolja a hálózati és gateway hibákat anélkül, hogy `SyntaxError` keletkezne a parserben.
3. **Egységtesztek:**
   - Dedikált egységtesztek készültek (`src/hooks/__tests__/usePdfExport.test.ts`), amelyek lefedik a sikeres hívást, a hálózati/gateway hibák biztonságos kezelését és a szerver oldali üzleti hibaüzenetek feldolgozását.

---

## 3. Consequences

### Pozitív:
- Megszűntek a `SyntaxError: Unexpected token '<'` típusú kivételek a PDF export indításakor.
- Egységes és megbízható hibajelentés az `app_error_logs:frontend` felé (`type: 'edge_function'`).
