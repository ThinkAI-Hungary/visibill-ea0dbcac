

## Sonner toast lista viselkedés — terv

### Probléma
A Sonner toaster "kártyapakli" (stacking) módban működik: a hátsó toastok kicsinyítve, egymás mögé csúszva jelennek meg. Ez olvashatatlan, ha több értesítés érkezik egyszerre.

### Változtatások

**1. `src/components/ui/sonner.tsx`**
- `visibleToasts={6}`
- `gap={10}`
- Default `duration: 3000` hozzáadása a `toastOptions`-höz
- Az `expand={true}` már be van állítva, marad

**2. `src/index.css`**
CSS override hozzáadása a fájl végéhez, amely:
- Minden toast `opacity: 1`, `scale: 1`, `visibility: visible` legyen (nem kicsinyített)
- Sima `translateY` transition a toast mozgásokhoz (400ms ease-out)
- Fade-out animáció a lejáró toastokhoz

**3. `LiveNotificationProvider.tsx`**
- A "Gratulálunk!" toast `duration`-jét 5000-ről 3000-re csökkentjük, hogy konzisztens legyen az új globális beállítással (vagy meghagyjuk 5000-en ha a feldolgozási értesítések fontosabbak — a feladat 3mp-t kér, tehát 3000).

### Érintett fájlok
- `src/components/ui/sonner.tsx`
- `src/index.css`
- `src/components/LiveNotificationProvider.tsx`

