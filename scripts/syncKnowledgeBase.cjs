const fs = require('fs');
const path = require('path');
const https = require('https');

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || '';

const ROOT_DIR = path.resolve(__dirname, '..');
const EAISYBILL_DIR = path.join(ROOT_DIR, 'docs', 'knowledge-base', 'eaisybill');
const EAISYBOOKS_DIR = path.join(ROOT_DIR, 'docs', 'knowledge-base', 'eaisybooks');
const FALLBACK_FILE = path.join(ROOT_DIR, 'src', 'data', 'knowledgeBaseFallback.ts');

// Mapping for eaisyBill articles
const EAISYBILL_MAP = {
  '01-dashboard.md': { id: 'eaisybill-dashboard', category_id: 'basics', title: 'Irányítópult (Dashboard) és Pénzügyi KPI-k', menu_path: '/', icon: 'LayoutDashboard', tags: ['irányítópult', 'dashboard', 'áttekintés', 'vezérlőpult', 'kpi', 'pénzügyi mutatók', 'bevétel', 'kiadás', 'eredmény'], order_num: 1 },
  '02-categories.md': { id: 'eaisybill-categories', category_id: 'accounting', title: 'Kategóriák és Számlatükör Menedzsment', menu_path: '/categories', icon: 'Folders', tags: ['kategóriák', 'számlatükör', 'főkönyvi számok', 'kontírozási kategóriák', 'bevételi kategória', 'költség kategória'], order_num: 1 },
  '03-projects.md': { id: 'eaisybill-projects', category_id: 'basics', title: 'Projektek és Költséghelyek', menu_path: '/projects', icon: 'Briefcase', tags: ['projektek', 'költséghelyek', 'projektfedezet', 'jövedelmezőség', 'projekt költségvetés', 'mérföldkövek'], order_num: 2 },
  '04-partners.md': { id: 'eaisybill-partners', category_id: 'basics', title: 'Partnertörzs és Ügyfélkezelés', menu_path: '/partners', icon: 'Users', tags: ['partnerek', 'ügyfelek', 'vevők', 'szállítók', 'adószám lekérdezés', 'partner minősítés', 'partnerlista'], order_num: 3 },
  '05-invoices.md': { id: 'eaisybill-invoices', category_id: 'invoices', title: 'Számlakezelés és Bizonylatok Áttekintése', menu_path: '/invoices', icon: 'Receipt', tags: ['számlák', 'bizonylatok', 'kimenő számla', 'bejövő számla', 'fizetési státusz', 'teljesítés dátuma', 'számlaszűrés'], order_num: 1 },
  '06-kintlevo.md': { id: 'eaisybill-receivables', category_id: 'invoices', title: 'Kintlévőségek és Követeléskezelés', menu_path: '/kintlevo', icon: 'Clock', tags: ['kintlévőség', 'követelés', 'fizetési felszólítás', 'késedelmes számlák', 'korosítás', 'partner egyenleg'], order_num: 2 },
  '07-transactions.md': { id: 'eaisybill-transactions', category_id: 'transactions', title: 'Banki Tranzakciók és Intelligens Párosítás', menu_path: '/transactions', icon: 'ArrowLeftRight', tags: ['bank', 'bankszámla', 'tranzakciók', 'párosítás', 'kivonat import', 'egyenleg', 'számlapárosítás'], order_num: 1 },
  '08-petty-cash.md': { id: 'eaisybill-petty-cash', category_id: 'transactions', title: 'Házipénztár és Készpénzmozgások', menu_path: '/petty-cash', icon: 'Coins', tags: ['házipénztár', 'készpénz', 'bevételi pénztárbizonylat', 'kiadási pénztárbizonylat', 'címletjegyzék', 'pénztárzárás'], order_num: 2 },
  '09-transfers.md': { id: 'eaisybill-transfers', category_id: 'transactions', title: 'Átutalási Csomagok és Banki Export', menu_path: '/transfers', icon: 'Send', tags: ['utalás', 'banki átutalás', 'h批量 import', 'electra', 'sepa', 'utalási csomag'], order_num: 3 },
  '10-general-ledger.md': { id: 'eaisybill-general-ledger', category_id: 'accounting', title: 'Főkönyvi Kivonat és Kartonok', menu_path: '/general-ledger', icon: 'BookOpen', tags: ['főkönyv', 'főkönyvi kivonat', 'számlakarton', 'tartozik', 'követel', 'egyenleg'], order_num: 2 },
  '11-profit-and-loss.md': { id: 'eaisybill-profit-and-loss', category_id: 'accounting', title: 'Eredménykimutatás és Üzleti Riportok', menu_path: '/profit-and-loss', icon: 'TrendingUp', tags: ['eredménykimutatás', 'árbevétel', 'ebitda', 'üzemi eredmény', 'költségek', 'nyereség'], order_num: 3 },
  '12-balance-sheet.md': { id: 'eaisybill-balance-sheet', category_id: 'accounting', title: 'Mérleg és Vagyoni Helyzet Kimutatás', menu_path: '/balance-sheet', icon: 'Scale', tags: ['mérleg', 'eszközök', 'források', 'saját tőke', 'kötelezettségek', 'vagyoni helyzet'], order_num: 4 },
  '13-annual-report.md': { id: 'eaisybill-annual-report', category_id: 'accounting', title: 'Éves Beszámoló és Zárási Csomag', menu_path: '/annual-report', icon: 'FileSpreadsheet', tags: ['éves beszámoló', 'évzárás', 'kiegészítő melléklet', 'adózott eredmény', 'mérlegkészítés'], order_num: 5 },
  '14-vat-return.md': { id: 'eaisybill-vat-return', category_id: 'accounting', title: 'ÁFA Analitika és Havi Bevallás Előkészítés', menu_path: '/vat-return', icon: 'Percent', tags: ['áfa', 'áfa analitika', 'fizetendő áfa', 'levonható áfa', 'm65 bevallás', 'áfa göngyölés'], order_num: 6 },
  '15-journals.md': { id: 'eaisybill-journals', category_id: 'accounting', title: 'Könyvelési Naplók és Vegyes Bizonylatok', menu_path: '/journals', icon: 'BookMarked', tags: ['naplók', 'vegyes könyvelés', 'naplótételek', 'kontírozás', 'helyesbítés'], order_num: 7 },
  '16-salaries.md': { id: 'eaisybill-salaries', category_id: 'hr', title: 'Bérszámfejtési Adatok és Munkavállalók', menu_path: '/salaries', icon: 'UserCheck', tags: ['bér', 'bérszámfejtés', 'bruttó bér', 'nettó bér', 'járulékok', 'szja', 'szocho', 'munkavállaló'], order_num: 1 },
  '17-working-time.md': { id: 'eaisybill-working-time', category_id: 'hr', title: 'Munkaidő Nyilvántartás és Jelenléti Ív', menu_path: '/working-time', icon: 'CalendarDays', tags: ['munkaidő', 'jelenléti ív', 'szabadság', 'táppénz', 'túlóra', 'ledolgozott órák'], order_num: 2 },
  '18-teny.md': { id: 'eaisybill-teny', category_id: 'accounting', title: 'Tény Számviteli Zárások és Audit Napló', menu_path: '/teny', icon: 'ShieldAlert', tags: ['tény', 'számviteli zárás', 'audit napló', 'változáskövetés', 'archiválás'], order_num: 8 },
  '19-shipments.md': { id: 'eaisybill-shipments', category_id: 'shipments', title: 'Fuvarlevelek és CMR Megbízások Menedzsmentje', menu_path: '/shipments', icon: 'Truck', tags: ['fuvarlevél', 'cmr', 'fuvarozás', 'szállítmányozás', 'fuvar számla'], order_num: 1 },
  '20-shipment-import.md': { id: 'eaisybill-shipment-import', category_id: 'shipments', title: 'Fuvar Excel Import és Párosítási Motor', menu_path: '/shipments/import', icon: 'FileUp', tags: ['fuvar import', 'excel import', 'párosítás', 'speditőr', 'tömeges rögzítés'], order_num: 2 },
  '21-shipment-escalation.md': { id: 'eaisybill-shipment-escalation', category_id: 'shipments', title: 'Fuvar Eltérések és Eszkalációkezelés', menu_path: '/shipments/escalated', icon: 'AlertTriangle', tags: ['fuvar eltérés', 'eszkaláció', 'reklamáció', 'jóváhagyás', 'árkülönbözet'], order_num: 3 },
  '22-integrations.md': { id: 'eaisybill-integrations', category_id: 'system', title: 'Külső Integrációk és API Kapcsolatok', menu_path: '/integrations', icon: 'Cpu', tags: ['integrációk', 'api', 'nav online számla', 'billingo', 'számlázz.hu', 'banki api'], order_num: 1 },
  '23-exchange-rates.md': { id: 'eaisybill-exchange-rates', category_id: 'system', title: 'MNB és EKB Árfolyamkezelés', menu_path: '/exchange-rates', icon: 'TrendingUp', tags: ['árfolyam', 'mnb', 'valuta', 'deviza', 'eur', 'usd', 'árfolyamnyereség'], order_num: 2 },
  '24-notes.md': { id: 'eaisybill-notes', category_id: 'system', title: 'Jegyzetek és Pénzügyi Feljegyzések', menu_path: '/notes', icon: 'StickyNote', tags: ['jegyzetek', 'emlékeztető', 'feljegyzés', 'belső megjegyzés', 'teendők'], order_num: 3 },
  '25-analytics.md': { id: 'eaisybill-analytics', category_id: 'system', title: 'Pénzügyi Elemzések és Üzleti Intelligencia', menu_path: '/analytics', icon: 'LineChart', tags: ['elemzések', 'analitika', 'diagramok', 'trendek', 'költségelemzés', 'cash flow előrejelzés'], order_num: 4 },
  '26-upload.md': { id: 'eaisybill-upload', category_id: 'invoices', title: 'Bizonylat Feltöltés és OCR Dokumentumfeldolgozás', menu_path: '/upload', icon: 'UploadCloud', tags: ['feltöltés', 'ocr', 'számlafeldolgozás', 'ai adatkinyerés', 'dokumentumkezelés'], order_num: 3 },
  '27-settings.md': { id: 'eaisybill-settings', category_id: 'system', title: 'Cégprofil és Rendszerbeállítások', menu_path: '/settings', icon: 'Settings', tags: ['beállítások', 'cégprofil', 'adószám', 'székhely', 'értesítések', 'jogosultságok'], order_num: 5 },
  '28-knowledge-base.md': { id: 'eaisybill-help', category_id: 'system', title: 'Tudástár és Súgóközpont', menu_path: '/knowledge-base', icon: 'HelpCircle', tags: ['tudástár', 'súgó', 'kézikönyv', 'útmutatók', 'keresés', 'rag'], order_num: 6 },
  '29-tickets.md': { id: 'eaisybill-tickets', category_id: 'basics', title: 'Hibajegyek és Ügyfélszolgálati Támogatás', menu_path: '/tickets', icon: 'LifeBuoy', tags: ['hibajegy', 'support', 'ügyfélszolgálat', 'problémabejelentés', 'fejlesztési kérés'], order_num: 4 },
};

