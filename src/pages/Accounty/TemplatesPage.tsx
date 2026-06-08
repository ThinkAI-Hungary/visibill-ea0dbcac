import React, { useState } from 'react';
import { FileText, Plus, Edit3, Check, X, History, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useTemplates, useSaveTemplate, useTemplateVersions } from '@/hooks/useAdminData';

const CATEGORIES = [
  { id: 'data_request', label: 'Adatbekérő' },
  { id: 'missing_docs', label: 'Hiánypótlás' },
  { id: 'payslip', label: 'Bérjegyzék' },
  { id: 'monthly_docs', label: 'Havi dokumentumok' },
  { id: 'm30', label: 'M30 küldés' },
  { id: 'custom', label: 'Egyéb' },
];

const VARIABLES = [
  { key: '[Cég]', label: 'Cég neve' },
  { key: '[Hónap]', label: 'Hónap' },
  { key: '[Év]', label: 'Év' },
  { key: '[Hiányzó dokumentumok]', label: 'Hiányzó dokumentumok' },
  { key: '[Foglalkoztatott neve]', label: 'Foglalkoztatott neve' },
  { key: '[Határidő]', label: 'Határidő' },
  { key: '[Link]', label: 'Portál link' },
];

export default function TemplatesPage() {
  const [selectedCat, setSelectedCat] = useState('data_request');
  const { data: templates = [], isLoading } = useTemplates(selectedCat);
  const saveTemplate = useSaveTemplate();
  const [editModal, setEditModal] = useState<any>(null);
  const [versionModal, setVersionModal] = useState<string | null>(null);
  const { data: versions = [] } = useTemplateVersions(versionModal || undefined);

  const [form, setForm] = useState({
    name: '',
    subject: '',
    body_markdown: '',
  });

  const openCreate = () => {
    setForm({ name: '', subject: '', body_markdown: '' });
    setEditModal({ isNew: true });
  };

  const openEdit = (t: any) => {
    setForm({ name: t.name, subject: t.subject || '', body_markdown: t.body_markdown || '' });
    setEditModal(t);
  };

  const handleSave = () => {
    saveTemplate.mutate({
      id: editModal?.isNew ? undefined : editModal?.id,
      category: selectedCat,
      name: form.name,
      subject: form.subject,
      body_markdown: form.body_markdown,
    }, {
      onSuccess: () => setEditModal(null),
    });
  };

  const insertVariable = (v: string) => {
    setForm(f => ({ ...f, body_markdown: f.body_markdown + v }));
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl shadow-lg shadow-violet-500/25">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sablonok</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Üzenet- és e-mail sablonok karbantartása</p>
          </div>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Új sablon
        </Button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-1 overflow-x-auto">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedCat(c.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              selectedCat === c.id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Template cards */}
      <div className="grid gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))
        ) : templates.length === 0 ? (
          <div className="py-16 text-center bg-card rounded-xl border border-border">
            <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-400 mb-4">Nincs sablon ebben a kategóriában</p>
            <Button variant="outline" size="sm" onClick={openCreate}>Sablon létrehozása</Button>
          </div>
        ) : (
          templates.map((t: any) => (
            <div key={t.id} className="bg-card rounded-xl border border-border shadow-soft p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{t.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${t.is_active ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'}`}>
                      {t.is_active ? 'Aktív' : 'Inaktív'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">v{t.version}</span>
                  </div>
                  {t.subject && <p className="text-xs text-slate-500 mb-1">Tárgy: {t.subject}</p>}
                  <p className="text-xs text-slate-400 line-clamp-2">{t.body_markdown?.slice(0, 200)}</p>
                </div>
                <div className="flex items-center gap-1 ml-3">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setVersionModal(t.id)}>
                    <History className="w-4 h-4 text-slate-400" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                    <Edit3 className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Módosítva: {new Date(t.updated_at).toLocaleDateString('hu-HU')}</p>
            </div>
          ))
        )}
      </div>

      {/* Edit modal */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent className="sm:max-w-2xl bg-card max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editModal?.isNew ? 'Új sablon' : 'Sablon szerkesztése'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sablon neve</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tárgy sor</label>
              <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="mt-1" placeholder="Email tárgy..." />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Változók</label>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map(v => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    {v.key}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sablon szövege (Markdown)</label>
              <textarea
                value={form.body_markdown}
                onChange={e => setForm(f => ({ ...f, body_markdown: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-mono min-h-[250px] focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Kedves [Cég],&#10;&#10;Kérjük az alábbi dokumentumok benyújtását..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>Mégsem</Button>
            <Button onClick={handleSave} disabled={!form.name || saveTemplate.isPending}>Mentés</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Version history modal */}
      <Dialog open={!!versionModal} onOpenChange={() => setVersionModal(null)}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle>Verzió-történet</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
            {versions.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Nincs korábbi verzió</p>
            ) : (
              versions.map((v: any) => (
                <div key={v.id} className="p-3 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">v{v.version}</span>
                    <span className="text-[10px] text-slate-400">{new Date(v.created_at).toLocaleDateString('hu-HU')}</span>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-3 font-mono">{v.body_markdown?.slice(0, 200)}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
