import React, { useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, X, File,
  Clock, Shield, Building2, ChevronDown, Loader2, Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'done' | 'error';
}

interface MissingDoc {
  id: string;
  title: string;
  category: string;
  deadline: string;
  urgent: boolean;
}

export default function ClientPortalPage() {
  const { token } = useParams();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submittedDocs, setSubmittedDocs] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Validate portal token and get company info
  const { data: portalData, isLoading: portalLoading } = useQuery({
    queryKey: ['portal-token', token],
    queryFn: async () => {
      if (!token) return null;
      // Look up token
      const { data: tokenData, error: tokenErr } = await supabase
        .from('accounty_portal_tokens' as any)
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .maybeSingle();

      if (tokenErr || !tokenData) return null;

      // Check expiry
      const tokenRow = tokenData as any;
      if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) return null;

      // Get company name
      const { data: company } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', tokenRow.company_id)
        .single();

      // Get missing items for this company
      const { data: items } = await supabase
        .from('accounty_missing_items' as any)
        .select('*')
        .eq('company_id', tokenRow.company_id)
        .in('status', ['open', 'notified'])
        .order('priority', { ascending: true });

      const missingDocs: MissingDoc[] = (items || []).map((item: any) => ({
        id: item.id,
        title: item.title + (item.subtitle ? ` – ${item.subtitle}` : ''),
        category: item.category === 'bejovo' ? 'Bejövő számla'
          : item.category === 'kimeno' ? 'Kimenő számla'
          : item.category === 'bank' ? 'Banki dokumentum'
          : 'Bérszámfejtés',
        deadline: item.item_date ? new Date(item.item_date).toLocaleDateString('hu-HU') : '-',
        urgent: item.priority === 'urgent',
      }));

      return {
        companyName: company?.name || 'Ismeretlen cég',
        companyId: tokenRow.company_id,
        missingDocs,
      };
    },
    enabled: !!token,
  });

  const missingDocs = portalData?.missingDocs || [];
  const companyName = portalData?.companyName || 'Betöltés...';
  const companyId = portalData?.companyId;

  const realUpload = useCallback(async (file: File) => {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newFile: UploadedFile = {
      id: fileId,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading',
    };
    setUploadedFiles(prev => [...prev, newFile]);

    try {
      // Start progress animation
      const progressInterval = setInterval(() => {
        setUploadedFiles(prev =>
          prev.map(f => f.id === fileId && f.status === 'uploading'
            ? { ...f, progress: Math.min(f.progress + Math.random() * 15 + 5, 90) }
            : f
          )
        );
      }, 200);

      // Real upload to Supabase Storage
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `portal-uploads/${companyId || 'unknown'}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('invoice-uploads')
        .upload(storagePath, file);

      clearInterval(progressInterval);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setUploadedFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, progress: 0, status: 'error' } : f)
        );
        return;
      }

      // Success
      setUploadedFiles(prev =>
        prev.map(f => f.id === fileId ? { ...f, progress: 100, status: 'done' } : f)
      );
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadedFiles(prev =>
        prev.map(f => f.id === fileId ? { ...f, progress: 0, status: 'error' } : f)
      );
    }
  }, [companyId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => realUpload(file));
  }, [realUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => realUpload(file));
    e.target.value = '';
  }, [realUpload]);

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const completedFiles = uploadedFiles.filter(f => f.status === 'done');
  const completedCount = completedFiles.length;
  const allDone = uploadedFiles.length > 0 && uploadedFiles.every(f => f.status === 'done' || f.status === 'error');
  const hasCompletedFiles = completedCount > 0;
  const remainingDocs = missingDocs.filter(d => !submittedDocs.has(d.id));

  const handleSubmitDocuments = async () => {
    if (completedCount === 0) return;
    setIsSubmitting(true);

    try {
      // Update portal token last_used_at
      if (token) {
        await supabase
          .from('accounty_portal_tokens' as any)
          .update({ last_used_at: new Date().toISOString() })
          .eq('token', token);
      }

      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 800));

      setIsSubmitted(true);
    } catch (err) {
      console.error('Submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success screen after submission
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center animate-in fade-in duration-500">
        <div className="max-w-md w-full mx-4">
          <div className="bg-card rounded-2xl border border-border shadow-soft p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mx-auto flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
              Dokumentumok beküldve! ✅
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
              {completedCount} fájlt sikeresen elküldtünk a könyvelőjének.
              Köszönjük a gyors válaszát!
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-border">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                <strong className="text-slate-700 dark:text-slate-300">{companyName}</strong> • {completedCount} dokumentum feltöltve
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                {new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 mt-6">
            Powered by Accounty • {new Date().getFullYear()}
          </p>
        </div>
      </div>
    );
  }

  const [showAllDocs, setShowAllDocs] = useState(false);
  const visibleDocs = showAllDocs ? missingDocs : missingDocs.slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background animate-in fade-in duration-500">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-soft">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent dark:bg-accent flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary dark:text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{companyName}</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Dokumentum feltöltő portál</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Shield className="w-3.5 h-3.5 text-primary" />
            Biztonságos
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6 space-y-4 pb-32">

        {/* Welcome + Stats - compact */}
        <div className="bg-card rounded-2xl border border-border shadow-soft p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Üdvözöljük! 👋
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Kérjük, töltse fel a hiányzó dokumentumokat a könyvelési záráshoz.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-4">
              <div className="text-center">
                <div className="text-2xl font-black text-red-500">{remainingDocs.length}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">hiányzó</div>
              </div>
              {uploadedFiles.length > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-black text-emerald-500">{uploadedFiles.length}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">feltöltve</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Missing Documents - collapsible */}
        <div className="bg-card rounded-2xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Hiányzó dokumentumok ({missingDocs.length})
            </h3>
            {missingDocs.length > 3 && (
              <button
                onClick={() => setShowAllDocs(!showAllDocs)}
                className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
              >
                {showAllDocs ? 'Kevesebb' : `Mind (${missingDocs.length})`}
                <ChevronDown className={cn('w-3 h-3 transition-transform', showAllDocs && 'rotate-180')} />
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleDocs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between px-5 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{doc.title}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {doc.category} • Határidő: {doc.deadline}
                    </p>
                  </div>
                </div>
                {doc.urgent && (
                  <span className="text-[9px] font-bold text-red-600 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full shrink-0">SÜRGŐS</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Upload Zone - compact horizontal */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'relative bg-card rounded-2xl border-2 border-dashed transition-all duration-200 p-5',
            isDragging
              ? 'border-primary bg-accent-subtle/50 dark:bg-accent scale-[1.01]'
              : 'border-border hover:border-slate-300 dark:hover:border-slate-700'
          )}
        >
          <div className="flex items-center gap-5">
            <div className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors',
              isDragging ? 'bg-accent dark:bg-accent' : 'bg-slate-100 dark:bg-slate-800'
            )}>
              <Upload className={cn(
                'w-6 h-6 transition-colors',
                isDragging ? 'text-primary' : 'text-slate-400'
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isDragging ? 'Engedd el a fájlokat!' : 'Húzd ide a fájlokat vagy tallózz'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                PDF, JPG, PNG, Excel, Word • Max 25 MB/fájl
              </p>
            </div>
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors cursor-pointer shrink-0">
              <Upload className="w-4 h-4" />
              Tallózás
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInput}
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.doc,.docx"
              />
            </label>
          </div>
        </div>

        {/* Uploaded Files - compact */}
        {uploadedFiles.length > 0 && (
          <div className="bg-card rounded-2xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <File className="w-3.5 h-3.5 text-slate-500" />
                Feltöltött fájlok ({uploadedFiles.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {uploadedFiles.map(file => (
                <div key={file.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                    file.status === 'done' ? 'bg-emerald-100 dark:bg-emerald-900/40' :
                    file.status === 'error' ? 'bg-red-100 dark:bg-red-900/40' :
                    'bg-slate-100 dark:bg-slate-800'
                  )}>
                    {file.status === 'uploading' ? (
                      <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                    ) : file.status === 'done' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{file.name}</p>
                    {file.status === 'uploading' && (
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 mt-1">
                        <div
                          className="h-1 rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{formatSize(file.size)}</span>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0"
                  >
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-2">
          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Ez a link egyedi az Ön számára • Powered by Accounty • {new Date().getFullYear()}
          </p>
        </div>

      </main>

      {/* Sticky Bottom Submit Bar - always visible when files exist */}
      {uploadedFiles.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border shadow-2xl z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {uploadedFiles.length} fájl feltöltve
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                A beküldés után a könyvelő értesítést kap
              </p>
            </div>
            <button
              onClick={handleSubmitDocuments}
              disabled={isSubmitting}
              className="flex items-center gap-2.5 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-base font-bold transition-colors shadow-lg shadow-emerald-600/20 shrink-0"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Küldés...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Beküldés
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}