// Mapping for eaisyBooks articles
const EAISYBOOKS_MAP = {
  '01-portfolio.md': { id: 'books-portfolio-overview', category_id: 'books_portfolio', title: 'Könyvelőirodai Portfólió Műszerfal', menu_path: '/eaisybooks', icon: 'Briefcase', tags: ['portfólió', 'ügyfelek', 'könyvelőiroda', 'határidők', 'hiányzó bizonylatok'], order_num: 1 },
  '02-missing-invoices-hub.md': { id: 'books-missing-invoices-hub', category_id: 'books_portfolio', title: 'Központi Hiányzó Számlák Menedzsmentje', menu_path: '/eaisybooks/missing-invoices', icon: 'AlertCircle', tags: ['hiányzó számlák', 'nav eltérés', 'felszólítás', 'bizonylatpótlás'], order_num: 2 },
  '03-tax-calendar.md': { id: 'books-tax-calendar', category_id: 'books_portfolio', title: 'Irodai Adónaptár és Határidő Menedzser', menu_path: '/eaisybooks/tax-calendar', icon: 'Calendar', tags: ['adónaptár', 'határidő', 'bevallási határidő', 'áfa határidő'], order_num: 3 },
  '04-reports-and-anomalies.md': { id: 'books-reports-and-anomalies', category_id: 'books_portfolio', title: 'Portfólió Riportok és Számviteli Anomáliák', menu_path: '/eaisybooks/reports', icon: 'Activity', tags: ['riportok', 'anomáliák', 'hibakeresés', 'audit ellenőrzés'], order_num: 4 },
  '05-approval-queue.md': { id: 'books-approval-queue', category_id: 'books_portfolio', title: 'Vezetői Jóváhagyási Sor és Bizonylat Verifikáció', menu_path: '/eaisybooks/approval-queue', icon: 'CheckSquare', tags: ['jóváhagyás', 'kontírozás ellenőrzés', 'munkafolyamat', 'jóváhagyási sor'], order_num: 5 },
  '06-alerts-center.md': { id: 'books-alerts-center', category_id: 'books_portfolio', title: 'Irodai Értesítési és Riasztási Központ', menu_path: '/eaisybooks/alerts', icon: 'Bell', tags: ['riasztások', 'értesítések', 'figyelmeztetések', 'kritikus események'], order_num: 6 },
  '07-onboarding-and-new-client.md': { id: 'books-onboarding', category_id: 'books_portfolio', title: 'Ügyfél Onboarding és Új Ügyfél Varázsló', menu_path: '/eaisybooks/onboarding', icon: 'UserPlus', tags: ['onboarding', 'új ügyfél', 'irodai beállítás', 'cég felvétel'], order_num: 7 },
  '08-ai-assistant.md': { id: 'books-ai-assistant', category_id: 'books_portfolio', title: 'eaisyBooks AI Szakmai Asszisztens', menu_path: '/eaisybooks/ai-assistant', icon: 'Bot', tags: ['ai asszisztens', 'szakmai segítség', 'számviteli kérdések', 'promptok'], order_num: 8 },
  '09-office-settings.md': { id: 'books-office-settings', category_id: 'books_admin', title: 'Könyvelőiroda Törzsadatok és Fiókbeállítások', menu_path: '/eaisybooks/admin/office', icon: 'Building2', tags: ['iroda beállítások', 'törzsadatok', 'iroda profil', 'számlázási adatok'], order_num: 1 },
  '10-profile-settings.md': { id: 'books-profile-settings', category_id: 'books_admin', title: 'Személyes Könyvelői Profil és Értesítések', menu_path: '/eaisybooks/settings', icon: 'UserCog', tags: ['profil', 'értesítések', 'jelszó', 'biztonság', 'felhasználói beállítások'], order_num: 2 },
  '11-permission-matrix.md': { id: 'books-permission-matrix', category_id: 'books_admin', title: 'Irodai Jogosultsági Mátrix és Szerepkörök', menu_path: '/eaisybooks/admin/permissions', icon: 'Shield', tags: ['jogosultság', 'szerepkörök', 'hozzáférés', 'adminisztrátor', 'könyvelő'], order_num: 3 },
  '12-accountant-management.md': { id: 'books-accountant-management', category_id: 'books_admin', title: 'Munkatársak és Könyvelők Menedzsmentje', menu_path: '/eaisybooks/admin/accountants', icon: 'Users2', tags: ['munkatársak', 'könyvelők', 'ügyfél hozzárendelés', 'irodai kapacitás'], order_num: 4 },
  '13-templates.md': { id: 'books-templates', category_id: 'books_admin', title: 'Számviteli Sablonok és Kontírozási Minták', menu_path: '/eaisybooks/admin/templates', icon: 'FileText', tags: ['sablonok', 'kontírozási sablon', 'számlatükör minta', 'könyvelési szabályok'], order_num: 5 },
  '14-job-codes.md': { id: 'books-job-codes', category_id: 'books_admin', title: 'FEOR Munkaköri Kódok és Jogcímek', menu_path: '/eaisybooks/admin/job-codes', icon: 'FileCode', tags: ['feor', 'munkaköri kódok', 'foglalkozás', 'bérszámfejtési kódok'], order_num: 6 },
  '15-tax-parameters.md': { id: 'books-tax-parameters', category_id: 'books_admin', title: 'Törvényi Adókulcsok és Számviteli Paraméterek', menu_path: '/eaisybooks/admin/tax-parameters', icon: 'Percent', tags: ['adókulcsok', 'minimálbér', 'szocho mérték', 'adómentes keretek'], order_num: 7 },
  '16-legal-updates.md': { id: 'books-legal-updates', category_id: 'books_admin', title: 'Jogszabálykövetés és Számviteli Hírek', menu_path: '/eaisybooks/admin/legal-updates', icon: 'Newspaper', tags: ['jogszabályok', 'adójogszabályok', 'nav közlemények', 'számviteli változások'], order_num: 8 },
  '17-audit-log.md': { id: 'books-audit-log', category_id: 'books_admin', title: 'Irodai Rendszernapló és Műveleti Audit', menu_path: '/eaisybooks/admin/audit', icon: 'FileSpreadsheet', tags: ['audit napló', 'rendszernapló', 'műveleti előzmények', 'ki csinálta'], order_num: 9 },
  '18-gdpr.md': { id: 'books-gdpr', category_id: 'books_admin', title: 'Adatvédelem és GDPR Megfelelőségi Központ', menu_path: '/eaisybooks/admin/gdpr', icon: 'Lock', tags: ['gdpr', 'adatvédelem', 'hozzájárulások', 'adatmegőrzési idő'], order_num: 10 },
  '19-tickets.md': { id: 'books-tickets', category_id: 'books_admin', title: 'Irodai Ügyfélszolgálat és Hibajegyek', menu_path: '/eaisybooks/tickets', icon: 'LifeBuoy', tags: ['ügyfélszolgálat', 'hibajegy', 'support', 'technikai támogatás'], order_num: 11 },
  '20-help.md': { id: 'books-help', category_id: 'books_admin', title: 'eaisyBooks Szakmai Súgó és Dokumentáció', menu_path: '/eaisybooks/help', icon: 'HelpCircle', tags: ['szakmai súgó', 'kézikönyv', 'videó útmutatók', 'gyik'], order_num: 12 },
  '21-client-overview.md': { id: 'books-client-overview', category_id: 'books_modules', title: 'Ügyfél Munkamenet Áttekintő Műszerfal', menu_path: '/eaisybooks/client/overview', icon: 'LayoutDashboard', tags: ['ügyfél műszerfal', 'havi zárási státusz', 'nyitott feladatok', 'ügyfél kpi'], order_num: 1 },
  '22-client-profile.md': { id: 'books-client-profile', category_id: 'books_modules', title: 'Ügyfél Törzsadatok és Adózási Beállítások', menu_path: '/eaisybooks/client/profile', icon: 'FileText', tags: ['ügyfél törzsadat', 'adózási forma', 'kft', 'bt', 'ev', 'áfakód'], order_num: 2 },
  '23-client-invoices.md': { id: 'books-client-invoices', category_id: 'books_modules', title: 'Ügyfél Számlaállomány és Bizonylatfeldolgozás', menu_path: '/eaisybooks/client/invoices', icon: 'Receipt', tags: ['ügyfél számlák', 'bejövő számlák', 'kimenő számlák', 'kontírozás'], order_num: 3 },
  '24-client-missing-invoices.md': { id: 'books-client-missing-invoices', category_id: 'books_modules', title: 'Ügyfél NAV Eltérések és Hiánypótlás', menu_path: '/eaisybooks/client/missing-invoices', icon: 'AlertTriangle', tags: ['hiányzó bizonylat', 'nav online számla', 'eltérés', 'hiánypótlás kérése'], order_num: 4 },
  '25-client-ev.md': { id: 'books-client-ev', category_id: 'books_modules', title: 'Egyéni Vállalkozói (EV) Könyvvezetés', menu_path: '/eaisybooks/client/ev', icon: 'UserCheck', tags: ['egyéni vállalkozó', 'ev', 'átalányadó', 'költségelszámolás', 'kamarai tagdíj'], order_num: 5 },
  '26-client-tao.md': { id: 'books-client-tao', category_id: 'books_modules', title: 'Társasági Adó (TAO) és KIVA Modul', menu_path: '/eaisybooks/client/tao', icon: 'Calculator', tags: ['tao', 'társasági adó', 'kiva', 'adóalap korrekció', 'éves társasági adó'], order_num: 6 },
  '27-client-payroll.md': { id: 'books-client-payroll', category_id: 'books_modules', title: 'Ügyfél Bérszámfejtés és Dolgozói Analitika', menu_path: '/eaisybooks/client/payroll', icon: 'Users', tags: ['bérszámfejtés', 'bérlapok', 'szja', 'szocho', 'járulékok', 'bérköltség'], order_num: 7 },
  '28-client-payroll-filings.md': { id: 'books-client-payroll-filings', category_id: 'books_modules', title: 'Havi Bérbevallások és ÁNYK Generálás', menu_path: '/eaisybooks/client/payroll-filings', icon: 'FileSpreadsheet', tags: ['08-as bevallás', 'mányk', 'nav xml', 'bérbevallás', 'határidő'], order_num: 8 },
  '29-client-prompts.md': { id: 'books-client-prompts', category_id: 'books_modules', title: 'Ügyfélspecifikus AI Promptok és Szabályok', menu_path: '/eaisybooks/client/prompts', icon: 'Cpu', tags: ['ai promptok', 'egyedi szabályok', 'kontírozási logika', 'automatizálás'], order_num: 9 },
  '30-client-cegkapu.md': { id: 'books-client-cegkapu', category_id: 'books_modules', title: 'Cégkapu Integráció és Hivatalos Üzenetek', menu_path: '/eaisybooks/client/cegkapu', icon: 'Inbox', tags: ['cégkapu', 'hivatali tárhely', 'nav levelek', 'üzenetek letöltése'], order_num: 10 },
  '31-client-representation.md': { id: 'books-client-representation', category_id: 'books_modules', title: 'Képviselet és NAV-meghatalmazások (UJEGYKE Varázsló)', menu_path: '/eaisybooks/:companyId/:dateRange/representation', icon: 'Shield', tags: ['ujegyke', 'képviselet', 'meghatalmazás', 'nav meghatalmazás', 'air 17', 'állandó meghatalmazott'], order_num: 11 },
  '32-client-data-retention.md': { id: 'books-client-data-retention', category_id: 'books_modules', title: 'Iratkezelés és GDPR Megőrzési Szabályzat', menu_path: '/eaisybooks/:companyId/:dateRange/data-retention', icon: 'Clock', tags: ['iratkezelés', 'adatmegőrzés', '8 év megőrzés', 'sztv 169', 'adatfeldolgozói szerződés', 'gdpr 28'], order_num: 12 },
  '33-client-structure.md': { id: 'books-client-structure', category_id: 'books_modules', title: 'Szervezeti és Bérezési Struktúra (Telephelyek, Költséghelyek)', menu_path: '/eaisybooks/:companyId/:dateRange/structure', icon: 'FolderTree', tags: ['telephelyek', 'költséghelyek', 'részlegek', 'szervezeti struktúra', 'hipa megosztás', 'létszám'], order_num: 13 },
  '34-client-settings.md': { id: 'books-client-settings', category_id: 'books_modules', title: 'Ügyfél Egyedi Beállítások és Bérügyi Konfiguráció', menu_path: '/eaisybooks/:companyId/:dateRange/settings', icon: 'Settings', tags: ['ügyfél beállítások', 'adózási profil', 'kerekítés', 'pótlékszabályok', 'bérfizetési nap', 'cafeteria'], order_num: 14 },
};

