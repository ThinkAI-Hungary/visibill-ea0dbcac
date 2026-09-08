# 🎯 RAG Optimalizációs Útmutató az eaisyBill / eaisyBooks Tudástárhoz

Ez az útmutató bemutatja, hogyan működik a rendszer RAG (Retrieval-Augmented Generation) lekérdező motorja, és hogyan kell megfogalmazni a cikkeket, hogy az AI asszisztens a legmagasabb pontszámmal találja meg őket és tökéletes válaszokat generáljon.

---

## 1. Hogyan pontoz a `search_knowledge_base` RPC?

A PostgreSQL tárolt eljárás többszempontú pontozást (ranking) végez:

1. **Aktív oldal egyezése (`menu_path`):**
   - Ha a felhasználó egy adott aloldalon áll (pl. `/eaisybooks/vat`), és a cikk `menu_path = '/eaisybooks/vat'`, a pontszám **azonnal 1.0 (maximális prioritás)**.
   - Ha prefix egyezés van (pl. `/eaisybooks/vat/history` -> `/eaisybooks/vat`), a pontszám **0.8**.
   - *Tanulság:* Minden cikkhez, ami egy konkrét menüponthoz köthető, kötelező megadni a pontos `menu_path`-t!

2. **Full-Text Search (`fts @@ to_tsquery('simple', ...)`):**
   - Pontszám: `ts_rank(fts, query) + 0.2` (jellemzően **0.25 - 0.75** pont között mozog).
   - A bemeneti kérdésből a rendszer kiszűri a magyar stop-szavakat (`és`, `hogy`, `nem`, `kell`, `van`, stb.).
   - Regex alapú magyar szótövezést végez (levágja a ragokat: `-nak`, `-nek`, `-ban`, `-ben`, `-ból`, `-ről`, `-hoz`, stb.).
   - Minden szótőre prefix egyezést állít be (`szótő:*`).
   - *Tanulság:* A cikk szövegében, címében és címkéiben használj természetes magyar szavakat, mert a stemmer automatikusan kezeli a ragozott alakokat!

3. **Cím és Címkék (`title ILIKE` / `tags && ARRAY[...]`):**
   - Pontszám: **0.3**.
   - Ha az FTS nem találna egyezést, a `tags` tömbben lévő pontos kulcsszavak vagy a cím részleges egyezése garantálja, hogy a cikk átlépje az AI asszisztens **0.15**-ös minimális szűrési küszöbét.

---

## 2. Hogyan használja fel a cikkeket az `accounty-ai-chat` Edge Function?

Az Edge Function a következőképpen dolgozza fel a találatokat:
1. Lekéri a legfeljebb 5 releváns cikket.
2. Kiszűri azokat, amelyek nem az aktuális oldalhoz tartoznak ÉS a pontszámuk kisebb, mint **0.15**.
3. A cikkekből az alábbi blokkot építi fel a rendszerpromptba:
   ```
   ═══════════════════════════════════════════════════════════════
   HIVATALOS EAISYBILL / EAISYBOOKS TUDÁSTÁR (RELEVÁNS CIKKEK)
   ═══════════════════════════════════════════════════════════════
   [Tudástár Téma #1: ÁFA levonhatósági szabályok]
   Összefoglaló: A céges személygépkocsi és telefonszámlák ÁFA tartalmának...
   Leírás:
   (a cikk első 1800 karaktere)
   ```

### Kritikus tervezési következmények a cikkíró számára:
- **A `summary` mező kiemelt prioritású:** Az LLM először az összefoglalót látja, ezért annak tartalmaznia kell a funkció lényegét és a legfontosabb üzleti szabályt.
- **A `content` eleje a legértékesebb:** Mivel a rendszer az első 1800 karaktert vágja le cikkeként, a kulcslépéseket, határidőket, számlaszámokat vagy szabályokat **a cikk elején, strukturált pontokban** kell elhelyezni! Ne a bevezető körmondatok vigyék el a karakterkeretet.
- **Ne hivatkozz belső technikai URL-ekre a szövegben:** Ne írj olyat, hogy *"kattints a `/eaisybooks/prompts` linkre"*, mert a modell ezt közvetlenül bemásolhatja a felhasználónak. Helyette használd a valódi menüpont nevet: *"a Könyvelési szabályok menüpontban"* vagy *"a Bérszámfejtés felületen"*.
