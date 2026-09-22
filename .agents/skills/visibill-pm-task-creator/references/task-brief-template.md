# 📋 Visibill PM Task Brief Sablon

Ez a sablon szolgál alapul a projektmenedzsertől érkező vázlatos kérések letisztult, azonnal érthető és tesztelhető feladatleírássá történő formázásához.

> ⚠️ **SZABÁLY:** Szigorúan tilos kódblokkokat, SQL lekérdezéseket, React hookokat vagy belső fájlneveket/specifikációs kódokat (pl. P-066, A-085) beleírni a briefbe! A brief tisztán funkcionális és felhasználó-központú.

---

```markdown
# 🎫 [Task] [Feladat tömör, egyértelmű megnevezése]

### 🎯 Cél és Funkció
[1-2 bekezdésben a feladat lényege: mi a jelenlegi hiányosság vagy probléma, mit szeretnénk elérni, és miért hasznos ez a felhasználónak/könyvelőnek.]

### 📍 Felületi elhelyezkedés
* **Hol:** [A képernyő és a felületi blokk pontos helye hétköznapi nyelven, pl. A felső sávban, közvetlenül az „Időszak:” dátumválasztó gombok mellett.]
* **Megjelenés:** [Hogyan nézzen ki, pl. Kétállású kompakt kapcsoló: `[ Keltezés | Teljesítés ]`.]

### ⚙️ Működési logika
1. **Alapértelmezés:** [Mi az alapállapot az oldal megnyitásakor, pl. A felület megnyitásakor a `Keltezés` aktív.]
2. **Kattintáskor / Használatkor:** [Mi történik a felhasználó interakciójakor, pl. Átkattintva a `Teljesítés`-re, az oldal (pl. Számlák lista) azonnal újraszűri a tételeket a teljesítés napja alapján.]
3. **Időszak / Szűrők megőrzése:** [Hogyan viselkednek az egyéb beállítások, pl. A kiválasztott időszak (pl. „Ez a hónap”) változatlan marad.]
4. **Megjegyzés / Megosztás:** [pl. A kiválasztott szűrési mód maradjon meg az URL-ben, hogy frissítéskor vagy link megosztásakor se álljon vissza.]

### ✅ Elfogadási kritériumok (Teszteléshez)
- [ ] [1. ellenőrizhető pont a felületi megjelenésről]
- [ ] [2. ellenőrizhető pont az alapértelmezett működésről]
- [ ] [3. ellenőrizhető pont az interakció és az adatok frissüléséről]
- [ ] [4. ellenőrizhető pont az állapot megőrzéséről vagy szélső esetről]
- [ ] [5. ellenőrizhető pont a reszponzivitásról vagy hiba/üres állapotról]
```
