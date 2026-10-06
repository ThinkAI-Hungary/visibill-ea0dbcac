# 📁 Visibill — Google Drive Automatikus Számlabegyűjtő Rendszer

> **Alapelv:** A cégvezetőknek és ügyfeleknek **ZÉRÓ technikai feladatuk van**.  
> Egyetlen dolguk van: a számítógépen vagy telefonon **egyszerűen behúzni a számlákat a saját Google Drive mappájukba**.  
> Minden technikai háttérfolyamatot (API, szinkronizáció, OCR, könyvelés) a rendszer automatikusan elvégez.

---

## 👔 1. A Cégvezető / Ügyfél Élménye (100% Non-Technical)

A cégvezető vagy pénzügyes semmilyen technikai felülettel, kóddal vagy beállítással nem találkozik:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      A CÉGVEZETŐ MINDENNAPI FOLYAMATA                  │
│                                                                        │
│   1. E-mail értesítést kap: "A ThinkAI megosztott veled egy mappát"    │
│   2. Megnyitja a saját Google Drive-ját                                │
│   3. Behúzza (Drag & Drop) a számlákat a mappájába                     │
│      (vagy telefonos Google Drive appból lefotózza)                    │
│   4. Pár perc múlva a számla átkerül a "Feldolgozva" mappába           │
│   5. A számla megjelenik a Visibill rendszerben könyvelve!             │
└────────────────────────────────────────────────────────────────────────┘
```

### Mit lát a cégvezető a Google Drive-on?
* Belép a saját Google Drive-jába (drive.google.com).
* A **„Velem megosztva”** (Shared with me) menüpontban látja a saját cége mappáját (pl. `12345678 - Pelda Kft`).
* **Szigorú adatvédelem:** Kizárólag a saját cége mappáját látja. A többi céget, mások számláit, vagy a ThinkAI belső gyökérmappáját **garantáltan nem láthatja**.
* A mappában talál egy **`Számlák`** almappát: ide húzza be a bizonylatokat. *(Ha véletlenül közvetlenül a cégmappába másolja be a fájlt, a rendszer azt is automatikusan észleli és feldolgozza!)*

---

## 🛠️ 2. A ThinkAI Csapat Teendői (Egyszeri, Belső Beállítás)

> [!NOTE]
> Az alábbi lépéseket **kizárólag a ThinkAI adminisztrátora végzi el egyetlen alkalommal**, a saját ThinkAI Google fiókjában. Az ügyfeleknek ebből semmit sem kell látniuk!

### A) Első alkalommal (Központi motor üzembe helyezése — 5 perc)

1. **Visibill Rendszerszintű Master API kulcs:**
   - Mivel az ügyfelek különböző cégeihez a scriptnek globálisan hozzá kell férnie (míg a webes felületen generált kulcsok szándékosan csak a belépett felhasználó saját cégeire korlátozódnak), ehhez a központi szinkronhoz egy dedikált **Platform Master API kulcs** tartozik (`ThinkAI Google Drive Sync Master Key`).
   - A kulcs formátuma: `vb_...` (lásd a belső jelszókezelőben vagy a telepítési jegyzőkönyvben).
   - Ezzel a kulccsal a script az összes létező és jövőbeli Visibill cég bizonylatait képes automatikusan fogadni és a megfelelő céghez hozzárendelni.
2. **Központi Google Drive mappa létrehozása:**
   - A ThinkAI Google fiókjában hozz létre egy mappát, pl.: `Visibill Számlák`.
   - Másold ki az URL-ből a Mappa ID-t (`https://drive.google.com/drive/folders/<MAPPA_ID>`).
   - *(Fontos: Ezt a gyökérmappát NE oszd meg senkivel kívülről!)*
