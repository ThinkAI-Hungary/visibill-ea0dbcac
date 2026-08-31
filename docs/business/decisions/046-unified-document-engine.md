# Decision 046: Egységes Dokumentum és Export Motor Szabályai

**Status:** Decided  
**Category:** Business Rule / Compliance / Data Export  
**Question:** Milyen üzleti és megfelelőségi követelményeknek kell érvényesülniük a hivatalos számviteli és munkaügyi dokumentumok (bérjegyzék, pénztárbizonylat, ÁFA bevallás, éves beszámoló, analitikus táblázatok) generálásakor és exportálásakor?  
**Decision:**
1. **Munkaügyi és Számviteli Megfelelőség:**
   - **Bérjegyzék:** A 2012. évi I. törvény (Mt.) 155. § (2) bekezdésének megfelelően tartalmaznia kell a bruttó bérelemeket, levonásokat (SZJA, TB), a nettó kifizetendő összeget és a munkáltatói terheket (SZOCHO).
   - **Pénztárbizonylat:** Tartalmaznia kell a sorszámot, az átadó és átvevő adatait, a jogcímet, a keltezést, valamint a magyar helyesírásnak megfelelően kiírt betű szerinti összeget (`numberToWordsHu`).
2. **NAV és ÁNYK Formátumhűség:**
   - A 2665 ÁFA bevallási XML-eknek strictly meg kell felelniük a NAV ÁNYK sémaelőírásainak, hibátlan UTF-8 kódolással és XML entitás-védelemmel.
3. **Auditálhatóság és Visszakövethetőség:**
   - Minden generált PDF dokumentum fejlécében és láblécében kötelezően szerepelnie kell a generálás dátumának és a feldolgozó rendszer megjelölésének (`Visibill / eaisyBooks`).

**Rationale:** A hazai számviteli, adózási és munkaügyi jogszabályoknak való maradéktalan megfelelés biztosítása, megelőzve az adóbírságokat és a könyvelési hibákat.

## Kapcsolódó
- ADR: [A-063: Unified DocumentEngine Architecture](../../architecture/decisions/A-063-unified-document-engine-architecture.md)
- PRD: [P-058: Unified DocumentEngine UX](../../product/decisions/P-058-unified-document-engine-ux.md)
- Business Decision: [012: Invoice Types](./012-invoice-types.md)
- Business Decision: [043: Accounting Journals](./043-accounting-journals.md)
