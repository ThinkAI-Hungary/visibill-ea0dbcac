import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle, BookOpen, Keyboard, MessageCircle, ChevronDown, ChevronRight,
  FileWarning, Calendar, BarChart2, Settings, Briefcase, Search, Mail, Phone,
  ExternalLink, Lightbulb, Zap, Shield, Play, Scale, BookText, Tag,
  Calculator, Users, Lock, Link2, Construction, Video, GraduationCap,
  FileText, ArrowRight, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// ══════════════════════════════════════════════
// DATA
// ══════════════════════════════════════════════

interface FaqItem { q: string; a: string; }

const faqs: FaqItem[] = [
  { q: 'Hogyan adok hozzá új ügyfelet?', a: 'A Portfólió oldalon kattints az "Új ügyfél" gombra. Add meg a cég nevét és adószámát, majd a rendszer automatikusan lekéri a NAV adatait és beállítja a cég profilját.' },
  { q: 'Hogyan működik a hiányzó számlák észlelése?', a: 'Az eaisybooks összeveti a NAV Online Számla rendszeréből érkező adatokat a könyvelőrendszerbe rögzített számlákkal. Ha egy NAV-ban szereplő számla nincs a rendszerben, automatikusan "hiányzó" státuszt kap.' },
  { q: 'Mi a különbség a "Kritikus" és "Felszólított" státusz között?', a: '"Kritikus": a hiányzó számla már régóta bekéretlen és sürgős beavatkozást igényel. "Felszólított": a rendszer már küldött emlékeztetőt az ügyfélnek, de még nem érkezett válasz.' },
  { q: 'Hogyan működik az adó naptár?', a: 'Az adó naptár automatikusan generálja a havi/negyedéves/éves adóbevallási határidőket minden ügyfeledhez. Piros jelzést kap, ha közeledik a határidő, zöldet ha teljesítve van.' },
  { q: 'Hogyan exportálok riportot?', a: 'A Riportok oldalon válaszd ki a kívánt riport típust, szűrd le az időszakot és ügyfeleket, majd kattints az "Export CSV" vagy "Export PDF" gombra.' },
  { q: 'Hogyan váltok világos és sötét mód között?', a: 'A sidebar alján a felhasználói profilodra kattintva megjelenik a menü, ahol a "Sötét mód" / "Világos mód" opcióval válthatsz.' },
  { q: 'Hogyan működik az AI Hívás funkció?', a: 'Az ügyfél részletei oldalon az "AI Hívás" gombbal indíthatsz automatizált hívást, amellyel hiányzó dokumentumokat kérhetsz be. A rendszer rögzíti a hívás eredményét.' },
  { q: 'Hogyan küldök Magic Linket az ügyfélnek?', a: 'Az ügyfél részletei oldalon a "Magic Link" gombbal generálhatsz egyedi linket, amelyen keresztül az ügyfeled feltöltheti a hiányzó dokumentumokat anélkül, hogy regisztrálnia kellene.' },
];

const shortcuts = [
  { keys: ['Ctrl', 'B'], desc: 'Sidebar be/kikapcsolás (Visibill oldalon)' },
  { keys: ['Ctrl', 'K'], desc: 'Keresés megnyitása' },
  { keys: ['Esc'], desc: 'Modal / panel bezárása' },
];

const modules = [
  { icon: Briefcase, title: 'Portfólió', desc: 'Ügyfeleid áttekintése, KPI-ok, szűrés Admin/Könyvelő szerint' },
  { icon: FileWarning, title: 'Hiányzó számlák', desc: 'NAV vs könyvelőrendszer eltérés detektálás, bekérés, felszólítás' },
  { icon: Calendar, title: 'Adó naptár', desc: 'Határidők követése cégre lebontva, vizuális naptár nézet' },
  { icon: BarChart2, title: 'Riportok', desc: 'Irodai szintű kimutatások, CSV/PDF export, havi trend' },
  { icon: Settings, title: 'Beállítások', desc: 'Értesítési csatornák, email sablonok, automatikus felszólítás' },
];

// ── Categories ──

interface CategoryArticle {
  title: string;
  summary: string;
  tags: string[];
}

interface Category {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  articles: CategoryArticle[];
}