3. **Google Apps Script elindítása:**
   - Nyisd meg a [script.google.com](https://script.google.com) felületet a ThinkAI fiókkal, hozz létre egy új projektet.
   - Másold be a [`scripts/gdrive-sync/VisibillGoogleDriveSync.js`](file:///d:/ThinkAI/Visibill/eaisybill-prod/scripts/gdrive-sync/VisibillGoogleDriveSync.js) fájl tartalmát.
   - Írd be az `API_KEY` és `ROOT_FOLDER_ID` értékeket.
   - Futtasd a `installAutoTrigger` függvényt a szerkesztőben.  
   **Kész!** A háttérmotor mostantól 5 percenként automatikusan és csendben fut a Google felhőjében.

---

### B) Új Ügyfél / Cég Bekapcsolása (1 perc/cég)

Amikor egy új ügyfél csatlakozik, csupán ennyi a teendő a ThinkAI Drive-on:

1. A központi `Visibill Számlák` mappában hozz létre egy új mappát a cég **adószámával** (pl. `12345678-1-42` vagy `12345678 - Kovacs Bt`).
2. Kattints a jobb gombbal a mappára → **Megosztás** (Share).
3. Írd be a cégvezető / pénzügyes Google email címét, és add meg neki a **Szerkesztő** (Editor) jogosultságot.

**Ennyi!** Az ügyfél azonnal megkapja az értesítést a Drive-ban, behúzza a számláit, a script pedig az adószám alapján automatikusan tudni fogja, hogy melyik céghez tartozik, felküldi a Visibillbe a PGMQ sorba, a worker feldolgozza, a Drive-on pedig átkerül a `Feldolgozva` mappába.

---

## ⚙️ Mi történik a motorháztető alatt?

```
Cégvezető behúzza a számlát a Drive-ra (szamla.pdf)
                 │
                 ▼ (max. 5 percen belül)
Google Apps Script (ThinkAI fiókban a Google felhőjében)
  • Felolvassa a cég adószámát a mappa nevéből
  • Átkonvertálja Base64-be
  • Meghívja a Visibill REST API-t (POST /v1/invoices/upload)
                 │
                 ▼
Visibill Customer REST API (eaisybill-prod)
  • Fájl mentése Supabase Storage-ba (invoice-uploads)
  • Sor beszúrása az invoice_uploads táblába
  • Trigger (trg_enqueue_invoice) elhelyezi a jobot a PGMQ-ban
                 │
                 ▼
Visibill Python Worker (DigitalOcean)
  • Kiveszi a jobot a pgmq.invoice_processing sorból
  • Vision OCR és LLM adatkivonás (partner, összegek, ÁFA, tételek)
  • Mentés az invoices táblába és főkönyvi automatikus kontírozás
                 │
                 ▼
Visszajelzés a Google Drive-on
  • A Google Apps Script a feltöltött fájlt átrakja a "Feldolgozva/ÉÉÉÉ-HH" mappába
  • A cégvezető bemeneti mappája tiszta marad, látja hogy elintézve!
```

---

## 🔒 Biztonsági és Adatvédelmi Garanciák

| Kérdés | Hogyan védi a rendszer? |
|---|---|
| **Láthatja-e az „A” cég a „B” cég számláit?** | **Szigorúan kizárt.** A cégek csak a saját egyedi mappájukhoz kapnak megosztást. A Google Drive jogosultsági rendszere nem engedi átlátni más mappákba. |
| **Mi történik, ha egy cégvezető rossz formátumot tölt fel?** | A script csak a támogatott számlaképeket (PDF, JPG, PNG, WEBP) dolgozza fel. Hibás fájl esetén áthelyezi a `Hibás` mappába, a feldolgozás nem áll le. |
| **Küldhet-e be a cégvezető véletlenül duplikált számlát?** | A feltöltött fájl azonnal átkerül a `Feldolgozva` mappába. Emellett a Visibill adatbázisában az [A-023](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-023-upload-dedup-protection.md) SHA-256 hash védelme és a trigger dedup guard megelőzi a felesleges OCR költségeket. |
| **Kell-e a cégvezetőnek bármit telepítenie?** | **Semmit.** A meglévő Google Drive webes vagy mobilos alkalmazását használja, amit már úgyis ismer és használ. |
