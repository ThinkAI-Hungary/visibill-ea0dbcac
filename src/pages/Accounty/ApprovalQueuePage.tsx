import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  LayoutGrid,
  List,
  Eye,
  Send,
  AlertTriangle,
  ArrowLeft,
  Filter,
  Trash2,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { FloatingBulkBar } from '@/components/ui/floating-bulk-bar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import {
  type OutgoingMessage,
  type MessageStatus,
  type MessageCategory,
  getApprovalQueue,
  saveApprovalQueue,
  updateMessageStatus,
  updateMessageBody,
} from './generateRequestEmail';

type TabType = 'pending' | 'history';
type ViewMode = 'grid' | 'list';

const categoryConfig: Record<MessageCategory, { label: string; color: string }> = {
  urgent: {
    label: 'SÜRGŐS',
    color: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  },
  callback: {
    label: 'CALLBACK',
    color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
  normal: {
    label: 'EGYÉB',
    color: 'bg-muted text-muted-foreground border-border',
  },
};

const statusConfig: Record<MessageStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: {
    label: 'Várakozó',
    color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
    icon: Clock,
  },
  approved: {
    label: 'Jóváhagyva',
    color: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Elutasítva',
    color: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
    icon: XCircle,
  },
  sent: {
    label: 'Elküldve',
    color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400',
    icon: Send,
  },
};