const categories: Category[] = [
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

interface VideoTutorial {
  title: string;
  description: string;
  duration: string;
  category: string;
  thumbnail?: string;
}

const videoTutorials: VideoTutorial[] = [
  { title: 'Első lépések az eaisybooks-ban', description: 'Bemutatjuk az eaisybooks felületét, navigációt és az alapvető funkciókat.', duration: '5:30', category: 'Alapok' },
  { title: 'Ügyfél hozzáadása és beállítása', description: 'Hogyan adj hozzá új ügyfelet adószám alapján, és állítsd be a profilját.', duration: '3:45', category: 'Alapok' },
  { title: 'Hiányzó számlák kezelése', description: 'NAV szinkronizáció, hiányok felismerése, AI hívás és Magic Link használata.', duration: '7:20', category: 'Számlák' },
  { title: 'Bérszámfejtés modul használata', description: 'Foglalkoztatottak kezelése, havi bérszámfejtés és NAV bevallás.', duration: '8:15', category: 'Bérszámfejtés' },
  { title: 'Riportok és KPI-ok', description: 'Irodai szintű kimutatások készítése, export és trendek elemzése.', duration: '4:50', category: 'Riportok' },
  { title: 'Adó naptár és határidők', description: 'Határidők követése, emlékeztetők beállítása és NAV bevallási naptár.', duration: '3:30', category: 'NAV' },
];

// ── Legislation ──

interface Legislation {
  abbreviation: string;
  fullName: string;
  description: string;
  year: string;
  url: string;
  tags: string[];
}

const legislations: Legislation[] = [
  { abbreviation: 'Mt.', fullName: 'Munka Törvénykönyve', description: 'A munkaviszonyt szabályozó alapvető törvény. Tartalmazza a munkaviszony létesítésére, fennállására és megszűnésére vonatkozó szabályokat, a munkaidőre, pihenőidőre és a munkabérre vonatkozó rendelkezéseket.', year: '2012. évi I. tv.', url: 'https://njt.hu/eli/TV/2012/1', tags: ['munkaviszony', 'munkabér', 'felmondás', 'szabadság'] },
  { abbreviation: 'Szja tv.', fullName: 'Személyi jövedelemadóról szóló törvény', description: 'A magánszemélyek jövedelmének adóztatását szabályozza. Meghatározza az adóköteles jövedelmeket, az adókulcsot, a kedvezményeket és az adóbevallási kötelezettségeket.', year: '1995. évi CXVII. tv.', url: 'https://njt.hu/eli/TV/1995/117', tags: ['szja', 'jövedelem', 'adó', 'kedvezmény'] },
  { abbreviation: 'Tbj.', fullName: 'Társadalombiztosítás ellátásairól szóló törvény', description: 'A társadalombiztosítási rendszer alapjait határozza meg: egészségbiztosítási és nyugdíjbiztosítási ellátások, járulékfizetési kötelezettségek.', year: '2019. évi CXXII. tv.', url: 'https://njt.hu/eli/TV/2019/122', tags: ['tb', 'társadalombiztosítás', 'járulék', 'egészségbiztosítás'] },
  { abbreviation: 'Szocho tv.', fullName: 'Szociális hozzájárulási adóról szóló törvény', description: 'A munkáltatók által fizetendő szociális hozzájárulási adó mértékét, alapját és kedvezményeit szabályozza.', year: '2018. évi LII. tv.', url: 'https://njt.hu/eli/TV/2018/52', tags: ['szocho', 'munkáltató', 'adó', 'kedvezmény'] },
  { abbreviation: 'Art.', fullName: 'Adóigazgatási rendtartás', description: 'Az adóhatóság eljárási szabályait tartalmazza: adóellenőrzés, határozatok, jogorvoslat, adóvégrehajtás és az adózók jogai és kötelezettségei.', year: '2017. évi CLI. tv.', url: 'https://njt.hu/eli/TV/2017/151', tags: ['adóhatóság', 'ellenőrzés', 'jogorvoslat', 'nav'] },
  { abbreviation: 'Efo tv.', fullName: 'Egyszerűsített foglalkoztatásról szóló törvény', description: 'Az egyszerűsített foglalkoztatás (alkalmi munka, mezőgazdasági idénymunka) szabályait határozza meg, beleértve a bejelentési kötelezettségeket.', year: '2010. évi LXXV. tv.', url: 'https://njt.hu/eli/TV/2010/75', tags: ['egyszerűsített foglalkoztatás', 'alkalmi munka', 'idénymunka', 'efo'] },
];

// ── Glossary ──

interface GlossaryItem {
  abbr: string;
  full: string;
  description: string;
}

const glossary: GlossaryItem[] = [
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

type HelpTab = 'overview' | 'categories' | 'videos' | 'legislation' | 'glossary';

const helpTabs: { id: HelpTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Áttekintés', icon: HelpCircle },
  { id: 'categories', label: 'Kategóriák', icon: BookOpen },
  { id: 'videos', label: 'Videó-tutorialok', icon: Video },
  { id: 'legislation', label: 'Jogszabályok', icon: Scale },
  { id: 'glossary', label: 'Glosszárium', icon: BookText },
];

// ══════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<HelpTab>('overview');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [expandedLaw, setExpandedLaw] = useState<string | null>(null);

  // Global search filtering
  const q = searchQuery.toLowerCase().trim();

  const filteredFaqs = useMemo(() =>
    q ? faqs.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)) : faqs
  , [q]);

  const filteredCategories = useMemo(() =>
    q ? categories.map(c => ({
      ...c,
      articles: c.articles.filter(a =>
        a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || a.tags.some(t => t.includes(q))
      ),
    })).filter(c => c.articles.length > 0 || c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    : categories
  , [q]);

  const filteredLegislations = useMemo(() =>
    q ? legislations.filter(l =>
      l.abbreviation.toLowerCase().includes(q) || l.fullName.toLowerCase().includes(q) || l.description.toLowerCase().includes(q) || l.tags.some(t => t.includes(q))
    ) : legislations
  , [q]);

  const filteredGlossary = useMemo(() =>
    q ? glossary.filter(g =>
      g.abbr.toLowerCase().includes(q) || g.full.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)
    ) : glossary
  , [q]);

  const filteredVideos = useMemo(() =>
    q ? videoTutorials.filter(v =>
      v.title.toLowerCase().includes(q) || v.description.toLowerCase().includes(q) || v.category.toLowerCase().includes(q)
    ) : videoTutorials
  , [q]);

  // Auto-switch to matching tab on search
  const searchResultCounts = useMemo(() => ({
    overview: filteredFaqs.length,
    categories: filteredCategories.reduce((sum, c) => sum + c.articles.length, 0),
    videos: filteredVideos.length,
    legislation: filteredLegislations.length,
    glossary: filteredGlossary.length,
  }), [filteredFaqs, filteredCategories, filteredVideos, filteredLegislations, filteredGlossary]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-primary" />
          </div>
          Segítség & Dokumentáció
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Minden, amit az eaisybooks modulról tudnod kell</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
        <Input
          placeholder="Keresés a súgóban... (pl. SZJA, bérszámfejtés, NAV bevallás)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 bg-card border-border text-sm"
        />
        {q && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {Object.entries(searchResultCounts).map(([tab, count]) => (
              count > 0 && (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as HelpTab)}
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors",
                    activeTab === tab
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  {helpTabs.find(t => t.id === tab)?.label} ({count})
                </button>
              )
            ))}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl border border-border/60 overflow-x-auto">
        {helpTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap",
              activeTab === tab.id
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            )}
          >
            <tab.icon className="w-4 h-4 shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* TAB: OVERVIEW (existing content preserved) */}
      {/* ═══════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Quick Start */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Gyors útmutató
              </h2>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-sm font-bold text-primary">1</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Ügyfél hozzáadása</p>
                    <p className="text-xs text-muted-foreground mt-1">Portfólió → Új ügyfél → Adószám megadása</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-sm font-bold text-primary">2</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Hiányok áttekintése</p>
                    <p className="text-xs text-muted-foreground mt-1">Hiányzó számlák → Cég kiválasztása → Részletek</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-sm font-bold text-primary">3</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Bekérés indítása</p>
                    <p className="text-xs text-muted-foreground mt-1">AI Hívás vagy Magic Link küldése az ügyfélnek</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modules */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Modulok áttekintése
              </h2>
            </div>
            <div className="divide-y divide-border">
              {modules.map((m) => (
                <div key={m.title} className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <m.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{m.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                Gyakran ismételt kérdések
              </h2>
            </div>
            <div className="divide-y divide-border">
              {filteredFaqs.map((faq, i) => (
                <button
                  key={i}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{faq.q}</p>
                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200",
                      openFaq === i && "rotate-180"
                    )} />
                  </div>
                  <div className={cn(
                    "overflow-hidden transition-all duration-200",
                    openFaq === i ? "max-h-40 mt-2 opacity-100" : "max-h-0 opacity-0"
                  )}>
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </div>
                </button>
              ))}
              {q && filteredFaqs.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">Nincs találat a keresésre.</p>
              )}
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-primary" />
                Billentyűparancsok
              </h2>
            </div>
            <div className="p-5 space-y-3">
              {shortcuts.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{s.desc}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, j) => (
                      <span key={j}>
                        <kbd className="px-2 py-1 text-xs font-mono font-semibold bg-muted text-muted-foreground rounded border border-border shadow-soft">
                          {k}
                        </kbd>
                        {j < s.keys.length - 1 && <span className="text-xs text-muted-foreground mx-1">+</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contact & Support */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border shadow-soft p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <MessageCircle className="w-4 h-4 text-primary" />
                Kapcsolat
              </h3>
              <div className="space-y-3">
                <a href="mailto:support@eaisybooks.hu" className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group">
                  <Mail className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div>
                    <p className="text-sm font-medium text-foreground">support@eaisybooks.hu</p>
                    <p className="text-xs text-muted-foreground">Email támogatás</p>
                  </div>
                </a>
                <a href="tel:+3612345678" className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group">
                  <Phone className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div>
                    <p className="text-sm font-medium text-foreground">+36 1 234 5678</p>
                    <p className="text-xs text-muted-foreground">H–P 9:00–17:00</p>
                  </div>
                </a>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-soft p-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-primary" />
                Verzió & Adatvédelem
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-muted-foreground">Verzió</span>
                  <span className="font-mono font-semibold text-foreground">2.0.0-beta</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-muted-foreground">Utolsó frissítés</span>
                  <span className="font-semibold text-foreground">{new Date().toLocaleDateString('hu-HU')}</span>
                </div>
                <Link to="/accounty/privacy-policy" className="flex items-center gap-2 p-3 rounded-lg hover:bg-accent/50 transition-colors text-muted-foreground hover:text-primary">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Adatvédelmi tájékoztató</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════ */}
      {/* TAB: CATEGORIES            */}
      {/* ═══════════════════════════ */}
      {activeTab === 'categories' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Böngéssz a témakörök között, vagy használd a keresőt a szűréshez.</p>
            <Badge variant="outline" className="gap-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0">
              <Construction className="h-3 w-3" />
              Tartalom fejlesztés alatt
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCategories.map((cat) => (
              <div
                key={cat.id}
                className="bg-card rounded-xl border border-border shadow-soft overflow-hidden hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                  className="w-full p-5 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", cat.color)}>
                      <cat.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">{cat.title}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{cat.articles.length} cikk</span>
                          <ChevronDown className={cn(
                            "w-4 h-4 text-muted-foreground transition-transform duration-200",
                            expandedCategory === cat.id && "rotate-180"
                          )} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                    </div>
                  </div>
                </button>

                <div className={cn(
                  "overflow-hidden transition-all duration-300",
                  expandedCategory === cat.id ? "max-h-[500px]" : "max-h-0"
                )}>
                  <div className="px-5 pb-5 space-y-2 border-t border-border pt-3">
                    {cat.articles.map((article, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-start gap-2">
                          <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div>
                            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{article.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{article.summary}</p>
                            <div className="flex items-center gap-1.5 mt-2">
                              {article.tags.map((tag, j) => (
                                <span key={j} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">{tag}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {q && filteredCategories.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">Nincs találat a keresésre.</p>
          )}
        </div>
      )}

      {/* ═══════════════════════════ */}
      {/* TAB: VIDEO TUTORIALS       */}
      {/* ═══════════════════════════ */}
      {activeTab === 'videos' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Videós útmutatók az eaisybooks használatához.</p>
            <Badge variant="outline" className="gap-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-0">
              <Construction className="h-3 w-3" />
              Tartalom fejlesztés alatt
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVideos.map((video, i) => (
              <div
                key={i}
                className="bg-card rounded-xl border border-border shadow-soft overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-pointer"
              >
                {/* Thumbnail placeholder */}
                <div className="relative aspect-video bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200">
                    <Play className="w-6 h-6 text-white ml-0.5" />
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-xs font-mono font-medium">
                    {video.duration}
                  </div>
                  <div className="absolute top-2 left-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-foreground font-semibold">{video.category}</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">{video.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{video.description}</p>
                </div>
              </div>
            ))}
          </div>

          {q && filteredVideos.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">Nincs találat a keresésre.</p>
          )}

          {/* Hamarosan banner */}
          <div className="bg-card rounded-xl border border-dashed border-primary/30 p-8 text-center space-y-3">
            <GraduationCap className="w-10 h-10 text-primary/40 mx-auto" />
            <h3 className="font-semibold text-foreground">További videók hamarosan</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Folyamatosan bővítjük a videó-tartalmainkat. Ha van konkrét témád, amiről szívesen látnál videós útmutatót, jelezd nekünk!
            </p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════ */}
      {/* TAB: LEGISLATION           */}
      {/* ═══════════════════════════ */}
      {activeTab === 'legislation' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <p className="text-sm text-muted-foreground">A könyvelési és bérszámfejtési munkához legfontosabb jogszabályok gyűjteménye.</p>

          <div className="space-y-3">
            {filteredLegislations.map((law) => (
              <div
                key={law.abbreviation}
                className="bg-card rounded-xl border border-border shadow-soft overflow-hidden"
              >
                <button
                  onClick={() => setExpandedLaw(expandedLaw === law.abbreviation ? null : law.abbreviation)}
                  className="w-full p-5 text-left hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Scale className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-foreground">{law.abbreviation}</h3>
                          <span className="text-xs text-muted-foreground font-mono">{law.year}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{law.fullName}</p>
                      </div>
                    </div>
                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200",
                      expandedLaw === law.abbreviation && "rotate-180"
                    )} />
                  </div>
                </button>

                <div className={cn(
                  "overflow-hidden transition-all duration-300",
                  expandedLaw === law.abbreviation ? "max-h-[300px]" : "max-h-0"
                )}>
                  <div className="px-5 pb-5 space-y-3 border-t border-border pt-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">{law.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {law.tags.map((tag, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{tag}</span>
                      ))}
                    </div>
                    <a
                      href={law.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Jogszabály megnyitása (njt.hu)
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {q && filteredLegislations.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">Nincs találat a keresésre.</p>
          )}
        </div>
      )}

      {/* ═══════════════════════════ */}
      {/* TAB: GLOSSARY               */}
      {/* ═══════════════════════════ */}
      {activeTab === 'glossary' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Könyvelési és bérszámfejtési rövidítések magyarázata — {filteredGlossary.length} kifejezés
            </p>
          </div>

          {/* ABC quick jump */}
          {!q && (
            <div className="flex items-center gap-1 flex-wrap">
              {Array.from(new Set(glossary.map(g => g.abbr[0]))).sort().map(letter => (
                <a
                  key={letter}
                  href={`#glossary-${letter}`}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {letter}
                </a>
              ))}
            </div>
          )}

          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="divide-y divide-border">
              {filteredGlossary
                .sort((a, b) => a.abbr.localeCompare(b.abbr, 'hu'))
                .map((item, i) => (
                <div
                  key={item.abbr}
                  id={i === 0 || filteredGlossary[i - 1]?.abbr[0] !== item.abbr[0] ? `glossary-${item.abbr[0]}` : undefined}
                  className="p-4 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0">
                      <span className="inline-block min-w-[72px] text-center px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-bold text-sm tracking-wider">
                        {item.abbr}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.full}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {q && filteredGlossary.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">Nincs találat a keresésre.</p>
          )}
        </div>
      )}
    </div>
  );
}
