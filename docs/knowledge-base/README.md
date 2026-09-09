# eaisyBill & eaisyBooks Teljes Rendszer Tudásbázis (Knowledge Base)

Üdvözöljük az **eaisyBill** és **eaisyBooks** platform hivatalos szakmai és funkcionális tudástárában.
Ez a dokumentáció tartalmazza a platform összes menüpontjának, aloldalának és munkafolyamatának részletes leírását, elhelyezkedését és használati útmutatóját.

---

## 📑 Tartalomjegyzék

- [1. eaisyBill Vállalatirányítási Rendszer (29 Menüpont)](#1-eaisybill-vállalatirányítási-rendszer)
- [2. eaisyBooks Könyvelőirodai Platform (34 Menüpont)](#2-eaisybooks-könyvelőirodai-platform)
  - [2.1. Portfólió Mód (Irodai Szintű Nézet)](#21-portfólió-mód-irodai-szintű-nézet)
  - [2.2. Ügyfél Kontextus Mód (Cég Szintű Munkaterület)](#22-ügyfél-kontextus-mód-cég-szintű-munkaterület)

---

## 1. eaisyBill Vállalatirányítási Rendszer

Az eaisyBill a vállalkozások mindennapi pénzügyi, számlázási, banki, munkaügyi és operatív folyamatainak digitális platformja.

| Ssz. | Menüpont Neve | Útvonal / URL | Fájl Hivatkozás |
| :--- | :--- | :--- | :--- |
| **01** | **Irányítópult (Dashboard)** | `/:companyId/:dateRange/` | [01-dashboard.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/01-dashboard.md) |
| **02** | **Kategóriák és Számlatükör** | `/:companyId/:dateRange/categories` | [02-categories.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/02-categories.md) |
| **03** | **Projektek és Költséghelyek** | `/:companyId/:dateRange/projects` | [03-projects.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/03-projects.md) |
| **04** | **Partnertörzs és Kockázati Rangsor** | `/:companyId/:dateRange/partners` | [04-partners.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/04-partners.md) |
| **05** | **Számlák (Invoices Hub)** | `/:companyId/:dateRange/invoices/:tab?` | [05-invoices.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/05-invoices.md) |
| **06** | **Kintlévőségek és Dunning Felszólítások** | `/:companyId/:dateRange/kintlevo/:tab?` | [06-kintlevo.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/06-kintlevo.md) |
| **07** | **Banki Tranzakciók és Párosítás** | `/:companyId/:dateRange/transactions/:tab?` | [07-transactions.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/07-transactions.md) |
| **08** | **Házipénztár (Petty Cash)** | `/:companyId/:dateRange/petty-cash/:tab?` | [08-petty-cash.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/08-petty-cash.md) |
| **09** | **Szállítói Átutalások (Transfers)** | `/:companyId/:dateRange/transfers` | [09-transfers.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/09-transfers.md) |
| **10** | **Főkönyvi Kivonat és Kartonok** | `/:companyId/:dateRange/general-ledger/:tab?` | [10-general-ledger.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/10-general-ledger.md) |
| **11** | **Eredménykimutatás (Profit & Loss)** | `/:companyId/:dateRange/profit-and-loss/:tab?` | [11-profit-and-loss.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/11-profit-and-loss.md) |
| **12** | **Mérlegkimutatás (Balance Sheet)** | `/:companyId/:dateRange/balance-sheet/:tab?` | [12-balance-sheet.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/12-balance-sheet.md) |
| **13** | **Éves Beszámoló Varázsló** | `/:companyId/:dateRange/annual-report` | [13-annual-report.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/13-annual-report.md) |
| **14** | **ÁFA Bevallás (2665 Modul)** | `/:companyId/:dateRange/vat-return/:tab?` | [14-vat-return.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/14-vat-return.md) |
| **15** | **Zárt Könyvviteli Naplók (Journals)** | `/:companyId/:dateRange/journals` | [15-journals.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/15-journals.md) |
| **16** | **Bérek és Járulékok (Salaries)** | `/:companyId/:dateRange/salaries/:tab?` | [16-salaries.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/16-salaries.md) |
| **17** | **Munkaidő és Jelenléti Ív** | `/:companyId/:dateRange/working-time/:tab?` | [17-working-time.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/17-working-time.md) |
| **18** | **Tárgyi Eszköz Nyilvántartás (TE-NY)** | `/:companyId/:dateRange/teny/:tab?` | [18-teny.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/18-teny.md) |
| **19** | **Fuvarok és CMR Megbízások** | `/:companyId/:dateRange/shipments` | [19-shipments.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/19-shipments.md) |
| **20** | **Fuvar Import (Excel/CSV)** | `/:companyId/:dateRange/shipment-import` | [20-shipment-import.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/20-shipment-import.md) |
| **21** | **Fuvar Eszkaláció és Eltérések** | `/:companyId/:dateRange/shipment-escalation` | [21-shipment-escalation.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/21-shipment-escalation.md) |
| **22** | **Integrációk (NAV, Számlázz.hu, Relax)** | `/:companyId/:dateRange/integrations` | [22-integrations.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/22-integrations.md) |
| **23** | **Árfolyamok (MNB és Devizaváltó)** | `/:companyId/:dateRange/exchange-rates` | [23-exchange-rates.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/23-exchange-rates.md) |
| **24** | **Cégjegyzetek (Notes)** | `/:companyId/:dateRange/notes` | [24-notes.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/24-notes.md) |
| **25** | **Pénzügyi Analitika (Analytics)** | `/:companyId/:dateRange/analytics/:tab?` | [25-analytics.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/25-analytics.md) |
| **26** | **Bizonylat Feltöltés (Manual Upload)** | `/:companyId/:dateRange/upload/:tab?` | [26-upload.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/26-upload.md) |
| **27** | **Beállítások (Cégprofil, Bank, Tagok)** | `/:companyId/:dateRange/settings/:tab?` | [27-settings.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/27-settings.md) |
| **28** | **Tudástár (Knowledge Base)** | `/:companyId/:dateRange/knowledge-base/:articleId?` | [28-knowledge-base.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/28-knowledge-base.md) |
| **29** | **Hibajegyek és Támogatás (Tickets)** | `/:companyId/:dateRange/tickets/:ticketId?` | [29-tickets.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybill/29-tickets.md) |

---

## 2. eaisyBooks Könyvelőirodai Platform

Az eaisyBooks a könyvelőirodák, adótanácsadók és bérszámfejtők professzionális csoportmunka- és vezérlőplatformja.

### 2.1. Portfólió Mód (Irodai Szintű Nézet)

Amikor a könyvelő a teljes irodai ügyfélkört tekinti át (`/eaisybooks/*`):

| Ssz. | Menüpont Neve | Útvonal / URL | Fájl Hivatkozás |
| :--- | :--- | :--- | :--- |
| **01** | **Ügyfélportfólió és KPI Műszerfal** | `/eaisybooks` | [01-portfolio.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/01-portfolio.md) |
| **02** | **Hiányzó Számlák Központi Hub** | `/eaisybooks/missing-invoices` | [02-missing-invoices-hub.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/02-missing-invoices-hub.md) |
| **03** | **Adónaptár és Törvényi Határidők** | `/eaisybooks/tax-calendar` | [03-tax-calendar.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/03-tax-calendar.md) |
| **04** | **Riportok és AI Anomáliák** | `/eaisybooks/reports` | [04-reports-and-anomalies.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/04-reports-and-anomalies.md) |
| **05** | **Jóváhagyó Rendszer (Approval Queue)** | `/eaisybooks/approval-queue` | [05-approval-queue.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/05-approval-queue.md) |
| **06** | **Riasztások Központ és NAV Határidők** | `/eaisybooks/alerts` | [06-alerts-center.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/06-alerts-center.md) |
| **07** | **Ügyfél Onboarding & Új Ügyfél Varázsló** | `/eaisybooks/onboarding` & `/eaisybooks/new-client` | [07-onboarding-and-new-client.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/07-onboarding-and-new-client.md) |
| **08** | **eaisyBooks AI Asszisztens** | `/eaisybooks/ai-assistant` | [08-ai-assistant.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/08-ai-assistant.md) |
| **09** | **Irodai Beállítások (Office Settings)** | `/eaisybooks/settings` & `/admin/office-settings` | [09-office-settings.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/09-office-settings.md) |
| **10** | **Könyvelői Profilbeállítások** | `/eaisybooks/profile/settings` | [10-profile-settings.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/10-profile-settings.md) |
| **11** | **Jogosultságkezelő Mátrix** | `/eaisybooks/admin/permissions` | [11-permission-matrix.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/11-permission-matrix.md) |
| **12** | **Könyvelők és Munkatársak Kezelése** | `/eaisybooks/admin/accountants` | [12-accountant-management.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/12-accountant-management.md) |
| **13** | **Szakmai Sablonok és Iratminták** | `/eaisybooks/admin/templates` | [13-templates.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/13-templates.md) |
| **14** | **Jogviszonykódok és FEOR Törzs** | `/eaisybooks/admin/job-codes` | [14-job-codes.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/14-job-codes.md) |
| **15** | **Adómértékek és Jogszabályi Paraméterek** | `/eaisybooks/admin/tax-parameters` | [15-tax-parameters.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/15-tax-parameters.md) |
| **16** | **Jogszabály-frissítések és Változások** | `/eaisybooks/admin/legal-updates` | [16-legal-updates.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/16-legal-updates.md) |
| **17** | **Audit Napló és Biztonsági Naplózás** | `/eaisybooks/admin/audit` | [17-audit-log.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/17-audit-log.md) |
| **18** | **GDPR és Adatvédelem** | `/eaisybooks/admin/gdpr` | [18-gdpr.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/18-gdpr.md) |
| **19** | **Könyvelői Hibajegyek (Tickets)** | `/eaisybooks/tickets/:ticketId?` | [19-tickets.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/19-tickets.md) |
| **20** | **Segítség és Adatvédelmi Irányelvek** | `/eaisybooks/help` & `/privacy-policy` | [20-help.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/20-help.md) |

---

### 2.2. Ügyfél Kontextus Mód (Cég Szintű Munkaterület)

Amikor a könyvelő belép egy konkrét cég könyvelési környezetébe (`/eaisybooks/:companyId/:dateRange/*`):

| Ssz. | Menüpont Neve | Útvonal / URL | Fájl Hivatkozás |
| :--- | :--- | :--- | :--- |
| **21** | **Ügyfél Áttekintés és Műszerfal** | `.../:dateRange/overview` | [21-client-overview.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/21-client-overview.md) |
| **22** | **Ügyfél Profil és Törzsadatok** | `.../:dateRange/profile` | [22-client-profile.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/22-client-profile.md) |
| **23** | **Ügyfél Számlák és Bizonylatok** | `.../:dateRange/invoices` | [23-client-invoices.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/23-client-invoices.md) |
| **24** | **Ügyfél Hiányzó Számlák Kezelése** | `.../:dateRange/missing-invoices` | [24-client-missing-invoices.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/24-client-missing-invoices.md) |
| **25** | **Egyéni Vállalkozás és Pénztárkönyv** | `.../:dateRange/ev/*` | [25-client-ev.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/25-client-ev.md) |
| **26** | **Társasági Adó, KIVA és Zárás** | `.../:dateRange/tao/*` | [26-client-tao.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/26-client-tao.md) |
| **27** | **Ügyfél Bérszámfejtési Központ** | `.../:dateRange/payroll/*` | [27-client-payroll.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/27-client-payroll.md) |
| **28** | **NAV Bérbevallások és 08-as Modul** | `.../:dateRange/payroll/filings/*` | [28-client-payroll-filings.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/28-client-payroll-filings.md) |
| **29** | **Könyvelési Szabályok és AI Promptok** | `.../:dateRange/prompts` | [29-client-prompts.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/29-client-prompts.md) |
| **30** | **Cégkapu Beállítások és Integráció** | `.../:dateRange/cegkapu` | [30-client-cegkapu.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/30-client-cegkapu.md) |
| **31** | **Képviselet és Meghatalmazások** | `.../:dateRange/representation` | [31-client-representation.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/31-client-representation.md) |
| **32** | **Adatmegőrzés és Archiválás** | `.../:dateRange/data-retention` | [32-client-data-retention.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/32-client-data-retention.md) |
| **33** | **Cégstruktúra és Tulajdonosi Lánc** | `.../:dateRange/structure` | [33-client-structure.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/33-client-structure.md) |
| **34** | **Ügyfél Egyedi Beállítások** | `.../:dateRange/settings` | [34-client-settings.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/knowledge-base/eaisybooks/34-client-settings.md) |
