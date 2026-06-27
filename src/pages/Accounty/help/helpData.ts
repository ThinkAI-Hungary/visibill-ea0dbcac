import React from 'react';
import {
  FileWarning, Calendar, BarChart2, Settings, Briefcase,
  FileText, Calculator, Users, Lock, Link2, Scale, BookText, Tag,
  HelpCircle, BookOpen, Video
} from 'lucide-react';

export interface FaqItem { q: string; a: string; }

export const faqs: FaqItem[] = [
  { q: 'Hogyan adok hozzá új ügyfelet?', a: 'A Portfólió oldalon kattints az "Új ügyfél" gombra. Add meg a cég nevét és adószámát, majd a rendszer automatikusan lekéri a NAV adatait és beállítja a cég profilját.' },
  { q: 'Hogyan működik a hiányzó számlák észlelése?', a: 'Az eaisybooks összeveti a NAV Online Számla rendszeréből érkező adatokat a könyvelőrendszerbe rögzített számlákkal. Ha egy NAV-ban szereplő számla nincs a rendszerben, automatikusan "hiányzó" státuszt kap.' },
  { q: 'Mi a különbség a "Kritikus" és "Felszólított" státusz között?', a: '"Kritikus": a hiányzó számla már régóta bekéretlen és sürgős beavatkozást igényel. "Felszólított": a rendszer már küldött emlékeztetőt az ügyfélnek, de még nem érkezett válasz.' },
  { q: 'Hogyan működik az adó naptár?', a: 'Az adó naptár automatikusan generálja a havi/negyedéves/éves adóbevallási határidőket minden ügyfeledhez. Piros jelzést kap, ha közeledik a határidő, zöldet ha teljesítve van.' },
  { q: 'Hogyan exportálok riportot?', a: 'A Riportok oldalon válaszd ki a kívánt riport típust, szűrd le az időszakot és ügyfeleket, majd kattints az "Export CSV" vagy "Export PDF" gombra.' },
  { q: 'Hogyan váltok világos és sötét mód között?', a: 'A sidebar alján a felhasználói profilodra kattintva megjelenik a menü, ahol a "Sötét mód" / "Világos mód" opcióval válthatsz.' },
  { q: 'Hogyan működik az AI Hívás funkció?', a: 'Az ügyfél részletei oldalon az "AI Hívás" gombbal indíthatsz automatizált hívást, amellyel hiányzó dokumentumokat kérhetsz be. A rendszer rögzíti a hívás eredményét.' },
  { q: 'Hogyan küldök Magic Linket az ügyfélnek?', a: 'Az ügyfél részletei oldalon a "Magic Link" gombbal generálhatsz egyedi linket, amelyen keresztül az ügyfeled feltöltheti a hiányzó dokumentumokat anélkül, hogy regisztrálnia kellene.' },
];

export const shortcuts = [
  { keys: ['Ctrl', 'B'], desc: 'Sidebar be/kikapcsolás' },
  { keys: ['Ctrl', 'K'], desc: 'Keresés megnyitása' },
  { keys: ['Esc'], desc: 'Modal / panel bezárása' },
];

export const modules = [
  { icon: Briefcase, title: 'Portfólió', desc: 'Ügyfeleid áttekintése, KPI-ok, szűrés Admin/Könyvelő szerint' },
  { icon: FileWarning, title: 'Hiányzó számlák', desc: 'NAV vs könyvelőrendszer eltérés detektálás, bekérés, felszólítás' },
  { icon: Calendar, title: 'Adó naptár', desc: 'Határidők követése cégre lebontva, vizuális naptár nézet' },
  { icon: BarChart2, title: 'Riportok', desc: 'Irodai szintű kimutatások, CSV/PDF export, havi trend' },
  { icon: Settings, title: 'Beállítások', desc: 'Értesítési csatornák, email sablonok, automatikus felszólítás' },
];

// ── Categories ──

export interface CategoryArticle {
  title: string;
  summary: string;
  tags: string[];
}

export interface Category {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  articles: CategoryArticle[];
}

