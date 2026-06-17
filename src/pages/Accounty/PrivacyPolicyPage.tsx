import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, CheckCircle2, FileText, Clock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const PRIVACY_CONSENT_KEY = 'accounty_privacy_consent';
const PRIVACY_VERSION = '1.0';

export interface PrivacyConsent {
  userId: string;
  acceptedAt: string;
  version: string;
}

/** Check if privacy policy has been accepted */
export function hasPrivacyConsent(): boolean {
  try {
    const raw = localStorage.getItem(PRIVACY_CONSENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed.version === PRIVACY_VERSION;
  } catch {
    return false;
  }
}

const sections = [
  {
    title: '1. Az adatkezelő',
    content: 'Az eaisybooks könyvelőiroda-kezelő szoftver üzemeltetője kezeli az Ön személyes adatait a GDPR (EU 2016/679 rendelet) és az információs önrendelkezési jogról szóló 2011. évi CXII. törvény (Infotv.) rendelkezéseinek megfelelően.',
  },
  {
    title: '2. Kezelt adatok köre',
    content: 'A rendszer az alábbi személyes adatokat kezeli:\n• Felhasználói azonosítók (név, e-mail, telefon)\n• Foglalkoztatotti adatok (TAJ, adóazonosító, bankszámlaszám, lakcím)\n• Bérszámfejtési adatok (bruttó/nettó bér, járulékok, kedvezmények)\n• Számla adatok (számlaszám, összeg, partner adatok)\n• Hozzáférési naplók (bejelentkezés, műveletek időbélyege)',
  },
  {
    title: '3. Az adatkezelés jogalapja',
    content: 'Az adatkezelés jogalapja:\n• Szerződés teljesítése (GDPR 6. cikk (1) b) — könyvelési szolgáltatás nyújtása)\n• Jogi kötelezettség (GDPR 6. cikk (1) c) — adó- és számviteli jogszabályok)\n• Hozzájárulás (GDPR 6. cikk (1) a) — analitikai célú adatgyűjtés)',
  },
  {
    title: '4. Az adatkezelés időtartama',
    content: 'A személyes adatok megőrzési ideje:\n• Számviteli bizonylatok: 8 év (Szt. 169. §)\n• Bérszámfejtési adatok: 5 év a jogviszony megszűnését követően\n• Hozzáférési naplók: 1 év\n• Felhasználói fiók adatok: a fiók törléséig',
  },
  {
    title: '5. Érintetti jogok',
    content: 'Önnek joga van:\n• Hozzáférés — személyes adatairól másolatot kérni\n• Helyesbítés — pontatlan adatokat javíttatni\n• Törlés — adatainak törlését kérni (\"elfeledtetéshez való jog\")\n• Adathordozhatóság — adatait géppel olvasható formátumban megkapni\n• Tiltakozás — az adatkezelés ellen tiltakozni\n\nKérelmét a Beállítások → Biztonság → GDPR menüpontban vagy e-mailben nyújthatja be.',
  },
  {
    title: '6. Adatbiztonság',
    content: 'A rendszer az alábbi biztonsági intézkedéseket alkalmazza:\n• TLS 1.3 titkosítás minden kommunikációhoz\n• Sor-szintű hozzáférés-vezérlés (RLS) az adatbázisban\n• Munkamenet időtúllépés konfigurálható időközönként\n• Hozzáférési napló minden felhasználói műveletről\n• Jelszó-kivonat tárolás (bcrypt)',
  },
  {
    title: '7. Sütik (Cookie-k)',
    content: 'A rendszer az alábbi sütiket használja:\n• Szükséges sütik — munkamenet és bejelentkezés kezelése (kötelező)\n• Funkcionális sütik — felhasználói beállítások megjegyzése (opcionális)\n• Analitikai sütik — használati statisztikák (opcionális)\n\nA süti beállításokat a belépéskor megjelenő banneren kezelheti.',
  },
  {
    title: '8. Kapcsolat',
    content: 'Adatvédelmi kérdésekkel kapcsolatban forduljon hozzánk:\n• E-mail: support@eaisybooks.hu\n• Az alkalmazáson belül: Beállítások → Biztonság → GDPR',
  },
];

export default function PrivacyPolicyPage() {
  const { user } = useAuth();
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    setAccepted(hasPrivacyConsent());
  }, []);

  const handleAccept = () => {
    const consent: PrivacyConsent = {
      userId: user?.id || 'anonymous',
      acceptedAt: new Date().toISOString(),
      version: PRIVACY_VERSION,
    };
    localStorage.setItem(PRIVACY_CONSENT_KEY, JSON.stringify(consent));
    setAccepted(true);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/accounty/settings" className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-primary to-primary/70 rounded-xl shadow-lg">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Adatkezelési tájékoztató</h1>
          <p className="text-sm text-muted-foreground">GDPR megfelelőségi dokumentum · v{PRIVACY_VERSION}</p>
        </div>
      </div>

      {/* Acceptance status */}
      {accepted && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Tájékoztató elfogadva</p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70">Legutóbb elfogadva: {new Date(JSON.parse(localStorage.getItem(PRIVACY_CONSENT_KEY) || '{}').acceptedAt || '').toLocaleDateString('hu-HU') || 'ismeretlen'}</p>
          </div>
        </div>
      )}

      {/* Last updated */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="w-3.5 h-3.5" />
        Utolsó frissítés: {new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, i) => (
          <div key={i} className="bg-card rounded-xl border border-border p-5 shadow-soft">
            <h2 className="text-sm font-bold text-foreground mb-2">{section.title}</h2>
            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{section.content}</div>
          </div>
        ))}
      </div>

      {/* Accept button */}
      {!accepted && (
        <div className="sticky bottom-4 bg-card/95 backdrop-blur border border-border rounded-xl p-4 shadow-lg flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Az eaisybooks használatával elfogadja az adatkezelési tájékoztatót.
          </p>
          <Button onClick={handleAccept} className="gap-1.5 bg-primary hover:bg-primary/90">
            <CheckCircle2 className="w-4 h-4" />
            Elfogadom
          </Button>
        </div>
      )}
    </div>
  );
}
