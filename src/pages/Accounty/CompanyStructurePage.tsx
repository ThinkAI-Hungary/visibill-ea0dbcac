import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Building, MapPin, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
  Users, FolderTree, Layers, Save, X, Hash
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Site {
  id: string;
  code: string;
  name: string;
  address: string;
  mainActivity: string;
  headcount: number;
}

interface CostCenter {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  responsible: string;
  headcount: number;
  children?: CostCenter[];
}

interface Department {
  id: string;
  name: string;
  siteId: string;
  headcount: number;
  manager: string;
}

const MOCK_SITES: Site[] = [
  { id: 's1', code: 'BP-01', name: 'Központi iroda', address: '1052 Budapest, Váci utca 12.', mainActivity: '6920 - Könyvvizsgálat', headcount: 28 },
  { id: 's2', code: 'DB-01', name: 'Debreceni fiók', address: '4026 Debrecen, Kossuth tér 5.', mainActivity: '6920 - Könyvvizsgálat', headcount: 8 },
  { id: 's3', code: 'GY-01', name: 'Győri raktár', address: '9021 Győr, Árpád út 44.', mainActivity: '5210 - Raktározás', headcount: 4 },
];

const MOCK_COST_TREE: CostCenter[] = [
  {
    id: 'cc1', code: 'CC-100', name: 'Vezetőség', parentId: null, responsible: 'Kovács Péter', headcount: 3,
    children: [
      { id: 'cc1a', code: 'CC-110', name: 'Stratégia', parentId: 'cc1', responsible: 'Nagy Anna', headcount: 2 },
    ]
  },
  {
    id: 'cc2', code: 'CC-200', name: 'Könyvelés', parentId: null, responsible: 'Szabó Éva', headcount: 18,
    children: [
      { id: 'cc2a', code: 'CC-210', name: 'Bérszámfejtés', parentId: 'cc2', responsible: 'Tóth Gábor', headcount: 6 },
      { id: 'cc2b', code: 'CC-220', name: 'Főkönyvi könyvelés', parentId: 'cc2', responsible: 'Varga László', headcount: 8 },
      { id: 'cc2c', code: 'CC-230', name: 'Adótanácsadás', parentId: 'cc2', responsible: 'Molnár Kata', headcount: 4 },
    ]
  },
  {
    id: 'cc3', code: 'CC-300', name: 'IT és fejlesztés', parentId: null, responsible: 'Kiss Béla', headcount: 6,
    children: [
      { id: 'cc3a', code: 'CC-310', name: 'Szoftverfejlesztés', parentId: 'cc3', responsible: 'Horváth Dávid', headcount: 4 },
      { id: 'cc3b', code: 'CC-320', name: 'Infrastruktúra', parentId: 'cc3', responsible: 'Balogh Zsolt', headcount: 2 },
    ]
  },
  {
    id: 'cc4', code: 'CC-400', name: 'Adminisztráció', parentId: null, responsible: 'Fekete Júlia', headcount: 5,
    children: []
  },
];

const MOCK_DEPARTMENTS: Department[] = [
  { id: 'd1', name: 'Pénzügy', siteId: 's1', headcount: 8, manager: 'Nagy Anna' },
  { id: 'd2', name: 'HR', siteId: 's1', headcount: 3, manager: 'Kiss Júlia' },
  { id: 'd3', name: 'Könyvelés', siteId: 's1', headcount: 12, manager: 'Szabó Éva' },
  { id: 'd4', name: 'Ügyfélszolgálat', siteId: 's2', headcount: 5, manager: 'Horváth Gábor' },
  { id: 'd5', name: 'Logisztika', siteId: 's3', headcount: 4, manager: 'Tóth Béla' },
];

