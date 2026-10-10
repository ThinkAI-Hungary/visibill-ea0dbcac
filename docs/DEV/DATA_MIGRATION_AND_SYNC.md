# Adatmigráció és Napi Szinkronizáció (Data Migration & Daily Sync)

Ez a dokumentum a VisiBill fejlesztői adatbázisába átemelt adatok körét, a verifikált auditot és a napi automatikus szinkronizációt rögzíti.

---

## 🏢 1. Az Átemelt Cégek

A fejlesztési és tesztelési célokra a termelési adatbázisból 3 kiemelt cég és teljes adathalmaza került átemelésre:

| Cég Név | Cég UUID | Adószám | Megjegyzés |
| :--- | :--- | :--- | :--- |
| **Think Ai Kft** | `541c8fcb-c121-4f93-b6d4-8dbb263300aa` | `32551460-2-41` | Elsődleges fejlesztési és adminisztrátori cég |
| **Teszt Kft** | `c9851f50-0a25-4c07-ba71-6c2e71d34c11` | `11111111-1-11` | Funkcionális tesztcég nagy naplótételszámmal |
| **Taxology Kft.** | `972ee7fa-6dfc-4cb0-a50e-a89faef5e236` | `32142279-2-41` | Éles könyvelési és számla-adatbázis tesztek |

---

## 📊 2. Átemelt Adattáblák és Integritási Audit

Az adatok átemelése ideiglenes replica módban (`session_replication_role = 'replica'`) történt, garantálva az idegen kulcsok (Foreign Keys) és UUID-k pontos megőrzését a következő 13 kulcstáblában:

1. `companies` (Cégadatok)
2. `company_memberships` (Cégtagságok és szerepkörök)
3. `partners` (Partnertörzs)
4. `invoices` (Számlafejlécek)
5. `invoice_items` (Számlatételek)
6. `invoice_uploads` (Számla dokumentumcsatolmányok)
7. `bank_transactions` (Banki tranzakciók)
8. `bank_statement_uploads` (Bankkivonat fájlok)
9. `chart_of_accounts` / `general_ledger_accounts` (Számlatükör és főkönyvi számlák)
10. `journals` (Könyvelési naplók)
11. `journal_entries` (Naplófejlécek)
12. `journal_lines` (Könyvelési tételek / sorok)
13. `custom_matching_rules` (Egyedi párosítási szabályok)

### 🔍 Fizikailag Ellenőrzött Audit Eredmény (Prod vs Dev)

A [scratch/audit_company_data_prod_vs_dev.mjs](file:///d:/ThinkAI/Visibill/eaisybill-prod/scratch/audit_company_data_prod_vs_dev.mjs) szkripttel elvégzett összehasonlító ellenőrzés szerint a 3 cég adatai **100%-ban, darabra pontosan megegyeznek az éles adatbázissal**:

| Entitás / Tábla | Think Ai Kft | Teszt Kft | Taxology Kft. | Státusz |
| :--- | :---: | :---: | :---: | :---: |
| **Számlák (`invoices`)** | 523 / 523 | 95 / 95 | 416 / 416 | **100% Egyezés ✓** |
| **NAV Számlák (`nav_invoices`)** | 264 / 264 | 531 / 531 | 520 / 520 | **100% Egyezés ✓** |
| **Számlatételek (`invoice_items`)** | 514 / 514 | 1 103 / 1 103 | 1 006 / 1 006 | **100% Egyezés ✓** |
| **Feltöltések (`invoice_uploads`)** | 1 067 / 1 067 | 136 / 136 | 436 / 436 | **100% Egyezés ✓** |
| **Banki Tranzakciók (`bank_transactions`)** | 1 037 / 1 037 | 239 / 239 | 567 / 567 | **100% Egyezés ✓** |
| **Könyvelési Tételsorok (`journal_lines`)** | 2 362 / 2 362 | 2 021 / 2 021 | 2 369 / 2 369 | **100% Egyezés ✓** |

---

## ⏰ 3. Napi 06:00-s Automatikus Szinkronizáció (Cron Job)

A felhasználói elvárásnak megfelelően a `Taxology Kft.` és a `Think Ai Kft` friss tranzakciói és számlái minden nap reggel **06:00-kor (Budapest idő)** átszinkronizálódnak az éles rendszerről a dev környezetbe.

* **Futtató szerver:** DigitalOcean droplet (`64.226.83.137`)
* **Szkript:** `/home/jani/dev-cron/sync_daily_prod_to_dev.mjs`
* **Indító wrapper:** `/home/jani/dev-cron/run_sync.sh`
* **Naplófájl:** `/home/jani/dev-cron/sync.log`
* **Crontab bejegyzés:**
  ```bash
  CRON_TZ=Europe/Budapest
  0 6 * * * /home/jani/dev-cron/run_sync.sh
  ```
* **Működési mechanizmus:**
  1. A szkript az IPv4 tranzakciós pooleren (`aws-0-eu-west-1.pooler.supabase.com:5432`) keresztül csatlakozik mindkét adatbázishoz.
  2. Lekéri az elmúlt 48 órában módosult vagy létrehozott számlákat, tételeket, tranzakciókat és naplósorokat a két megadott cégre.
  3. `ON CONFLICT DO UPDATE` logikával frissíti vagy beszúrja az új rekordokat a Dev adatbázisba.

---

## 🛑 4. Háttérszinkronok és Integrációk Védelme a Dev-en

1. **Hajnali NAV Szinkronok Tiltása:**
   * A Dev adatbázisban a NAV automatikus hajnali szinkronja inaktív: nincs berögzítve érvényes technikai felhasználó token vagy ütemezett `pg_cron` NAV feladat a dev környezetben.
2. **Aggreg8 (A8) Háttérszinkron Tiltása:**
   * Az `aggreg8_settings` tábla a dev adatbázisban teljesen üres.
   * A forráskód és az API végpontok érintetlenek maradtak, de a rendszer nem kezdeményez és nem dolgoz fel banki A8 háttérszinkront a dev felületen – a friss banki adatokat a reggeli 06:00-s szinkron job biztosítja.
