

## Plan: Partner nevek levágása fix copy icon pozícióval

### Probléma
A `CopyableCell` komponensben a copy ikon `absolute` pozícióval a szöveg mellé van helyezve (`left-full ml-1`), így ha a szöveg hosszú, az ikon kicsúszik a cellából. A `maxWidth="100%"` nem működik jól, mert az `inline-flex` konténer nem korlátozza a szélességét.

### Megoldás

**`src/components/ui/copyable-cell.tsx`** módosítása:
- A külső `div`-re `min-w-0 overflow-hidden` kerül, hogy a cella szélességéhez igazodjon
- A belső `relative inline-flex` konténer → `flex items-center min-w-0 gap-1`
- A copy ikon pozícionálása: `absolute` helyett normál flex elem, fix mérettel (`shrink-0`)
- A szöveg `span` kapja a `min-w-0 truncate` osztályokat, `maxWidth` style eltávolítva (a flex layout kezeli)

Ez biztosítja, hogy:
1. A szöveg levágódik a rendelkezésre álló helyen
2. A copy ikon mindig a szöveg végénél marad, nem csúszik el

**Nincs más fájl módosítás** — a `CopyableCell` minden használati helyen automatikusan javul.

