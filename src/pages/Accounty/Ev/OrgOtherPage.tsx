import React, { useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Building2, FileText, Calendar,
  TrendingUp, CheckCircle2, AlertTriangle, Info, Scale,
  Download, Users, Landmark, BookOpen, HelpCircle, ArrowRight, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useUpdateEvSettings, useEvClientSettings } from '@/hooks/useEvData';
import { useToast } from '@/hooks/use-toast';

// ─── Organization Types ─────────────────────────────────────────────────────

interface OrgTypeInfo {
  id: string;
  name: string;
  legalRef: string;
  description: string;
  bookkeeping: 'single' | 'double' | 'either';
  taxObligations: string[];
  icon: React.ElementType;
  color: string;
}

const ORG_TYPES: (OrgTypeInfo & { details?: string })[] = [
  {
    id: 'cooperative',
    name: 'Szövetkezet',
    legalRef: '2006. évi X. tv.',
    description: 'Tagjainak közös gazdálkodása érdekében működő szervezet.',
    bookkeeping: 'double',
    taxObligations: ['Társasági adó (TAO)', 'Áfa bevallás', 'Éves beszámoló', 'Adóelőleg'],
    icon: Users,
    color: 'from-blue-500 to-indigo-600',
    details: 'A szövetkezet a 2006. évi X. törvény alapján működő, tagjainak közös gazdasági érdekét szolgáló szervezet. Kettős könyvvitelt vezet, éves beszámolót készít. A szövetkezet tagjai korlátolt felelősséggel tartoznak. A TAO kulcs 9%, az osztalékot 15% SZJA terheli. Az áfa-bevallás gyakoriságát az éves árbevétel határozza meg.',
  },
  {
    id: 'church',
    name: 'Egyházi jogi személy',
    legalRef: '2011. CCVI. tv.',
    description: 'Vallási közösség jogi személyiséggel rendelkező szervezete.',
    bookkeeping: 'either',
    taxObligations: ['Beszámoló készítés', 'Adomány igazolás', 'ÁFA (ha alany)'],
    icon: Landmark,
    color: 'from-amber-500 to-orange-600',
    details: 'Egyházi jogi személyek a 2011. évi CCVI. törvény szerint működnek. Választhatnak egyszeres vagy kettős könyvvitel között. Az egyházi szervezet adómentesen kaphat adományokat, amiről adóigazolást állít ki (a magánszemély adójának 1%-a is ide irányítható). ÁFA-alanyiság csak gazdasági tevékenység esetén merül fel. Közhasznú jogállás esetén kedvezmények illetik meg.',
  },
  {
    id: 'nonprofit_kft',
    name: 'Nonprofit Kft.',
    legalRef: 'Ptk. 3:89. §',
    description: 'Üzletszerű gazdasági tevékenységet nem folytathat, de nonprofit célra működik.',
    bookkeeping: 'double',
    taxObligations: ['Társasági adó', 'Áfa bevallás', 'Éves beszámoló', 'Közhasznúsági melléklet'],
    icon: Building2,
    color: 'from-emerald-500 to-teal-600',
    details: 'A nonprofit Kft. a Ptk. 3:89. § alapján olyan gazdasági társaság, amely nem oszthat osztalékot — a nyereséget a létesítő okiratban meghatározott cél érdekében kell felhasználni. Kettős könyvvitelt vezet, éves beszámolót készít. TAO kötelezett (9%), de közhasznú jogállás esetén kedvezményes adózás lehetséges. Áfa-alany, ha gazdasági tevékenységet folytat.',
  },
  {
    id: 'political_party',
    name: 'Párt',
    legalRef: '1989. évi XXXIII. tv.',
    description: 'Politikai párt gazdálkodásának nyilvántartása.',
    bookkeeping: 'double',
    taxObligations: ['Éves pénzügyi beszámoló', 'ÁSZ ellenőrzés', 'Vagyonnyilatkozat'],
    icon: Scale,
    color: 'from-rose-500 to-pink-600',
    details: 'A pártok az 1989. évi XXXIII. törvény szerint gazdálkodnak. Kettős könyvvitelt vezetnek, éves pénzügyi beszámolót készítenek, amelyet az Állami Számvevőszék ellenőriz. Pártok vállalkozási tevékenységet nem folytathatnak. Az állami költségvetési támogatás és a tagdíjak a fő bevételi források.',
  },
  {
    id: 'water_utility',
    name: 'Vízitársulat',
    legalRef: '2009. évi CXLIV. tv.',
    description: 'Vízgazdálkodási közfeladat ellátására létrejött szervezet.',
    bookkeeping: 'double',
    taxObligations: ['Éves beszámoló', 'ÁFA', 'Társasági adó'],
    icon: Building2,
    color: 'from-cyan-500 to-blue-600',
    details: 'A vízitársulat a 2009. évi CXLIV. törvény alapján vízgazdálkodási közfeladat (árvízvédelem, belvízelvezetés, öntözés) ellátására alapított szervezet. Kettős könyvvitelt vezet, éves beszámolót készít. TAO és ÁFA kötelezett. A tagok érdekeltségi hozzájárulást fizetnek.',
  },
  {
    id: 'other',
    name: 'Egyéb gazdálkodó',
    legalRef: 'Szt. 3. § (1) bek.',
    description: 'A számviteli törvény hatálya alá tartozó egyéb gazdálkodó szervezet.',
    bookkeeping: 'either',
    taxObligations: ['Mérlegelés szükséges a szervezet típusa alapján'],
    icon: FileText,
    color: 'from-slate-500 to-gray-600',
    details: 'A számviteli törvény (2000. évi C. tv.) 3. § (1) bekezdése alapján a törvény hatálya alá tartozó egyéb gazdálkodó szervezet. A könyvvezetési mód (egyszeres/kettős) és az adókötelezettségek a szervezet konkrét jogi formájától és tevékenységétől függnek. Egyedi mérlegelés szükséges.',
  },
];

