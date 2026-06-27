import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle, BookOpen, Keyboard, MessageCircle, ChevronDown, ChevronRight,
  FileWarning, Calendar, BarChart2, Settings, Briefcase, Search, Mail,
  ExternalLink, Lightbulb, Zap, Shield, Play, Scale, BookText, Tag,
  Calculator, Users, Lock, Link2, Construction, Video, GraduationCap,
  FileText, ArrowRight, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  faqs, shortcuts, modules, categories, videoTutorials, legislations, glossary, helpTabs,
  type FaqItem, type HelpTab,
} from './help/helpData';






// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


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


      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* TAB: OVERVIEW (existing content preserved) */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
                    <p className="text-xs text-muted-foreground mt-1">Portfólió â†’ Új ügyfél â†’ Adószám megadása</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-sm font-bold text-primary">2</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Hiányok áttekintése</p>
                    <p className="text-xs text-muted-foreground mt-1">Hiányzó számlák â†’ Cég kiválasztása â†’ Részletek</p>
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
                <a href="mailto:info@eaisybooks.hu" className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group">
                  <Mail className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <div>
                    <p className="text-sm font-medium text-foreground">info@eaisybooks.hu</p>
                    <p className="text-xs text-muted-foreground">Email támogatás</p>
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
                  <span className="font-mono font-semibold text-foreground">2.1.0-beta</span>
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


      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* TAB: CATEGORIES            */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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


      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* TAB: VIDEO TUTORIALS       */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
                className="bg-card rounded-xl border border-border shadow-soft overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-not-allowed opacity-75"
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


      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* TAB: LEGISLATION           */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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


      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* TAB: GLOSSARY               */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
