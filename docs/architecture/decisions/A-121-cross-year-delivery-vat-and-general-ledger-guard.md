# A-121: Évek Közötti Áthúzódó Teljesítésű Számlák Főkönyvi és ÁFA Védőhálója (Cross-Year Delivery Guard)

**Status:** Decided  
**Date:** 2026-09-16  
**Category:** Architecture / Database / Accounting / General Ledger / VAT / Triggers  
**Érintett komponensek:** `supabase/migrations/20260916170000_cross_year_delivery_guard.sql`, `trigger_auto_create_accounting_draft`, `generate_auto_accounting_drafts`, `post_accounting_journal_draft`, `accounting_journal_entries`  
**Kapcsolódó döntések:** [A-107: ÁFA Levonhatóság Szinkronizálása a Főkönyvvel](./A-107-vat-deductibility-journal-and-gl-sync.md), [A-111: Közvetlen Bizonylat-visszanyitás és Sorszámvédelem](./A-111-accounting-journal-unpost-gl-storno-and-numbering-integrity.md), [BRD 049: Főkönyvi Dátum Alap](../../business/decisions/049-gl-date-basis-fulfillment-vs-issue.md), [BRD 057: Áthúzódó Számlák Számviteli Szabálya](../../business/decisions/057-cross-year-delivery-accounting-rules.md)

---

## Context

A kettős könyvviteli és ÁFA modulban kritikus számviteli anomália alakulhat ki azon számlák feldolgozásakor, amelyeknél a gazdasági esemény **teljesítési dátuma az előző üzleti évre** esik (pl. 2025.12.31.), míg a **számla kibocsátása és beérkezése már a következő üzleti évben** történik (pl. 2026.01.08.).

Konkrét termelési eset: A VBV Vision Kft. könyvelésében a 2025. decemberi teljesítésű, de 2026. januárban kibocsátott bizonylat (VBV-2026-1) a rendszer korábbi automatizmusa miatt bekerült a 2026. januári 46671-es főkönyvi kartonra és az ÁFA kalkulációba, miközben az előző év már lezárt vagy felülvizsgálat alatti időszaka és a tárgyévi bevallás között disszonancia keletkezett.

### Számviteli és jogi háttér:
1. **Számviteli törvény (Sztv. 15. § - Időbeli elhatárolás és összemérés elve):** A gazdasági esemény költségét/ráfordítását és bevételét abban az évben kell elszámolni, amelyre vonatkozik (2025), a számla hiánya esetén passzív időbeli elhatárolással (482/911 vagy 5/481).
2. **Áfa tv. 55. §, 58. § és 119-120. § (Adólevonási jog keletkezése):** A levonási jog a teljesítéskor keletkezik, de legkorábban akkor gyakorolható, ha az adóalany a számlával rendelkezik. Ha a számla januárban érkezik meg, de a decemberi ÁFA időszak még nincs lezárva, a decemberi bevallásba állítható be; ha a decemberi bevallás lezárult, a tárgyévben vagy önellenőrzéssel kezelendő.
3. **Főkönyvi veszély:** Ha az automatikus könyvelő trigger vakon a kibocsátási dátum alapján könyveli le a tételt a tárgyévi naplóba, a ráfordítás és az ÁFA nem a megfelelő számviteli évbe kerül, ami súlyos adóbírságot és hibás éves beszámolót okozhat.

---

## Decision

### 1. Adatbázis-szintű Cross-Year Guard a Tervezet-Generáló Triggerekben
A `supabase/migrations/20260916170000_cross_year_delivery_guard.sql` migrációban megerősítettük a `trigger_auto_create_accounting_draft` és `generate_auto_accounting_drafts` PostgreSQL triggereket és tárolt eljárásokat:
- **Évváltás Detektálás:** A trigger automatikusan vizsgálja, hogy az `EXTRACT(YEAR FROM fulfillment_date)` eltér-e az `EXTRACT(YEAR FROM invoice_issue_date)` évétől (pl. teljesítés éve = 2025, kiállítás éve = 2026).
- **Zárt Év Védelem:** Ha a teljesítés éve egy korábbi, már lezárt üzleti évhez tartozik (`accounting_periods.is_closed = true`), a rendszer szigorúan megtiltja a közvetlen, retrospektív bejegyzések generálását az előző év naplóiba.

### 2. 46671 Főkönyvi Számla Helyes Kezelése és Átfutó ÁFA Elkülönítés
- A `46671` (Előzetesen felszámított áthúzódó / le nem vonható ÁFA) számla használata kizárólag azon tételeknél engedélyezett, amelyeknél az ÁFA levonhatósága jogszabályilag vagy a számla késői beérkezése miatt átmenetileg függőben van.
- Az automatikus tervezet a kibocsátás évében megnyitott naplóba kizárólag akkor rögzíthet ÁFA tételt, ha az megfelel az Áfa tv. időszaki szabályainak; ellenkező esetben a tétel státusza `pending_accountant_review` (könyvelői jóváhagyásra vár) állapotba kerül, megakadályozva a vak automatikus véglegesítést.

### 3. Véglegesített Főkönyvi Tételek Integritása (`post_accounting_journal_draft`)
A tervezet véglegesítésekor (`post_accounting_journal_draft`) a rendszer megismétli a dátum- és időszakkonzisztencia ellenőrzést, biztosítva, hogy a könyvelési időszak (`period_id`), a teljesítés dátuma és a bizonylat dátuma közötti eltérés csak tudatos könyvelői döntéssel kerülhessen a főkönyvi kartonokra.

---

## Consequences

### Pozitív
- **Lezárt Üzleti Évek Érinthetetlensége:** Megszűnik az a kockázat, hogy a tárgyévben beérkező késedelmes számlák észrevétlenül módosítsák a már elfogadott és letétbe helyezett előző évi beszámolót vagy főkönyvet.
- **Karton Tisztaság:** A 46671-es és 4661-es ÁFA kartonok nem tartalmaznak fantom- vagy jogosulatlan tételeket.
- **Audit Megfelelőség:** A könyvelőirodák és belső könyvelők számára a rendszer jelzi az áthúzódó tételeket, időt biztosítva az időbeli elhatárolások manuális vagy félautomata megképzésére.

### Negatív / Kötöttségek
- Az áthúzódó számlák egy része nem könyvelődik le 100%-ban automatikusan: a könyvelőnek el kell döntenie, hogy önellenőrzi-e a decembert, vagy a tárgyév nyitó naplójában számolja el az átfutó ÁFÁ-t.
