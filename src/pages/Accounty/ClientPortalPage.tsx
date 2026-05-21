import React, { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, X, File,
  Clock, Shield, Building2, ChevronDown, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock missing items for the client
const mockMissingDocs = [
  { id: '1', title: 'MOL Nyrt. – 2024. januári számla', category: 'Bejövő számla', deadline: '2024.01.20', urgent: true },
  { id: '2', title: 'Telekom – Havi telefondíj', category: 'Bejövő számla', deadline: '2024.01.20', urgent: false },
  { id: '3', title: 'Bankkivonat – OTP 2024. január', category: 'Banki dokumentum', deadline: '2024.01.22', urgent: true },
  { id: '4', title: 'Munkabér igazolás – 2024. január', category: 'Bérszámfejtés', deadline: '2024.01.25', urgent: false },
  { id: '5', title: 'Áram számla – ELMŰ', category: 'Bejövő számla', deadline: '2024.01.20', urgent: false },
];

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'done' | 'error';
}

export default function ClientPortalPage() {
  const { token } = useParams();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submittedDocs, setSubmittedDocs] = useState<Set<string>>(new Set());

  const simulateUpload = useCallback((file: File) => {
    const fileId = `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newFile: UploadedFile = {
      id: fileId,
      name: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading',
    };
    setUploadedFiles(prev => [...prev, newFile]);

    // Simulate progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30 + 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setUploadedFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, progress: 100, status: 'done' } : f)
        );
      } else {
        setUploadedFiles(prev =>
          prev.map(f => f.id === fileId ? { ...f, progress: Math.min(progress, 99) } : f)
        );
      }
    }, 300);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => simulateUpload(file));
  }, [simulateUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => simulateUpload(file));
    e.target.value = '';
  }, [simulateUpload]);

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const completedCount = uploadedFiles.filter(f => f.status === 'done').length;
  const remainingDocs = mockMissingDocs.filter(d => !submittedDocs.has(d.id));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Tech Solutions Kft.</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Dokumentum feltöltő portál</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            Biztonságos kapcsolat
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Welcome Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Üdvözöljük! 👋
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Könyvelője hiányzó dokumentumokat kér Öntől. Kérjük, töltse fel az alábbi listában
            szereplő dokumentumokat a havi könyvelési zárás érdekében.
          </p>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-900 dark:text-slate-100">{remainingDocs.length}</span> hiányzó dokumentum
              </span>
            </div>
            {completedCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-600 dark:text-slate-400">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{completedCount}</span> feltöltve
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Missing Documents List */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Hiányzó dokumentumok
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {mockMissingDocs.map(doc => {
              const isSubmitted = submittedDocs.has(doc.id);
              return (
                <div key={doc.id} className={cn(
                  'flex items-center justify-between p-4 transition-all',
                  isSubmitted ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      isSubmitted ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-slate-100 dark:bg-slate-800'
                    )}>
                      {isSubmitted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        isSubmitted ? 'text-emerald-700 dark:text-emerald-400 line-through' : 'text-slate-900 dark:text-slate-100'
                      )}>{doc.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{doc.category}</span>
                        <span className="text-[10px] text-slate-400">•</span>
                        <span className={cn(
                          'text-[10px] font-medium',
                          doc.urgent ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
                        )}>
                          Határidő: {doc.deadline}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!isSubmitted && (
                    <button
                      onClick={() => setSubmittedDocs(prev => new Set(prev).add(doc.id))}
                      className="text-[10px] font-medium text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 px-2 py-1 rounded transition-colors"
                    >
                      Megjelölöm kézbesítettnek
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Drag & Drop Upload Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'relative bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed transition-all duration-200 p-8',
            isDragging
              ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10 scale-[1.01]'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          )}
        >
          <div className="text-center">
            <div className={cn(
              'w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 transition-colors',
              isDragging ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-slate-100 dark:bg-slate-800'
            )}>
              <Upload className={cn(
                'w-8 h-8 transition-colors',
                isDragging ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
              )} />
            </div>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
              {isDragging ? 'Engedd el a fájlokat!' : 'Húzd ide a fájlokat'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              vagy kattints a tallózáshoz
            </p>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              Fájlok kiválasztása
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInput}
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv,.doc,.docx"
              />
            </label>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3">
              PDF, JPG, PNG, Excel, Word • Max 25 MB/fájl
            </p>
          </div>
        </div>

        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <File className="w-4 h-4 text-slate-500" />
                Feltöltött fájlok ({uploadedFiles.length})
              </h3>
              {uploadedFiles.every(f => f.status === 'done') && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Minden feltöltve
                </span>
              )}
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {uploadedFiles.map(file => (
                <div key={file.id} className="flex items-center gap-3 p-4">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    file.status === 'done' ? 'bg-emerald-100 dark:bg-emerald-900/40' :
                    file.status === 'error' ? 'bg-red-100 dark:bg-red-900/40' :
                    'bg-slate-100 dark:bg-slate-800'
                  )}>
                    {file.status === 'uploading' ? (
                      <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                    ) : file.status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">{formatSize(file.size)}</span>
                      {file.status === 'uploading' && (
                        <>
                          <span className="text-[10px] text-slate-400">•</span>
                          <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">{Math.round(file.progress)}%</span>
                        </>
                      )}
                    </div>
                    {file.status === 'uploading' && (
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1 mt-1.5">
                        <div
                          className="h-1 rounded-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Ez a link egyedi az Ön számára. Kérjük, ne ossza meg másokkal.
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            Powered by Accounty • {new Date().getFullYear()}
          </p>
        </div>

      </main>
    </div>
  );
}
