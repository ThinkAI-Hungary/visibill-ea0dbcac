# A-175: Folyószámla és Analitika Architektúra, Nyitott Tételek Rendezése és Főkönyvi Integritás-Védelem

- **Státusz:** ✅ Decided
- **Dátum:** 2026-09-28
- **Érintett területek:** PostgreSQL DB, Supabase RPC, Kettős Könyvvitel, Főkönyvi Integritás, Folyószámla Analitika, React Frontend, Általános Könyvelési Sztenderdek (Sztv.)

---

## 1. Kontextus és Problémafelvetés

A kettős könyvviteli rendszerekben kritikus számviteli követelmény a **főkönyv és az analitika teljes és garantált egyezősége** (pl. vevő 311, szállító 454, előleg 361/4521 számlák). Lendvai Ádám könyvelői fejlesztési javaslata (`tests/docs/eb0148/b63265c7-6f08-437c-a63b-59208d52edc4.pdf`) alapján a korábbi működésben az alábbi kockázatok és hiányosságok merültek fel:

1. **Analitika és Főkönyv eltérésének kockázata:** Ha egy felhasználó közvetlenül könyvel a 311-es vagy 454-es számlára anélkül, hogy megadná a partnert vagy a bizonylatot, a főkönyvi egyenleg megváltozik, de a partneri analitikában nem jelenik meg tétel — így a főkönyv és az analitika elválik egymástól.
2. **Hiányzó folyószámla és nyitott tételek felület:** Nem volt dedikált felület a nyitott tételek áttekintésére, esedékesség szerinti szűrésére, valamint kézi összerendezésére (pl. banki kiegyenlítés és számla párosítására).
3. **Kerekítési és realizált árfolyamkülönbözetek:** Kisebb kerekítési eltérések ($\le 10$ Ft) vagy devizás kiegyenlítéskor keletkező árfolyamkülönbözetek miatt a tételek nyitva maradtak, mert nem állt rendelkezésre 1-kattintásos vegyes bizonylatos leírási mechanizmus.
4. **Belső analitikus számlák kezelése:** Nem csak partnerekhez köthető analitika létezik, hanem tétel-alapú belső számlák is (pl. 161 Beruházások beszerzése vs. aktiválása), ahol szintén nyomon kell követni a nyitott/zárt tételeket.

---

## 2. Megoldási Architektúra és Döntések

### D-1: Főkönyvi számlák analitikai konfigurációja (`subledger_type`, `is_open_item_managed`)
A `public.gl_accounts` táblát bővítettük:
- `subledger_type`: `'none' | 'partner' | 'detail'` (partneri analitika: 311, 454; tételes/belső analitika: 361, 4521; alapeset: none).
- `is_open_item_managed`: `BOOLEAN DEFAULT false` (jelzi, hogy a számla nyitott tételei párba állítandók-e).
- Alapértelmezett standard beállítások automatikusan inicializálva a standard számlatükörben (311*, 454*, 361*, 4521*, 161*).

### D-2: Szigorú főkönyvi integritás-védelem (`acc_post_journal_entry`)
A könyvelési napló lekönyvelését végző `acc_post_journal_entry` RPC-t kiegészítettük egy hard integrity checkkel:
```sql
SELECT l.id, g.gl_number, g.short_name INTO v_invalid_line
FROM public.acc_journal_lines l
JOIN public.gl_accounts g ON g.id = l.gl_account_id
WHERE l.header_id = p_header_id AND g.subledger_type = 'partner'
LIMIT 1;

IF FOUND AND v_header.partner_id IS NULL THEN
  RAISE EXCEPTION 'Könyvelési hiba: A(z) % (%) főkönyvi szám partnerhez kötött folyószámla, rögzítéskor a partner megadása kötelező!',
    v_invalid_line.gl_number, v_invalid_line.short_name;
END IF;
```
Ez garantálja a **Zero Silent Discrepancy** elvet: partner nélküli könyvelés partneri folyószámlára lehetetlen a rendszerben.

### D-3: Nyitott tételek kapcsoló táblája (`acc_open_item_matches`)
Nem módosítjuk a már lekönyvelt naplósorokat (immutability), hanem egy dedikált M:N kapcsolótáblát vezetünk:
- `id`: UUID PRIMARY KEY
- `company_id`: UUID REFERENCES companies
- `invoice_line_id`: UUID REFERENCES acc_journal_lines (nyitott tétel)
- `settling_line_id`: UUID REFERENCES acc_journal_lines (kiegyenlítő tétel)
- `settled_amount_huf`: NUMERIC(18,2)
- `settled_amount_foreign`: NUMERIC(18,2)
- `currency`: CHAR(3) DEFAULT 'HUF'
- `match_type`: `'MANUAL' | 'AUTO_REF' | 'COMPENSATION' | 'ROUNDING' | 'FX_DIFFERENCE'`
- RLS védelmet kapott a céges tagság alapján.

### D-4: Teljesítmény-optimalizált lekérdező RPC (`get_subledger_items`)
Egyetlen optimalizált SECURITY DEFINER PostgreSQL függvényben végezzük a nyitott/zárt/összes tételek kinyerését, a kiegyenlített összeg (`settled_amount`) és a fennmaradó összeg (`remaining_amount`) CTE-alapú aggregációját:
```sql
CREATE OR REPLACE FUNCTION public.get_subledger_items(...)
RETURNS TABLE (
  line_id UUID, header_id UUID, posting_date DATE, document_date DATE, due_date DATE,
  document_id VARCHAR, partner_id UUID, partner_name TEXT, gl_number VARCHAR,
  amount NUMERIC, settled_amount NUMERIC, remaining_amount NUMERIC, is_settled BOOLEAN, ...
)
```

