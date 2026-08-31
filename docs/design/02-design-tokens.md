# 02 — Design Tokens & Színrendszer

> Az eaisybill platform teljes design token rendszere: CSS változók, HSL színpaletta, sötét/világos mód, shadows, border radius. Ez a dokumentum minden eaisybill termékre érvényes referencia.

---

## Alapelv

Minden szín **HSL formátumban** van definiálva CSS custom property-kként az `index.css` `@layer base` blokkjában. A Tailwind config ezeket a változókat használja `hsl(var(--token))` szintaxissal.

**Miért HSL?** Az opacity módosító (`hsl(var(--primary) / 0.5)`) natívan működik TailwindCSS-ben.

**Forrás fájl:** `src/index.css` — `:root` (light) és `.dark` (dark) blokkokban.

---

## Szín Token Táblázat

### Core Tokens — Világos Mód (`:root`)

| Token | HSL Érték | Hex Közelítés | Felhasználás |
|-------|-----------|---------------|-------------|
| `--background` | `220 7% 97%` | `#f5f6f7` | Oldal háttér (Linear canvas) |
| `--foreground` | `210 14% 4%` | `#090b0e` | Elsődleges szöveg |
| `--card` | `0 0% 100%` | `#ffffff` | Kártya háttér |
| `--card-foreground` | `210 14% 4%` | `#090b0e` | Kártya szöveg |
| `--popover` | `0 0% 100%` | `#ffffff` | Popover háttér |
| `--popover-foreground` | `210 14% 4%` | `#090b0e` | Popover szöveg |

### Core Tokens — Sötét Mód (`.dark`)

| Token | HSL Érték | Hex Közelítés | Felhasználás |
|-------|-----------|---------------|-------------|
| `--background` | `210 14% 3%` | `#08090a` | Oldal háttér (Onyx) |
| `--foreground` | `210 7% 97%` | `#f5f6f7` | Elsődleges szöveg |
| `--card` | `210 7% 5%` | `#0f1011` | Kártya háttér (Charcoal) |
| `--card-foreground` | `210 7% 97%` | `#f5f6f7` | Kártya szöveg |
| `--popover` | `210 5% 9%` | `#161718` | Popover háttér (Obsidian) |
| `--popover-foreground` | `210 7% 97%` | `#f5f6f7` | Popover szöveg |

---

### Brand Szín — Primary (Fintech Teal)

| Token | Világos | Sötét | Felhasználás |
|-------|---------|-------|-------------|
| `--primary` | `174 83% 32%` | `170 82% 45%` | Brand szín / CTA gombok |
| `--primary-foreground` | `0 0% 100%` | `210 14% 3%` | Szöveg primary háttéren |
| `--primary-subtle` | `174 83% 97%` | `170 82% 10%` | Halvány primary háttér |

> **Hex közelítés:** `#0D9488` (light) / `#14D4B8` (dark)

### Semleges Színek

| Token | Világos | Sötét |
|-------|---------|-------|
| `--secondary` | `220 14% 96%` | `210 5% 9%` |
| `--secondary-foreground` | `210 14% 4%` | `210 7% 97%` |
| `--muted` | `220 7% 94%` | `210 5% 9%` |
| `--muted-foreground` | `220 5% 40%` | `220 5% 55%` |

### Akció & Accent Színek

| Token | Világos | Sötét | Felhasználás |
|-------|---------|-------|-------------|
| `--accent` | `174 60% 92%` | `170 50% 12%` | Hover/kijelölés háttér |
| `--accent-foreground` | `174 83% 25%` | `170 82% 70%` | Accent szöveg |
| `--accent-subtle` | `174 83% 97%` | `170 82% 8%` | Nagyon halvány accent |
| `--destructive` | `0 65% 56%` | `0 80% 63%` | Törlés / hiba |
| `--destructive-foreground` | `0 0% 100%` | `0 0% 100%` | Szöveg destructive háttéren |

### Border & Input

