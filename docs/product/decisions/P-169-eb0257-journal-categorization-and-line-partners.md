# P-169: Könyvelési Naplók Kategóriái, Szerkeszthetősége, Banki Szinkronizáció és Tételsori Partnerkezelés (EB-0257)

- **Státusz**: Elfogadva (Accepted)
- **Dátum**: 2026-10-08
- **Ügyfél / Érintett**: Lendvai Ádám (Ván Iroda / Kolos Transport Kft., EB-0257)
- **Felelős**: Eaisybill / Eaisybooks Fejlesztői Csapat

---

## 1. Kontextus és Ügyféligény

A Kolos Transport Kft. könyvelése és a Ván Iroda könyvelői csapata jelezte, hogy a naplók növekvő száma miatt a kezelőfelület nehezen átláthatóvá vált:
1. **Képernyő túlcsordulás**: A sok könyvelési napló (nyitó, több bank, devizaszámlák, pénztárak, vevő/szállító forgalom, vegyesek, záró) vízszintesen kifut a képernyőről, nehéz köztük lapozni.
2. **Naplók szerkeszthetősége**: A meglévő naplók szerkesztési felületén eddig csak bizonyos mezők voltak módosíthatók; szükség van a devizanem (MNB 24 hivatalos devizája), kód, elnevezés és bankszámlaszám szabad szerkesztésére.
3. **Kétirányú Banknapló <-> Bankszámla szinkron**: Ha a banknaplónál megadjuk a bankszámlaszámot, kerüljön át a cég bankszámláihoz, és fordítva. A beolvasott bankkivonat / tranzakció a számlaszám és deviza alapján automatikusan a megfelelő banknaplóhoz rendelődjön.
4. **Kézi vegyes könyvelés partnerkezelése**: Korábban a kézi vegyes bizonylat rögzítésekor a fejlécben globálisan kellett kiválasztani a partnert. Ez ellehetetlenítette az olyan vegyes tételeket, ahol több különböző partner szerepel egy bizonylaton, vagy ahol skontó (pl. 879/979), kerekítés, kamat szerepel a partnerköveteléssel szemben. A partnerkezelést a tételsorok szintjére kellett áthelyezni (`acc_journal_lines.partner_id`).
5. **Rendszer-automatizált naplók védelme**: Az automatizmusok által használt naplókat (`603` Nem realizált árfolyamkülönbözet, `605` Értékcsökkenés, `901` Év végi zárás) védeni kell a kézi félrekönyveléstől (`is_system_locked = true`).

---

## 2. Termékdöntések és Felhasználói Élmény (UX)

### 2.1. Naplók Kategória Szűrői és Gyorsugró Választó (`JournalsPage.tsx`)
- A naplók fejléce felett 7 kategóriagomb (filter pill) jelenik meg sorszámtartományokkal és számlálókkal:
  1. `Összes napló`
  2. `Nyitó (101)`
  3. `Bankok (201..253)`
  4. `Pénztárak (301..351)`
  5. `Számlák (401..552)`
  6. `Vegyesek (601..605)`
  7. `Záró (901)`
- Csoportosított lenyíló (`Select`) gyorsugró a naplók közötti azonnali váltáshoz.
- Csak az aktív kategóriába tartozó naplókártyák jelennek meg, megszüntetve a vízszintes görgetési túlcsordulást.

### 2.2. Teljeskörű Naplószerkesztés (`ManageJournalsModal.tsx`, `CreateJournalModal.tsx`)
- A ceruza ikonra kattintva megnyílik a teljes szerkesztő modal (`isEditMode = true`).
- Módosítható mezők:
  - Naplókód és elnevezés.
  - Devizanem: 24 hivatalos MNB devizanem (HUF, EUR, USD, GBP, CHF, PLN, CZK, RON, BGN, SEK, NOK, DKK, JPY, CAD, AUD, NZD, TRY, CNY, ILS, RSD, RUB, BRL, MXN, ZAR).
  - Kapcsolt főkönyvi számla.
  - Bankszámlaszám (bank típusú naplóknál automatikus formázással és érvényességi ellenőrzéssel).

### 2.3. Tételsori Partnerkezelés Vegyes Bizonylatoknál (`AddManualJournalEntryModal.tsx`)
- Eltávolítottuk a globális fejléc partner választót; a fejléc tiszta 3 oszlopos elrendezést kapott (Napló, Bizonylatszám, Megnevezés / Indoklás).
- Új tételsori komponens: `JournalLinePartnerPicker.tsx`:
  - Kereshető combobox popover név és adószám alapján.
  - Ha a kiválasztott főkönyvi számla partnerkényszeres folyószámla (`gl_accounts.subledger_type === 'partner'`), a mező kiemelten jelzi: `Partner kötelező *`, és a mentés validálja.
  - Skontó, kamat, kerekítés vagy egyéb számláknál a partner megadása opcionális.
  - Visszafelé kompatibilitás: a fejléc `partner_id` mezője mentéskor automatikusan az első kitöltött sor partnerével frissül.

### 2.4. Rendszer-zárolt Naplók Kezelése
- A `603`, `605`, `901` kódú vagy `is_system_locked = true` jelölésű naplók ki vannak szűrve az új kézi bizonylat rögzítő modalból.
- A felületen kiválasztva figyelmeztető sárga kártya jelzi: *"Rendszer által zárolt automatikus napló — kézi rögzítés és törlés tiltva"*.
- Az "Új vegyes bizonylat" gomb inaktív, a tételsorok műveletei (stornó, szerkesztés, törlés) zároltak.

---

## 3. Kapcsolódó Architektúra és Verifikáció

- **ADR**: [A-230-journal-categorization-and-line-partners.md](../../architecture/decisions/A-230-journal-categorization-and-line-partners.md)
- **Tesztek**: `src/test/eb0257JournalsAndPartnerLines.test.ts`, `src/components/journals/__tests__/AddManualJournalEntryModal.test.tsx`
