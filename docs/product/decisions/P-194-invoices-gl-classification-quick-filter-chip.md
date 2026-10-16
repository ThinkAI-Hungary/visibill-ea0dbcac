# P-194: Számlák Kontírozási Gyorsszűrő Checkbox UX

**Dátum:** 2026-10-15  
**Státusz:** ✅ Elfogadva  
**Terület:** VisiBill Számlák (`/invoices`)  
**Kapcsolódó döntések:** [A-262](../../architecture/decisions/A-262-invoice-gl-classification-status-filter-rpc.md), [P-089](./P-089-invoice-exclude-from-accounting-optimistic-toggle-ux.md)

---

## 1. Felhasználói Igény és Célkitűzés
A felhasználó igénye:
> *"szöveg legyen : Csak kontítozott tételek"*
> Tisztázott logika: A bepipáláskor a **MÁR KONTÍROZOTT** tételekkel rendelkező számlák jelennek meg (`glStatus === 'classified'`).

A könyvelők számára elengedhetetlen, hogy a számlák listájában közvetlenül és gyorsan szűrni tudjanak a már lekönyvelt, kontírozott tételekre.

---

## 2. Felületi Kialakítás (UI / UX)

### 2.1 Checkbox Vezérlő
- **Helye:** Az `InvoiceFilterBar` szűrősávban közvetlenül az ÁFA-kulcs választó mellett és a "Szűrők törlése" gomb előtt.
- **Megjelenés inaktív / bepipálatlan állapotban:**
  - Felirat: `Csak kontírozott tételek`
  - Megjelenés: Lekerekített keretben (`h-9 px-3 rounded-lg border-border/80 text-muted-foreground hover:bg-muted/40`), shadcn Checkbox komponenssel.
  - Letisztult, nem tolakodó, mégis azonnal észrevehető.
- **Megjelenés aktív / bepipált állapotban (`glStatus === 'classified'`):**
  - Kellemes smaragd/emerald vizuális kiemelés: `bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 border-emerald-400/60 dark:border-emerald-500/50 font-semibold shadow-2xs`.
  - A checkbox maga zöld kitöltéssel jelenik meg: `data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600`.
  - Egyértelmű tooltip tájékoztatja a felhasználót az érvényben lévő szűrésről: *"Szűrve: Csak a kontírozott tételekkel rendelkező számlák láthatók. Kattints a pipa levételéhez!"*.

### 2.2 Egykattintásos Váltás & Törlés
- A checkboxra vagy annak címkéjére kattintva a szűrő közvetlenül vált a `glStatus: 'classified'` és `glStatus: 'all'` állapotok között.
- A "Szűrők törlése" gomb aktívvá válik, ha a kontírozás szűrő be van kapcsolva, és arra kattintva a többi szűrővel együtt ez is visszaáll alapállapotba.

### 2.3 URL Szinkronizáció és Megoszthatóság
- A szűrő állapota megjelenik az URL-ben: `?gl=classified`.
- Ez lehetővé teszi, hogy a könyvelők közvetlenül elmentsék vagy megosszák kollégáikkal a "Már kontírozott számlák" nézetet.
