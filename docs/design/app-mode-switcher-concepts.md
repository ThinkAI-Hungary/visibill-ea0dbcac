# App Mode Switcher — Design Koncepciók

> **Státusz:** ⏳ Döntésre vár (management jóváhagyás)
> **Dátum:** 2026-06-14
> **Mockup fájl:** `scratch/app-switcher-mockups.html` (lokális preview)
> **Érintett fájlok:** `AppSidebar.tsx` (L306-332), `AccountyLayout.tsx` (L196-228)
>
> **❗ Megjegyzés:** Az "Accounty" rebrandelve lett **eaisyBooks**-ra. A kódban (`AccountyLayout`, `/accounty/` route) továbbra is a legacy név él. A váltó UI-ban az új brand nevet (eaisyBooks) kell megjeleníteni.

---

## Kontextus

Az eaisyBill és eaisyBooks (korábban: Accounty) nézet közötti váltás jelenleg a sidebar header-ben egy egyszerű szöveges link:

```
eaisyBill | eaisyBooks
```

A cél: egy designosabb, professzionális váltó komponens, ami:
- Egyértelmű vizuális jelzést ad, melyik mód aktív
- Illeszkedik a meglévő dark theme-hez (teal `#2dd4bf` = eaisyBill, red `#ef4444` = eaisyBooks)
- Működik collapsed sidebar-ban is (opcionális, de előny)
- Támogat notification badge-et (pl. jóváhagyásra váró elemek száma)

---

## Jelenlegi implementáció

