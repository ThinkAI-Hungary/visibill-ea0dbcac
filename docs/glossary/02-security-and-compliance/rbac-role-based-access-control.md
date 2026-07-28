# 👑 RBAC — Role-Based Access Control (Szerepkör Alapú Hozzáférés-kezelés)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-009: Auth RBAC Architecture](../../architecture/decisions/A-009-auth-rbac.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Role-Based Access Control (RBAC)** egy szoftver-biztonsági hozzáférési modell, amelyben a felhasználók nem egyénileg kapnak konkrét jogosultságokat az egyes erőforrásokhoz, hanem **szerepkörökhöz (Roles)** vannak rendelve. A rendszer az adott szerepkör alapján engedélyezi vagy tiltja az akciókat.

A Visibillben a felhasználók cég-szintű és platform-szintű szerepkörökkel rendelkeznek, amelyeket a PostgreSQL RLS policy-k és az Edge Function-ök szigorúan ellenőriznek.

---

## 🎭 A Visibill 7-Szintű Szerepkör Mátrixa

A Visibill platformon a `profiles` és `company_members` táblákban az alábbi **7 szerepkör** van definiálva ([A-009]):

| Szerepkör | Szint | Jogosultság Terjedelem | UI / Funkció Hozzáférés |
|---|---|---|---|
| **`owner`** | Cég tulajdonos | Teljes céges kontroll, számlázás, előfizetés, törlés. | Cég beállítások, tagok meghívása/törlése, teljes pénzügyi adatok. |
| **`admin`** | Cég adminisztrátor | Operatív céges adminisztráció. | Tagok kezelése, adatmódosítás, új feltöltések. |
| **`member`** | Céges munkatárs | Normál olvasási és feltöltési jog a cégben. | Számlák, tranzakciók megtekintése, dokumentum feltöltés. |
| **`assistant`** | Asszisztens | Korlátozott operatív hozzáférés. | Fájl feltöltés és iktatás, adatmódosítás nélkül. |
| **`viewer`** | Megtekintő | Kizárólagos olvasási jog (Read-Only). | Riportok és adatok megtekintése, szerkesztési gombok rejtve. |
| **`employee`** | Alkalmazott | Személyes adatok és bérjegyzékek megtekintése. | Saját eaisyBooks/bérszámfejtési dokumentumok. |
| **`management` / `thinkai`** | Platform Admin | **Cross-Tenant Superadmin** jog a Management Dashboardon. | `/management` nézet, 27 superadmin modul, hibák és konténerek kezelése. |

---

## 💡 Hogyan Érvényesül az RBAC a Kódban?

### 1. Adatbázis Szinten (PostgreSQL RLS Policy-k)
```sql
-- Csak owner vagy admin hívhat meg új tagot a cégbe:
CREATE POLICY "Admins can invite members"
ON public.company_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = NEW.company_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin')
  )
);
```

### 2. Edge Function Szinten (`management-stats/index.ts`)
```typescript
// Superadmin jog ellenőrzése platform statisztikák eléréséhez:
const { data: profile } = await admin
  .from("profiles")
  .select("role")
  .eq("user_id", userId)
  .single();

if (profile?.role !== "management" && profile?.role !== "thinkai") {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
}
```

### 3. Frontend Szinten (`ProtectedLayout.tsx` & Button Guards)
```tsx
// Gomb elrejtése megtekintő (viewer) role esetén:
const { userRole } = useCompanyPermissions();

{userRole !== 'viewer' && (
  <Button onClick={handleDelete}>Számla Törlése</Button>
)}
```
