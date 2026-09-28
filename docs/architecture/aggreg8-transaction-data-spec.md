# Aggreg8 PSD2 Open Banking Tranzakciós és Partner Adatstruktúra Specifikáció

**Státusz:** Éles (Production)  
**Verzió:** 1.0.0  
**Dátum:** 2026-09-28  
**Kapcsolódó döntések:** [A-119 (ADR)](./decisions/A-119-aggreg8-psd2-open-banking-integration.md), [P-087 (PRD)](../product/decisions/P-087-aggreg8-bank-connections-and-sync-ui-ux.md), [026 (BRD)](../business/decisions/026-banking-integration.md)  
**Modul:** `eaisybill-prod` & `worker/aggreg8_processor.py`  

---

## 1. Áttekintés

A Visibill / eaisybill-prod rendszer az **Aggreg8 (AISP API v5.3.1)** felhőalapú banki aggregátorán keresztül közvetlen, európai PSD2 szabványnak megfelelő Account Information Service Provider (AISP) kapcsolatot tart fenn a partnerbankokkal.

A kapcsolat célja a manuális bankkivonat-feltöltések (CSV, XLS) teljes kiváltása, a partnertörzs automatikus adatgazdagítása és az élő, másodpercek alatti számlapárosítás (Two-Pass Matching).

```
  [ Partnerbankok (OTP, Erste, CIB, stb.) ]
                    │
                    ▼ (PSD2 AISP)
  [ Aggreg8 Cloud API (ais-api.aggreg8.hu) ]
                    │
                    ▼ (Statikus IP Whitelist: 64.226.83.137)
  [ DigitalOcean Reverse Proxy (a8.visibill.hu) ]
                    │ (X-A8-Proxy-Secret)
                    ▼
  [ Supabase Edge Functions: aggreg8-api / callback ]
                    │
                    ▼ (Upsert: bank_transactions + raw_data)
  [ Postgres DB: aggreg8_accounts, bank_transactions ]
                    │
                    ▼ (PGMQ: transaction_jobs)
  [ Python AI Worker: aggreg8_processor.py ]
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  [ public.transactions ]  [ transaction_invoice_matches ]
  (Könyvelési tételek)     (Párosított NAV számlák)
```

---

## 2. A Partnerektől és a Banktól Megkapható Adatok Katalógusa

A banki szinkronizáció során az Aggreg8 API-ból érkező adatokat két rétegben dolgozzuk fel:
1. **Nyers banki adatok (Bank Core):** A számlavezető bank által kiadott hiteles könyvelési tétel.
2. **Dúsított adatok (Aggreg8 Enrichment):** Az Aggreg8 gépi tanulásos motorja által normalizált partner- és kategóriaadatok.

### 🏢 2.1 Partner / Ellenoldali Adatok (Counterparty)

| Mező elnevezése | Forrás a JSON-ben | Adattípus | Leírás és példa |
|---|---|---|---|
| **Partner hivatalos neve** | `creditorName` / `debtorName` / `payee.name` / `payer.name` | `string` | Átutalás esetén a partner banknál nyilvántartott hivatalos neve (pl. `Taxology kft.`, `Dr. Tanács Ügyvédi Iroda`, `Opennetworks Kft`). |
| **Partner nemzetközi számlaszáma** | `creditorAccount.iban` / `debtorAccount.iban` / `partner.accountNumber` | `string` | 28 karakteres szabványos IBAN számlaszám (pl. `HU93117130122145225100000000`). |
| **Partner belföldi számlaszáma (BBAN)** | `creditorAccount.bban` / `debtorAccount.bban` | `string` | Magyar 3×8 vagy 2×8 jegyű GIRO formátum (pl. `11713012-21452251-00000000`). Ebből a Visibill algoritmusa a bankkódot (pl. `117` = OTP) automatikusan feloldja. |
| **Dúsított / Tisztított partnernév** | `enriched.partner.name` | `string` | Kártyás vásárlásoknál a banki POS terminál kódolt nevéből (pl. `Budapest POSTA1065 01102321`) letisztított kereskedelmi név (pl. `Magyar Posta`, `Budapest Go Print Allee`, `Anthropic`, `OpenAI`). |

---

### 💰 2.2 Pénzügyi és Valutaváltási Adatok

