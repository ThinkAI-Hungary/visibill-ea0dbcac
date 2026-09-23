# A-142: Kettős Könyvvitel Szerinti Kötelező Kontírszám Szabályok és Vevői Kontírválasztó (311–317 + ÁFA 467/466)

## Státusz
Elfogadva és Implementálva (2026-09-24)

## Kontextus
A magyar számviteli törvény (2000. évi C. tv. - Sztv.) szerinti kettős könyvvitelben a gazdasági műveletek rögzítésekor a bizonylat kontírozása szigorú összefüggéseken alapul:
1. **Tartalmi / Eredmény láb (Változó):** Költségnem (5xx), Ráfordítás (8xx), Árbevétel (9xx) vagy Eszközaktiválás (1xx), amit a számla tételeinek természete alapján a könyvelő határoz meg.
2. **Partneri láb (Kötött):**
   - Kimenő (vevői) számláknál a követelés kötelezően a Vevők számlacsoportból kell kikerüljön. A magyar számlakeret szerint ez a 31-es számlacsoport, azon belül kizárólag:
     - `311` – Belföldi vevők követelései (HUF)
     - `312` – Külföldi vevők követelései (Export / Devizás)
     - `315` – Vevőkövetelések kapcsolt vállalkozással szemben
     - `316` – Vevőkövetelések jelentős tulajdoni részesedési viszonyban lévő vevővel szemben
     - `317` – Vevőkövetelések egyéb részesedési viszonyban lévő vevővel szemben
   - Bejövő (szállítói) számláknál a kötelezettség a Szállítók számlacsoport (`454` / `4541` belföldi, `4542` külföldi).
3. **ÁFA láb (Rögzített):**
   - Kimenő értékesítés esetén az adófizetési kötelezettség a **467 – Fizetendő ÁFA** számlára könyvelendő.
   - Bejövő beszerzés esetén az adólevonási jogosultság a **466 – Előzetesen felszámított (levonható) ÁFA** számlára könyvelendő.

Korábban a rendszerben a számlák jóváhagyásakor vagy adatlapi megtekintésekor nem volt dedikált vevői számlaszám választó, a rendszer mereven a `311`-et vette alapul mind a háttérben futó tervezet generálásakor, mind a T-számlás vizualizációban és a külső könyvelőprogram exportokban (RLB60, Novitax, Kulcs-Soft).

## Döntések

1. **Adatmodell Bővítés:**
   - A `public.invoices` és `public.nav_invoices` táblák bővítésre kerültek két új oszloppal:
     - `partner_gl_number VARCHAR(16) DEFAULT NULL`
     - `vat_gl_number VARCHAR(16) DEFAULT NULL`
   - Mindkét táblán részleges / összetett indexek jöttek létre (`idx_invoices_partner_gl`, `idx_nav_invoices_partner_gl`).

2. **Frontend UI és Validációs Szabályok (`InvoiceGlAccountSelector`):**
   - Létrehoztuk a `@/components/invoices/InvoiceGlAccountSelector` komponenst:
     - **Kimenő számláknál:** A vevői kontírszám egy zárt, 5 elemű lenyíló listából választható (`311`, `312`, `315`, `316`, `317`), kizárva a téves könyvelési számlaszámok megadását.
     - **ÁFA kontírszám:** Nem szerkeszthető, lakat ikonnal rögzített badge (`467` Fizetendő ÁFA kimenőnél, `466` Levonható ÁFA bejövőnél).
   - Beépítésre került a számla részletező adatlapba ([InvoiceDetailPopup.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/InvoiceDetailPopup.tsx)) a 2665-ös ÁFA kód választó mellé.

3. **Downstream Pipeline Szinkronizáció:**
   - **T-számlás előnézet ([TAccountLedger.tsx](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/accounty/invoices/TAccountLedger.tsx)):** A Tartozik oldalon a kiválasztott partner kontírt (pl. `315` Vevők - Kapcsolt vállalkozás) jeleníti meg az alapértelmezett 311 helyett.
   - **Külső Könyvelő Exportok ([bookkeepingExports.ts](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/lib/bookkeepingExports.ts)):**
     - RLB60 CSV text import: a vevői debit oszlop a `partner_gl_number`-t használja.
     - Novitax CSV import: Tartozik, Követel és ÁFA számla dinamikusan a számla beállításaiból töltődik.
     - Kulcs-Soft XML: `<TartozikFokonyv>` és `<AfaFokonyv>` a számla beállításait követi.
   - **Naplótervezet Generálás ([acc_generate_drafts_from_ledger](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/supabase/migrations/20260924100000_add_invoice_partner_and_vat_gl_numbers.sql) és [draftFallbackGenerator.ts](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/features/journals/services/draftFallbackGenerator.ts)):**
     - Ha a számlán explicit meg van adva `partner_gl_number`, a generátor prioritásként azt a számlaszámot köti be.

## Következmények és Előnyök
- **Sztv. Konformitás:** A vevői számláknál garantált, hogy a követelés oldal soha nem mutathat helytelen számlaosztályra vagy nem vevői számlára.
- **Transzparencia:** A könyvelő a számla adatlapon azonnal látja és ellenőrizheti a teljes 3-lábú kontírt.
- **Export Hűség:** A kapcsolt (`315`) vagy export (`312`) vevők számlái hibátlanul jutnak át az RLB, Kulcs-Soft és Novitax könyvelőszoftverekbe.
