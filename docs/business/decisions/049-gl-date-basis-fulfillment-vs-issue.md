# Decision 049: Főkönyvi Dátum Alap (Teljesítés vs. Kibocsátás Kelte) Üzleti Szabály

**Status:** Decided  
**Date:** 2026-09-03  
**Category:** Accounting / Financial Reporting / Business Rule  
**Releváns ügyféligény (Ticket):** Kiss-Százi Emese (2026. szept. 2. 11:19)  

---

## Context

A magyar számviteli törvény és a könyvviteli gyakorlat szerint a gazdasági események könyvelése alapértelmezetten a gazdasági teljesítés időpontjához (`teljesites_datuma`) kötődik, nem kizárólag a számla kiállításának keltezéséhez (`kibocsatas_datuma`). 

Különösen hónap- és évfordulók környékén gyakori, hogy egy számlát a következő hónap elején bocsátanak ki (pl. 2026. január 7.), de a szolgáltatás teljesítése még az előző év decemberében (pl. 2025. december 31.) történt. A Visibill korábbi főkönyvi modulja kizárólag kibocsátás kelte szerint gyűjtötte a tételeket, ami torzította a havi és éves záróegyenlegeket, és megnehezítette az adóbevallásokkal és mérlegekkel való egyeztetést.

## Decision

1. **Kettős Számítási Mód Támogatása:**
   - A rendszernek natívan támogatnia kell mind a **Kibocsátás kelte** (`kibocsatas`), mind a **Teljesítés dátuma** (`teljesites`) szerinti főkönyvi összesítést.
2. **Teljesítés Dátum Prioritás & Visszaesési Szabály (Fallback):**
   - Amikor a könyvelő a Teljesítés dátuma alapot választja, a rendszer a számla `teljesites_datuma` mezőjét veszi alapul.
   - Ha egy bizonylatnál a teljesítés dátuma nincs kitöltve (NULL), az üzleti integritás megőrzése érdekében automatikusan a számla kibocsátási kelte (`kibocsatas_datuma`), végső esetben a rögzítés időpontja lép életbe (`COALESCE`).
3. **Cégszintű Alapértelmezés és Felhasználói Felülbírálás:**
   - A cégek beállításaiban (`company_settings.gl_date_basis`) meghatározható az adott vállalkozásra érvényes alapértelmezett elszámolási mód.
   - A könyvelő a Főkönyv képernyőn (Kivonat, Naplófőkönyv, Többéves Összehasonlítás) azonnal felülbírálhatja ezt a szűrőt anélkül, hogy a globális cégbeállítást módosítania kellene.
4. **Exportok Hitelessége:**
   - Valamennyi Excel és nyomtatott exportnak kötelezően tartalmaznia kell a kiválasztott dátum alapot mind a fájlnévben, mind a fejlécekben, megakadályozva a félreértéseket külső ellenőrzések során.

## Rationale

A könyvelők számára a magyar adó- és számviteli jogszabályoknak való megfelelés elengedhetetlen. A teljesítés alapú elszámolás lehetővé teszi a valós gazdasági időszaki bevételek és költségek pontos kimutatását, miközben a kibocsátás kelte szerinti opció megőrzi az adminisztratív számlakibocsátási ellenőrizhetőséget.

## Kapcsolódó
- PRD: [P-066: Főkönyvi Dátum Alap Kapcsoló és Beállítások UX](../../product/decisions/P-066-gl-date-basis-toggle-and-settings-ux.md)
- ADR: [A-085: Főkönyvi Dátum Alap RPC Pushdown és Dinamikus Chunk Reload Recovery](../../architecture/decisions/A-085-gl-date-basis-rpc-and-chunk-error-recovery.md)