export const categories: Category[] = [
  {
    id: 'payroll',
    icon: Calculator,
    title: 'Bérszámfejtés',
    description: 'Bérszámfejtési folyamatok, járulékok, munkabér elszámolás',
    color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    articles: [
      { title: 'Havi bérszámfejtés lépései', summary: 'A bérszámfejtés teljes folyamata a munkaidő rögzítéstől a nettó bér kifizetéséig.', tags: ['bérszámfejtés', 'havi zárás'] },
      { title: 'Járulékkulcsok 2026-ban', summary: 'Az aktuális SZJA, TB és SZOCHO mértékek összefoglalója és alkalmazásuk.', tags: ['járulékok', 'szja', 'szocho'] },
      { title: 'Cafeteria kezelés', summary: 'SZÉP-kártya, munkáltatói hozzájárulások és adómentes juttatások elszámolása.', tags: ['cafeteria', 'szép-kártya'] },
    ],
  },
  {
    id: 'nav',
    icon: FileText,
    title: 'NAV-bevallás',
    description: 'Adóbevallások, határidők, NAV Online Számla integráció',
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
    articles: [
      { title: 'ÁFA bevallás (65-ös nyomtatvány)', summary: 'Havi és negyedéves ÁFA bevallás elkészítése, gyakori hibák és javításuk.', tags: ['áfa', 'nav', '65-ös'] },
      { title: 'NAV Online Számla szinkronizáció', summary: 'Hogyan működik a NAV adatkapcsolat és a hiányzó számlák automatikus felismerése.', tags: ['nav', 'online számla', 'szinkronizáció'] },
      { title: '08-as bevallás (járulék)', summary: 'Havi járulékbevallás elkészítése, beküldési határidők és javítások.', tags: ['08-as', 'járulék', 'nav'] },
    ],
  },
  {
    id: 'employment',
    icon: Users,
    title: 'Foglalkoztatás',
    description: 'Munkaviszony, bejelentés, T1041, jogviszony kódok',
    color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
    articles: [
      { title: 'Beléptetés és T1041 bejelentés', summary: 'Új munkavállaló felvételekor szükséges NAV bejelentés és határidők.', tags: ['t1041', 'bejelentés', 'beléptetés'] },
      { title: 'Jogviszony típusok', summary: 'Munkaviszony, megbízási, vállalkozási és egyéb jogviszonyok közötti különbségek.', tags: ['jogviszony', 'megbízási', 'munkaviszony'] },
      { title: 'Kilépés és elszámolás', summary: 'Munkaviszony megszűnésekor szükséges teendők és dokumentumok.', tags: ['kilépés', 'elszámolás', 'felmondás'] },
    ],
  },
  {
    id: 'benefits',
    icon: Tag,
    title: 'Kedvezmények',
    description: 'Adókedvezmények, családi kedvezmény, GYED, CSED',
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
    articles: [
      { title: 'Családi kedvezmény 2026', summary: 'Az aktuális családi kedvezmény mértéke, igénylés feltételei és megosztás szabályai.', tags: ['családi kedvezmény', 'szja'] },
      { title: 'Első házasok kedvezménye', summary: 'Az első házasok kedvezményének feltételei, összege és érvényesítése.', tags: ['első házasok', 'kedvezmény'] },
      { title: 'Személyi kedvezmény', summary: 'Megváltozott munkaképességű személyek személyi kedvezménye.', tags: ['személyi kedvezmény', 'fogyatékosság'] },
    ],
  },
  {
    id: 'integration',
    icon: Link2,
    title: 'Integráció',
    description: 'NAV, banki kapcsolatok, API, import/export',
    color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400',
    articles: [
      { title: 'NAV Online Számla API beállítás', summary: 'Technikai és felhasználói token regisztráció a NAV rendszerében.', tags: ['nav', 'api', 'token'] },
      { title: 'Banki tranzakció import', summary: 'Bankszámlakivonatok importálása CSV és MT940 formátumban.', tags: ['bank', 'import', 'csv'] },
    ],
  },
  {
    id: 'gdpr',
    icon: Lock,
    title: 'GDPR',
    description: 'Adatvédelem, hozzáférés-kezelés, naplózás',
    color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
    articles: [
      { title: 'Adatkezelési nyilvántartás', summary: 'A kötelező adatkezelési nyilvántartás vezetése és tartalma.', tags: ['gdpr', 'adatkezelés', 'nyilvántartás'] },
      { title: 'Hozzáférés-kezelés és audit', summary: 'Felhasználói jogosultságok beállítása és a hozzáférési napló ellenőrzése.', tags: ['audit', 'jogosultság', 'napló'] },
    ],
  },
];

// ── Video tutorials ──

export interface VideoTutorial {
  title: string;
  description: string;
  duration: string;
  category: string;
  thumbnail?: string;
}

