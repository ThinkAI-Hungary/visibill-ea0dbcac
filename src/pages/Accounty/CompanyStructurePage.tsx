import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building, MapPin, Plus, Edit2, Trash2, ChevronDown, ChevronRight,
  Users, FolderTree, Layers, Save, X, Loader2, ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  useSites, useAddSite, useUpdateSite, useDeleteSite,
  useCostCenters, useAddCostCenter, useUpdateCostCenter, useDeleteCostCenter,
  useDepartments, useAddDepartment, useUpdateDepartment, useDeleteDepartment,
  type Site, type CostCenter, type Department,
} from '@/hooks/accounty';

export default function CompanyStructurePage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState<'sites' | 'costcenters' | 'departments'>('sites');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Data
  const { data: sites, isLoading: sitesLoading } = useSites(id || '');
  const addSiteMut = useAddSite();
  const updateSiteMut = useUpdateSite();
  const deleteSiteMut = useDeleteSite();

  const { data: costCenters, isLoading: ccLoading } = useCostCenters(id || '');
  const addCCMut = useAddCostCenter();
  const deleteCCMut = useDeleteCostCenter();

  const { data: departments, isLoading: deptsLoading } = useDepartments(id || '');
  const addDeptMut = useAddDepartment();
  const deleteDeptMut = useDeleteDepartment();

  // New forms
  const [showNewSite, setShowNewSite] = useState(false);
  const [newSite, setNewSite] = useState({ code: '', name: '', address: '', mainActivity: '', headcount: 0 });
  const [showNewCC, setShowNewCC] = useState(false);
  const [newCC, setNewCC] = useState({ code: '', name: '', responsible: '', parentId: '' as string | null, headcount: 0 });
  const [showNewDept, setShowNewDept] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', siteId: '' as string | null, manager: '', headcount: 0 });

  // Edit states
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editSite, setEditSite] = useState<Omit<Site, 'id' | 'companyId'>>({ code: '', name: '', address: '', mainActivity: '', headcount: 0 });

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
      return next;
    });
  };

  // Flatten cost centers for counting
  const flattenCC = (nodes: CostCenter[]): number => {
    let count = 0;
    for (const n of nodes) {
      count += 1;
      if (n.children) count += flattenCC(n.children);
    }
    return count;
  };

  const handleAddSite = async () => {
    if (!id || !newSite.name.trim()) return;
    try {
      await addSiteMut.mutateAsync({ companyId: id, ...newSite });
      setShowNewSite(false);
      setNewSite({ code: '', name: '', address: '', mainActivity: '', headcount: 0 });
      toast({ title: 'Telephely hozzáadva' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const handleSaveSiteEdit = async (site: Site) => {
    try {
      await updateSiteMut.mutateAsync({ ...site, ...editSite });
      setEditingSiteId(null);
      toast({ title: 'Telephely frissítve' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const handleDeleteSite = async (site: Site) => {
    if (!confirm(`Biztosan törlöd: "${site.name}"?`)) return;
    try {
      await deleteSiteMut.mutateAsync({ id: site.id, companyId: site.companyId });
      toast({ title: 'Törölve' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const handleAddCC = async () => {
    if (!id || !newCC.name.trim()) return;
    try {
      await addCCMut.mutateAsync({ companyId: id, parentId: newCC.parentId || null, code: newCC.code, name: newCC.name, responsible: newCC.responsible, headcount: newCC.headcount });
      setShowNewCC(false);
      setNewCC({ code: '', name: '', responsible: '', parentId: null, headcount: 0 });
      toast({ title: 'Költséghely hozzáadva' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const handleDeleteCC = async (cc: CostCenter) => {
    if (!confirm(`Biztosan törlöd: "${cc.name}"?`)) return;
    try {
      await deleteCCMut.mutateAsync({ id: cc.id, companyId: cc.companyId });
      toast({ title: 'Költséghely törölve' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const handleAddDept = async () => {
    if (!id || !newDept.name.trim()) return;
    try {
      await addDeptMut.mutateAsync({ companyId: id, siteId: newDept.siteId || null, name: newDept.name, manager: newDept.manager, headcount: newDept.headcount });
      setShowNewDept(false);
      setNewDept({ name: '', siteId: null, manager: '', headcount: 0 });
      toast({ title: 'Részleg hozzáadva' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const handleDeleteDept = async (dept: Department) => {
    if (!confirm(`Biztosan törlöd: "${dept.name}"?`)) return;
    try {
      await deleteDeptMut.mutateAsync({ id: dept.id, companyId: dept.companyId });
      toast({ title: 'Részleg törölve' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
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
            {node.responsible && <p className="text-xs text-slate-500">Felelős: {node.responsible}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Users className="w-3 h-3" /> {node.headcount} fő
            </span>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={e => { e.stopPropagation(); handleDeleteCC(node); }}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
        {isExpanded && node.children?.map(child => renderCostCenterNode(child, depth + 1))}
      </React.Fragment>
    );
  };

  const sitesList = sites || [];
  const ccList = costCenters || [];
  const deptsList = departments || [];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button 
          onClick={() => {
            if (window.history.state && window.history.state.idx > 0) {
              navigate(-1);
            } else {
              navigate(`/eaisybooks/${id}/${dateRange}/overview`);
            }
          }}
          className="flex items-center justify-center w-8 h-8 mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm shrink-0"
          title="Vissza"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/25">
            <Building className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bérezési struktúra</h1>
            <p className="text-sm text-slate-500">Telephelyek, költséghelyek, részlegek</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Telephelyek', count: sitesList.length, icon: MapPin, color: 'from-amber-500 to-orange-500' },
          { label: 'Költséghelyek', count: flattenCC(ccList), icon: FolderTree, color: 'from-indigo-500 to-blue-500' },
          { label: 'Részlegek', count: deptsList.length, icon: Layers, color: 'from-emerald-500 to-teal-500' },
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
                  <input type="text" value={newSite.code} onChange={e => setNewSite(s => ({ ...s, code: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" placeholder="SZ-01" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Megnevezés *</label>
                  <input type="text" value={newSite.name} onChange={e => setNewSite(s => ({ ...s, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="Szegedi iroda" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-500 mb-1 block">Cím</label>
                  <input type="text" value={newSite.address} onChange={e => setNewSite(s => ({ ...s, address: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="6720 Szeged, Kárász utca 10." />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Főtevékenység (TEÁOR)</label>
                  <input type="text" value={newSite.mainActivity} onChange={e => setNewSite(s => ({ ...s, mainActivity: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="6920 - Könyvvizsgálat" />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddSite} disabled={!newSite.name.trim() || addSiteMut.isPending} className="gap-1.5 bg-amber-600 hover:bg-amber-700" size="sm">
                    {addSiteMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Mentés
                  </Button>
                </div>
              </div>
            </div>
          )}

          {sitesLoading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
          ) : sitesList.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center text-sm text-slate-400">Nincsenek telephelyek. Adj hozzá az első telephelyet!</div>
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border dark:bg-slate-900/20">
                    <th className="text-left px-5 py-2.5 text-xs font-bold text-slate-500 uppercase">Kód</th>
                    <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Megnevezés</th>
                    <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Cím</th>
                    <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Főtevékenység</th>
                    <th className="text-center px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Létszám</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {sitesList.map(site => {
                    // Effective headcount: sum of departments assigned to this site, or site's own if no deps
                    const depsForSite = deptsList.filter(d => d.siteId === site.id);
                    const effectiveHeadcount = depsForSite.length > 0
                      ? depsForSite.reduce((s, d) => s + d.headcount, 0)
                      : site.headcount;
                    return (
                    <tr key={site.id} className="border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">{site.code}</td>
                      <td className="px-3 py-3 font-medium">{site.name}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{site.address}</td>
                      <td className="px-3 py-3 text-xs text-slate-500">{site.mainActivity}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-xs font-bold">{effectiveHeadcount} fő</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDeleteSite(site)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-5 py-3 dark:bg-slate-900/30 border-t border-border text-xs text-slate-500">
                Összesen: {sitesList.reduce((s, site) => {
                  const depsForSite = deptsList.filter(d => d.siteId === site.id);
                  return s + (depsForSite.length > 0 ? depsForSite.reduce((acc, d) => acc + d.headcount, 0) : site.headcount);
                }, 0)} fő
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cost centers tab */}
      {tab === 'costcenters' && (
        <div className="space-y-4">
          {showNewCC && (
            <div className="bg-card rounded-xl border-2 border-indigo-300 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Új költséghely</h3>
                <button onClick={() => setShowNewCC(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Kód</label>
                  <input type="text" value={newCC.code} onChange={e => setNewCC(s => ({ ...s, code: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" placeholder="CC-100" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Megnevezés *</label>
                  <input type="text" value={newCC.name} onChange={e => setNewCC(s => ({ ...s, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="Könyvelés" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Felelős</label>
                  <input type="text" value={newCC.responsible} onChange={e => setNewCC(s => ({ ...s, responsible: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="Kovács Péter" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Létszám</label>
                  <input type="number" min={0} value={newCC.headcount} onChange={e => setNewCC(s => ({ ...s, headcount: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" />
                </div>
                <div className="col-span-2 flex items-end justify-end">
                  <Button onClick={handleAddCC} disabled={!newCC.name.trim() || addCCMut.isPending} className="gap-1.5" size="sm">
                    {addCCMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Mentés
                  </Button>
                </div>
              </div>
            </div>
          )}

          {ccLoading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
              <div className="px-5 py-3 border-b border-border dark:bg-slate-900/30 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Költséghelyi hierarchia</h2>
                <Button variant="outline" size="sm" onClick={() => setShowNewCC(true)} className="gap-1.5 text-xs"><Plus className="w-3 h-3" /> Új költséghely</Button>
              </div>
              {ccList.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">Nincsenek költséghelyek.</div>
              ) : ccList.map(node => renderCostCenterNode(node))}
              <div className="px-5 py-3 dark:bg-slate-900/30 border-t border-border text-xs text-slate-500">
                {flattenCC(ccList)} költséghely
              </div>
            </div>
          )}
        </div>
      )}

      {/* Departments tab */}
      {tab === 'departments' && (
        <div className="space-y-4">
          {showNewDept && (
            <div className="bg-card rounded-xl border-2 border-emerald-300 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Új részleg</h3>
                <button onClick={() => setShowNewDept(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Részleg neve *</label>
                  <input type="text" value={newDept.name} onChange={e => setNewDept(s => ({ ...s, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="Pénzügy" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Telephely</label>
                  <select value={newDept.siteId || ''} onChange={e => setNewDept(s => ({ ...s, siteId: e.target.value || null }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                    <option value="">— Nincs megadva —</option>
                    {sitesList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Vezető</label>
                  <input type="text" value={newDept.manager} onChange={e => setNewDept(s => ({ ...s, manager: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm" placeholder="Kiss Júlia" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Létszám</label>
                  <input type="number" min={0} value={newDept.headcount} onChange={e => setNewDept(s => ({ ...s, headcount: Number(e.target.value) }))} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" />
                </div>
                <div className="col-span-2 flex items-end justify-end">
                  <Button onClick={handleAddDept} disabled={!newDept.name.trim() || addDeptMut.isPending} className="gap-1.5" size="sm">
                    {addDeptMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Mentés
                  </Button>
                </div>
              </div>
            </div>
          )}

          {deptsLoading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
              <div className="px-5 py-3 border-b border-border dark:bg-slate-900/30 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Részlegek és csoportok</h2>
                <Button variant="outline" size="sm" onClick={() => setShowNewDept(true)} className="gap-1.5 text-xs"><Plus className="w-3 h-3" /> Új részleg</Button>
              </div>
              {deptsList.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">Nincsenek részlegek.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border dark:bg-slate-900/20">
                      <th className="text-left px-5 py-2.5 text-xs font-bold text-slate-500 uppercase">Részleg</th>
                      <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Telephely</th>
                      <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Vezető</th>
                      <th className="text-center px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Létszám</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {deptsList.map(dept => {
                      const site = sitesList.find(s => s.id === dept.siteId);
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
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleDeleteDept(dept)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              <div className="px-5 py-3 dark:bg-slate-900/30 border-t border-border text-xs text-slate-500">
                Összesen: {deptsList.reduce((s, d) => s + d.headcount, 0)} fő{sitesList.length > 0 ? `, ${new Set(deptsList.filter(d => d.siteId).map(d => d.siteId)).size} telephelyen` : ''}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
