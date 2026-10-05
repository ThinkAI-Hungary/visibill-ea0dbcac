# 06. Hiányossági Katalógus és Cselekvési Terv — HR Lokalizáció

**Projekt:** Eaisybill (főalkalmazás)  
**Kapcsolódó döntések:** [A-109: Horvát Lokalizáció](../../architecture/decisions/A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md), [P-081: Horvát Demó UX](../../product/decisions/P-081-eaisybill-croatia-localization-and-demo-ux.md), [003: Nemzetközi Stratégia](../../business/decisions/003-localization-strategy.md)  
**Kapcsolódó leltárak:** [00. Áttekintés](./00-ATTEKINTES-ES-MODUL-LELTAR.md) · [01. Számlák](./01-SZAMLA-ES-BIZONYLATKEZELES.md) · [02. Pénzügy](./02-PENZUGY-KONYVELES-ES-GL.md) · [03. Bank és Partnerek](./03-BANK-PARTNER-ES-TRANZAKCIOK.md) · [04. HR és Eszközök](./04-HR-MUNKAIDO-ES-TARGYI-ESZKOZOK.md) · [05. Beállítások és UI](./05-BEALLITASOK-INTEGRACIOK-ES-KOZOS-UI.md)

---

## 🎯 1. Bevezetés és Célkitűzés

A teljes Eaisybill felületen végzett audit összesen **9514 darab lefordítandó vagy beégetett magyar elemet** azonosított. A feladat nagysága miatt a javítási munkálatokat nem ad-hoc módon, hanem egy fegyelmezett, háromfázisú bevezetési terv szerint kell végrehajtani:

```
[ FÁZIS 1: Demó és P0 Showstopperek ] ──> [ FÁZIS 2: Modálok és Űrlapok (P1) ] ──> [ FÁZIS 3: Teljes Rendszerfedettség (P2/P3) ]
  • Gombok, exportok, fejlécek             • Új számla, tételkezelő modálok        • Összes ritka toast és hibaüzenet
  • Elsődleges státusz badge-ek            • Nyitó napló varázsló                  • Beállítások, API dokumentáció
  • Főkönyvi és Mérleg kapcsolók           • Tárgyi eszköz és partner űrlapok      • Mélyebb szűrők és üres állapotok
```

---

## 📅 2. Háromfázisú Cselekvési Terv

### 🟢 1. Fázis: Értékesítési Demó és Kritikus UI Felületek (P0 Showstoppers)
*Becsült időigény: 1–2 fejlesztői nap | Érintett elemek: ~180 db*

* **Fő cél:** Az ügyfél-bemutatókon közvetlenül látható felületek azonnali tisztítása (Zero Hungarian on First Sight).
* **Konkrét feladatok:**
  1. **Számla fejléc és műveletek ([InvoiceHeader.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/header/InvoiceHeader.tsx)):**
     - `Számlázz.hu szinkron` $ightarrow$ `Sinkronizacija Számlázz.hu` (vagy horvát cégnél elrejtés Minimax javára).
     - Export legördülő címkék: `Export Excel (.xlsx)` $ightarrow$ `Izvoz u Excel (.xlsx)`, `Export CSV` $ightarrow$ `Izvoz u CSV`, `Export PDF` $ightarrow$ `Izvoz u PDF`.
     - `Új számla rögzítése` $ightarrow$ `Unos novog računa`.
     - `Könyvelési szabályok` $ightarrow$ `Računovodstvena pravila`.
     - `Feltöltött fájlok` $ightarrow$ `Učitane datoteke`.
  2. **Számlalista szűrősáv ([InvoiceFilterBar.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/filters/InvoiceFilterBar.tsx)):**
     - Szűrő placeholder: `Keresés partnerre, számlaszámra...` $ightarrow$ `Pretraži po partneru, broju računa...`.
     - Irány fülek: `Összes` $ightarrow$ `Sve`, `Bejövő` $ightarrow$ `Ulazni`, `Kimenő` $ightarrow$ `Izlazni`.
  3. **Státusz badge-ek és feliratok:**
     - Fizetési állapotok leképezése: `Fizetve` $ightarrow$ `Plaćeno`, `Fizetésre vár` $ightarrow$ `Za plaćanje`, `Késedelmes` $ightarrow$ `Dospjelo`, `Részben fizetve` $ightarrow$ `Djelomično plaćeno`.
     - Bizonylat állapotok: `Feldolgozva` $ightarrow$ `Obrađeno`, `Feldolgozás alatt` $ightarrow$ `U obradi`, `Jóváhagyásra vár` $ightarrow$ `Čeka odobrenje`.
  4. **Pénzügyi kimutatások fejlécei:**
     - Mérleg (`BalanceSheet.tsx`): `Mérleg-hinta` $ightarrow$ `Bilancna vaga ⚖️`, `Egyensúlyban` $ightarrow$ `U ravnoteži`, `Hagyományos nézet` $ightarrow$ `Tradicionalni prikaz`.
     - Eredménykimutatás (`ProfitAndLoss.tsx`): `Hivatalos nézet` $ightarrow$ `Službeni prikaz`, `Szimuláció` $ightarrow$ `Simulacija`.