export default function ApprovalQueuePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MessageCategory>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Approval modal
  const [selectedMessage, setSelectedMessage] = useState<OutgoingMessage | null>(null);
  const [editedBody, setEditedBody] = useState('');
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [editedRecipient, setEditedRecipient] = useState('');

  // State trigger for re-renders
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Load data from localStorage
  const allMessages = useMemo(() => {
    void refreshKey; // dependency trigger
    return getApprovalQueue();
  }, [refreshKey]);

  const pendingMessages = useMemo(
    () => allMessages.filter((m) => m.status === 'pending'),
    [allMessages]
  );
  const historyMessages = useMemo(
    () => allMessages.filter((m) => m.status !== 'pending'),
    [allMessages]
  );

  const currentMessages = activeTab === 'pending' ? pendingMessages : historyMessages;

  const filteredMessages = useMemo(() => {
    return currentMessages.filter((m) => {
      const matchesSearch =
        !searchTerm ||
        m.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.contactEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.subject.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [currentMessages, searchTerm, categoryFilter]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, activeTab]);

  const totalItems = filteredMessages.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedMessages = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMessages.slice(start, start + pageSize);
  }, [filteredMessages, currentPage, pageSize]);

  // ── Handlers ──

  const handleOpenApproval = (message: OutgoingMessage) => {
    setSelectedMessage(message);
    setEditedBody(message.aiGeneratedBody);
    setEditedRecipient(message.contactEmail);
    setIsApprovalModalOpen(true);
  };

  const sendViaEdgeFunction = async (message: OutgoingMessage, bodyOverride?: string, emailOverride?: string): Promise<boolean> => {
    try {
      const { error } = await supabase.functions.invoke('send-accounty-email', {
        body: {
          to: emailOverride || message.contactEmail,
          subject: message.subject,
          htmlBody: message.htmlPreview,
          textBody: bodyOverride || message.aiGeneratedBody,
          companyName: message.companyName,
          companyId: message.companyId,
          category: message.category,
          messageId: message.id,
          portalLink: message.portalLink,
          missingItemIds: message.missingItemIds,
        },
      });
      if (error) throw error;
      return true;
    } catch (err: any) {
      reportError({ type: 'db_query', component: 'ApprovalQueuePage', action: 'error', message: '[accounty-email] Send error:', error: err });
      return false;
    }
  };

  const handleApprove = async () => {
    if (!selectedMessage) return;
    setIsSending(true);
    try {
      updateMessageBody(selectedMessage.id, editedBody);
      const recipientEmail = editedRecipient.trim() || selectedMessage.contactEmail;
      const success = await sendViaEdgeFunction(selectedMessage, editedBody, recipientEmail);
      if (success) {
        updateMessageStatus(selectedMessage.id, 'sent');
        toast({
          title: ' Üzenet elküldve',
          description: `${selectedMessage.companyName} – Az email sikeresen elküldve a(z) ${recipientEmail} címre.`,
        });
      } else {
        updateMessageStatus(selectedMessage.id, 'approved');
        toast({
          title: ' Jóváhagyva, de küldési hiba',
          description: `${selectedMessage.companyName} – Az email jóváhagyásra került, de a küldés sikertelen volt. Később újrapróbálható.`,
          variant: 'destructive',
        });
      }
      setIsApprovalModalOpen(false);
      setSelectedMessage(null);
      refresh();
    } finally {
      setIsSending(false);
    }
  };

  const handleReject = () => {
    if (!selectedMessage) return;
    updateMessageStatus(selectedMessage.id, 'rejected');
    setIsApprovalModalOpen(false);
    setSelectedMessage(null);
    refresh();
    toast({
      title: ' Üzenet elutasítva',
      description: `${selectedMessage.companyName} – Az üzenet elutasításra került.`,
    });
  };

  const handleBulkApprove = async () => {
    setIsSending(true);
    const queue = getApprovalQueue();
    const targetMessages = queue.filter((m) => selectedIds.has(m.id));
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const message of targetMessages) {
        const success = await sendViaEdgeFunction(message);
        if (success) {
          updateMessageStatus(message.id, 'sent');
          successCount++;
        } else {
          updateMessageStatus(message.id, 'approved');
          errorCount++;
        }
      }
      setSelectedIds(new Set());
      refresh();
      if (successCount > 0) {
        toast({
          title: ` ${successCount} üzenet sikeresen elküldve`,
          description: errorCount > 0 ? `${errorCount} küldés sikertelen.` : undefined,
        });
      }
      if (errorCount > 0 && successCount === 0) {
        toast({
          title: ` ${errorCount} küldés sikertelen`,
          variant: 'destructive',
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleBulkReject = () => {
    const queue = getApprovalQueue();
    const updated = queue.map((m) =>
      selectedIds.has(m.id)
        ? { ...m, status: 'rejected' as const, rejectedAt: new Date().toISOString() }
        : m
    );
    saveApprovalQueue(updated);
    setSelectedIds(new Set());
    refresh();
    toast({
      title: ' Tömeges elutasítás',
      description: `${selectedIds.size} üzenet elutasítva.`,
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredMessages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMessages.map((m) => m.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('hu-HU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-full space-y-6 pb-24 page-animate">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
             Jóváhagyó rendszer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kimenő kommunikáció áttekintése és jóváhagyása
          </p>
        </div>
      </div>

      {/* Tabs + View Toggle + Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="flex bg-muted p-1 rounded-lg">
            <button
              onClick={() => { setActiveTab('pending'); setSelectedIds(new Set()); }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                activeTab === 'pending'
                  ? 'bg-card text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground/90 dark:hover:text-foreground'
              )}
            >
              <Clock className="w-4 h-4" />
              Várakozó
              {pendingMessages.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-5 text-center">
                  {pendingMessages.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab('history'); setSelectedIds(new Set()); }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                activeTab === 'history'
                  ? 'bg-card text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground/90 dark:hover:text-foreground'
              )}
            >
              <RotateCcw className="w-4 h-4" />
              Előzmények
            </button>
          </div>

          {/* View Toggle */}
          <div className="flex bg-muted p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-md transition-all',
                viewMode === 'grid'
                  ? 'bg-card text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground/60'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-md transition-all',
                viewMode === 'list'
                  ? 'bg-card text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground/60'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {activeTab === 'pending' && filteredMessages.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <Checkbox
                checked={selectedIds.size === filteredMessages.length && filteredMessages.length > 0}
                onCheckedChange={handleSelectAll}
                className="cursor-pointer"
              />
              Mind
            </label>
          )}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground/90 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-soft cursor-pointer"
          >
            <option value="all">Összes kategória</option>
            <option value="urgent">Sürgős</option>
            <option value="callback">Callback</option>
            <option value="normal">Egyéb</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Keresés..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-soft w-48"
            />
          </div>
        </div>
      </div>

      {/* Counter */}
      <div className="text-xs text-muted-foreground">
        {filteredMessages.length} megjelenítve
      </div>

      {/* Empty State */}
      {filteredMessages.length === 0 && (
        <div className="bg-card border border-border rounded-lg shadow-soft p-16 text-center">
          <div className="w-16 h-16 rounded-lg bg-muted mx-auto flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-muted-foreground/60" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {activeTab === 'pending' ? 'Nincs várakozó üzenet' : 'Nincsenek előzmények'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {activeTab === 'pending'
              ? 'Amikor „Bekérés küldése" gombra kattintasz egy hiányzó számlánál, az üzenet ide kerül jóváhagyásra.'
              : 'A jóváhagyott és elutasított üzenetek itt jelennek majd meg.'}
          </p>
        </div>
      )}

      {/* Grid View */}
      {filteredMessages.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedMessages.map((message) => {
            const cat = categoryConfig[message.category];
            const isSelected = selectedIds.has(message.id);
            return (
              <div
                key={message.id}
                className={cn(
                  'bg-card border rounded-lg shadow-soft overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-md hover:-translate-y-0.5 group relative',
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-border dark:hover:border-slate-600'
                )}
                onClick={() => handleOpenApproval(message)}
              >
                {/* Top row */}
                <div className="p-4 pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {activeTab === 'pending' && (
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(message.id)}
                            className="cursor-pointer"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />
                        Email
                      </div>
                    </div>
                    <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border', cat.color)}>
                      {cat.label}
                    </span>
                  </div>

                  {/* Client name */}
                  <h3 className="text-sm font-bold text-foreground mb-1 truncate">
                    {message.companyName}
                  </h3>
                  <p className="text-xs text-primary font-medium truncate mb-3">
                    {message.contactEmail}
                  </p>

                  {/* Message preview */}
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed min-h-[3.6em]">
                    {message.aiGeneratedBody.substring(0, 150)}...
                  </p>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 dark:bg-card/50 border-t border-border flex items-center justify-between">
                  {activeTab === 'pending' ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDate(message.createdAt)}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {(() => {
                        const sc = statusConfig[message.status];
                        const Icon = sc.icon;
                        return (
                          <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold uppercase', sc.color)}>
                            <Icon className="w-3 h-3 inline mr-1" />
                            {sc.label}
                          </span>
                        );
                      })()}
                    </div>
                  )}
                  {activeTab === 'history' && (
                    <div className="text-xs text-muted-foreground">
                      {formatDate(message.approvedAt || message.rejectedAt || message.createdAt)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {filteredMessages.length > 0 && viewMode === 'list' && (
        <div className="bg-card border border-border rounded-lg shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border dark:bg-card/50">
                  {activeTab === 'pending' && (
                    <th className="py-4 px-4 w-12">
                      <Checkbox
                        checked={selectedIds.size === filteredMessages.length && filteredMessages.length > 0}
                        onCheckedChange={handleSelectAll}
                        className="cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Csatorna</th>
                  <th className="py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ügyfél</th>
                  <th className="py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tárgy</th>
                  <th className="py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kategória</th>
                  <th className="py-4 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {activeTab === 'pending' ? 'Létrehozva' : 'Státusz'}
                  </th>
                  <th className="py-4 px-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedMessages.map((message) => {
                  const cat = categoryConfig[message.category];
                  const isSelected = selectedIds.has(message.id);
                  return (
                    <tr
                      key={message.id}
                      className={cn(
                        'hover:bg-muted/40/80 dark:hover:bg-muted/50/50 transition-colors cursor-pointer',
                        isSelected && 'bg-muted/30'
                      )}
                      onClick={() => handleOpenApproval(message)}
                    >
                      {activeTab === 'pending' && (
                        <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(message.id)}
                            className="cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Mail className="w-3.5 h-3.5" />
                          Email
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-foreground text-sm">{message.companyName}</div>
                        <div className="text-xs text-primary font-medium">{message.contactEmail}</div>
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground max-w-xs truncate">{message.subject}</td>
                      <td className="py-4 px-4">
                        <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border', cat.color)}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {activeTab === 'pending' ? (
                          <span className="text-xs text-muted-foreground">{formatDate(message.createdAt)}</span>
                        ) : (
                          (() => {
                            const sc = statusConfig[message.status];
                            return (
                              <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold uppercase', sc.color)}>
                                {sc.label}
                              </span>
                            );
                          })()
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenApproval(message);
                          }}
                          className="text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground/60 p-1.5 rounded-md hover:bg-muted transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="bg-card border border-border rounded-lg p-4 shadow-soft">
          <UnifiedPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      )}

      {/* Centralized Floating Bulk Action Bar */}
      <FloatingBulkBar
        open={selectedIds.size > 0 && activeTab === 'pending'}
        count={selectedIds.size}
        label="Kijelölt üzenetek:"
        itemUnit="db"
        onCancel={() => setSelectedIds(new Set())}
        cancelLabel="Mégse"
        hideSaveButton={true}
      >
        <Button
          type="button"
          size="sm"
          onClick={handleBulkApprove}
          disabled={isSending}
          className="h-9 text-xs gap-1.5 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm shrink-0"
        >
          {isSending ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Küldés...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Jóváhagyás és Küldés
            </>
          )}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={handleBulkReject}
          className="h-9 text-xs gap-1.5 rounded-lg font-semibold shadow-sm shrink-0"
        >
          <XCircle className="w-3.5 h-3.5" />
          Elutasítás
        </Button>
      </FloatingBulkBar>

      {/* Approval Modal */}
      <Dialog open={isApprovalModalOpen} onOpenChange={(open) => { if (!open) setIsApprovalModalOpen(false); }}>
        <DialogContent className="sm:max-w-[680px] p-0 gap-0 overflow-hidden">
          {selectedMessage && (
            <>
              <DialogHeader className="px-6 py-4 border-b border-border">
                <DialogTitle className="text-lg font-bold text-foreground">
                  Üzenet jóváhagyása
                </DialogTitle>
              </DialogHeader>

              <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* Original Context */}
                <div className="bg-amber-50/80 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4">
                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
                    Eredeti üzenet / Kontextus:
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {selectedMessage.originalContext}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span> {selectedMessage.companyName}</span>
                  </div>
                </div>

                {/* Editable Recipient */}
                {selectedMessage.status === 'pending' && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Címzett email:
                    </p>
                    <input
                      type="email"
                      value={editedRecipient}
                      onChange={(e) => setEditedRecipient(e.target.value)}
                      className="w-full px-4 py-2.5 bg-card border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      placeholder="email@example.com"
                    />
                    {editedRecipient !== selectedMessage.contactEmail && (
                      <p className="text-[11px] text-amber-500 mt-1.5 flex items-center gap-1">
                         Módosított címzett (eredeti: {selectedMessage.contactEmail})
                      </p>
                    )}
                  </div>
                )}

                {/* AI Generated Body */}
                <div>
                  <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
                    AI által generált válasz piszkozata:
                  </p>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-background/50 px-4 py-2 border-b border-border">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Tárgy:</span> {selectedMessage.subject}
                      </p>
                    </div>
                    {selectedMessage.status === 'pending' ? (
                      <textarea
                        value={editedBody}
                        onChange={(e) => setEditedBody(e.target.value)}
                        className="w-full px-4 py-3 bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none min-h-[250px] font-mono leading-relaxed"
                        placeholder="Email szöveg..."
                      />
                    ) : (
                      <div className="px-4 py-3 bg-card text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed min-h-[200px]">
                        {selectedMessage.aiGeneratedBody}
                      </div>
                    )}
                  </div>
                </div>

                {/* Portal Link */}
                {selectedMessage.portalLink && (
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
                    <ExternalLink className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs text-muted-foreground">Magic Link:</span>
                    <a href={selectedMessage.portalLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-mono truncate flex-1 hover:underline cursor-pointer">{selectedMessage.portalLink}</a>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              {selectedMessage.status === 'pending' ? (
                <div className="px-6 py-4 bg-muted/40/80 dark:bg-muted/80 border-t border-border flex items-center justify-between">
                  <button
                    onClick={handleReject}
                    className="px-4 py-2.5 bg-card border border-border text-foreground/90 rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors shadow-soft"
                  >
                    Elutasítás
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={isSending}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors shadow-soft"
                  >
                    {isSending ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Küldés...</>
                    ) : (
                      <><Send className="w-4 h-4" /> Jóváhagyás és Küldés</>
                    )}
                  </button>
                </div>
              ) : (
                <div className="px-6 py-4 bg-muted/40/80 dark:bg-muted/80 border-t border-border flex items-center justify-end">
                  <button
                    onClick={() => setIsApprovalModalOpen(false)}
                    className="px-4 py-2.5 bg-card border border-border text-foreground/90 rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors shadow-soft"
                  >
                    Bezárás
                  </button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