export const videoTutorials: VideoTutorial[] = [
  { title: 'Első lépések az eaisybooks-ban', description: 'Bemutatjuk az eaisybooks felületét, navigációt és az alapvető funkciókat.', duration: '5:30', category: 'Alapok' },
  { title: 'Ügyfél hozzáadása és beállítása', description: 'Hogyan adj hozzá új ügyfelet adószám alapján, és állítsd be a profilját.', duration: '3:45', category: 'Alapok' },
  { title: 'Hiányzó számlák kezelése', description: 'NAV szinkronizáció, hiányok felismerése, AI hívás és Magic Link használata.', duration: '7:20', category: 'Számlák' },
  { title: 'Bérszámfejtés modul használata', description: 'Foglalkoztatottak kezelése, havi bérszámfejtés és NAV bevallás.', duration: '8:15', category: 'Bérszámfejtés' },
  { title: 'Riportok és KPI-ok', description: 'Irodai szintű kimutatások készítése, export és trendek elemzése.', duration: '4:50', category: 'Riportok' },
  { title: 'Adó naptár és határidők', description: 'Határidők követése, emlékeztetők beállítása és NAV bevallási naptár.', duration: '3:30', category: 'NAV' },
];

// ── Legislation ──

export interface Legislation {
  abbreviation: string;
  fullName: string;
  description: string;
  year: string;
  url: string;
  tags: string[];
}

export const legislations: Legislation[] = [
  { abbreviation: 'Mt.', fullName: 'Munka Törvénykönyve', description: 'A munkaviszonyt szabályozó alapvető törvény. Tartalmazza a munkaviszony létesítésére, fennállására és megszűnésére vonatkozó szabályokat, a munkaidőre, pihenőidőre és a munkabérre vonatkozó rendelkezéseket.', year: '2012. évi I. tv.', url: 'https://njt.hu/eli/TV/2012/1', tags: ['munkaviszony', 'munkabér', 'felmondás', 'szabadság'] },
  { abbreviation: 'Szja tv.', fullName: 'Személyi jövedelemadóról szóló törvény', description: 'A magánszemélyek jövedelmének adóztatását szabályozza. Meghatározza az adóköteles jövedelmeket, az adókulcsot, a kedvezményeket és az adóbevallási kötelezettségeket.', year: '1995. évi CXVII. tv.', url: 'https://njt.hu/eli/TV/1995/117', tags: ['szja', 'jövedelem', 'adó', 'kedvezmény'] },
  { abbreviation: 'Tbj.', fullName: 'Társadalombiztosítás ellátásairól szóló törvény', description: 'A társadalombiztosítási rendszer alapjait határozza meg: egészségbiztosítási és nyugdíjbiztosítási ellátások, járulékfizetési kötelezettségek.', year: '2019. évi CXXII. tv.', url: 'https://njt.hu/eli/TV/2019/122', tags: ['tb', 'társadalombiztosítás', 'járulék', 'egészségbiztosítás'] },
  { abbreviation: 'Szocho tv.', fullName: 'Szociális hozzájárulási adóról szóló törvény', description: 'A munkáltatók által fizetendő szociális hozzájárulási adó mértékét, alapját és kedvezményeit szabályozza.', year: '2018. évi LII. tv.', url: 'https://njt.hu/eli/TV/2018/52', tags: ['szocho', 'munkáltató', 'adó', 'kedvezmény'] },
  { abbreviation: 'Art.', fullName: 'Adóigazgatási rendtartás', description: 'Az adóhatóság eljárási szabályait tartalmazza: adóellenőrzés, határozatok, jogorvoslat, adóvégrehajtás és az adózók jogai és kötelezettségei.', year: '2017. évi CLI. tv.', url: 'https://njt.hu/eli/TV/2017/151', tags: ['adóhatóság', 'ellenőrzés', 'jogorvoslat', 'nav'] },
  { abbreviation: 'Efo tv.', fullName: 'Egyszerűsített foglalkoztatásról szóló törvény', description: 'Az egyszerűsített foglalkoztatás (alkalmi munka, mezőgazdasági idénymunka) szabályait határozza meg, beleértve a bejelentési kötelezettségeket.', year: '2010. évi LXXV. tv.', url: 'https://njt.hu/eli/TV/2010/75', tags: ['egyszerűsített foglalkoztatás', 'alkalmi munka', 'idénymunka', 'efo'] },
];

// ── Glossary ──

export interface GlossaryItem {
  abbr: string;
  full: string;
  description: string;
}

