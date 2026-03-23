

# Build Fix + AuthContext 4h Gate Megerősítés

## Jelenlegi állapot

Az AuthContext **már tartalmazza** a 4 órás gate logikát (`isSessionExpired()` pre-flight check). A kód architektúrálisan helyes:
- A gate szinkron módon fut az `onAuthStateChange` listener regisztrálása után, de ELŐTTE, hogy az aszinkron `INITIAL_SESSION` event beérkezne
- Az `onAuthStateChange` callback elutasítja a session-visszaállítást, ha `expired && event !== 'SIGNED_IN'`
- A `signOut` silent módot a gate NEM használja (közvetlenül hívja `supabase.auth.signOut()`-ot), így nincs "Kijelentkezve" toast — **ez helyes**
- Login után a `LAST_ACTIVE` frissül — **ez helyes**

### Potenciális race condition (javítandó)
Az `onAuthStateChange` callback a `gateCheckedRef.current` értékét ellenőrzi, DE a `gateCheckedRef.current = true` a listener regisztrálása UTÁN van beállítva. Ha a Supabase SDK szinkron módon hívná az `INITIAL_SESSION`-t (nem szokta, de nem garantált), a gate kikerülhető lenne.

**Javítás**: `gateCheckedRef.current = true` legyen a listener ELŐTT beállítva, és az `expired` flag is ref-ben tárolódjon (ne closure capture legyen).

### Build error (kritikus)
`npm:resend@4.0.0` import a `send-email/index.ts`-ben → `esm.sh` importra kell cserélni.

---

## Implementációs terv

### 1. Build error fix: `send-email/index.ts`
- `npm:resend@4.0.0` → `https://esm.sh/resend@4.0.0`

### 2. AuthContext gate megerősítés
- `gateCheckedRef.current = true` áthelyezése a listener regisztrálása **elé** (mindkét ágban)
- `expired` flag tárolása ref-ben, hogy a closure ne ragadjon le régi értéken
- A `LAST_ACTIVE` kulcs törlése is bekerüljön a gate-es signOut ágba (az újra belépéskor ne a régi expired timestamp maradjon)
- Explicit `localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE)` a gate ágban

### 3. Érintett fájlok

| Fájl | Változás |
|---|---|
| `supabase/functions/send-email/index.ts` | `npm:resend` → `esm.sh` |
| `src/contexts/AuthContext.tsx` | Gate ref timing fix |

