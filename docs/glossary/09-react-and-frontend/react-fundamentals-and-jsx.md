# ⚛️ React Alapfogalmak, Virtual DOM & JSX

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [frontend-tech-stack.md](../../architecture/frontend-tech-stack.md) | [GLOSSARY Index](../index.md)

---

## 📖 Mozaikszavak Kibontása & Definíciók

| Mozaikszó | Teljes Angol Név | Magyar Jelentés & Tanítói Magyarázat |
|---|---|---|
| **DOM** | **Document Object Model** | **Dokumentum Objektum Modell:** A böngésző belső fa-struktúrája, amely a HTML elemeket (gombok, bekezdések, div-ek) memóriabeli objektumokként ábrázolja. |
| **VDOM** | **Virtual Document Object Model** | **Virtuális Dokumentum Objektum Modell:** A React saját, könnyűsúlyú memóriabeli másolata a valódi DOM-ról, amellyel a villámgyors frissítéseket számolja ki. |
| **JSX** | **JavaScript XML / Syntax Extension** | **JavaScript XML Kiterjesztés:** A React speciális szintaxisa, amely lehetővé teszi, hogy HTML-szerű kódot írjunk közvetlenül a JavaScript/TypeScript fájlokban. |
| **UI** | **User Interface** | **Felhasználói Felület:** A képernyőn megjelenő elemek összessége, amellyel a felhasználó interakcióba lép. |
| **SPA** | **Single Page Application** | **Egyoldalas Webalkalmazás:** Olyan weboldal (pl. a Visibill), amely betöltéskor egyetlen HTML oldalt tölt le, és a navigáció során nem tölti újra a böngészőt, hanem JavaScripttel cseréli a tartalmat. |

---

## 🏛️ 1. Mi a React? (Deklaratív vs. Imperatív UI)

A **React** a Meta (Facebook) által kifejlesztett komponens-alapú JavaScript könyvtár, amely segítségével interaktív felhasználói felületeket (UI) építhetünk.

### 💡 Tanítói Analógia: Az Imperatív vs. Deklaratív Megközelítés

- **Imperatív (Hagyományos JavaScript / DOM manipuláció):**  
  Utasítások sorozata lépésről lépésre. *"Lépj a szobába, nyúlj a falra, keresd meg a kapcsolót, nyomd le a gombot, hogy felgyulladjon a lámpa."*
  ```javascript
  // Hagyományos JS (Imperatív):
  const button = document.getElementById('my-btn');
  button.innerText = 'Betöltés...';
  button.disabled = true;
  ```

- **Deklaratív (React megközelítés):**  
  Azt írjuk le, hogy a felületnek **hogyan KENE kinéznie egy adott állapotban (State)**, és a React automatikusan elvégzi a fizikai módosításokat. *"A szobában világosnak kell lennie, ha az `isLit` állapot igaz."*
  ```tsx
  // React (Deklaratív):
  <Button disabled={isLoading}>
    {isLoading ? 'Betöltés...' : 'Mentés'}
  </Button>
  ```

---

## 🌳 2. A DOM és a Virtual DOM (VDOM) Működése

A valódi **DOM (Document Object Model)** módosítása a böngészőben rendkívül **lassú és erőforrás-igényes** művelet, mert minden módosítás után a böngészőnek újra kell számolnia az elrendezést (Layout Reflow) és újra le kell rajzolnia a pixeleket (Repaint).

### 💡 Tanítói Analógia: Az Építész és az Épület

- **Valódi DOM:** A kész fizikai épület. Ha meg akarjuk változtatni egy ablak színét, az épületen közvetlenül dolgozni drága és lassú.
- **Virtual DOM (VDOM):** Az építész tervrajzának gyors memóriabeli másolata. Ha változtatunk, a tervrajzon azonnal módosítjuk, összehasonlítjuk a régit az újjal (Diffing), és csak a pontosan megváltozott 1 db ablakot festjük át a fizikai épületen!

```
[ Állapot Változás (State Change) ]
                 │
                 ▼
[ Új Virtual DOM Fa Generálása ]
                 │
                 ▼
[ Diffing Algoritmus (Reconciliation) ]
(Összehasonlítja a Régi VDOM-ot az Új VDOM-mal)
                 │
                 ▼
[ Batch DOM Update (Commit) ]
(Kizárólag a megváltozott 1-2 elemet frissíti a valódi DOM-ban!)
```

### Miért fontos a `key` prop a listáknál?
Amikor a React egy tömböt renderel (pl. számlák listája `.map()` segítségével), a **`key`** prop segítségével azonosítja be egyértelműen az egyes elemeket.
- **Helyes használat:** Egyedi adatbázis ID (`key={invoice.id}`). Így ha egy elem törlődik vagy beszúródik a lista közepére, a React nem rajzolja újra az egész listát, csak a változott elemet mozdítja el!

---

## 📦 3. Props vs. State (Adatáramlás)

A React-ben az adatok szigorúan **egyirányban (Unidirectional Data Flow)** áramlanak a szülő komponenstől a gyermek komponensek felé.

| Fogalom | Mi az? | Módosítható? | Honnan származik? |
|---|---|---|---|
| **State (Állapot)** | A komponens saját belső, privát memóriája (pl. egy nyitott modal állapota). | **Igen** (kizárólag a beállító szemantikával: `setState`). | A komponensen belül jön létre. |
| **Props (Properties)** | A szülő komponens által a gyermeknek átadott paraméterek/tulajdonságok. | **NEM (Read-Only)**. A gyermek komponens soha nem módosíthatja a kapott propokat! | A szülő komponenstől érkezik. |

---

## 💡 Használat a Visibillben

A Visibill frontendje (`eaisybill-prod`) egy **Vite-alapú React 18 Single Page Application (SPA)** architecture, amely TypeScript-et és **shadcn/ui** komponenskönyvtárat használ.

### Példa Visibill Komponensre (Props + State):

```tsx
// src/components/invoices/InvoiceBadge.tsx
interface InvoiceBadgeProps {
  status: 'draft' | 'processed' | 'error'; // ← Props (Külső paraméter)
}

export function InvoiceBadge({ status }: InvoiceBadgeProps) {
  // A kapott status prop alapján deklaratívan rendereli a megfelelő színű UI jelvényt
  const variant = status === 'processed' ? 'success' : status === 'error' ? 'destructive' : 'secondary';
  
  return (
    <Badge variant={variant}>
      {status.toUpperCase()}
    </Badge>
  );
}
```