| Mező elnevezése | Forrás a JSON-ben | Adattípus | Leírás és példa |
|---|---|---|---|
| **Elszámolt könyvelési összeg** | `amount` / `transactionAmount.amount` | `decimal` | A saját bankszámlán jóváírt (+) vagy terhelt (-) összeg a számla devizájában (pl. `-2701026.00`). |
| **Számla devizaneme** | `currency` / `transactionAmount.currency` | `string(3)` | ISO devizakód (pl. `HUF`, `EUR`, `USD`). |
| **Eredeti külföldi összeg** | `enriched.originalAmount` | `decimal` | Devizás kártyás vásárlásnál a tranzakció eredeti devizaösszege (pl. `-76.50` EUR, `-50.00` USD, `-19.05` USD). |
| **Eredeti külföldi devizanem** | `enriched.originalCurrency` | `string(3)` | A kártyás tranzakció eredeti devizaneme (pl. `EUR`, `USD`). |
| **Implicit banki árfolyam** | `amount / originalAmount` | `decimal` | A bank által alkalmazott devizaváltási árfolyam (pl. `374.48` HUF/EUR, `328.45` HUF/USD). |
| **Maszkolt bankkártyaszám** | `enriched.cardNumber` | `string` | A kártyás vásárláshoz használt céges fizetési kártya azonosítója (pl. `4796 **** **** 5470`). |

---

### 📝 2.3 Közlemény és Tranzakciós Referenciák

| Mező elnevezése | Forrás a JSON-ben | Adattípus | Leírás és példa |
|---|---|---|---|
| **Közlemény szövege** | `remittanceInformationUnstructured` / `comment` | `string` | Az utalás vagy tranzakció szöveges leírása. Tartalmazza a hivatkozott számlaszámot (pl. `THINK-2026-42`, `OE9044/2026`, `DR-2026-333`). |
| **Banki tranzakció azonosító** | `bankTransactionId` / `transactionId` | `string` | A bank belső egyedi naplóazonosítója (pl. `20260922ALLE@I0010000481`). |
| **GIRO / Megbízás referencia** | `entryReference` | `string` | Bankközi elszámolási referencia (pl. `AZKIG31069235947`). |
| **Könyvelés dátuma** | `bookingDate` | `date (YYYY-MM-DD)` | A nap, amikor a bank a tételt lekönyvelte a számlán (pl. `2026-09-28`). |
| **Értéknap** | `valueDate` | `date (YYYY-MM-DD)` | A kamatozás és pénzügyi teljesítés tényleges értéknapja (pl. `2026-09-28`). |
| **Eredeti tranzakció időbélyeg** | `enriched.originalValueDate` | `timestamp` | Kártyás vásárlás másodperc-pontos ideje (pl. `2026-09-26T21:28:02.000Z`). |
| **Számla sorszám (Ordinal)** | `ordinalOnAccount` | `integer` | Szigorúan monoton növekvő tétel-sorszám a számlán (pl. `402`). Alapja a vízjel-alapú inkrementális szinkronizációnak. |

---

### 🏷️ 2.4 Művelettípus és Gépi Besorolás

| Mező elnevezése | Értékkészlet | Jelentés |
|---|---|---|
| **Tranzakció típus** (`transactionType`) | `WIRE_TRANSFER` | Belföldi vagy nemzetközi banki átutalás. |
| | `CARD_PURCHASE` | Céges bankkártyás vásárlás (online vagy fizikai). |
| | `POS_ATM` | Készpénzfelvét vagy fizikai bankkártya terminál. |
| | `BANK_FEE` | Banki jutalék, számlavezetési díj vagy GIRO költség. |
| | `DIRECT_DEBIT` | Rendszeres csoportos beszedési megbízás. |
| **Aggreg8 AI Kategória** (`category.name`) | `INCOME` | Árbevétel, partneri jóváírás. |
| | `EXPENSE` | Általános anyag- vagy szolgáltatási kiadás. |
| | `EXPENSE_TAX` | NAV / államkincstári adóbefizetés, járulék. |
| | `EXPENSE_BANK_CHARGES` | Pénzintézeti költségek (pl. bankközi díjak). |

---

## 3. Valós Adatpéldák (Think Ai Kft. Éles Tranzakciókból)

### 3.1 Belföldi Banki Átutalás (Kimenő Partneri Kifizetés)
```json
{
  "_id": "6aba2a821e6cb3563c16775c",
  "type": "OTHER",
  "status": "booked",
  "amount": -2701026,
  "currency": "HUF",
  "bookingDate": "2026-09-22T00:00:00.000Z",
  "valueDate": "2026-09-22T00:00:00.000Z",
  "ordinalOnAccount": 370,
  "bankTransactionId": "20260922ALLE@I0010000481",
  "payee": {
    "name": "Taxology kft.",
    "accountNumber": "HU93117130122145225100000000"
  },
  "payer": {
    "name": "THINK AI KORLÁTOLT FELELŐSSÉGŰ TÁRSASÁG",
    "accountNumber": "HU47107015207486773851100005"
  },
  "comment": "11713012-21452251-00000000 Taxology kft. 2026-43, storno szamla ellenerteke, helytelen vegosszeg miatt",
  "rawData": [
    {
      "data": {
        "creditorName": "Taxology kft.",
        "creditorAccount": {
          "bban": "117130122145225100000000"
        },
        "entryReference": "AZKIG31069235947",
        "remittanceInformationUnstructured": "11713012-21452251-00000000 Taxology kft. 2026-43, storno szamla ellenerteke, helytelen vegosszeg miatt"
      }
    }
  ],
  "enriched": {
    "partner": {
      "name": "Taxology kft.",
      "accountNumber": "HU93117130122145225100000000"
    },
    "category": {
      "name": "EXPENSE_TAX"
    },
    "transactionType": "OTHER"
  }
}
```

