import { useState } from 'react';
import {
  HelpCircle, BookOpen, Keyboard, MessageCircle, ChevronDown, ChevronRight,
  FileWarning, Calendar, BarChart2, Settings, Briefcase, Search, Mail, Phone,
  ExternalLink, Lightbulb, Zap, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FaqItem {
  q: string;
  a: string;
}

const faqs: FaqItem[] = [
  { q: 'Hogyan adok hozzá új ügyfelet?', a: 'A Portfólió oldalon kattints az "Új ügyfél" gombra. Add meg a cég nevét és adószámát, majd a rendszer automatikusan lekéri a NAV adatait és beállítja a cég profilját.' },
  { q: 'Hogyan működik a hiányzó számlák észlelése?', a: 'Az Accounty összeveti a NAV Online Számla rendszeréből érkező adatokat a könyvelőrendszerbe rögzített számlákkal. Ha egy NAV-ban szereplő számla nincs a rendszerben, automatikusan "hiányzó" státuszt kap.' },
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

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-primary" />
          </div>
          Segítség & Dokumentáció
        </h1>
        <p className="text-sm text-muted-foreground mt-2">Minden, amit az Accounty modulról tudnod kell</p>
      </div>

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
          {faqs.map((faq, i) => (
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
            <a href="mailto:support@taxology.hu" className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group">
              <Mail className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <div>
                <p className="text-sm font-medium text-foreground">support@taxology.hu</p>
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
            <a href="#" className="flex items-center gap-2 p-3 rounded-lg hover:bg-accent/50 transition-colors text-muted-foreground hover:text-primary">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Adatvédelmi tájékoztató</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