| Token | Világos | Sötét | Felhasználás |
|-------|---------|-------|-------------|
| `--border` | `222 10% 89%` | `225 9% 15%` | Hairline border (#e2e4e8 / #23252a) |
| `--input` | `220 10% 89%` | `210 5% 24%` | Input border |
| `--ring` | `174 83% 32%` | `170 82% 45%` | Focus ring (brand teal) |

### Szemantikus Státusz Színek

| Token | Világos | Sötét | Felhasználás |
|-------|---------|-------|-------------|
| `--success` | `142 71% 45%` | `142 71% 50%` | Sikeres művelet, „fizetve" |
| `--success-foreground` | `0 0% 100%` | `210 14% 3%` | Szöveg success háttéren |
| `--success-subtle` | `142 71% 97%` | `142 71% 8%` | Halvány zöld háttér |
| `--warning` | `41 100% 30%` | `41 85% 52%` | Figyelmeztetés, „nyitott" (#9a6700 light) |
| `--warning-foreground` | `41 100% 10%` | `210 14% 3%` | Szöveg warning háttéren |
| `--warning-subtle` | `41 80% 95%` | `41 85% 8%` | Halvány amber háttér |
| `--info` | `219 82% 57%` | `219 82% 62%` | Információ |
| `--info-foreground` | `0 0% 100%` | `210 14% 3%` | Szöveg info háttéren |
| `--info-subtle` | `219 82% 97%` | `219 82% 8%` | Halvány kék háttér |

> **⚠️ Warning szín — Light mode:** Sötét amber (`41 100% 30%` ≈ #9a6700) a világos háttéren való kontraszt biztosításához. NEM sárga!

### Chart Színek

Recharts diagramokhoz 5 előre definiált szín:

| Token | Világos | Sötét | Szín |
|-------|---------|-------|------|
| `--chart-1` | `174 83% 32%` | `170 82% 45%` | Teal (primary) |
| `--chart-2` | `219 82% 57%` | `219 82% 62%` | Kék |
| `--chart-3` | `41 100% 30%` | `41 85% 52%` | Amber |
| `--chart-4` | `142 71% 45%` | `142 71% 50%` | Zöld |
| `--chart-5` | `330 81% 60%` | `330 81% 65%` | Rózsaszín |

---

## Tranzakció Típus Színek

Egyedi színkódolás tranzakció típusonként:

### Világos Mód

| Típus | Háttér token | Szöveg token | Szín leírás |
|-------|-------------|-------------|-------------|
| Szállító (`supplier`) | `220 75% 92%` | `220 80% 25%` | Kék pasztell |
| Vevő (`customer`) | `152 60% 88%` | `152 75% 20%` | Zöld pasztell |
| Átutalás (`transfer`) | `200 70% 90%` | `200 80% 22%` | Világoskék |
| Bankdíj (`bankfee`) | `30 80% 90%` | `30 90% 25%` | Narancs pasztell |
| Kártyadíj (`cardfee`) | `35 80% 90%` | `35 90% 25%` | Sárgás narancs |
| Hitel (`loan`) | `330 65% 92%` | `330 75% 25%` | Rózsaszín |
| ATM (`atm`) | `25 45% 88%` | `25 55% 22%` | Barna pasztell |
| Készpénz ki (`cashout`) | `25 40% 90%` | `25 45% 22%` | Halvány barna |
| Készpénz be (`cashin`) | `152 50% 88%` | `152 55% 20%` | Halvány zöld |
| Bér (`salary`) | `270 55% 92%` | `270 60% 22%` | Lila pasztell |
| Adó (`tax`) | `270 60% 90%` | `270 70% 22%` | Sötétebb lila |
| Bankköltség (`bankcost`) | `185 55% 88%` | `185 65% 18%` | Cián |
| Kamat (`interest`) | `45 75% 88%` | `45 85% 22%` | Sárga |
| ATM készpénz (`atmcash`) | `15 65% 88%` | `15 75% 22%` | Vörös-narancs |

### Sötét Mód

| Típus | Háttér token | Szöveg token | Szín leírás |
|-------|-------------|-------------|-------------|
| Szállító (`supplier`) | `220 70% 40%` | `0 0% 100%` | Sötétebb kék háttér, fehér szöveg |
| Vevő (`customer`) | `142 71% 35%` | `0 0% 100%` | Mélyzöld háttér, fehér szöveg |
| Átutalás (`transfer`) | `200 60% 30%` | `200 80% 85%` | Mélykék háttér, világoskék szöveg |
| Bankdíj (`bankfee`) | `30 90% 40%` | `0 0% 100%` | Narancsbarna háttér, fehér szöveg |
| Kártyadíj (`cardfee`) | `35 70% 35%` | `35 90% 85%` | Mély sárgásbarna háttér |
| Hitel (`loan`) | `330 60% 40%` | `0 0% 100%` | Mély rózsaszín / bordó |
| ATM (`atm`) | `25 50% 30%` | `0 0% 100%` | Mélybarna háttér |
| Készpénz ki (`cashout`) | `25 40% 35%` | `0 0% 100%` | Sötétbarna háttér |
| Készpénz be (`cashin`) | `142 40% 30%` | `142 50% 85%` | Mély mohazöld háttér |
| Bér (`salary`) | `270 40% 35%` | `270 50% 85%` | Sötétlila háttér |
| Adó (`tax`) | `270 60% 30%` | `0 0% 100%` | Sötétibolya háttér |
| Bankköltség (`bankcost`) | `180 50% 28%` | `180 60% 85%` | Sötét petrol háttér |
| Kamat (`interest`) | `55 60% 30%` | `55 70% 85%` | Sötét olajbarna |
| ATM készpénz (`atmcash`) | `15 55% 30%` | `15 65% 85%` | Sötét vörösesbarna |

> **Fontos:** A szövegszín NEM hardkódolt `text-white` — a `--tr-xxx-text` CSS változó dark mode-ban `0 0% 100%` (fehér), light mode-ban sötét értéket vesz fel. Így mindkét mód egyetlen Tailwind osztállyal kezelhető: `text-[hsl(var(--tr-xxx-text))]`.

---

## Egységes Táblázat Sorszín Rendszer (Unified Row Status)

A számlák, tranzakciók és futárjelentések táblázatai azonos, bal oldali 3px szegéllyel és áttetsző háttérrel rendelkező színkódolást alkalmaznak:

| Státusz Kulcs | Jelentés | Világos háttér / szegély | Sötét háttér / szegély |
|---|---|---|---|
| `--row-matched-*` | **Párosítva** | `hsla(149, 80%, 80%, 0.85)` / `hsl(160, 84%, 39%)` | `hsla(152, 69%, 17%, 0.5)` / `hsl(160, 84%, 39%)` |
| `--row-suggested-*` | **AI Javaslat** | `hsla(48, 96%, 80%, 0.85)` / `hsl(48, 96%, 47%)` | `hsla(32, 81%, 25%, 0.5)` / `hsl(48, 96%, 47%)` |
| `--row-settled-*` | **Rendezve / Sztornó zárva** | `hsla(214, 95%, 85%, 0.7)` / `hsl(217, 91%, 60%)` | `hsla(212, 72%, 24%, 0.4)` / `hsl(217, 91%, 60%)` |
| `--row-noinvoice-*` | **Számla nélkül** | `hsla(269, 100%, 88%, 0.75)` / `hsl(271, 91%, 65%)` | `hsla(274, 66%, 32%, 0.4)` / `hsl(271, 91%, 65%)` |
| `--row-missing-*` | **Hiányzó számla** | `hsla(204, 94%, 86%, 0.75)` / `hsl(199, 89%, 48%)` | `hsla(202, 80%, 24%, 0.4)` / `hsl(199, 89%, 48%)` |
| `--row-unmatched-*` | **Párosítatlan** | `hsla(356, 100%, 85%, 0.80)` / `hsl(351, 95%, 72%)` | `hsla(348, 83%, 15%, 0.4)` / `hsl(351, 95%, 72%)` |

### Sorszintű Hover Fényerő-Shift (`data-row-hover`)

Mivel a státusz sorok színes háttérrel rendelkeznek, a sima `hover:bg-muted` elfedné a státuszt. A `tr[data-row-hover]:hover td` szabály egy finom gradient világosítást (`rgba(0,0,0,0.03)` light / `rgba(255,255,255,0.06)` dark) tesz a meglévő háttérre.

### Automatikus Badge Hairline Szegély (`color-mix`)

Minden badge és státusz span automatikusan a saját szövegszínéből kevert 15%-os szegélyt kap:
```css
span[class*="inline-flex"][class*="items-center"][class*="bg-"][class*="text-"],
.badge {
  border: 1px solid currentColor !important;
  border-color: color-mix(in srgb, currentColor 15%, transparent) !important;
}
```

### Recharts Tooltip Változók

| Változó | Világos | Sötét |
|---|---|---|
| `--tooltip-bg` | `white` | `#1e293b` |
| `--tooltip-text` | `#1e293b` | `#e2e8f0` |
| `--tooltip-cursor` | `#f8fafc` | `rgba(255, 255, 255, 0.05)` |

---

## Shadow Rendszer

### Linear-inspirált Shadow Filozófia

> **FONTOS:** A design rendszer **flat design** elveket követ. Dark mode-ban az árnyékok helyett subtilis `1px inset border`-eket használ a rendszer. Light mode-ban is minimális, visszafogott shadow-k vannak.

### CSS Custom Property Shadow-ok

| Token | Világos | Sötét |
|-------|---------|-------|
| `--shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.04)` | `inset 0 0 0 1px rgb(255 255 255 / 0.04)` |
| `--shadow` | `rgba(0,0,0,0.06) 0px 2px 8px 0px` | `inset 0 0 0 1px hsl(225 9% 15%)` |
| `--shadow-lg` | `0 10px 20px -5px rgb(0 0 0 / 0.08), ...` | `inset 0 0 0 1px ... + 0 4px 12px -4px rgb(0 0 0 / 0.3)` |
| `--shadow-xl` | `0 20px 40px -10px rgb(0 0 0 / 0.1), ...` | `inset 0 0 0 1px ... + 0 8px 24px -8px rgb(0 0 0 / 0.4)` |

### Hover Shadow Tiltás

A `index.css` globálisan tiltja a hover-re aktiválódó shadow-kat:

```css
*[class*="hover:shadow"]:hover {
  --tw-shadow: 0 0 #0000 !important;
  --tw-shadow-colored: 0 0 #0000 !important;
  transform: none !important;
}
```

Ez biztosítja a **flat design** elvének érvényesülését.

---

## Border Radius

| Token | Érték | Felhasználás |
|-------|-------|-------------|
| `--radius` | `0.375rem` (6px) | Kompakt, Linear-stílusú radius |
| `lg` | `var(--radius)` = 6px | Kártyák, nagy elemek |
| `md` | `calc(var(--radius) - 2px)` = 4px | Gombok, inputok |
| `sm` | `calc(var(--radius) - 4px)` = 2px | Badge-ek, kis elemek |

> A radius értékek szándékosan kompaktak (6px max), a Linear-inspirált flat design jegyében.

---

## Sidebar Színek

| Token | Világos | Sötét |
|-------|---------|-------|
| `--sidebar-background` | `0 0% 100%` | `210 7% 5%` |
| `--sidebar-foreground` | `220 5% 40%` | `210 7% 97%` |
| `--sidebar-primary` | `210 14% 4%` | `170 82% 45%` |
| `--sidebar-primary-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--sidebar-accent` | `174 60% 92%` | `170 50% 12%` |
| `--sidebar-accent-foreground` | `174 83% 25%` | `170 82% 70%` |
| `--sidebar-border` | `222 10% 89%` | `225 9% 15%` |
| `--sidebar-ring` | `174 83% 32%` | `170 82% 45%` |

---

## Szín Használati Útmutató

### Tailwind Osztályok

```tsx
// Background
className="bg-background"        // Oldal háttér
className="bg-card"              // Kártya háttér
className="bg-primary"           // Brand teal háttér
className="bg-primary/10"        // 10% opacity teal

// Text
className="text-foreground"      // Elsődleges szöveg
className="text-muted-foreground" // Másodlagos szöveg
className="text-primary"         // Brand teal szöveg
className="text-foreground/80"   // Enyhén muted szöveg (logo, stb.)

// Border
className="border-border"        // Standard hairline border
className="border-primary/30"    // Teal tinted border

// Semantic
className="bg-success text-success-foreground"
className="bg-warning text-warning-foreground"
className="bg-destructive text-destructive-foreground"

// Pénzügyi értékek
className="text-emerald-700 dark:text-emerald-400"  // Pozitív összeg
className="text-rose-600 dark:text-rose-400"         // Negatív összeg
```

### Dark Mode Viselkedés

A sötét mód a `darkMode: ["class"]` TailwindCSS beállítás szerint működik. A `dark` class a `<html>` elemre kerül, NEM a `<body>`-ra.

### Témaváltás Animáció Megőrzés

A témaváltás során a CSS animációkat **pauseoljuk** (`animation-play-state: paused`), nem reseteljük. Ez megakadályozza a `page-animate` és egyéb animációk újraindulását.

```css
/* Freeze all animations during theme switch (pause, don't reset) */
.theme-switching * { animation-play-state: paused !important; }
```

A transition-ök a `no-transitions` class-szal tiltva vannak a váltás alatt:

```css
.no-transitions * { transition: none !important; }
```
