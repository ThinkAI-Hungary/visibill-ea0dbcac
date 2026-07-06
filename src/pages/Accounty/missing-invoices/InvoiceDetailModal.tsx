import React from 'react';
import { CheckCircle, Mail, FileText, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';
import { getPriorityBadge } from './badges';

interface InvoiceItem {
  id: string;
  vendor: string;
  subtext: string;
  period: string;
  amount: string;
  source: string;
  priority: string;
  status: string;
  statusVariant: string;
  category: string;
  notificationCount: number;
  itemDate: string | null;
  amountRaw: number | null;
  uploadedFiles: string[];
  createdAt: string | null;
  navInvoiceId: string | null;
  invoiceNumber: string | null;
  lastNotifiedAt: string | null;
  escalationLevel: number;
  details: string | null;
}

interface InvoiceDetailModalProps {
  invoice: InvoiceItem | null;
  onClose: () => void;
  onSendToApprovalQueue: (items: InvoiceItem[]) => void;
}

export default function InvoiceDetailModal({ invoice, onClose, onSendToApprovalQueue }: InvoiceDetailModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  if (!invoice) return null;

  return (
    <Dialog open={!!invoice} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden">
        <>
          <div className="px-6 py-4 flex items-center justify-between border-b border-border">
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">{invoice.subtext}</DialogTitle>
            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-full mr-6">
              {invoice.status}
            </span>
          </div>
          
          <div className="px-6 py-5 grid grid-cols-2 gap-y-6 gap-x-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Szállító neve</p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{invoice.vendor}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Azonosítás módja</p>
              <span className="inline-block px-2.5 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-border rounded-md text-xs font-medium">
                {invoice.source}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Becsült összeg</p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{invoice.amount}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Várható időszak</p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{invoice.period}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Prioritás</p>
              {getPriorityBadge(invoice.priority)}
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Hozzáadva</p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('hu-HU') : '-'}</p>
            </div>
          </div>

          <div className="px-6 py-5 border-t border-border">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">NAV adatok</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">NAV számla azonosító</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{invoice.navInvoiceId || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Számla szám</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{invoice.invoiceNumber || '-'}</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 border-t border-border">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">Bekérési előzmények</h3>
            {invoice.notificationCount > 0 ? (
              <div className="space-y-3">
                {invoice.lastNotifiedAt && (
                  <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl shadow-soft">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 border border-border">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {new Date(invoice.lastNotifiedAt).toLocaleString('hu-HU')}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Email – {invoice.notificationCount}. bekérés</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                      Elküldve
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Még nem lett bekérve.</p>
            )}
          </div>

          {/* Uploaded files section */}
          {invoice.uploadedFiles.length > 0 && (
            <div className="px-6 py-5 border-t border-border">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Feltöltött dokumentumok</h3>
              <div className="space-y-2">
                {invoice.uploadedFiles.map((filePath, idx) => {
                  const fileName = filePath.split('/').pop() || filePath;
                  const displayName = fileName.replace(/^\d+_/, '');
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 bg-card border border-border rounded-xl shadow-soft">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg text-green-600 border border-green-100 dark:border-green-800">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{displayName}</p>
                          <p className="text-[10px] text-slate-400">Portálon keresztül feltöltve</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://vxxgvdlqvvchtlmqnrqf.supabase.co/storage/v1/object/public/accounty_uploads/${filePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-full hover:bg-primary/20 transition-colors"
                        >
                          Megnyitás
                        </a>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!confirm('Biztosan törölni szeretnéd ezt a fájlt?')) return;
                            try {
                              await supabase.storage.from('accounty_uploads').remove([filePath]);
                              const newFiles = invoice.uploadedFiles.filter((_, i) => i !== idx);
                              await supabase.from('accounty_missing_items')
                                .update({
                                  uploaded_files: newFiles,
                                  ...(newFiles.length === 0 ? { status: 'open', resolved_at: null, resolved_by: null } : {}),
                                })
                                .eq('id', invoice.id);
                              queryClient.invalidateQueries({ queryKey: ['accounty-missing-items'] });
                              toast({ title: 'Fájl törölve' });
                            } catch (err) {
                              reportError({ type: 'upload', component: 'InvoiceDetailModal', action: 'fileDelete', message: 'File delete error', error: err as Error });
                              toast({ variant: 'destructive', title: 'Törlés sikertelen' });
                            }
                          }}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                          title="Fájl törlése"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-800/80 border-t border-border flex items-center justify-between">
            <button 
              className="px-4 py-2.5 bg-card border border-border text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors shadow-soft"
              onClick={onClose}
            >
              Téves azonosítás
            </button>
            <div className="flex items-center gap-3">
              <button 
                className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors shadow-soft"
                onClick={onClose}
              >
                <CheckCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Megérkezett a számla
              </button>
              <button 
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-soft"
                onClick={() => {
                  onSendToApprovalQueue([invoice]);
                  onClose();
                }}
              >
                <Mail className="w-4 h-4" />
                Bekérés küldése
              </button>
            </div>
          </div>
        </>
      </DialogContent>
    </Dialog>
  );
}

export type { InvoiceItem };
