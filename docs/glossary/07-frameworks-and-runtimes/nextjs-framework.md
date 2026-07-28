# ⚛️ Next.js — Fullstack React Framework

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [Node.js Runtime](./nodejs-runtime.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Next.js** a Vercel által fejlesztett populáris, nyílt forráskódú **fullstack React keretrendszer**. A megszokott kliens-oldali React alkalmazásokkal (SPA - Single Page Application) ellentétben a Next.js hibrid renderelést kínál: **Server-Side Rendering (SSR)**, **Static Site Generation (SSG)**, **Incremental Static Regeneration (ISR)** és **React Server Components (RSC)**.

---

## 🔑 Főbb Next.js Fogalmak & Funkciók

| Kifejezés | Jelentése & Működése |
|---|---|
| **App Router (`app/` directory)** | A Next.js új architektúrája, amely a React Server Components-re épül és támogatja a beágyazott layout-okat (`layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`). |
| **SSR (Server-Side Rendering)** | A HTML oldal minden kérésnél a szerveren renderelődik le a friss adatokkal, javítva az SEO-t és az első betöltési élményt (FCP). |
| **SSG (Static Site Generation)** | Az oldalak a build időben HTML-lé generálódnak le, ami ultragyors CDN kiszolgálást tesz lehetővé. |
| **API Routes & Server Actions** | Szerver oldali végpontok és async függvények írása közvetlenül a React kódban, külön backend szerver nélkül. |
| **Hydration** | Az a folyamat, amikor a szerverről megérkező statikus HTML vázat a böngészőben futó JavaScript "életre kelti" és interaktívvá teszi. |

---

## 💡 Hogyan viszonyul a Next.js a Visibill Webapphoz?

### A Visibill Jelenlegi Frontend Stack-je (Vite + React SPA)
A Visibill frontendje (`eaisybill-prod`) **Vite-alapú React Single Page Application (SPA)** architecture-re épül shadcn/ui és Tailwind CSS komponensekkel:
- **Kliens-oldali Routing:** `react-router-dom` kezeli az útvonalakat.
- **Backend Adatkapcsolat:** Supabase client + Deno Edge Functions (`management-stats`, `send-email`).
- **Autentikáció & RLS:** A kliens oldali React Query kezeli a gyellemes cache-elést.

### Mikor Érdemes Next.js-t Használni?
1. **Public Marketing Oldalak & SEO:** Publikus landing page-eknél, blogbejegyzéseknél, árazási oldalaknál, ahol a Google keresőmotorok általi indexelés (SEO) kritikus.
2. **Hybrid Webappok:** Ahol bizonyos zárt oldalak dashboard-ként futnak, de a publikus részeknek villámgyors szerver-oldali renderelésre van szükségük.
