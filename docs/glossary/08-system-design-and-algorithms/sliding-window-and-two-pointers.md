# 🪟 Sliding Window & Two Pointers Minták

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [Big O Notation](../05-architecture-and-standards/big-o-notation.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

A **Sliding Window (Gördülő Ablak)** és a **Two Pointers (Két Mutatós Minta)** két népszerű algoritmikus tervezési minta (Algorithmic Patterns), amelyek segítségével a tömbökön vagy sztringeken végzett műveletek időkomplexitását redukálhatjuk kuadratikus $O(N^2)$-ról lineáris **$O(N)$**-ra.

---

## 🪟 1. Sliding Window (Gördülő Ablak Minta)

### Működési Elv:
Egy tömb felett egy adott méretű (vagy dinamikusan változó) "ablakot" (Window) csúsztatunk végig az első elemtől az utolsóig. Az ablak elmozdításakor nem számoljuk újra a teljes ablak tartalmát, hanem csak levonjuk a kibukó elemet és hozzáadjuk a beérkező új elemet.

```
Lépés 1: [ 1,  3,  5 ] 2,  8,  1   -> Összeg = 9
Lépés 2:   1, [ 3,  5,  2 ] 8,  1   -> Összeg = 9 - 1 + 2 = 10
Lépés 3:      1,  3, [ 5,  2,  8 ] 1 -> Összeg = 10 - 3 + 8 = 15
```

### Használata a Visibillben:
- **Napi/Heti Gördülő Költség trendek:** Az elmúlt 24 óra vagy 7 nap hibaszámainak és LLM költségeinek folyamatos frissítése az adatbázisban.
- **Sliding Window Rate Limiter:** Az elmúlt 60 másodpercben érkezett API kérések gördülő számlálása.

---

## 👈👉 2. Two Pointers (Két Mutatós Minta)

### Működési Elv:
Két mutatót (indexet) tartunk nyilván a tömbben (pl. egyet a tömb legelején `left = 0`, egyet a legvégén `right = N-1`). A mutatókat lépésről lépésre mozgatjuk egymás felé bizonyos feltételek alapján.

### Használati Esetek:
1. **Rendezett listák összefésülése:** Két különálló rendezett számlalista (pl. NAV számlák és feltöltött PDF számlák) lineáris $O(N + M)$ összefésülése.
2. **Karakterlánc szimmetria / Dedup:** Számlaszámok és adószámok tisztítása és egyezőség-vizsgálata.

---

## 💡 Komplexitási Haszon

| Minta | Hagyományos Ciklusos Megoldás | Optimalizált Minta | Futási Idő Nyereség |
|---|---|---|---|
| **Sliding Window** | $O(N \times K)$ (Újraszámolás) | **$O(N)$** (Gördülő frissítés) | Akár **100x gyorsabb** nagy idősoros adatoknál. |
| **Two Pointers** | $O(N^2)$ (Dupla ciklus) | **$O(N)$** (Egytömbös bejárás) | Megakadályozza a böngésző vagy worker fagyását. |
