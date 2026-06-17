# A-015: Stripe Integráció Eltávolítása

**Status:** Superseded (2026-06-07)  
**Date:** 2025-09 (implementálva) → 2026-06-07 (eltávolítva)

## Context

A Stripe subscription modell nem illeszkedett a célpiac igényeihez. A magyar KKV cégvezetők inkább egyszeri vásárlást preferálnak.

## Decision

**A teljes Stripe integráció eltávolítva a kódbázisból.**

**Törölt komponensek:**
| Fájl/Mappa | Funkció |
|-----------|---------|
| `src/contexts/SubscriptionContext.tsx` | Subscription state management, 60s polling |
| `src/pages/Pricing.tsx` | Stripe pricing page UI |
| `src/components/SubscriptionUsage.tsx` | Usage meter widget |
| `supabase/functions/check-subscription/` | Stripe subscription status check |
| `supabase/functions/check-subscription-status/` | Cron-based expiry notifications |
| `supabase/functions/create-checkout/` | Stripe checkout session creation |
| `supabase/functions/customer-portal/` | Stripe billing portal |

**Módosított fájlok:**
- `App.tsx` — SubscriptionProvider eltávolítva
- `AppSidebar.tsx` — Pricing nav link eltávolítva
- `navigation.ts` — pricing PAGE_PATHS eltávolítva
- `information-architecture.md` — /pricing route eltávolítva

**DB állapot:** A `user_subscriptions` tábla még létezik, de nem aktív.

## Consequences

**Pozitív:**
- Megszűnt a felesleges 60s polling (check-subscription)
- Egyszerűbb provider stack (5 → 4 kontextus)
- Kisebb bundle méret

**Negatív:**
- Nincs fizetési rendszer — az egyszeri díjas modell fizetési flow-ja még nem tervezett
- A `user_subscriptions` tábla "árva" — a jövőben törlendő vagy átalakítandó

## Kapcsolódó döntések
- [004-pricing-model.md](../../business/decisions/004-pricing-model.md) — egyszeri díjas modell
- [005-subscription-scope.md](../../business/decisions/005-subscription-scope.md) — Superseded
- [P-028-pricing-page.md](../../product/decisions/P-028-pricing-page.md) — Superseded
