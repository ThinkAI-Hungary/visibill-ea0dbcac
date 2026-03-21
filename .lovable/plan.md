

# LiveNotificationProvider — hibaelhárítás és javítás

## Valószínű ok

A komponens jelenleg **két kritikus ponton elnémítja a hibákat**:

1. **`.subscribe()` státusz nincs figyelve** — ha a Realtime csatorna nem tud csatlakozni (pl. subscription limit, hálózati hiba), semmi nem jelzi
2. **`catch` blokk teljesen néma** — ha a fájlnév-lekérdezés sikertelen, sem toast, sem console log nem jelenik meg

Ezen felül a `useRealtimeInvalidation` hook ugyanazokat a táblákat figyeli egy másik csatornán, ami összesen 11 `.on()` listenert jelent — közel lehet a Supabase Realtime limithez.

## Javítások (`src/components/LiveNotificationProvider.tsx`)

### 1. Subscription státusz figyelése
A `.subscribe()` híváshoz callback hozzáadása, ami logol, ha nem `SUBSCRIBED`:
```typescript
.subscribe((status, err) => {
  if (status !== 'SUBSCRIBED') {
    console.warn('[LiveNotifications] Realtime status:', status, err);
  }
});
```

### 2. Catch blokk javítása — fallback toast + console.error
Ha a fájlnév-lekérdezés sikertelen, jelenjen meg generikus toast és logoljon:
```typescript
catch (err) {
  console.error('[LiveNotifications] File lookup failed:', err);
  toast.success('Gratulálunk!', {
    description: 'Egy fájl sikeresen fel lett dolgozva!',
    duration: 7000,
    icon: ...,
  });
}
```

### 3. Cache invalidáció kiemelése a try-catch-en kívülre
Jelenleg a kód helyes (a try-catch-en kívül van), de a toast megjelenés a try-n belül — ha hiba van, a fallback catch-ben is megjelenik.

Összesen ~10 sor módosítás egyetlen fájlban.