### AppSidebar.tsx (eaisybill oldal)
- **Fájl:** [`src/components/AppSidebar.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppSidebar.tsx#L306-L332)
- **Expanded:** `eaisybill | Accounty` — a "Accounty" egy `<Link to="/accounty">`
- **Collapsed:** `eai` felett `A` link, elválasztó vonallal

### AccountyLayout.tsx (Accounty oldal)
- **Fájl:** [`src/pages/Accounty/AccountyLayout.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Accounty/AccountyLayout.tsx#L196-L228)
- **Expanded:** `eaisybill | Accounty` — az "eaisybill" egy `<Link to="/">`
- **Collapsed:** `eai` felett `A` link

### Navigáció
- eaisybill → Accounty: `<Link to="/accounty">`
- Accounty → eaisybill: `<Link to="/">`
- Nem SPA state toggle — **valódi route váltás** (teljes layout csere)

---

## 10 Design Koncepció

### ① Pill Toggle
| Tulajdonság | Érték |
|-------------|-------|
| **Típus** | Csúszó hátteres toggle |
| **Elrendezés** | Egysoros, horizontális |
| **Méret** | Kompakt (1 sor) |
| **Collapsed** | Jól skálázik ikonos módra |
| **Notification** | Nem natív, de badge hozzáadható |
| **Inspiráció** | shadcn/ui Tabs, Stripe Dashboard |

**Implementáció:**
- Háttér: `bg-primary/10` + `border-primary/25` csúszó `div` (CSS transition)
- Aktív oldal: `color: primary` / `color: destructive`
- React: `position: relative` konténer, abszolút slider `left` animálva

---

### ② Orb Icons + Bridge
| Tulajdonság | Érték |
|-------------|-------|
| **Típus** | Két ikonos gomb kötővonallal |
| **Elrendezés** | Egysoros, horizontális |
| **Méret** | Közepes |
| **Collapsed** | Két ikon egymás alatt |
| **Notification** | ✅ Natív badge az inaktív orb-on |
| **Inspiráció** | macOS Mission Control |

**Implementáció:**
- 40×40px kerekített négyzet ikonok (`eb` / `A` betűk)
- Aktív: `box-shadow` glow + `scale(1)`, Inaktív: `opacity: 0.4` + `scale(0.85)`
- Gradient bridge vonal a kettő között
- Notification badge: piros kör az inaktív orb jobb felső sarkán

---

### ③ Stacked Glass Cards
| Tulajdonság | Érték |
|-------------|-------|
| **Típus** | Egymásra helyezett kártyák |
| **Elrendezés** | Vertikális stack |
| **Méret** | Közepes-nagy |
| **Collapsed** | Nehezen skálázik |
| **Notification** | Badge hozzáadható |
| **Inspiráció** | Apple Wallet, Card Stack UI |

**Implementáció:**
- Két `position: absolute` kártya, az aktív `z-index: 2` + `translateY(0)`
- Inaktív: `translateY(4px) scale(0.95) opacity(0.3) blur(0.5px)`
- Kattintásra CSS transition cserél
- Tartalmazza: ikon + név + al-felirat ("Cég nézet" / "Könyvelő nézet") + ⇅ nyíl

---

### ④ Vertical Radio Pills
| Tulajdonság | Érték |
|-------------|-------|
| **Típus** | Vertikális gombok bal akcenttel |
| **Elrendezés** | Vertikális (2 sor) |
| **Méret** | Közepes |
| **Collapsed** | Két ikon egymás alatt |
| **Notification** | Badge hozzáadható |
| **Inspiráció** | Settings Radio Group, VS Code Activity Bar |

**Implementáció:**
- Bal szélén 3px színes csík (`border-left` animálva)
- Aktív: háttér + border + glow csík
- Inaktív: átlátszó, `opacity: 0.35`
- Pipa (✓) jel az aktív pillen

---

### ⑤ Segmented Control + Icons
| Tulajdonság | Érték |
|-------------|-------|
| **Típus** | iOS-stílusú szegmentált kontrol |
| **Elrendezés** | Egysoros, horizontális |
| **Méret** | Kompakt |
| **Collapsed** | ✅ Tökéletesen skálázik (csak ikonok) |
| **Notification** | ✅ Natív badge |
| **Inspiráció** | iOS UISegmentedControl |

**Implementáció:**
- Háttér konténer + abszolút mozgó `indicator` div
- Két tab: ikon (20×20 kerekített négyzet) + label
- Collapsed módban: csak az ikonok maradnak, a label eltűnik
- Badge: kis piros kör az inaktív tab jobb sarkán

---

### ⑥ Workspace Dropdown (Notion/Slack)
| Tulajdonság | Érték |
|-------------|-------|
| **Típus** | Legördülő workspace selector |
| **Elrendezés** | Trigger gomb + dropdown |
| **Méret** | Trigger: 1 sor; Dropdown: extra overlay |
| **Collapsed** | Csak az avatar ikon marad |
| **Notification** | ✅ Badge a dropdown-ban |
| **Inspiráció** | Notion workspace switcher, Slack team selector |

**Implementáció:**
- Trigger: avatar (gradient háttér) + név + role/cég + chevron
- Dropdown: `Popover` vagy `DropdownMenu` (shadcn/ui), két opció listával
- Aktív opció: ✓ pipa, inaktív: badge ha van
- Kontextus infó: "Cég nézet · Think AI Kft" / "Könyvelő nézet · 12 ügyfél"
- Collapsed: csak a 28×28 avatar ikon, kattintásra tooltip vagy mini dropdown

---

### ⑦ Gradient Border Glow
| Tulajdonság | Érték |
|-------------|-------|
| **Típus** | Két gomb izzó alsó sávval |
| **Elrendezés** | Egysoros, horizontális |
| **Méret** | Kompakt |
| **Collapsed** | Két ikon egymás alatt |
| **Notification** | Nem natív |
| **Inspiráció** | Gaming UI, Neon Dashboard |

**Implementáció:**
- Aktív gomb: finom háttér + border + `::after` pseudo-element (izzó csík alul)
- Az izzó sáv: 20×3px, `border-radius`, `box-shadow` glow
- Inaktív: átlátszó, `color: muted`
- Extra padding-bottom szükséges a glow-nak

---

### ⑧ macOS Dock Style
| Tulajdonság | Érték |
|-------------|-------|
| **Típus** | App ikonok dock-ban |
| **Elrendezés** | Horizontális, centrált |
| **Méret** | Közepes-nagy |
| **Collapsed** | Vertikális dock (két ikon) |
| **Notification** | Indikátor pont |
| **Inspiráció** | macOS Dock |

**Implementáció:**
- Konténer: kerekített háttér (`bg-muted/5`)
- Ikonok: 44×44 gradient négyzet (`border-radius: 12px`)
- Aktív: `scale(1)` + `box-shadow`, Inaktív: `scale(0.85) opacity(0.45)`
- Név alatta: 10px font
- Indikátor pont: 4×4 kör az aktív ikon alatt

---

### ⑨ Seesaw Slider
| Tulajdonság | Érték |
|-------------|-------|
| **Típus** | Track + csúszó gomb |
| **Elrendezés** | Horizontális track + labels |
| **Méret** | Kompakt |
| **Collapsed** | Nehezen skálázik |
| **Notification** | Nem natív |
| **Inspiráció** | Range slider, Toggle switch |

**Implementáció:**
- Track: 4px magas, `bg-muted/10`
- Fill: gradient kitöltés az aktív oldalon
- Thumb: 18×18 izzó kör (`box-shadow` glow), `left` animálva
- Labels: két oldalon a nevek

---

### ⑩ Split Brand Logo
| Tulajdonság | Érték |
|-------------|-------|
| **Típus** | Kettévágott logó |
| **Elrendezés** | Egysoros, horizontális |
| **Méret** | Kompakt |
| **Collapsed** | Két kis ikon egymás mellett |
| **Notification** | Nem natív |
| **Inspiráció** | Split-screen UI, Brand fusion |

**Implementáció:**
- Két fél: bal (`border-radius: left`) + jobb (`border-radius: right`)
- Középen: 1px gradient vonal (teal → red)
- Aktív fél: háttér + border + szín, Inaktív: `opacity: 0.35`
- Mini ikonok (20×20) + label

---

## Összehasonlító mátrix

| # | Koncepció | Kompaktság | Collapsed | Badge | Vizuális hatás | Komplexitás |
|---|-----------|:----------:|:---------:|:-----:|:--------------:|:-----------:|
| ① | Pill Toggle | ⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐ | Alacsony |
| ② | Orb Icons | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | Közepes |
| ③ | Glass Cards | ⭐ | ⭐ | ⭐⭐ | ⭐⭐⭐ | Közepes |
| ④ | Radio Pills | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | Alacsony |
| ⑤ | Segmented | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | Alacsony |
| ⑥ | Workspace DD | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | Magas |
| ⑦ | Gradient Glow | ⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐ | Alacsony |
| ⑧ | macOS Dock | ⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | Közepes |
| ⑨ | Seesaw | ⭐⭐ | ⭐ | ⭐ | ⭐⭐ | Alacsony |
| ⑩ | Split Brand | ⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐ | Alacsony |

---

## Implementációs útmutató (a kiválasztott koncepcióhoz)

### Módosítandó fájlok

| Fájl | Változás |
|------|---------|
| `src/components/AppSidebar.tsx` | Header szekció (L306-332) cseréje az új switcher-re |
| `src/pages/Accounty/AccountyLayout.tsx` | Header szekció (L196-228) cseréje az új switcher-re |
| `src/components/AppModeSwitcher.tsx` | **[ÚJ]** — közös switcher komponens |

### Közös komponens felépítése

```tsx
// src/components/AppModeSwitcher.tsx
interface AppModeSwitcherProps {
  activeMode: 'eaisybill' | 'accounty';
  isCollapsed?: boolean;
  notificationCount?: number;  // Accounty jóváhagyási badge
}
```

### Technikai követelmények
1. **Route-alapú váltás** — `<Link to="/accounty">` / `<Link to="/">` (nem state toggle)
2. **Collapsed mód** — a `useSidebar()` hook `state === "collapsed"` értéke alapján
3. **Notification badge** — az `useUnreadTicketCount()` hook vagy Accounty-specifikus count
4. **Brand színek** — teal (`text-primary` / `bg-primary`) és red (`from-red-500 via-red-600 to-red-700`)
5. **Animáció** — `transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)`
6. **Dark/Light** — a meglévő theme rendszer CSS variable-jain keresztül

### Döntés után

A management döntése után az implementáló agent:
1. Olvassa el ezt a dokumentumot
2. Nézze meg a mockup HTML-t a kiválasztott koncepció CSS-éért
3. Hozza létre az `AppModeSwitcher.tsx` komponenst
4. Cserélje ki mindkét sidebar header-ben a jelenlegi kódot
5. Tesztelje expanded + collapsed módban
