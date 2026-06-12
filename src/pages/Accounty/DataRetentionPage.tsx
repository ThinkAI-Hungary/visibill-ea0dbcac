import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Shield, FileText, Clock, AlertTriangle, CheckCircle,
  Upload, Trash2, Eye, Download, Database, Plus, Save, Loader2, Pencil, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useRetentionRules, useSeedRetentionRules, useUpdateRetentionRule,
  useAddRetentionRule, useDeleteRetentionRule,
  useDataContracts, useAddDataContract, useDeleteDataContract,
  type RetentionRule, type DataContract,
} from '@/hooks/useAccountyData';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const REQUEST_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  access: { label: 'Hozzáférési', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  rectification: { label: 'Helyesbítési', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' },
  restriction: { label: 'Korlátozási', color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
  deletion: { label: 'Törlési', color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
};

export default function DataRetentionPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [tab, setTab] = useState<'retention' | 'contracts' | 'requests'>('retention');
  const [dragging, setDragging] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ years: number; autoDelete: boolean; legalBasis: string }>({ years: 3, autoDelete: false, legalBasis: '' });
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ docType: '', retentionYears: 3, legalBasis: '', autoDelete: false });
  const [showAddContract, setShowAddContract] = useState(false);
  const [newContract, setNewContract] = useState({ partnerName: '', validUntil: '' });
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data hooks
  const { data: rules, isLoading: rulesLoading } = useRetentionRules(id || '');
  const seedMutation = useSeedRetentionRules();
  const updateRuleMutation = useUpdateRetentionRule();
  const addRuleMutation = useAddRetentionRule();
  const deleteRuleMutation = useDeleteRetentionRule();
  const { data: contracts, isLoading: contractsLoading } = useDataContracts(id || '');
  const addContractMutation = useAddDataContract();
  const deleteContractMutation = useDeleteDataContract();

  const handleSeedDefaults = async () => {
    if (!id) return;
    try {
      await seedMutation.mutateAsync(id);
      toast({ title: 'Alapértelmezések betöltve', description: 'Magyar jogszabályok szerinti megőrzési idők beállítva.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const startEdit = (rule: RetentionRule) => {
    setEditingRuleId(rule.id);
    setEditValues({ years: rule.retentionYears, autoDelete: rule.autoDelete, legalBasis: rule.legalBasis });
  };

  const saveEdit = async (rule: RetentionRule) => {
    try {
      await updateRuleMutation.mutateAsync({
        ...rule,
        retentionYears: editValues.years,
        autoDelete: editValues.autoDelete,
        legalBasis: editValues.legalBasis,
      });
      setEditingRuleId(null);
      toast({ title: 'Mentve', description: `${rule.docType} megőrzési ideje frissítve.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const handleAddRule = async () => {
    if (!id || !newRule.docType.trim()) return;
    try {
      await addRuleMutation.mutateAsync({ companyId: id, ...newRule });
      setShowAddRule(false);
      setNewRule({ docType: '', retentionYears: 3, legalBasis: '', autoDelete: false });
      toast({ title: 'Hozzáadva', description: `${newRule.docType} felvéve a megőrzési szabályokhoz.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const handleDeleteRule = async (rule: RetentionRule) => {
    try {
      await deleteRuleMutation.mutateAsync({ id: rule.id, companyId: rule.companyId });
      toast({ title: 'Törölve', description: `${rule.docType} eltávolítva.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const handleAddContract = async () => {
    if (!id || !newContract.partnerName.trim() || !contractFile) return;
    setUploading(true);
    try {
      // Upload file to Supabase Storage
      const ext = contractFile.name.split('.').pop();
      const safeName = contractFile.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/[^a-zA-Z0-9._-]/g, '_'); // replace everything else with _
      const storagePath = `contracts/${id}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('accounty_contracts')
        .upload(storagePath, contractFile, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('accounty_contracts')
        .getPublicUrl(storagePath);

      await addContractMutation.mutateAsync({
        companyId: id,
        partnerName: newContract.partnerName,
        fileName: contractFile.name,
        fileUrl: storagePath,
        uploadDate: new Date().toISOString().split('T')[0],
        validUntil: newContract.validUntil || null,
        status: 'active',
      });
      setShowAddContract(false);
      setNewContract({ partnerName: '', validUntil: '' });
      setContractFile(null);
      toast({ title: 'Szerződés feltöltve', description: `${contractFile.name} sikeresen feltöltve.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const getDownloadUrl = (fileUrl: string) => {
    if (!fileUrl) return '';
    const { data } = supabase.storage.from('accounty_contracts').getPublicUrl(fileUrl);
    return data.publicUrl;
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/accounty/client/${id}`} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg shadow-red-500/25">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Iratkezelés és GDPR</h1>
          <p className="text-sm text-slate-500">Megőrzési szabályzat, adatfeldolgozói szerződések, érintetti kérelmek</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5 w-fit">
        {[
          { id: 'retention' as const, label: 'Megőrzési idők', icon: Clock },
          { id: 'contracts' as const, label: 'Adatfeldolgozói szerződések', icon: FileText },
          { id: 'requests' as const, label: 'Érintetti kérelmek', icon: Database },
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

      {/* Retention rules table */}
      {tab === 'retention' && (
        <div className="space-y-4">
          {rulesLoading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> Betöltés...
            </div>
          ) : (rules || []).length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
              <Clock className="w-10 h-10 mx-auto text-slate-400" />
              <p className="text-sm text-slate-500">Nincsenek megőrzési szabályok beállítva ehhez a céghez.</p>
              <Button onClick={handleSeedDefaults} disabled={seedMutation.isPending} className="gap-1.5">
                {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Alapértelmezések betöltése (magyar jogszabályok)
              </Button>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Dokumentumtípusok és megőrzési idők</h2>
                <Button variant="outline" size="sm" onClick={() => setShowAddRule(true)} className="gap-1 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Új típus
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50/30 dark:bg-slate-900/20">
                      <th className="text-left px-5 py-2.5 text-xs font-bold text-slate-500 uppercase">Dokumentumtípus</th>
                      <th className="text-center px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Megőrzés</th>
                      <th className="text-left px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Jogalap</th>
                      <th className="text-center px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Auto törlés</th>
                      <th className="text-center px-3 py-2.5 text-xs font-bold text-slate-500 uppercase">Műveletek</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rules || []).map((rule) => (
                      <tr key={rule.id} className="border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{rule.docType}</td>
                        <td className="px-3 py-3 text-center">
                          {editingRuleId === rule.id ? (
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={editValues.years}
                              onChange={e => setEditValues(v => ({ ...v, years: Number(e.target.value) }))}
                              className="w-16 px-2 py-1 rounded border border-border bg-background text-sm text-center font-mono"
                            />
                          ) : (
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-bold',
                              rule.retentionYears >= 50 ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                              rule.retentionYears >= 8 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                              'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                            )}>
                              {rule.retentionYears} év
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-500 font-mono">
                          {editingRuleId === rule.id ? (
                            <input
                              type="text"
                              value={editValues.legalBasis}
                              onChange={e => setEditValues(v => ({ ...v, legalBasis: e.target.value }))}
                              className="w-full px-2 py-1 rounded border border-border bg-background text-xs font-mono"
                            />
                          ) : rule.legalBasis}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {editingRuleId === rule.id ? (
                            <input
                              type="checkbox"
                              checked={editValues.autoDelete}
                              onChange={e => setEditValues(v => ({ ...v, autoDelete: e.target.checked }))}
                              className="rounded"
                            />
                          ) : (
                            <div className={cn(
                              'w-5 h-5 rounded-full mx-auto flex items-center justify-center',
                              rule.autoDelete ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-slate-100 dark:bg-slate-700'
                            )}>
                              {rule.autoDelete ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <span className="text-slate-400 text-[10px]">—</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {editingRuleId === rule.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => saveEdit(rule)} disabled={updateRuleMutation.isPending}>
                                <Save className="w-3.5 h-3.5 text-emerald-600" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setEditingRuleId(null)}>
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="sm" onClick={() => startEdit(rule)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteRule(rule)} className="text-red-500 hover:text-red-600">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* Add new row */}
                    {showAddRule && (
                      <tr className="border-b border-border/50 bg-blue-50/50 dark:bg-blue-500/5">
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            value={newRule.docType}
                            onChange={e => setNewRule(r => ({ ...r, docType: e.target.value }))}
                            className="w-full px-2 py-1 rounded border border-border bg-background text-sm"
                            placeholder="Dokumentum típus..."
                            autoFocus
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={newRule.retentionYears}
                            onChange={e => setNewRule(r => ({ ...r, retentionYears: Number(e.target.value) }))}
                            className="w-16 px-2 py-1 rounded border border-border bg-background text-sm text-center font-mono"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={newRule.legalBasis}
                            onChange={e => setNewRule(r => ({ ...r, legalBasis: e.target.value }))}
                            className="w-full px-2 py-1 rounded border border-border bg-background text-xs font-mono"
                            placeholder="Jogalap..."
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={newRule.autoDelete}
                            onChange={e => setNewRule(r => ({ ...r, autoDelete: e.target.checked }))}
                            className="rounded"
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={handleAddRule} disabled={!newRule.docType.trim() || addRuleMutation.isPending}>
                              <Save className="w-3.5 h-3.5 text-emerald-600" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setShowAddRule(false)}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-t border-border text-xs text-slate-500">
                {(rules || []).length} dokumentumtípus konfigurálva
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contracts */}
      {tab === 'contracts' && (
        <div className="space-y-4">
          {contractsLoading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> Betöltés...
            </div>
          ) : (
            <>
              {/* Add contract form */}
              {showAddContract ? (
                <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                  <h3 className="text-sm font-bold">Új adatfeldolgozói szerződés</h3>
                  
                  {/* File drop zone */}
                  <div
                    className={cn(
                      'border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer',
                      dragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 
                      contractFile ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10' :
                      'border-border hover:border-blue-300'
                    )}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) setContractFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) setContractFile(file);
                      }}
                    />
                    {contractFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileText className="w-6 h-6 text-emerald-600" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{contractFile.name}</p>
                          <p className="text-xs text-slate-500">{(contractFile.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setContractFile(null); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Szerződés feltöltése</p>
                        <p className="text-xs text-slate-400 mt-1">Drag & drop vagy kattintson ide (PDF, DOC)</p>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Partner neve *</label>
                      <input
                        type="text"
                        value={newContract.partnerName}
                        onChange={e => setNewContract(c => ({ ...c, partnerName: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                        placeholder="Pl. CloudBackup Zrt."
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Érvényes eddig</label>
                      <input
                        type="date"
                        value={newContract.validUntil}
                        onChange={e => setNewContract(c => ({ ...c, validUntil: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => { setShowAddContract(false); setContractFile(null); }}>Mégse</Button>
                    <Button
                      size="sm"
                      onClick={handleAddContract}
                      disabled={!newContract.partnerName.trim() || !contractFile || uploading}
                      className="gap-1"
                    >
                      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploading ? 'Feltöltés...' : 'Feltöltés és mentés'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => setShowAddContract(true)} className="gap-1.5">
                  <Plus className="w-4 h-4" /> Új szerződés feltöltése
                </Button>
              )}

              {/* Contracts list */}
              <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
                  <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Adatfeldolgozói szerződések (GDPR 28. cikk)</h2>
                </div>
                <div className="divide-y divide-border/50">
                  {(contracts || []).length === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-400">Nincs rögzített szerződés</div>
                  ) : (contracts || []).map(c => (
                    <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        c.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'
                      )}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold">{c.partnerName}</p>
                        <p className="text-xs text-slate-500">{c.fileName}</p>
                      </div>
                      <div className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-bold',
                        c.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                        'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                      )}>
                        {c.status === 'active' ? 'Érvényes' : 'Lejárt'}
                      </div>
                      <div className="text-xs text-slate-500 text-right">
                        <p>Feltöltve: {c.uploadDate}</p>
                        <p>Érvényes: {c.validUntil || '—'}</p>
                      </div>
                      {c.fileUrl && (
                        <div className="flex gap-1">
                          <a
                            href={getDownloadUrl(c.fileUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex"
                          >
                            <Button variant="ghost" size="sm"><Download className="w-3.5 h-3.5" /></Button>
                          </a>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                        disabled={deleteContractMutation.isPending}
                        onClick={() => {
                          if (confirm(`Biztosan törlöd a(z) "${c.partnerName}" szerződést?`)) {
                            deleteContractMutation.mutate(
                              { id: c.id, companyId: c.companyId, fileUrl: c.fileUrl },
                              { onSuccess: () => toast({ title: 'Törölve', description: `${c.partnerName} szerződés eltávolítva.` }) }
                            );
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* GDPR Requests — links to admin module */}
      {tab === 'requests' && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Érintetti kérelmek</h2>
            <Button variant="outline" size="sm" className="text-xs" asChild>
              <Link to="/accounty/admin/gdpr">Rendszerszintű GDPR modul →</Link>
            </Button>
          </div>
          <div className="py-12 text-center text-sm text-slate-400 space-y-2">
            <Database className="w-8 h-8 mx-auto text-slate-400" />
            <p>Az érintetti kérelmek kezelése a rendszerszintű GDPR modulból érhető el.</p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/accounty/admin/gdpr">Megnyitás →</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
