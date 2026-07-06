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
import {
  HelpOverviewSection, HelpCategoriesSection, HelpVideosSection,
  HelpLegislationSection, HelpGlossarySection,
} from './help/HelpTabSections';






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



      {/* Tab Content */}
      {activeTab === 'overview' && (
        <HelpOverviewSection filteredFaqs={filteredFaqs} searchActive={!!q} />
      )}
      {activeTab === 'categories' && (
        <HelpCategoriesSection filteredCategories={filteredCategories} searchActive={!!q} />
      )}
      {activeTab === 'videos' && (
        <HelpVideosSection filteredVideos={filteredVideos} searchActive={!!q} />
      )}
      {activeTab === 'legislation' && (
        <HelpLegislationSection filteredLegislations={filteredLegislations} searchActive={!!q} />
      )}
      {activeTab === 'glossary' && (
        <HelpGlossarySection filteredGlossary={filteredGlossary} searchActive={!!q} />
      )}
    </div>
  );
}