export default function OrgOtherPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [searchParams] = useSearchParams();
  const taxYear = Number(searchParams.get('year') || '2026');
  const { data: settings } = useEvClientSettings(id, taxYear);
  const navigate = useNavigate();
  const updateSettings = useUpdateEvSettings();
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const selectedOrg = ORG_TYPES.find(o => o.id === selectedType);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/accounty/client/${id}/ev?year=${taxYear}`} className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Áttekintés
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Egyéb szervezetek</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Egyéb szervezetek</h1>
        <p className="text-sm text-slate-500 mt-1">
          {client?.name || 'Szervezet'} · Válassza ki a szervezeti formát a könyvelési és adózási konfigurációhoz.
        </p>
      </div>

      {/* Organization type grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ORG_TYPES.map(org => {
          const Icon = org.icon;
          const isSelected = selectedType === org.id;
          return (
            <button
              key={org.id}
              onClick={() => setSelectedType(org.id)}
              className={cn(
                'bg-card rounded-xl border-2 p-4 text-left transition-all group',
                isSelected
                  ? 'border-primary shadow-lg shadow-primary/10'
                  : 'border-border hover:border-primary/30 hover:shadow-md'
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={cn('p-2 rounded-xl bg-gradient-to-br shadow-sm', org.color)}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{org.name}</h3>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <p className="text-[10px] text-slate-400">{org.legalRef}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mb-3">{org.description}</p>
              <div className="flex items-center gap-2 text-[10px]">
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full font-semibold',
                  org.bookkeeping === 'single' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                    : org.bookkeeping === 'double' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                )}>
                  {org.bookkeeping === 'single' ? 'Egyszeres' : org.bookkeeping === 'double' ? 'Kettős' : 'Választható'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      {selectedOrg && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-5 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <div className={cn('p-2.5 rounded-xl bg-gradient-to-br shadow-sm', selectedOrg.color)}>
              <selectedOrg.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedOrg.name}</h2>
              <p className="text-xs text-slate-500">{selectedOrg.legalRef} · {selectedOrg.description}</p>
            </div>
          </div>

          {/* Bookkeeping requirement */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Könyvvezetési kötelezettség
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {selectedOrg.bookkeeping === 'single'
                ? 'Egyszeres könyvvitel alkalmazása kötelező.'
                : selectedOrg.bookkeeping === 'double'
                ? 'Kettős könyvvitel alkalmazása kötelező.'
                : 'A szervezet választhat egyszeres és kettős könyvvitel között a törvényi feltételek alapján.'
              }
            </p>
          </div>

          {/* Tax obligations */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" /> Adózási és bevallási kötelezettségek
            </h3>
            <div className="space-y-1.5">
              {selectedOrg.taxObligations.map((obl, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
                  {obl}
                </div>
              ))}
            </div>
          </div>

          {/* Action */}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <button
              disabled={updateSettings.isPending}
              onClick={() => {
                if (!selectedOrg || !id) return;
                const orgTypeMap: Record<string, string> = {
                  cooperative: 'egyeb', church: 'egyhaz', nonprofit_kft: 'egyeb',
                  political_party: 'egyeb', water_utility: 'egyeb', other: 'egyeb',
                };
                const bookkeepingMode = selectedOrg.bookkeeping === 'single' ? 'egyszeres' : 'kettos';
                updateSettings.mutate({
                  company_id: id,
                  tax_year: taxYear,
                  org_type: (orgTypeMap[selectedOrg.id] || 'egyeb') as any,
                  bookkeeping_mode: bookkeepingMode as any,
                }, {
                  onSuccess: () => {
                    toast({ title: 'Konfiguráció mentve', description: `${selectedOrg.name} — ${bookkeepingMode === 'egyszeres' ? 'Egyszeres' : 'Kettős'} könyvvitel` });
                    navigate(`/accounty/client/${id}/ev?year=${taxYear}`);
                  },
                  onError: (err: any) => {
                    toast({ title: 'Hiba', description: err?.message || 'Mentés sikertelen', variant: 'destructive' });
                  },
                });
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {updateSettings.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Konfiguráció indítása <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowInfo(p => !p)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm border rounded-lg transition-colors',
                showInfo
                  ? 'text-primary border-primary bg-primary/5'
                  : 'text-slate-600 border-border hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              <HelpCircle className="w-3.5 h-3.5" /> {showInfo ? 'Tájékoztató elrejtése' : 'Részletes tájékoztató'}
            </button>
          </div>

          {/* Detailed info panel */}
          {showInfo && selectedOrg && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-5 space-y-3 animate-in slide-in-from-top-2 duration-300">
              <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                {selectedOrg.name} — Részletes tájékoztató
              </h3>
              <p className="text-xs text-indigo-800 dark:text-indigo-300 leading-relaxed">
                {(selectedOrg as any).details || 'Nincs részletes leírás.'}
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Jogszabályi háttér</p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{selectedOrg.legalRef}</p>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Könyvvezetés</p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {selectedOrg.bookkeeping === 'single' ? 'Egyszeres könyvvitel (kötelező)'
                      : selectedOrg.bookkeeping === 'double' ? 'Kettős könyvvitel (kötelező)'
                      : 'Egyszeres vagy kettős (választható)'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <p className="font-semibold">Egyszeres könyvvitelt vezető egyéb szervezetek</p>
            <p>A számviteli törvény (2000. évi C. tv.) 161. § alapján az egyszeres könyvvitel alkalmazására kötelezett vagy azt választó szervezetek nyilvántartásainak kezelése.</p>
            <p className="text-blue-500/70">A szervezeti forma kiválasztása után a rendszer automatikusan konfigurálja a szükséges nyilvántartásokat és bevallási kötelezettségeket.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
