# A-237: NAV Online Számla v3 GZIP Kitömörítés és Többtételes Közműszámla Ingestion Architektúra

**Status:** Decided  
**Date:** 2026-10-09  
**Utoljára frissítve:** 2026-10-09  

---

## Context

A NAV Online Számla rendszer v3.0 protokolljában a nagyméretű vagy sok tételsort tartalmazó számlákat – különösen a közműszolgáltatók (Magyar Telekom, Magyar Posta, E.ON, MVM Next, Coca-Cola HBC, MOHU) bizonylatait – a NAV szerverei automatikusan tömörítve szolgáltatják.

A válaszban az `<invoiceData>` XML borítékban a `<compressedContentIndicator>true</compressedContentIndicator>` jelző jelöli ezt az állapotot. A számla tényleges XML tartalma Base64 kódolású GZIP bináris adatfolyamként érkezik, nem pedig nyers UTF-8 XML sztringként.

### A korábbi architektúra hibája:
1. Az `xml-parser.ts` a Base64 dekódolás után kapott bináris bájtokat azonnal átadta a `new TextDecoder('utf-8').decode(bytes)` hívásnak.
2. A GZIP bináris folyam szöveges dekódolása érvénytelen UTF-8 karakterek sorozatát (`\ufffd` helyettesítő karakterek) és bináris szemetet eredményezett.
3. Ennek következtében az XML reguláris kifejezések (`lineRegex`, `tag` kinyerők) semmilyen `<line>` tételsort nem találtak, így 0 tételsor került mentésre a `nav_invoice_items` táblába.
4. Ráadásul a `nav-ingestion-service.ts` `fetchDetailsBatch` metódusa a 0 tételsoros válasz ellenére feltétel nélkül beállította a `details_fetched: true` jelzőt a szülő `nav_invoices` rekordon.
5. Mivel a háttérfolyamatok (PGMQ worker és Edge Function-ök) kizárólag a `details_fetched.is.null,details_fetched.eq.false` rekordokat kérdezik le, a rendszer ezeket a számlákat "befejezettnek" tekintette, véglegesen elvágva a tételsorok újbóli letöltésének lehetőségét.

### Üzleti és Számviteli Következmény:
A közműszámlák (különösen a telekommunikációs számlák) vegyes ÁFA-kulcsúak: az internet- és internethozzáférési szolgáltatások 5%-os, míg a telefon- és egyéb díjak 27%-os ÁFA terhelésűek. Tételsorok hiányában a magyar törvényes ÁFA bevallás generátor (`calculate_hungarian_vat_return`) a számla teljes összegét egyetlen tételként (gyakran 27%-os általános kulccsal) kezelte, ami torzította a fizetendő és levonható ÁFA analitikát.

---

## Decision

A NAV Online Számla adatletöltési réteg robusztus, többrétegű GZIP bináris kitömörítési és érvényességi ellenőrzési logikával bővült:

### 1. Aszinkron Streaming GZIP Kitömörítés (`xml-parser.ts`)
A `parseInvoiceDataXml` metódus aszinkronná (`async`) vált, és beépített web-standard streaming kitömörítést alkalmaz:
- **Jelző vizsgálata:** Ha az XML tartalmazza a `<compressedContentIndicator>true</compressedContentIndicator>` jelzőt.
- **Magic Bytes vizsgálat:** Védelemként a Base64-ből dekódolt bináris tömb első két bájtját is ellenőrzi (`bytes[0] === 0x1F && bytes[1] === 0x8B`).
- **DecompressionStream:** 
  ```typescript
  const stream = new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip'));
  xmlContent = await new Response(stream).text();
  ```
- **Fallback:** Amennyiben a kitömörítés nem szükséges vagy sikertelen, a rendszer biztonságosan visszalép a hagyományos `TextDecoder('utf-8').decode(bytes)` folyamatra.

### 2. Kliens és Hívó Lánc Igazítás (`nav-client.ts`)
A `NavClient.queryInvoiceData` metódusa az aszinkron parszoló meghívásához igazítva `await parseInvoiceDataXml(...)` hívást végez, biztosítva a szekvenciális adatfolyamot.

### 3. Letöltési Státusz Zárási Védelem (`nav-ingestion-service.ts`)
A `fetchDetailsBatch` metódusban elhelyezett biztonsági feltétel:
- A `details_fetched: true` jelzőt **kizárólag akkor rögzíti**, ha az adott számlához ténylegesen sikerült tételsorokat kinyerni (`items.length > 0`), vagy a válaszban hiteles, kitöltött partnercím / számlafejléc információk érkeztek (`hasContent`).
- Amennyiben a számlarészletek letöltése üres maradt (0 tétel), a számla státusza `details_fetched = false` marad, így a háttérben futó worker a hiba kijavítása után automatikusan újrapróbálhatja az ingestion folyamatot.

### 4. Adatbázis Integritási és Trigger Védelem
- A `sync_nav_invoice_totals_from_items` trigger megvizsgálja a meglévő számlafejlécet: csak abban az esetben frissíti a fejléc bruttó/nettó összegét a tételekből, ha a fejléc összege `NULL` vagy `0` (`IF v_current_gross IS NULL OR v_current_gross = 0 THEN`). A korábban rögzített hivatalos NAV fejlécösszegek, fizetettségi státuszok és párosítások sértetlenek maradnak.
- A tételsorok betöltése a `calculate_hungarian_vat_return` eljárásban automatikusan biztosítja a törvényes 5%-os és 27%-os ÁFA kulcsok szétválasztását.

---

## Consequences

### Pozitív
- **100%-os Tételmegjelenítés:** A Telekom, Magyar Posta, E.ON és más közműszolgáltatók számlái hiánytalanul, valamennyi előfizetői és forgalmi tételsorukkal együtt bekerülnek a `nav_invoice_items` táblába.
- **Pontos ÁFA Analitika:** A telekommunikációs internet (5%) és telefónia (27%) tételek tételszinten különülnek el, megszüntetve az ÁFA túlfizetést vagy téves levonást.
- **Öngyógyító Pipeline:** A hibás vagy hiányos letöltések nem záródnak le hibásan `details_fetched = true` jelzővel; a worker ciklus automatikusan feldolgozza őket.

### Negatív / Kockázatok
- **Memóriaigény:** Több száz tételes számlák GZIP kitömörítése némi CPU- és memória-erőforrást igényel a Deno környezetben, de a streaming `DecompressionStream` hatékonyan kezeli a memóriaterhelést.

---

## Kapcsolódó
- [A-005: Edge Functions a Serverless Logikához](./A-005-edge-functions.md)
- [A-012: NAV Online Számla API v3 Integráció](./A-012-nav-integration.md)
- [A-113: NAV Számlatételek ÁFA és Bruttó Összeg Automatikus Kalkulációja](./A-113-nav-invoice-items-vat-gross-auto-calculation.md)
- [A-193: Hibrid Aszinkron NAV Számlaszinkronizáció és PGMQ Tétel-feldolgozás](./A-193-nav-hybrid-async-sync-and-atomic-item-idempotency.md)
- [068: ÁFA tv. Szerinti Adófizetési Kötelezettség és Levonási Jog Keletkezése](../business/decisions/068-vat-effective-tax-date-regime-rules.md)
