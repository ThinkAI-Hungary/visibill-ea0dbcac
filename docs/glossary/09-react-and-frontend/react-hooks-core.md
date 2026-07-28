# 🪝 React Hooks — useState, useEffect, useRef, useContext & Custom Hooks

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [React Alapfogalmak](./react-fundamentals-and-jsx.md) | [GLOSSARY Index](../index.md)

---

## 📖 Mozaikszavak Kibontása & Definíciók

| Mozaikszó / Kifejezés | Teljes Név / Jelentés | Tanítói Magyarázat |
|---|---|---|
| **Hook (Horog)** | **React Hook** | Olyan speciális JavaScript függvény, amellyel belekapaszkodhatunk (hook into) a React belső állapotaiba és életciklusába funkcionális komponensekből. |
| **Side Effect** | **Mellékhatás** | Bármilyen olyan művelet a komponensen belül, amely kapcsolatba lép a külvilággal (pl. hálózati API kérés, feliratkozás, DOM módosítás, időzítő). |
| **Prop Drilling** | **Prop Átadás Zavar** | Az a kellemetlen jelenség, amikor egy adatot 5 egymásba ágyazott komponensen kell átpasszolni propként csak azért, hogy a legbelső gyermek megkaphassa. |

---

## 📜 A Hook-ok 2 Arany Szabálya (Rules of Hooks)

1. **Csak a legfelső szinten hívhatók (Top-Level Only):** SOHA ne hívj Hook-ot cikluson (`for`), feltételen (`if`) vagy egymásba ágyazott függvényen belül! A React a Hook-ok hívási sorrendjére támaszkodik.
2. **Csak React függvényekből hívhatók:** Kizárólag React komponensekből vagy saját Custom Hook-okból hívhatók meg.

---

## 🧩 Az 5 Alapvető Hook Részletezve

---

### 1. `useState` — Lokális Állapotkezelés

A `useState` segítségével a komponens saját belső memóriát kap, amely megőrződik az újrarenderelések között.

```tsx
const [searchQuery, setSearchQuery] = useState<string>("");
```

#### 💡 Tanítói Szabály: Immutabilitás & Funkcionális Update
A React állapotot **SOHA nem szabad közvetlenül módosítani** (`state = 'új'` ❌). Mindig a beállító függvényt kell használni (`setState('új')` ✅).
Ha az új állapot a korábbi állapottól függ, használd a **funkcionális frissítést**:

```tsx
// ❌ ROSSZ (Feltételezi a régi értéket, ami elavult lehet):
setCount(count + 1);

// ✅ JÓ (Garantáltan a legfrissebb előző állapotot kapja meg):
setCount(prevCount => prevCount + 1);
```

---

### 2. `useEffect` — Mellékhatások Kezelése

Az `useEffect` segítségével a komponens renderelése után lefutó kódot (Side Effect) hozhatunk létre.

```tsx
useEffect(() => {
  // 1. Megnyitás / Betöltés kódja (pl. Event listener feliratkozás)
  window.addEventListener('resize', handleResize);

  // 2. Takarító függvény (Cleanup Function): lefut mielőtt a komponens megsemmisül!
  return () => {
    window.removeEventListener('resize', handleResize);
  };
}, [handleResize]); // 3. Függőségi tömb (Dependency Array)
```

#### 💡 A Függőségi Tömb (Dependency Array) Szabályai:
- **`undefined` (nincs tömb):** A komponens **minden egyes renderelése után** lefut (veszélyes!).
- **`[]` (üres tömb):** Kizárólag **egyszer, a komponens első képernyőre kerülésénél (Mounting)** fut le.
- **`[stateA, propB]`:** Akkor fut le újra, ha a tömbben lévő **bármelyik érték megváltozik**.

---

### 3. `useRef` — Változó Renderelés Nélkül & DOM Elérés

A `useRef` egy olyan "dobozt" (objektumot `{ current: value }`) ad vissza, amelynek tartalma megmarad a renderelések között, de **a `.current` értékének módosítása NEM vált ki újrarenderelést!**

#### Két fő használati esete a Visibillben:
1. **Fizikai DOM elem megfogása:** (Pl. fókusz helyezése egy inputra, vagy görgetés).
2. **Ref Locking (Állapot Zárolás — [A-029]):** Olyan háttérváltozók tárolása, amelyek nem kellenek a vizuális rajzoláshoz, de meg kell őrizni őket (pl. URL sync időzítő ID).

```tsx
// Példa Visibill DOM Ref használatra:
const inputRef = useRef<HTMLInputElement>(null);

const handleFocus = () => {
  inputRef.current?.focus(); // Közvetlen DOM fókuszálás
};
```

---

### 4. `useContext` — Globális Adatátadás

A `useContext` lehetővé teszi, hogy adatokat adjunk át a komponensfában tetszőleges mélységbe anélkül, hogy manuálisan át kellene passzolni a propokat minden szinten (Prop Drilling megelőzése).

```tsx
// Globális AuthContext lekérése a Visibillben:
const { user, profile } = useAuth();
```

---

### 5. Custom Hooks (Saját Hook-ok)

Ha több komponensben is ugyanarra az komplex logikára van szükség, azt kiemelhetjük egy **`use` prefixszel ellátott saját függvénybe**.

### Példa Visibill Custom Hook-ra (`useCompanyPermissions`):

```tsx
// src/hooks/useCompanyPermissions.ts
export function useCompanyPermissions() {
  const { currentCompany } = useCompany();
  const { userProfile } = useAuth();

  const isOwnerOrAdmin = currentCompany?.role === 'owner' || currentCompany?.role === 'admin';
  const canEditInvoices = isOwnerOrAdmin && currentCompany?.role !== 'viewer';

  return { isOwnerOrAdmin, canEditInvoices, role: currentCompany?.role };
}
```