export const glossary: GlossaryItem[] = [
  { abbr: 'SZJA', full: 'Személyi Jövedelemadó', description: 'A magánszemélyek jövedelme után fizetendő adó, mértéke jelenleg 15%.' },
  { abbr: 'TB', full: 'Társadalombiztosítás', description: 'Egészségbiztosítási (4%) és nyugdíjbiztosítási (10%) járulék összefoglaló neve.' },
  { abbr: 'SZOCHO', full: 'Szociális Hozzájárulási Adó', description: 'A munkáltató által fizetendő adó a bruttó bér után, mértéke jelenleg 13%.' },
  { abbr: 'EFO', full: 'Egyszerűsített Foglalkoztatás', description: 'Alkalmi munkára és mezőgazdasági idénymunkára vonatkozó egyszerűsített bejelentési és adózási forma.' },
  { abbr: 'NEAK', full: 'Nemzeti Egészségbiztosítási Alapkezelő', description: 'Az egészségbiztosítási ellátások finanszírozásáért és nyilvántartásáért felelős szervezet.' },
  { abbr: 'KAÜ', full: 'Központi Azonosítási Ügynök', description: 'Az elektronikus ügyintézéshez használt központi azonosítási rendszer (Ügyfélkapu).' },
  { abbr: 'AVDH', full: 'Azonosításra Visszavezetett Dokumentum Hitelesítés', description: 'Elektronikus aláírási szolgáltatás, amely jogérvényes aláírást biztosít digitális dokumentumokon.' },
  { abbr: 'DÁP', full: 'Digitális Állampolgárság Program', description: 'A magyar állam digitalizációs programja, amely az elektronikus ügyintézés megkönnyítését célozza.' },
  { abbr: 'ONYA', full: 'Online Nyomtatványkitöltő Alkalmazás', description: 'NAV online felülete adóbevallások kitöltéséhez és beküldéséhez.' },
  { abbr: 'M2M', full: 'Machine-to-Machine', description: 'Gépi kommunikáció, pl. NAV Online Számla automatikus adatcsere rendszere.' },
  { abbr: 'CSED', full: 'Csecsemőgondozási Díj', description: 'A szülést követő 168 napra járó ellátás, mértéke a napi átlagkereset 70%-a.' },
  { abbr: 'GYED', full: 'Gyermekgondozási Díj', description: 'A gyermek 2 éves koráig igénybe vehető ellátás, mértéke az átlagkereset 70%-a (max összeg korláttal).' },
  { abbr: 'ÖFD', full: 'Összevont Adóalap-csökkentő Felső Összeghatár', description: 'Az adókedvezmények igénybevételénél alkalmazandó összevont felső korlát.' },
  { abbr: 'NAV', full: 'Nemzeti Adó- és Vámhivatal', description: 'Magyarország adóhatósága, amely az adók, vámok és járulékok beszedéséért felelős.' },
  { abbr: 'GYES', full: 'Gyermekgondozást Segítő Ellátás', description: 'A gyermek 3 éves koráig igénybe vehető, fix összegű ellátás (öregségi nyugdíjminimum összege).' },
  { abbr: 'ÁFA', full: 'Általános Forgalmi Adó', description: 'Termékek és szolgáltatások értékesítése után fizetendő adó, általános mértéke 27%.' },
  { abbr: 'TAJ', full: 'Társadalombiztosítási Azonosító Jel', description: '9 jegyű azonosítószám, amely az egészségbiztosítási és nyugdíjbiztosítási nyilvántartásban azonosítja az egyént.' },
  { abbr: 'KATA', full: 'Kisadózó Vállalkozások Tételes Adója', description: 'Egyszerűsített adózási forma egyéni vállalkozók számára, fix havi tételes adóval.' },
  { abbr: 'KIVA', full: 'Kisvállalati Adó', description: 'A kisvállalkozások számára elérhető adónem, amely a személyi jellegű kifizetéseket és a jövedelem-növekményt adóztatja.' },
];

// ══════════════════════════════════════════════
// TABS
// ══════════════════════════════════════════════

export type HelpTab = 'overview' | 'categories' | 'videos' | 'legislation' | 'glossary';

export const helpTabs: { id: HelpTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Áttekintés', icon: HelpCircle },
  { id: 'categories', label: 'Kategóriák', icon: BookOpen },
  { id: 'videos', label: 'Videó-tutorialok', icon: Video },
  { id: 'legislation', label: 'Jogszabályok', icon: Scale },
  { id: 'glossary', label: 'Glosszárium', icon: BookText },
];