### 3.2 Nemzetközi Devizás Kártyás Vásárlás (Anthropic / OpenAI)
```json
{
  "_id": "6aba2a821e6cb3563c167762",
  "type": "POS_ATM",
  "amount": -12579.84,
  "currency": "HUF",
  "bookingDate": "2026-09-23T00:00:00.000Z",
  "valueDate": "2026-09-23T00:00:00.000Z",
  "ordinalOnAccount": 373,
  "bankTransactionId": "20260923CIBHABDYL0000046",
  "comment": "4796 **** **** 5470 20260921 135231 39.00 USD 39.00 USD 322.56 MANCHESTER WWW.SOURCEFUL.COM",
  "enriched": {
    "partner": {
      "name": "MANCHESTER WWW.SOURCEFUL.COM GBSCNFZ5"
    },
    "category": {
      "name": "EXPENSE"
    },
    "cardNumber": "4796 **** **** 5470",
    "originalAmount": -12579.84,
    "originalCurrency": "USD",
    "originalValueDate": "2026-09-21T13:52:31.000Z",
    "transactionType": "CARD_PURCHASE"
  }
}
```

### 3.3 Banki Jutalék / GIRO Díj
```json
{
  "_id": "6aba2a821e6cb3563c167736",
  "type": "FEE_INTEREST",
  "amount": -416.94,
  "currency": "HUF",
  "bookingDate": "2026-09-17T00:00:00.000Z",
  "valueDate": "2026-09-17T00:00:00.000Z",
  "ordinalOnAccount": 351,
  "comment": "AD-Bankközi átutalás GIRO-n HUF 416,94 CB2ADFKT1",
  "enriched": {
    "category": {
      "name": "EXPENSE_BANK_CHARGES"
    },
    "transactionType": "BANK_FEE"
  }
}
```

---

## 4. Hogyan Hasznosítja a Visibill az Adatokat?

### 4.1 Automatikus Partnertörzs Gazdagítás (1:N Bankszámlák)
1. Amikor egy partnerrel új tranzakció történik (akár bejövő, akár kimenő), a rendszer kiolvassa a partner nevét, IBAN és belföldi számlaszámát.
2. A `partner_upsert.py` és a könyvelési modul ellenőrzi a partnertörzset:
   * Ha a partner létezik, de a bankszámlaszám még nem szerepel nála, automatikusan rögzíti az új bankszámlát a partnerhez.
   * Ha a számlaszám már ismert, frissíti az utolsó aktivitás időpontját.

### 4.2 Kétlépcsős Intelligens Számlapárosítás (Two-Pass Matching)
A Python Worker (`worker/aggreg8_processor.py` $\rightarrow$ `transaction_matcher.py`):
1. **1. Fázis: Determinisztikus heurisztika (`heuristic_match`):**
   * Megvizsgálja a közlemény szövegét (`comment`).
   * Reguláris kifejezésekkel keres számlasorszám-mintákat (pl. `THINK-2026-42`, `2026-43`, `DR-2026-333`).
   * Ha egyezik a partner adószáma vagy neve, a számla bruttó összege és a banki terhelés/jóváírás, **100%-os pontossággal azonnal összepárosítja** a bizonylatot.
2. **2. Fázis: AI és tolerancia-alapú párosítás (`match_transaction`):**
   * Ha az összeg eltér (pl. kerekítés, devizaárfolyam-ingadozás vagy részfizetés miatt), az AI motor a partnernév és kontextus alapján felajánlja a legvalószínűbb számlát.
3. **Státuszfrissítés:**
   * A számla azonnal `paid = true` státuszt kap.
   * A reláció rögzül a `transaction_invoice_matches` táblában.

### 4.3 Automatikus Főkönyvi és Költséghely Kontírozás
* **Bankköltség (`BANK_FEE` / `EXPENSE_BANK_CHARGES`):**
  * T: `532` (Pénzügyi műveletek egyéb ráfordításai / Bankköltség)
  * K: `384` (Elszámolási számla)
  * Nem igényel számlapárosítást, azonnal kontírozott státuszba kerül.
* **Kártyás vásárlások (`CARD_PURCHASE`):**
  * K: `389` (Átvezetési számla) vagy `384` (Kártya letéti számla)
  * A kártyaszám (`4796 **** **** 5470`) alapján a rendszer automatikusan hozzárendeli a kártyát birtokló munkatárs költséghelyéhez.
