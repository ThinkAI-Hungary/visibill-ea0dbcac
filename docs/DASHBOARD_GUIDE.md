# Visibill & Eaisybill Graphify Live Dashboard

Egy modern, asztali (Desktop) architektúra és kódbázis-vizualizációs vezérlőpult Python + CustomTkinter és Graphify alapokon.

## 🚀 Indítás

A projekt gyökeréből közvetlenül indítható:

```powershell
# Opció 1: Dupla kattintás vagy terminálból:
.\run_dashboard.bat

# Opció 2: Közvetlen Python futtatás:
python scripts/run_graphify_dashboard.py
```

---

## 🌟 Fő Funkciók és Képességek

### 1. 🔄 Live és Naprakész Szinkronizáció (Háttér Watcher)
- **Automatikus frissülés:** A háttérszál 2 másodpercenként ellenőrzi a `graphify-out/graph.json` és `manifest.json` fájlok módosulását. Ha egy kódváltozás vagy git művelet után frissül a gráf, a felület automatikusan, villódzás és fagyás nélkül újratölti az adatokat.
- **⚡ Beépített `graphify update` gomb:** Közvetlenül a fejlécből elindítható az AST alapú újraextrahálás, amelynek kimenete élőben folyik a beépített konzol fülön, és a végén automatikusan frissíti a dashboardot.

### 2. 📊 Kódbázis Áttekintés & KPI-k
- **Összesített metrikák:** 22 600+ csomópont, 37 600+ kapcsolat, 1600+ közösség.
- **Komponens megoszlás:** Frontend komponensek, Oldalak, Hookok & Contextek, Edge Function-ök, Adatbázis sémák.
- **👑 God Nodes (Legfontosabb Absztrakciók):** A legerősebben csatolt magok listája (`cn()`, `Button`, `useToast()`, `supabase`, `useAuth()`, stb.) közvetlen grafikus vizsgálati gombbal.
- **⚠️ Körkörös Függőségek (Import Cycles):** A kódbázisban detektált körkörös import láncok és minőségi kockázatok listája.

### 3. 🧭 Architektúra & Kód Navigátor
- Kategória szerinti szűrés: Komponensek, Oldalak, Hookok, Edge Function-ök, Dokumentációk.
- Azonnali keresőmező (gépelés közbeni szűrés).
- **Részletező Panel:**
  - Csomópont neve, típusa, forrásfájlja és sora (`L...`).
  - Bejövő hívók (`in-degree`) és kimenő függőségek (`out-degree`) kattintható listája.
  - **Beépített forráskód előnézet** sorszámozással.
  - `Megnyitás VS Code-ban` (`code -g`) közvetlen fájlmegnyitás.

### 4. 🕸️ Interaktív Gráf Megjelenítő (Interactive Canvas)
- Kiválasztott komponens lokális kapcsolatrendszerének (ego-network) kirajzolása.
- **Interakciók:**
  - *Bal egérhúzás:* Csomópontok szabad mozgatása (drag-and-drop).
  - *Dupla kattintás:* Az adott csomópont válik az új középponttá (gráfbejárás).
  - *Jobb egérgomb / drag:* Vászon mozgatása (Pan).
  - *Egérgörgő:* Zoom in / Zoom out.
  - *Mélység (Depth):* 1-lépéses közvetlen vagy 2-lépéses kiterjesztett környezet.

### 5. ⚡ Érintettség & Függőségi Útvonalak (Impact & Path Analysis)
- **Érintettségi elemzés (Impact Analysis):** Megmutatja, hogy egy adott függvény vagy komponens módosítása esetén melyik 1. és 2. szintű hívók és oldalak érintettek.
- **Legrövidebb útvonal (Shortest Path Finder):** BFS algoritmussal megkeresi a legrövidebb hívási láncot két tetszőleges komponens között (pl. `AppLayout` $\rightarrow$ `supabase`).

### 6. 💻 Beépített Graphify Konzol
- Élőben futtatható `graphify query`, `graphify explain`, vagy `graphify affected` kérdésfeltevés közvetlenül a felületről.
