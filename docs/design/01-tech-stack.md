# 01 — Tech Stack & Architektúra

> A eaisybill frontend technológiai alapjai és projekt struktúrája.

---

## Build & Runtime

| Kategória | Technológia | Verzió | Megjegyzés |
|-----------|-------------|--------|------------|
| **Framework** | React | 18.3 | Funkcionális komponensek, hooks |
| **Build Tool** | Vite | 5.4 | SWC plugin React-hez |
| **Nyelv** | TypeScript | 5.8 | Strict mode |
| **CSS** | TailwindCSS | 3.4 | `tailwindcss-animate` plugin |
| **UI Library** | shadcn/ui | default style | Radix UI primitívek |
| **State** | React Query (TanStack) | 5.x | Server-state cache |
| **Routing** | React Router DOM | 6.30 | Scoped route patternek |
| **Backend** | Supabase | 2.57 | Auth, DB, Storage, Edge Functions |
| **Linting** | ESLint | 9.x | `eslint-plugin-react-hooks` |
| **Testing** | Vitest + Playwright | 4.x / 1.58 | Unit + E2E |

## Egyéb Függőségek

| Csomag | Felhasználás |
|--------|-------------|
| `date-fns` + `hu` locale | Dátumformázás magyar formátumban |
| `lucide-react` | Ikonok (462+ ikon) |
| `recharts` | Diagramok (bevétel/kiadás chart, ÁFA) |
| `framer-motion` | Animációk |
| `react-hook-form` + `zod` | Űrlap validáció |
| `class-variance-authority` (CVA) | Komponens variánsok |
| `clsx` + `tailwind-merge` | Feltételes CSS osztályok |
| `exceljs` + `xlsx` | Excel export |
| `jspdf` + `jspdf-autotable` | PDF generálás |
| `papaparse` | CSV import/export |
| `react-joyride` | Product tour (onboarding walkthrough) |
| `tiptap` | Rich text editor |
| `cmdk` | Command palette (⌘K) |
| `vaul` | Drawer komponens |
| `react-qr-code` | QR kód generálás |
| `embla-carousel-react` | Carousel |
| `react-resizable-panels` | Átméretezhető panelek |
| `react-day-picker` | Naptár komponens |
| `input-otp` | OTP input |

## Projekt Struktúra

```
src/
├── App.tsx                     # Root component, routing, provider stack
├── App.css                     # Legacy CSS (nem használt aktívan)
├── index.css                   # 🎨 DESIGN SYSTEM — Minden token itt van
├── main.tsx                    # React entry point
│
├── components/
│   ├── ui/                     # 🧩 60+ shadcn/ui + egyedi UI komponens
│   │   ├── button.tsx          #    Button variánsok (CVA)
│   │   ├── badge.tsx           #    Badge variánsok
│   │   ├── card.tsx            #    Card layout
│   │   ├── dialog.tsx          #    Modal dialog
│   │   ├── table.tsx           #    Alap tábla primitívek
│   │   ├── sidebar.tsx         #    Sidebar primitív (24KB)
│   │   ├── toast.tsx           #    Toast értesítések
│   │   ├── loading-spinner.tsx #    Full-page spinner
│   │   ├── content-skeleton.tsx #   Tartalom skeleton
│   │   ├── unified-pagination.tsx # Egységes lapozás
│   │   ├── copyable-cell.tsx   #    Másolható cella tooltip-pal
│   │   ├── ios-toggle.tsx      #    iOS stílusú toggle
│   │   ├── page-header.tsx     #    Oldal fejléc + breadcrumb
│   │   └── ...                 #    (60 fájl összesen)
│   │
│   ├── dashboard/              # Dashboard al-komponensek
│   ├── transactions/           # Tranzakció tábla és szűrők
│   ├── invoices/               # Számla specifikus komponensek
│   ├── general-ledger/         # Főkönyv komponensek
│   ├── salaries/               # Bérszámfejtés
│   ├── working-time/           # Munkaidő
│   ├── fixed-assets/           # TENY
│   ├── kintlevo/               # Kintlévőség
│   ├── courier/                # Futárszolgálat riport
│   ├── nav/                    # Navigációs komponensek
│   ├── settings/               # Beállítások szekciók
│   │
│   ├── AppLayout.tsx           # ⬛ App shell (Sidebar + TopBar + Content)
│   ├── AppSidebar.tsx          # 📋 Navigációs sidebar
│   ├── ProtectedLayout.tsx     # 🔒 Auth gate + feedback FAB
│   ├── ScopedLayout.tsx        # 🔗 URL ↔ Context szinkronizáció
│   ├── ErrorBoundary.tsx       # ❌ Hibakezelő boundary
│   └── ...                     # Egyéb standalone komponensek
│
├── pages/                      # 📄 28 lazy-loaded page komponens
│   ├── Index.tsx               #    Dashboard
│   ├── Auth.tsx                #    Bejelentkezés (65KB!)
│   ├── InvoicesPage.tsx        #    Számlák (80KB - legnagyobb)
│   ├── ManualUpload.tsx        #    Feltöltés (65KB)
│   └── ...
│
├── contexts/                   # 🌐 5 React Context
│   ├── AuthContext.tsx          #    Autentikáció
│   ├── CompanyContext.tsx       #    Cégválasztás
│   ├── DateRangeContext.tsx     #    Globális dátumszűrő
│   ├── SubscriptionContext.tsx  #    Előfizetés
│   └── ThemeContext.tsx         #    Sötét/világos téma
│
├── hooks/                      # 🪝 31 custom hook
│   ├── useInvoiceData.ts       #    Számla adatok query
│   ├── useTransactionData.ts   #    Tranzakció query
│   ├── useDashboardData.ts     #    Dashboard KPI-k (26KB)
│   ├── useAppReady.ts          #    App inicializáció gate
│   ├── useSessionGuard.ts      #    Session timeout
│   └── ...
│
├── lib/                        # 📚 28 utility fájl
│   ├── navigation.ts           #    Scoped routing utilities
│   ├── constants.ts            #    Storage key-ek
│   ├── queryKeys.ts            #    React Query kulcsok
│   ├── utils.ts                #    cn() és egyéb utils
│   └── ...
│
├── types/                      # 📝 TypeScript típusok
│   ├── invoices.ts
│   └── fixed-assets.ts
│
└── integrations/               # 🔌 Supabase client, types
    └── supabase/
```

## Provider Stack (Nesting Sorrend)

A `App.tsx`-ben definiált provider hierarchy:

```
QueryClientProvider          ← React Query cache
  └── ThemeProvider          ← Dark/Light mode
    └── AuthProvider         ← Supabase auth session
      └── CompanyProvider    ← Cégválasztás context
        └── DateRangeProvider ← Globális dátum szűrő
          └── SubscriptionProvider ← Előfizetés limit-ek
            └── TooltipProvider    ← shadcn tooltip
              └── BrowserRouter    ← React Router
                └── Routes         ← Útvonalak
```

## shadcn/ui Konfiguráció

A `components.json` alapján:

```json
{
  "style": "default",
  "rsc": false,           // Nem Next.js, nincs RSC
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true   // HSL CSS változók
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```
