# 🚀 React Teljesítmény & Memoizáció (useMemo, useCallback, React.memo)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [React Alapfogalmak](./react-fundamentals-and-jsx.md) | [GLOSSARY Index](../index.md)

---

## 📖 Mozaikszavak Kibontása & Definíciók

| Mozaikszó / Kifejezés | Teljes Név | Tanítói Magyarázat |
|---|---|---|
| **Memoization** | **Memoizáció** | Számítástechnikai optimalizálási technika: drága függvényhívások eredményeinek elmentése a memóriába, hogy ugyanazokkal a bemeneti paraméterekkel ne kelljen újra kiszámolni azokat. |
| **HOC** | **Higher-Order Component** | **Felsőbbrendű Komponens:** Olyan függvény, amely egy komponenst vesz át paraméterül és egy kiterjesztett/memoizált komponenst ad vissza (pl. `React.memo`). |
| **Re-render** | **Újrarenderelés** | Az a folyamat, amikor egy komponens állapota (state) vagy propjai megváltoznak, és a React újra lefutatja a komponens függvényét az új JSX kiszámításához. |

---

## 💡 A 3 Fő Teljesítmény-Optimalizáló Eszköz

---

### 1. `useMemo` — Drága Számítások Memoizálása

Minden egyes újrarenderelés során a komponensben lévő összes JavaScript kód újra lefut. Ha van egy sok ezer elemes lista szűrése vagy egy drága számítás, a `useMemo` megmenti a CPU-t attól, hogy minden gombnyomásra újra lefusson a kód.

```tsx
// ❌ MEMOIZÁCIÓ NÉLKÜL (Minden apró gombnyomásnál újra lefut az 5,000 elem szűrése):
const filteredInvoices = invoices.filter(inv => inv.amount > 100000);

// ✅ useMemo HASZNÁLATÁVAL (Csak akkor fut le újra, ha az `invoices` tömb megváltozik!):
const filteredInvoices = useMemo(() => {
  return invoices.filter(inv => inv.amount > 100000);
}, [invoices]); // Függőségi tömb
```

#### 💡 mikor NE használj `useMemo`-t?
Ne használd egyszerű műveletekre (pl. 2 szám összeadása, string összefűzés)! A `useMemo` fenntartása is igényel memóriát és overhead-et. Csak $O(N)$ vagy drágább algoritmusoknál indokolt.

---

### 2. `useCallback` — Függvény-Referenciák Memoizálása

JavaScriptben minden komponens-renderelésnél **új függvény-példány (új memóriacím)** jön létre a komponensen belül deklarált függvényekből.

Ha ezt a függvényt átadjuk egy gyermek komponensnek propként, a gyermek komponens azt fogja látni, hogy a prop megváltozott (mert új a memóriacím!), és feleslegesen újra fog renderelődni.

```tsx
// ❌ useCallback NÉLKÜL: Minden rendereléskor új függvény jön létre
const handlePartnerSelect = (partnerId: string) => {
  setSelectedPartner(partnerId);
};

// ✅ useCallback-KEL: A függvény memóriacíme stabil marad a renderelések között!
const handlePartnerSelect = useCallback((partnerId: string) => {
  setSelectedPartner(partnerId);
}, []); // Nincs függőség -> fix referencia
```

---

### 3. `React.memo` (vagy `memo`) — Komponens Újrarenderelés Átugrása

Alapértelmezetten ha egy szülő komponens újrarenderelődik, az **összes gyermek komponense is újrarenderelődik**, még akkor is, ha a gyermek propjai nem változtak semmit.

A `React.memo` HOC-cal becsomagolt gyermek komponens **átugorja az újrarenderelést**, ha a kapott propok értékei megegyeznek a korábbival.

```tsx
// src/components/partners/PartnerRankingCard.tsx
export const PartnerRankingCard = memo(function PartnerRankingCard({ partner, rank }: Props) {
  // Ez a kártya NEM fog újrarenderelődni, ha a szülő felület frissül, 
  // de a konkrét partner adatai nem változtak!
  return (
    <Card>
      <CardHeader>{rank}. {partner.name}</CardHeader>
    </Card>
  );
});
```

---

## 🛑 State Batching & Debouncing (Keresőmező Optimalizáció)

A Visibill Management Dashboardon a szűrésnél a felhasználó gépelése közben **Debounce mintát (`useDebounce`)** alkalmazunk:
- Nem indítunk el minden billentyűleütésre egy újabb adatbázis kérést.
- A rendszer vár 300 ms-ot a gépelés szüneteltetéséig, és csak ekkor frissíti a keresési state-et.