function executeSql(query) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(b));
        } catch (e) {
          resolve(b);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function parseMarkdownFile(filePath, meta) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  let summary = '';
  let summaryLines = [];
  let inSec2 = false;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith('## 2.')) {
      inSec2 = true;
      continue;
    }
    if (inSec2 && (l.startsWith('## 3.') || l.startsWith('###') || l === '---')) {
      break;
    }
    if (inSec2 && l && !l.startsWith('#')) {
      summaryLines.push(l);
    }
  }

  if (summaryLines.length > 0) {
    summary = summaryLines.join(' ');
    if (summary.length > 250) {
      const cut = summary.slice(0, 247);
      const lastSpace = cut.lastIndexOf(' ');
      summary = (lastSpace > 180 ? cut.slice(0, lastSpace) : cut) + '...';
    }
  } else {
    summary = `${meta.title} részletes leírása, elhelyezkedése és kezelési útmutatója az eaisy rendszerben.`;
  }

  const words = content.split(/\s+/).length;
  const readMins = Math.max(2, Math.min(8, Math.round(words / 140)));
  const estimated_read_time = `${readMins} perc`;

  return {
    id: meta.id,
    category_id: meta.category_id,
    title: meta.title,
    summary,
    content,
    tags: meta.tags,
    menu_path: meta.menu_path,
    icon: meta.icon,
    estimated_read_time,
    order_num: meta.order_num,
    is_published: true,
  };
}

