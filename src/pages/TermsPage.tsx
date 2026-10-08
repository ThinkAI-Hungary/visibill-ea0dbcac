import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Download, ExternalLink, FileText, Shield, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TermsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active document from path
  const isPrivacyPath = location.pathname.includes('privacy') || location.pathname.includes('adatvedelem') || location.pathname.includes('adatkezeles');
  const [activeDoc, setActiveDoc] = useState<'aszf' | 'privacy'>(isPrivacyPath ? 'privacy' : 'aszf');

  useEffect(() => {
    if (isPrivacyPath) {
      setActiveDoc('privacy');
    } else {
      setActiveDoc('aszf');
    }
  }, [location.pathname, isPrivacyPath]);

  const docConfig = {
    aszf: {
      title: 'Általános Szerződési Feltételek',
      shortTitle: 'ÁSZF',
      subtitle: 'Visibill & eaisybill / eaisybooks felhőszolgáltatás hatályos szerződési feltételei',
      pdfUrl: '/docs/aszf.pdf',
      fileName: 'Visibill_ASZF.pdf',
      badge: 'Hatályos ÁSZF',
      icon: FileText,
    },
    privacy: {
      title: 'Adatkezelési Tájékoztató',
      shortTitle: 'Adatkezelési Tájékoztató',
      subtitle: 'Tájékoztatás a személyes adatok kezeléséről (GDPR & Infotv. megfelelőség)',
      pdfUrl: '/docs/adatkezelesi-tajekoztato.pdf',
      fileName: 'Visibill_Adatkezelesi_Tajekoztato.pdf',
      badge: 'GDPR Megfelelőség',
      icon: Shield,
    },
  };

  const current = docConfig[activeDoc];
  const Icon = current.icon;

  const handleTabChange = (value: string) => {
    const nextDoc = value as 'aszf' | 'privacy';
    setActiveDoc(nextDoc);
    // Update URL history without page reload
    if (nextDoc === 'privacy') {
      window.history.replaceState(null, '', '/adatvedelem');
    } else {
      window.history.replaceState(null, '', '/aszf');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background text-foreground flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.history.length > 2) {
                  navigate(-1);
                } else {
                  navigate('/auth');
                }
              }}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Vissza</span>
            </Button>

            <div className="h-4 w-px bg-border hidden sm:block" />

            {/* Logo */}
            <Link to="/auth" className="flex items-center gap-1.5 select-none">
              <span className="text-xl tracking-tight">
                <span className="font-semibold text-foreground/90">e</span>
                <span className="font-bold text-primary">ai</span>
                <span className="font-semibold text-foreground/90">sy</span>
                <span className="font-medium text-primary">bill</span>
              </span>
            </Link>
          </div>

          {/* Document Switcher Tabs */}
          <Tabs value={activeDoc} onValueChange={handleTabChange} className="w-auto">
            <TabsList className="bg-muted/70 p-1">
              <TabsTrigger value="aszf" className="gap-2 text-xs sm:text-sm font-medium">
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">ÁSZF</span>
                <span className="xs:hidden">ÁSZF</span>
              </TabsTrigger>
              <TabsTrigger value="privacy" className="gap-2 text-xs sm:text-sm font-medium">
                <Shield className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Adatkezelési tájékoztató</span>
                <span className="sm:hidden">Adatvédelem</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
              <a href={current.pdfUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Megnyitás új lapon</span>
              </a>
            </Button>
            <Button size="sm" asChild className="gap-1.5 text-xs shadow-xs">
              <a href={current.pdfUrl} download={current.fileName}>
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Letöltés (PDF)</span>
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        {/* Document Header Card */}
        <div className="bg-card border border-border/80 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                {current.title}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                {current.badge}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {current.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40 shrink-0">
            <div>
              <p className="font-medium text-foreground">Formátum: Hivatalos PDF</p>
              <p>Minden eszközről elérhető és letölthető</p>
            </div>
          </div>
        </div>

        {/* Embedded PDF Viewer Frame */}
        <div className="flex-1 bg-card border border-border rounded-xl shadow-xs overflow-hidden flex flex-col min-h-[750px]">
          <iframe
            src={`${current.pdfUrl}#toolbar=1&navpanes=0`}
            title={current.title}
            className="w-full flex-1 min-h-[750px] border-0 bg-white"
          />
          {/* Fallback & Download reminder bar */}
          <div className="p-3 bg-muted/30 border-t border-border flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-2">
            <span>
              Ha a böngésződ nem jeleníti meg közvetlenül a PDF dokumentumot, töltsd le a gépedre vagy nyisd meg külső alkalmazásban.
            </span>
            <a
              href={current.pdfUrl}
              download={current.fileName}
              className="text-primary hover:underline font-medium flex items-center gap-1 shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              {current.fileName} letöltése
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background/80 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-2">
          <p>© {new Date().getFullYear()} Visibill Kft. Minden jog fenntartva.</p>
          <div className="flex items-center gap-4">
            <Link to="/aszf" className="hover:underline hover:text-foreground">
              Általános Szerződési Feltételek
            </Link>
            <span>•</span>
            <Link to="/adatvedelem" className="hover:underline hover:text-foreground">
              Adatkezelési Tájékoztató
            </Link>
            <span>•</span>
            <Link to="/auth" className="hover:underline hover:text-foreground">
              Bejelentkezés
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