### D-5: 1-kattintásos Automatikus Különbözet-Leírás (`write_off_subledger_difference`)
Ha egy tételen kerekítési különbözet ($\le 10$ Ft) vagy árfolyamkülönbözet marad:
1. Az RPC megkeresi a cég Vegyes (`VE`) naplóját.
2. Megkeresi a megfelelő különbözeti ellenszámlát (Kerekítés: 8755/9779; Árfolyam: 8762/9762).
3. Létrehoz egy 2-lábú vegyes bizonylatot, amely ellentételezi a nyitott sort.
4. Lekönyveli a bizonylatot `acc_post_journal_entry` hívással.
5. Automatikusan össze is párosítja a nyitott sort az új vegyes ellenszámlasorral az `acc_open_item_matches` táblában.

### D-6: Dinamikus Könyvelési Státusz Szűrés (`p_status_filter`)
Az importált számlák és banki tranzakciók gyakran kezdetben `GEPI_JAVASLAT` (gépi könyvelési javaslat) státuszban állnak a felülvizsgálatig. A `get_subledger_items` RPC-t kiegészítettük `p_status_filter TEXT DEFAULT 'ALL_ACTIVE'` paraméterrel:
- `'ALL_ACTIVE'`: Lekérdezi a `KONYVELT`, `GEPI_JAVASLAT`, `PISZKOZAT` és `KEZI_PISZKOZAT` státuszú tételeket is (kiszűrve a sztornózottakat). Ezzel elkerülhető a kezdeti üres felület új cégeknél vagy friss importok után.
- `'POSTED_ONLY'`: Kizárólag a szigorúan lekönyvelt (`KONYVELT`) tételeket mutatja.
- `'DRAFT_ONLY'`: Kizárólag a még nem véglegesített könyvelési javaslatokat mutatja.

### D-7: 1-Kattintásos Kötegelt Automatikus Párosító Motor (`auto_settle_subledger_items`)
Nagy tételszámú vevő/szállító forgalom esetén a bizonylatszám-alapú egyeztetés manuálisan lassú. Az `auto_settle_subledger_items(p_company_id, p_gl_account_id)` RPC:
1. Feltárja az azonos bizonylatszámú (`document_id`), hivatkozási számú vagy banki közleményű Tartozik és Követel nyitott tételeket.
2. Megvizsgálja a fennmaradó nyitott összegeket (`remaining_amount`).
3. Létrehozza a rendezési rekordokat az `acc_open_item_matches` táblában `match_type = 'AUTO_REF'` jelöléssel.
4. Visszaadja a sikeresen párosított tételek darabszámát és összegét.

### D-8: Tömeges Javaslat-Könyvelés (`batch_post_subledger_items`)
A folyószámla felületről közvetlenül elvégezhető a kijelölt javaslatok jóváhagyása. Az RPC egyetlen tranzakcióban lefuttatja a bizonylatokra az `acc_post_journal_entry` függvényt, garantálva a kettős könyvviteli sorszámozást és integritás-ellenőrzéseket.

### D-9: Bizonylati Integritás és Megváltoztathatatlanság (Immutability Guard)
A lekönyvelt naplófejek módosítása szigorúan tiltott (`acc_enforce_header_immutability`). Ezért a kiegyenlítési hivatkozást nem utólagos fejléc-update-tel tároljuk, hanem a `get_subledger_items` dinamikusan feloldja a `COALESCE(h.document_id, '')` értéket `settlement_number`-ként, míg az összerendeléseket tisztán a dedikált `acc_open_item_matches` tábla kezeli.

---

## 3. Következmények és Eredmények

- ✅ **Garantált egyezőség:** A főkönyv és a folyószámla analitika között 0 Ft eltérés lehetséges (Sztv. megfelelőség).
- ✅ **Nagyvállalati M:N párosítás:** Támogatja az 1:1, 1:N (részletfizetés), N:1 (összevont bankkivonat) és M:N párosításokat is.
- ✅ **Auditálhatóság:** Bármikor visszakövethető, hogy melyik tétel melyik banki vagy vegyes sorral lett rendezve, és egyetlen kattintással felbontható (unsettle).
- ✅ **Gyors könyvelői munkafolyamat:** Nincs szükség kézi vegyes bizonylatok gépelésére filléres kerekítések vagy deviza-árfolyamok miatt.
- ✅ **Azonnali átláthatóság importálás után:** A javaslat státuszú tételek azonnal láthatók és párosíthatók.

---

## 4. Kapcsolódó Döntések és Szabályzatok
- [P-136: Folyószámla és Analitika Kezelőfelület és Nyomtatási Kimutatások UX](../../product/decisions/P-136-subledger-and-open-items-ux.md)
- [BRD 063: Folyószámla és Analitika Számviteli Szabályzat és Integritás](../../business/decisions/063-subledger-and-open-items-accounting-policy.md)
- [A-043: Könyvelési Naplók és Kettős Könyvviteli Folyószámlák](./A-043-accounting-journals.md)
- [A-111: Közvetlen Bizonylat-visszanyitás és Sorszámfolytonossági Védelem](./A-111-accounting-journal-unpost-gl-storno-and-numbering-integrity.md)