async function main() {
  console.log('🔄 Tudástár szinkronizálása indítása (Markdown -> Fallback & PostgreSQL)...');

  const articles = [];

  // Parse eaisyBill
  for (const [file, meta] of Object.entries(EAISYBILL_MAP)) {
    const p = path.join(EAISYBILL_DIR, file);
    if (!fs.existsSync(p)) {
      console.warn(`Hiányzó fájl: ${file}`);
      continue;
    }
    articles.push(parseMarkdownFile(p, meta));
  }

  // Parse eaisyBooks
  for (const [file, meta] of Object.entries(EAISYBOOKS_MAP)) {
    const p = path.join(EAISYBOOKS_DIR, file);
    if (!fs.existsSync(p)) {
      console.warn(`Hiányzó fájl: ${file}`);
      continue;
    }
    articles.push(parseMarkdownFile(p, meta));
  }

  console.log(`✅ Sikeresen beolvasva: ${articles.length} cikk (29 eaisyBill + 34 eaisyBooks)`);

  // Update src/data/knowledgeBaseFallback.ts
  const fallbackCategories = [
    { id: "basics", title: "Alapok & Vezérlőpult", description: "Navigáció, irányítópult kpi-k, projektek, partnerek és törzsadatok", icon: "LayoutDashboard", order_index: 10, article_count: 4 },
    { id: "invoices", title: "Bizonylatok & Számlák", description: "Kimenő és bejövő számlák, követelések, OCR bizonylat-feldolgozás", icon: "Receipt", order_index: 20, article_count: 3 },
    { id: "transactions", title: "Pénzügyek & Bank", description: "Banki tranzakciók, házipénztár, készpénzmozgás és átutalási csomagok", icon: "Coins", order_index: 30, article_count: 3 },
    { id: "accounting", title: "Könyvelés & Adózás", description: "Főkönyv, áfa analitika, eredménykimutatás, mérleg és beszámoló", icon: "Calculator", order_index: 40, article_count: 8 },
    { id: "hr", title: "Bérszámfejtés & HR", description: "Munkavállalói adatok, bérszámfejtés, munkaidő-nyilvántartás", icon: "Users", order_index: 50, article_count: 2 },
    { id: "shipments", title: "Szállítmányozás & Fuvarok", description: "Fuvarlevelek, CMR menedzsment, Excel import és vitás ügyek", icon: "Truck", order_index: 60, article_count: 3 },
    { id: "system", title: "Integrációk & Rendszer", description: "API kapcsolatok, árfolyamok, audit napló és cégbeállítások", icon: "Settings", order_index: 70, article_count: 6 },
    { id: "books_portfolio", title: "eaisyBooks Portfólió", description: "Könyvelőirodai műszerfal, hiányzó számlák, adónaptár és AI asszisztens", icon: "Briefcase", order_index: 80, article_count: 8 },
    { id: "books_modules", title: "eaisyBooks Szakmai Modulok", description: "Ügyfél munkamenet, számlakontírozás, EV, TAO, bér és zárás", icon: "BookOpen", order_index: 90, article_count: 14 },
    { id: "books_admin", title: "eaisyBooks Adminisztráció & AI", description: "Iroda beállítások, jogosultságok, sablonok, GDPR és audit", icon: "Building2", order_index: 100, article_count: 12 }
  ];

  const fallbackContent = `import { KnowledgeCategory, KnowledgeArticle } from "@/types/knowledgeBase";

export const FALLBACK_KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = ${JSON.stringify(fallbackCategories, null, 2)};

export const FALLBACK_CATEGORY_MAP = new Map<string, KnowledgeCategory>(
  FALLBACK_KNOWLEDGE_CATEGORIES.map((c) => [c.id, c])
);

export const FALLBACK_KNOWLEDGE_ARTICLES: KnowledgeArticle[] = ${JSON.stringify(articles, null, 2)};
`;

  fs.writeFileSync(FALLBACK_FILE, fallbackContent, 'utf-8');
  console.log(`✅ Frontend fallback állomány frissítve: ${FALLBACK_FILE}`);

  // Push to Supabase PostgreSQL Database in batches
  console.log('📡 Adatbázis szinkronizáció indítása (Supabase PostgreSQL)...');
  const BATCH_SIZE = 7;
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const chunk = articles.slice(i, i + BATCH_SIZE);
    const sqlStatements = chunk.map(art => {
      const tagArraySql = `ARRAY[${art.tags.map(t => `'${t.replace(/'/g, "''")}'`).join(', ')}]::text[]`;
      const tagDollar = `$__tag_${art.id}__${art.tags.join(' ')}$__tag_${art.id}__`;
      const contentDollar = `$__cnt_${art.id}__${art.content}$__cnt_${art.id}__`;
      const summaryDollar = `$__sum_${art.id}__${art.summary}$__sum_${art.id}__`;
      const titleDollar = `$__ttl_${art.id}__${art.title}$__ttl_${art.id}__`;
      const menuDollar = `$__mp_${art.id}__${art.menu_path}$__mp_${art.id}__`;
      const readDollar = `$__rt_${art.id}__${art.estimated_read_time}$__rt_${art.id}__`;
      
      return `INSERT INTO public.knowledge_base_articles (
  id, category_id, title, summary, content, tags, menu_path, estimated_read_time, order_num, is_published, created_at, updated_at
) VALUES (
  '${art.id}', '${art.category_id}', ${titleDollar}, ${summaryDollar}, ${contentDollar},
  ${tagArraySql}, ${menuDollar}, ${readDollar}, ${art.order_num}, true, NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  tags = EXCLUDED.tags,
  menu_path = EXCLUDED.menu_path,
  estimated_read_time = EXCLUDED.estimated_read_time,
  order_num = EXCLUDED.order_num,
  is_published = true,
  updated_at = NOW();`;
    }).join('\n\n');

    try {
      await executeSql(sqlStatements);
      console.log(`   Köteg ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(articles.length / BATCH_SIZE)} elküldve (${chunk.length} cikk).`);
    } catch (e) {
      console.error(`   Hiba a(z) ${Math.floor(i / BATCH_SIZE) + 1}. kötegnél:`, e.message);
    }
  }

  console.log('🎉 Tudástár és RAG szinkronizáció sikeresen befejeződött!');
}

main().catch(err => {
  console.error('Végzetes hiba:', err);
  process.exit(1);
});