export default function CompanyStructurePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'sites' | 'costcenters' | 'departments'>('sites');
  const [sites] = useState(MOCK_SITES);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['cc1', 'cc2', 'cc3']));
  const [showNewSite, setShowNewSite] = useState(false);
  const [newSite, setNewSite] = useState({ code: '', name: '', address: '', mainActivity: '' });

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });
  };

  const renderCostCenterNode = (node: CostCenter, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);

    return (
      <React.Fragment key={node.id}>
        <div
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer border-b border-border/30',
          )}
          style={{ paddingLeft: `${16 + depth * 24}px` }}
          onClick={() => hasChildren && toggleNode(node.id)}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <div className="w-4 h-4 shrink-0" />
          )}
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
            depth === 0 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' :
            depth === 1 ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' :
            'bg-slate-100 text-slate-500 dark:bg-slate-700'
          )}>
            <FolderTree className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">{node.code}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{node.name}</span>
            </div>
            <p className="text-xs text-slate-500">Felelős: {node.responsible}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Users className="w-3 h-3" /> {node.headcount} fő
            </span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Edit2 className="w-3 h-3" /></Button>
          </div>
        </div>
        {isExpanded && node.children?.map(child => renderCostCenterNode(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/accounty/client/${id}`} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/25">
          <Building className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bérezési struktúra</h1>
          <p className="text-sm text-slate-500">Telephelyek, költséghelyek, részlegek</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Telephelyek', count: sites.length, icon: MapPin, color: 'from-amber-500 to-orange-500' },
          { label: 'Költséghelyek', count: MOCK_COST_TREE.reduce((s, n) => s + 1 + (n.children?.length || 0), 0), icon: FolderTree, color: 'from-indigo-500 to-blue-500' },
          { label: 'Részlegek', count: MOCK_DEPARTMENTS.length, icon: Layers, color: 'from-emerald-500 to-teal-500' },
        ].map(c => (
          <div key={c.label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className={cn('p-2 rounded-lg bg-gradient-to-br text-white', c.color)}>
              <c.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-2xl font-bold">{c.count}</p>
              <p className="text-xs text-slate-500">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5 w-fit">
        {[
          { id: 'sites' as const, label: 'Telephelyek', icon: MapPin },
          { id: 'costcenters' as const, label: 'Költséghelyek', icon: FolderTree },
          { id: 'departments' as const, label: 'Részlegek', icon: Layers },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-all',
              tab === t.id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Sites tab */}
      {tab === 'sites' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowNewSite(true)} className="gap-1.5 bg-amber-600 hover:bg-amber-700" size="sm">
              <Plus className="w-3.5 h-3.5" /> Új telephely
            </Button>
          </div>

          {showNewSite && (
            <div className="bg-card rounded-xl border-2 border-amber-300 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Új telephely hozzáadása</h3>
                <button onClick={() => setShowNewSite(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Telephely kód</label>
                  <input type="text" value={newSite.code} onChange={e => setNewSite(s => ({ ...s, code: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-amber-500 outline-none" placeholder="SZ-01" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Megnevezés</label>
                  <input type="text" value={newSite.name} onChange={e => setNewSite(s => ({ ...s, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="Szegedi iroda" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Cím</label>
                  <input type="text" value={newSite.address} onChange={e => setNewSite(s => ({ ...s, address: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="6720 Szeged, Kárász utca 10." />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Főtevékenység (TEÁOR)</label>
                  <input type="text" value={newSite.mainActivity} onChange={e => setNewSite(s => ({ ...s, mainActivity: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-amber-500 outline-none" placeholder="6920 - Könyvvizsgálat" />
                </div>
                <div className="flex items-end">
                  <Button className="gap-1.5 bg-amber-600 hover:bg-amber-700" size="sm">
                    <Save className="w-3.5 h-3.5" /> Mentés
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50/30 dark:bg-slate-900/20">
                  <th className="text-left px-5 py-2.5 text-xs font-bold text-slate-500 uppercase">Kód</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Megnevezés</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Cím</th>
                  <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Főtevékenység</th>
                  <th className="text-center px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Létszám</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {sites.map(site => (
                  <tr key={site.id} className="border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{site.code}</td>
                    <td className="px-3 py-3 font-medium">{site.name}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{site.address}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{site.mainActivity}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-xs font-bold">{site.headcount} fő</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Edit2 className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-t border-border text-xs text-slate-500">
              Összesen: {sites.reduce((s, site) => s + site.headcount, 0)} fő
            </div>
          </div>
        </div>
      )}

      {/* Cost centers tab */}
      {tab === 'costcenters' && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Költséghelyi hierarchia</h2>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Plus className="w-3 h-3" /> Új költséghely</Button>
          </div>
          {MOCK_COST_TREE.map(node => renderCostCenterNode(node))}
          <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-t border-border text-xs text-slate-500">
            Összesen: {MOCK_COST_TREE.reduce((s, n) => s + n.headcount, 0)} fő
          </div>
        </div>
      )}

      {/* Departments tab */}
      {tab === 'departments' && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Részlegek és csoportok</h2>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Plus className="w-3 h-3" /> Új részleg</Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/30 dark:bg-slate-900/20">
                <th className="text-left px-5 py-2.5 text-xs font-bold text-slate-500 uppercase">Részleg</th>
                <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Telephely</th>
                <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Vezető</th>
                <th className="text-center px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Létszám</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {MOCK_DEPARTMENTS.map(dept => {
                const site = sites.find(s => s.id === dept.siteId);
                return (
                  <tr key={dept.id} className="border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3 font-medium flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-500" />
                      {dept.name}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">{site?.name || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{dept.manager}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full text-xs font-bold">
                        {dept.headcount} fő
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Edit2 className="w-3 h-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-t border-border text-xs text-slate-500">
            Összesen: {MOCK_DEPARTMENTS.reduce((s, d) => s + d.headcount, 0)} fő, {new Set(MOCK_DEPARTMENTS.map(d => d.siteId)).size} telephelyen
          </div>
        </div>
      )}
    </div>
  );
}
