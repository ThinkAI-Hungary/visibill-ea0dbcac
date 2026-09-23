# P-107: Globális Nyelvválasztó Elhelyezés és Lucide Globe Ikon Felületi Élmény (Books és Bill nézet)

**Status:** Decided  
**Date:** 2026-09-23  
**Category:** UI / UX & Navigation  
**Question:** Hogyan jelenjen meg a nyelvválasztó az eaisyBill és eaisyBooks felületeken úgy, hogy ne foglaljon feleslegesen helyet az oldalsávban, ne csonkolja a felhasználónevet, és széles képernyőn is közvetlenül elérhető legyen?  
**Decision:** A nyelvválasztó átkerül az alsó oldalsávból a globális felső fejlécbe, közvetlenül a dátumválasztó mezők mellé (`GlobalDatePicker`), és egy egységes Lucide `Globe` ikonnal, nagybetűs nyelvkóddal (`HU` / `HR`) és letisztult lenyíló menüvel (zászlók + pipa) jelenik meg.  
**Current Implementation:** `GlobalDatePicker.tsx`, `LanguageSwitcher.tsx`, `AppLayout.tsx`, `AccountyHeader.tsx`, `AppSidebar.tsx`  
**Rationale:** Az alsó oldalsáv láblécében a felhasználónév melletti `[HU]` jelvény szűk helyre volt szorítva, összenyomta és csonkolta a nevet (`Schwarzcin...`). A fejléc jobb szélére helyezve viszont ultrawide képernyőn túl távolra került volna a fő kezelőszervektől. A dátumválasztó mellett természetes kezelősáv-társként működik.  

---

## 1. Felületi Elrendezés

### Fejléc struktúra
```text
Időszak: [ Ez a hónap ] [ Előző hónap ] [ Ez az év ] | [ 📅 2026. jan. 01. ] – [ 📅 2026. dec. 31. ] | [ 🌐 HU ]
```

### Lenyíló menü állapot
Rákattintva egy letisztult Radix/shadcn DropdownMenu jelenik meg:
- `🇭🇺 Magyar` (aktív pipa ha kiválasztva)
- `🇭🇷 Hrvatski` (aktív pipa ha kiválasztva)

---

## 2. Viselkedési Szabályok
1. **URL Szinkronizáció:** Nyelvváltáskor a rendszer az URL útvonal prefixét módosítja (`/hr/...` vagy gyökér), miközben a teljes query paraméterlistát (`location.search`, pl. dátumtartományok, szűrők) megőrzi.
2. **Konzisztens Gombstílus:** A nyelvválasztó gomb magassága (`h-7`), betűmérete (`text-xs`), belső margója (`px-2.5`) és kerete (`outline`) 100%-ban illeszkedik a naptár intervallum-választó gombjaihoz.
3. **Oldalsáv Tisztaság:** Az oldalsáv láblécben (`AppSidebar.tsx`) csak az avatar, a teljes felhasználónév, az e-mail és a téma-kapcsoló marad, maximális helyet biztosítva a profiladatoknak.

---

## 3. Kapcsolódó Dokumentumok
- [A-141: Globális Fejléc Dátumválasztó Mellé Helyezett Nyelvválasztó](../../architecture/decisions/A-141-global-header-inline-datepicker-language-switcher.md)
- [P-081: Eaisybill Horvát Lokalizáció](./P-081-eaisybill-croatia-localization-and-demo-ux.md)
- [P-083: eaisyBooks ↔ eaisyBill Alkalmazásváltó](./P-083-eaisybooks-eaisybill-app-mode-switcher-and-cold-warm-transition-ux.md)