---

### 🟡 2. Fázis: Főbb Felhasználói Űrlapok és Modális Dialógusok (P1)
*Becsült időigény: 3–4 fejlesztői nap | Érintett elemek: ~480 db*

* **Fő cél:** A napi adatrögzítési munkafolyamatok (számlakészítés, tételezés, könyvelés) teljes horvátítása.
* **Konkrét feladatok:**
  1. **Kézi számlarögzítés ([ManualInvoiceCreateDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/invoices/ManualInvoiceCreateDialog.tsx)):**
     - Mezőcímkék és placeholderek: `Számlaszám`, `Partner neve`, `Teljesítés dátuma`, `Fizetési határidő`, `Bruttó végösszeg`.
     - Fejléc: `Új számla rögzítése` $ightarrow$ `Unos novog računa`.
  2. **Számlasor tételezés és kontírozás ([InvoiceItemsDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx)):**
     - Oszlopfejlécek: `Tétel megnevezése`, `Mennyiség`, `Egységár`, `Nettó összeg`, `ÁFA kulcs`, `ÁFA összeg`, `Bruttó összeg`, `Főkönyvi szám`.
     - Gombok: `Új tétel hozzáadása` $ightarrow$ `Dodaj novu stavku`, `Tételek mentése` $ightarrow$ `Spremi stavke`.
  3. **Nyitó Napló Varázsló ([OpeningJournalWizardModal.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/journals/OpeningJournalWizardModal.tsx)):**
     - Lépések: `1. Nyitó egyenlegek`, `2. Ellenőrzés`, `3. Könyvelés véglegesítése`.
     - Figyelmeztetések: `A tartozik és követel egyenlegnek meg kell egyeznie!` $ightarrow$ `Dugovna i potražna strana moraju biti u ravnoteži!`.
  4. **Tárgyi eszköz létrehozása ([CreateFixedAssetDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/fixed-assets/CreateFixedAssetDialog.tsx)):**
     - `Új tárgyi eszköz rögzítése` $ightarrow$ `Unos nove dugotrajne imovine`.
     - `Aktiválás dátuma` $ightarrow$ `Datum stavljanja u uporabu`, `Bruttó érték` $ightarrow$ `Nabavna vrijednost`.

---

### 🔵 3. Fázis: Teljes Rendszerfedettség, Toastok és Súgók (P2/P3)
*Becsült időigény: 4–5 fejlesztői nap | Érintett elemek: ~8800 db*

* **Fő cél:** 100%-os szöveg- és hibakezelési lefedettség, duplikáció- és regresszióvédelem.
* **Konkrét feladatok:**
  1. **Minden toast értesítés szótárba emelése:**
     - `toast({ title: t('common:toasts.save_success_title'), description: t('common:toasts.save_success_desc') })`.
  2. **Üres állapotok (Empty states):**
     - `Nincsenek megjeleníthető számlák ebben az időszakban.` $ightarrow$ `Nema računa za prikaz u ovom razdoblju.`.
  3. **Beállítások és integrációk mélyebb felületei:**
     - Minimax API naplózás, bankszámla szerkesztők, archív riportok.

---

## 💻 3. Javasolt Szótárstruktúra Kiegészítés (`src/locales/hr/`)

A javítás során a hardkódolt szövegeket az alábbi hierarchikus kulcsokkal javasolt beépíteni:

### A) `src/locales/hr/invoices.json` kiegészítése:
```json
{
  "header": {
    "actions": {
      "szamlazz_sync": "Sinkronizacija Számlázz.hu",
      "szamlazz_sync_tooltip": "Preuzimanje slika izlaznih računa i povezivanje iz Számlázz.hu sustava",
      "accounting_rules": "Računovodstvena pravila",
      "uploaded_files": "Učitane datoteke",
      "new_invoice": "Unos novog računa",
      "export_excel": "Izvoz u Excel (.xlsx)",
      "export_csv": "Izvoz u CSV (.csv)",
      "export_pdf": "Izvoz u PDF (.pdf)"
    }
  },
  "manual_create": {
    "dialog_title": "Unos novog računa",
    "dialog_subtitle": "Ručno evidentiranje ulaznog ili izlaznog računa",
    "invoice_number": "Broj računa",
    "invoice_number_placeholder": "npr. RA-2026/001",
    "partner_name": "Naziv partnera",
    "issue_date": "Datum izdavanja",
    "fulfillment_date": "Datum isporuke",
    "due_date": "Rok plaćanja",
    "currency": "Valuta",
    "gross_total": "Ukupni bruto iznos",
    "btn_save": "Spremi račun",
    "toast_success_title": "Račun uspješno spremljen",
    "toast_success_desc": "Novi račun je evidentiran u sustavu."
  },
  "items_dialog": {
    "title": "Stavke računa",
    "add_row": "Dodaj novu stavku",
    "save_items": "Spremi stavke",
    "col_name": "Opis stavke / usluge",
    "col_qty": "Količina",
    "col_unit_price": "Jedinična cijena",
    "col_net": "Neto iznos",
    "col_vat_rate": "Stopa PDV-a",
    "col_vat_amount": "Iznos PDV-a",
    "col_gross": "Bruto iznos",
    "col_gl_account": "Konto glavne knjige",
    "toast_saved": "Stavke računa uspješno ažurirane"
  }
}
```

### B) `src/locales/hr/common.json` kiegészítése:
```json
{
  "badges": {
    "paid": "Plaćeno",
    "unpaid": "Otvoreno",
    "partial": "Djelomično",
    "overdue": "Dospjelo",
    "processed": "Obrađeno",
    "processing": "U obradi",
    "pending_approval": "Čeka odobrenje",
    "approved": "Odobreno",
    "rejected": "Odbijeno",
    "active": "Aktivno",
    "inactive": "Neaktivno",
    "draft": "Nacrt"
  },
  "toasts": {
    "save_success_title": "Uspješno spremljeno",
    "save_success_desc": "Promjene su uspješno zabilježene.",
    "delete_success_title": "Uspješno obrisano",
    "delete_success_desc": "Odabrani element je uklonjen.",
    "error_title": "Greška",
    "error_general_desc": "Došlo je do neočekivane pogreške. Pokušajte ponovno."
  },
  "confirm": {
    "delete_title": "Potvrda brisanja",
    "delete_desc": "Jeste li sigurni da želite obrisati ovu stavku? Ova radnja je nepovratna."
  }
}
```

---

## 🛡️ 4. Minőségbiztosítási és Verifikációs Kapu

Minden lokalizációs fázis lezárásakor az alábbi minőségbiztosítási vizsgálatok kötelezőek a `rules/verification.md` alapján:

1. **Vitest Mélységi Kulcsparitás Teszt:**
   ```powershell
   npx vitest run src/test/i18n.test.ts
   ```
   *Elvárt eredmény:* Minden `hu` és `hr` kulcs 100%-ban megegyezik, 0 darab hiányzó kulcs.
2. **Gyors Lint Ellenőrzés (Oxlint):**
   ```powershell
   npm run lint:fast
   ```
3. **TypeScript Típusellenőrzés:**
   ```powershell
   npm run build
   ```
4. **Felületi Ellenőrzés a Böngészőben:**
   - Navigáció a `/hr/:companyId/:dateRange/invoices` útvonalra.
   - Ellenőrzés, hogy a gombok, modálok és toastok hibátlanul, horvát nyelven jelennek meg.

---
*Készült a Visibill Docs-First és Zero Workspace Clutter fejlesztési protokollja alapján.*
