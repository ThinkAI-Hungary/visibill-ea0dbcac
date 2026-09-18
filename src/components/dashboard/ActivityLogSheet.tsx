import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { InvoiceDetailPopup } from '@/components/InvoiceDetailPopup';
import { Skeleton } from '@/components/ui/skeleton';

import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { History } from 'lucide-react';
import { endOfDay } from 'date-fns';
import { UserActivityDialog } from './UserActivityDialog';
import { ActivityLogFilters, AVAILABLE_ACTIONS } from './ActivityLogFilters';
import { ActivityLogTimelineItem } from './ActivityLogTimelineItem';
import { ActivityLogPdfDialog } from './ActivityLogPdfDialog';

export { AVAILABLE_ACTIONS };

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface AuditLogRow {
  id: string;
  company_id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_name: string | null;
  details: any;
  created_at: string;
}

interface CompanyMember {
  user_id: string;
  name: string | null;
}

interface EnrichedUploadInfo {
  id: string;
  source: string | null;
  sender: string | null;
  subject: string | null;
  received_at: string | null;
  file_name: string;
  table: string;
}

export interface EnrichedInvoiceInfo {
  id: string;
  bizonylatsorszam: string;
  elado_nev: string | null;
  vevo_nev: string | null;
  brutto_vegosszeg: number | null;
  penznem: string | null;
  invoice_uploads_id: string | null;
}

export interface GroupedEmailAttachment {
  log: AuditLogRow;
  displayName: string;
  linkedInvoice: EnrichedInvoiceInfo | null;
}

export interface GroupedEmailUploadItem {
  type: 'grouped_email';
  isGroupedEmail: true;
  isProcessedDoc: false;
  id: string;
  created_at: string;
  user_id: null;
  sender: string | null;
  subject: string | null;
  files: GroupedEmailAttachment[];
  primaryLog: AuditLogRow;
}

export interface ProcessedDocumentItem {
  type: 'processed_doc';
  isGroupedEmail: false;
  isProcessedDoc: true;
  id: string;
  created_at: string;
  user_id: null;
  displayName: string;
  sourceLog: AuditLogRow;
  linkedInvoice: EnrichedInvoiceInfo | null;
  sender: string | null;
  subject: string | null;
}

export interface RegularAuditLogItem {
  type: 'regular_log';
  isGroupedEmail: false;
  isProcessedDoc: false;
  id: string;
  created_at: string;
  log: AuditLogRow;
}

export type TimelineItem =
  | GroupedEmailUploadItem
  | ProcessedDocumentItem
  | RegularAuditLogItem;

// ─── Date helpers ──────────────────────────────────────────────────────────────
function getDateRange(customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  return {
    from: customFrom ? new Date(customFrom).toISOString() : new Date(0).toISOString(),
    to: customTo ? new Date(customTo).toISOString() : endOfDay(now).toISOString()
  };
}

// ─── Processing detection & helpers ───────────────────────────────────────────
export const normalize = (s: string) => s.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, '').toLowerCase();

export function isProcessingComplete(log: AuditLogRow): boolean {
  // Case 1: explicit is_system flag from trigger (módosítás on invoice_uploads)
  if (log.action === 'módosítás') {
    const details = log.details;
    if (!details || typeof details !== 'object') return false;
    const d = details as Record<string, any>;
    return d.is_system === true || d.processing_type === 'invoice_processed';
  }
  // Case 2: invoice created by system (worker creates számla record after processing)
  if (log.action === 'feltöltés' && log.entity === 'számla' && !log.user_id) {
    return true;
  }
  return false;
}

export function isInvoiceProcessed(log: AuditLogRow): boolean {
  if (!isProcessingComplete(log)) return false;
  const d = log.details as Record<string, any>;
  return d.processing_type === 'invoice_processed';
}

export function isMailgunUpload(log: AuditLogRow): boolean {
  if (log.action !== 'feltöltés') return false;
  // Explicit email_alias source from trigger details
  const d = log.details as Record<string, any> | null;
  if (d?.upload_source === 'email_alias') return true;
  // Fallback: document uploads without a user_id are always email-originated
  // (manual uploads always have a user_id from auth.uid())
  if (!log.user_id && log.entity === 'dokumentum') return true;
  return false;
}

export function isLikelyPdf(log: AuditLogRow): boolean {
  const name = log.entity_name?.toLowerCase() || '';
  return name.endsWith('.pdf') ||
    name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') ||
    name.endsWith('.xlsx') || name.endsWith('.xls') ||
    log.entity === 'számla' ||
    log.entity === 'bérjegyzék' ||
    log.action === 'feltöltés';
}

export function getDisplayName(log: AuditLogRow): string {
  if (!log.entity_name) return '';
  const name = log.entity_name;
  const lower = name.toLowerCase();
  // Only append .pdf for számla entity (bizonylatsorszám has no extension)
  if (log.entity === 'számla' && !lower.match(/\.\w{2,5}$/)) {
    return `${name}.pdf`;
  }
  return name;
}

export function decodeSenderEmail(sender: string | null): string | null {
  if (!sender) return null;
  const trimmed = sender.trim();

  // Extract address if enclosed in angle brackets: "Name <email@domain.com>"
  const bracketMatch = trimmed.match(/<([^>]+)>/);
  const candidate = (bracketMatch ? bracketMatch[1] : trimmed).trim();

  // SRS0 format: SRS0=hash=timestamp=domain=localpart@forwarder
  // e.g. SRS0=z+7H=FJ=taxology.hu=david.jambor@srs.websupport.sk -> david.jambor@taxology.hu
  // e.g. SRS0=XiaJ=HH=skyrocketgroup.hu=balazs.lederer@srs.websupport.sk -> balazs.lederer@skyrocketgroup.hu
  const srs0Match = candidate.match(/^SRS0[=+-][^=]+[=+-][^=]+[=+]([^=]+)[=+]([^@]+)@/i);
  if (srs0Match) {
    const domain = srs0Match[1];
    const user = srs0Match[2];
    return `${user}@${domain}`;
  }

  // SRS1 format: SRS1=hash=forwarder=...=domain=localpart@...
  const srs1Match = candidate.match(/^SRS1[=+-][^=]+[=+-][^=]+[=+]([^=]+)[=+]([^@]+)@/i);
  if (srs1Match) {
    const domain = srs1Match[1];
    const user = srs1Match[2];
    return `${user}@${domain}`;
  }

  return candidate;
}

export function groupEmailTimelineItems(
  logs: AuditLogRow[],
  getEmailInfo: (log: AuditLogRow) => { isEmail: boolean; sender: string | null; subject: string | null },
  getLinkedInvoice: (log: AuditLogRow) => EnrichedInvoiceInfo | null,
  isProcessingCompleteFn: (log: AuditLogRow) => boolean = isProcessingComplete,
  getDisplayNameFn: (log: AuditLogRow) => string = getDisplayName
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Track invoice IDs and numbers that already have an explicit processing event in logs
  const existingProcessedInvoiceIds = new Set<string>();
  for (const log of logs) {
    if (isProcessingCompleteFn(log)) {
      const inv = getLinkedInvoice(log);
      if (inv?.id) existingProcessedInvoiceIds.add(inv.id);
      if (inv?.bizonylatsorszam) existingProcessedInvoiceIds.add(inv.bizonylatsorszam);
      if (log.entity_name) existingProcessedInvoiceIds.add(log.entity_name);
    }
  }

  for (const log of logs) {
    const processed = isProcessingCompleteFn(log);
    const emailInfo = getEmailInfo(log);

    if (processed) {
      const linkedInvoice = getLinkedInvoice(log);
      const logDisplayName = getDisplayNameFn(log) || log.entity_name || 'Dokumentum';
      items.push({
        type: 'processed_doc',
        isGroupedEmail: false,
        isProcessedDoc: true,
        id: log.id,
        created_at: log.created_at,
        user_id: null,
        displayName: logDisplayName,
        sourceLog: log,
        linkedInvoice,
        sender: emailInfo.sender,
        subject: emailInfo.subject,
      });
      continue;
    }

    const isEmailUpload = log.action === 'feltöltés' && emailInfo.isEmail;

    if (!isEmailUpload) {
      items.push({
        type: 'regular_log',
        isGroupedEmail: false,
        isProcessedDoc: false,
        id: log.id,
        created_at: log.created_at,
        log,
      });
      continue;
    }

    const logTime = new Date(log.created_at).getTime();
    const logDisplayName = getDisplayNameFn(log) || log.entity_name || 'Dokumentum';
    const linkedInvoice = getLinkedInvoice(log);

    // Search for an existing matching email group in recently added items (within 10 minutes)
    let matchedGroup: GroupedEmailUploadItem | null = null;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      if (!item.isGroupedEmail) continue;

      const groupTime = new Date(item.created_at).getTime();
      const diffMs = Math.abs(groupTime - logTime);
      if (diffMs > 10 * 60 * 1000) continue;

      // Fallback deduplication check: same file name within 10 min window
      const sameFile = item.files.some(
        f => normalize(f.displayName) === normalize(logDisplayName) ||
             (f.log.entity_name && log.entity_name && normalize(f.log.entity_name) === normalize(log.entity_name))
      );
      if (sameFile) {
        matchedGroup = item;
        break;
      }

      // Conflict checks
      const hasConflictingSender =
        emailInfo.sender && item.sender &&
        emailInfo.sender.trim().toLowerCase() !== item.sender.trim().toLowerCase();

      const hasConflictingSubject =
        emailInfo.subject && item.subject &&
        normalize(emailInfo.subject) !== normalize(item.subject);

      if (hasConflictingSender || hasConflictingSubject) {
        continue; // Different senders or different subjects -> definitely different emails
      }

      // Proximity check:
      // If both have explicit matching senders: allow up to 10 minutes
      // If one or both has null sender (e.g. fallback retry or missing metadata): allow up to 5 minutes
      const maxAllowedDiffMs = (emailInfo.sender && item.sender) ? 10 * 60 * 1000 : 5 * 60 * 1000;
      if (diffMs <= maxAllowedDiffMs) {
        matchedGroup = item;
        break;
      }
    }

    if (matchedGroup) {
      // Update sender/subject if matched group was missing it
      if (!matchedGroup.sender && emailInfo.sender) matchedGroup.sender = emailInfo.sender;
      if (!matchedGroup.subject && emailInfo.subject) matchedGroup.subject = emailInfo.subject;

      // Keep the earliest created_at as group timestamp so it reflects the actual email arrival
      if (logTime < new Date(matchedGroup.created_at).getTime()) {
        matchedGroup.created_at = log.created_at;
        matchedGroup.primaryLog = log;
      }

      // Deduplication: check if this file is already in matchedGroup.files
      const existingFileIndex = matchedGroup.files.findIndex(
        f => normalize(f.displayName) === normalize(logDisplayName) ||
             (f.log.entity_name && log.entity_name && normalize(f.log.entity_name) === normalize(log.entity_name))
      );

      if (existingFileIndex >= 0) {
        // Fallback duplicate! Upgrade linkedInvoice or details if missing
        if (linkedInvoice && !matchedGroup.files[existingFileIndex].linkedInvoice) {
          matchedGroup.files[existingFileIndex].linkedInvoice = linkedInvoice;
        }
        if (!(matchedGroup.files[existingFileIndex].log.details as any)?.upload_id && (log.details as any)?.upload_id) {
          matchedGroup.files[existingFileIndex].log = log;
        }
      } else {
        // Distinct attachment from the same email: add to group
        matchedGroup.files.push({
          log,
          displayName: logDisplayName,
          linkedInvoice,
        });
      }
    } else {
      // New email group
      items.push({
        type: 'grouped_email',
        isGroupedEmail: true,
        isProcessedDoc: false,
        id: log.id,
        created_at: log.created_at,
        user_id: null,
        sender: emailInfo.sender,
        subject: emailInfo.subject,
        primaryLog: log,
        files: [
          {
            log,
            displayName: logDisplayName,
            linkedInvoice,
          }
        ]
      });
    }
  }

  // Consolidation pass: merge any grouped email items within 5 minutes that have no conflicting sender or subject
  const consolidatedItems: TimelineItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const current = items[i];
    if (!current.isGroupedEmail) {
      consolidatedItems.push(current);
      continue;
    }

    // Check if current group can be merged into an earlier grouped_email in consolidatedItems
    let mergedInto: GroupedEmailUploadItem | null = null;
    for (let j = consolidatedItems.length - 1; j >= 0; j--) {
      const existing = consolidatedItems[j];
      if (!existing.isGroupedEmail) continue;

      const diffMs = Math.abs(new Date(existing.created_at).getTime() - new Date(current.created_at).getTime());
      if (diffMs > 10 * 60 * 1000) continue;

      const hasConflictingSender =
        current.sender && existing.sender &&
        current.sender.trim().toLowerCase() !== existing.sender.trim().toLowerCase();

      const hasConflictingSubject =
        current.subject && existing.subject &&
        normalize(current.subject) !== normalize(existing.subject);

      if (hasConflictingSender || hasConflictingSubject) continue;

      const maxDiff = (current.sender && existing.sender) ? 10 * 60 * 1000 : 5 * 60 * 1000;
      if (diffMs <= maxDiff) {
        mergedInto = existing;
        break;
      }
    }

    if (mergedInto) {
      if (!mergedInto.sender && current.sender) mergedInto.sender = current.sender;
      if (!mergedInto.subject && current.subject) mergedInto.subject = current.subject;
      if (new Date(current.created_at).getTime() < new Date(mergedInto.created_at).getTime()) {
        mergedInto.created_at = current.created_at;
        mergedInto.primaryLog = current.primaryLog;
      }
      for (const cf of current.files) {
        const exists = mergedInto.files.some(
          ef => normalize(ef.displayName) === normalize(cf.displayName) ||
                (ef.log.entity_name && cf.log.entity_name && normalize(ef.log.entity_name) === normalize(cf.log.entity_name))
        );
        if (!exists) {
          mergedInto.files.push(cf);
        } else {
          // Upgrade linkedInvoice if current has it
          const idx = mergedInto.files.findIndex(
            ef => normalize(ef.displayName) === normalize(cf.displayName) ||
                  (ef.log.entity_name && cf.log.entity_name && normalize(ef.log.entity_name) === normalize(cf.log.entity_name))
          );
          if (idx >= 0 && cf.linkedInvoice && !mergedInto.files[idx].linkedInvoice) {
            mergedInto.files[idx].linkedInvoice = cf.linkedInvoice;
          }
        }
      }
    } else {
      consolidatedItems.push(current);
    }
  }

  // Generate separate "A rendszer feldolgozott egy dokumentumot" entries for each processed attachment
  const generatedProcessedDocs: ProcessedDocumentItem[] = [];
  for (const item of consolidatedItems) {
    if (!item.isGroupedEmail) continue;
    for (const file of item.files) {
      if (file.linkedInvoice) {
        const invId = file.linkedInvoice.id;
        const invNum = file.linkedInvoice.bizonylatsorszam;
        if (!existingProcessedInvoiceIds.has(invId) && (!invNum || !existingProcessedInvoiceIds.has(invNum))) {
          existingProcessedInvoiceIds.add(invId);
          if (invNum) existingProcessedInvoiceIds.add(invNum);

          // Option A: Stable chronological timestamp (no synthetic 15s offset)
          const processedTime = file.log.created_at;
          generatedProcessedDocs.push({
            type: 'processed_doc',
            isGroupedEmail: false,
            isProcessedDoc: true,
            id: `processed-${file.log.id}`,
            created_at: processedTime,
            user_id: null,
            displayName: file.displayName,
            sourceLog: file.log,
            linkedInvoice: file.linkedInvoice,
            sender: item.sender,
            subject: item.subject,
          });
        }
      }
    }
  }

  if (generatedProcessedDocs.length > 0) {
    consolidatedItems.push(...generatedProcessedDocs);
  }

  // Cross-enrich processed_doc items with sender/subject from matching grouped_email if missing
  for (const doc of consolidatedItems) {
    if (!doc.isProcessedDoc) continue;
    if (doc.sender && doc.subject) continue;

    for (const group of consolidatedItems) {
      if (!group.isGroupedEmail) continue;
      const matchesFile = group.files.some(
        f => normalize(f.displayName) === normalize(doc.displayName) ||
             (f.log.entity_name && doc.sourceLog.entity_name && normalize(f.log.entity_name) === normalize(doc.sourceLog.entity_name))
      );
      const diffMs = Math.abs(new Date(group.created_at).getTime() - new Date(doc.created_at).getTime());
      if (matchesFile || diffMs <= 5 * 60 * 1000) {
        if (!doc.sender && group.sender) doc.sender = group.sender;
        if (!doc.subject && group.subject) doc.subject = group.subject;
        if (doc.sender && doc.subject) break;
      }
    }
  }

  // Hierarchical chronological sort (Option A: Primary order = timestamp descending; Secondary order = step_type priority)
  // When an email and its processed document share the same timestamp, 'processed_doc' sorts above 'grouped_email',
  // eliminating any race condition or artificial leapfrogging over other rapid successive emails.
  const getStepPriority = (item: TimelineItem): number => {
    if (item.type === 'processed_doc') return 2;
    return 1;
  };

  consolidatedItems.sort((a, b) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return getStepPriority(b) - getStepPriority(a);
  });

  return consolidatedItems;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function ActivityLogSheet() {
  const { t } = useTranslation(['dashboard']);
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  // ── Filter state ─────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');

  // Action filter
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [isActionFilterActive, setIsActionFilterActive] = useState(false);

  // Time filter
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [isFilterActive, setIsFilterActive] = useState(false);

  // User filter (multi-select, client-side)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isUserFilterActive, setIsUserFilterActive] = useState(false);

  // Document filter
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [isDocFilterActive, setIsDocFilterActive] = useState(false);

  // Selected invoice for detail popup
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const [isOpen, setIsOpen] = useState(false);

  // Auto-activate time filter when values are set
  useEffect(() => {
    if (customFrom || customTo) setIsFilterActive(true);
  }, [customFrom, customTo]);

  // PDF Preview State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [pdfErrorType, setPdfErrorType] = useState<'not_found' | 'unreachable' | 'invalid_format' | null>(null);
  // For non-PDF files that are images: show inline with a notice
  const [previewIsImage, setPreviewIsImage] = useState(false);
  const [previewActualExt, setPreviewActualExt] = useState<string | null>(null);
  // For non-inline files (spreadsheets, archives, etc.): show download card
  const [previewIsDownloadOnly, setPreviewIsDownloadOnly] = useState(false);
  const [previewDirectUrl, setPreviewDirectUrl] = useState<string | null>(null);
  // Track the log entry currently being previewed (for retry)
  const [currentPreviewLog, setCurrentPreviewLog] = useState<AuditLogRow | null>(null);
  // Track blob URL so we can revoke it when a new one is created
  const blobUrlRef = useRef<string | null>(null);

  // User Activity Dialog State
  const [selectedUserDialog, setSelectedUserDialog] = useState<{
    userId: string | null;
    userName: string;
    isSystem: boolean;
  } | null>(null);

  const dateRange = useMemo(
    () => {
      if (!isFilterActive) return getDateRange('', '');
      return getDateRange(customFrom, customTo);
    },
    [customFrom, customTo, isFilterActive]
  );

  // ── MAIN QUERY: audit_logs with STRICT company_id filter ─────────────────
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit_logs', companyId, dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('company_id', companyId!)
        .gte('created_at', dateRange.from)
        .lte('created_at', dateRange.to)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as unknown as AuditLogRow[];
    },
    enabled: !!companyId && isOpen,
    staleTime: 30_000,
  });

  // ── Company members ──────────────────────────────────────────────────────
  const { data: companyMembers = [] } = useQuery({
    queryKey: ['company_members_profiles', companyId],
    queryFn: async () => {
      const { data: members, error: membersError } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', companyId!);
      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];
      const memberUserIds = members.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', memberUserIds);
      if (profilesError) throw profilesError;
      return (profiles || []).map(p => ({ user_id: p.user_id, name: p.name })) as CompanyMember[];
    },
    enabled: !!companyId && isOpen,
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    companyMembers.forEach(m => { if (m.name) map.set(m.user_id, m.name); });
    return map;
  }, [companyMembers]);

  const getUserName = useCallback((userId: string | null): string => {
    if (!userId) return 'Rendszer';
    return profileMap.get(userId) || 'Felhasználó';
  }, [profileMap]);

  // ── Batch enrichment for document uploads & linked invoices (retrospective support) ──
  const { data: enrichment, isLoading: isEnrichmentLoading } = useQuery({
    queryKey: ['audit_logs_enrichment', companyId, logs.map(l => l.id).join(',')],
    queryFn: async () => {
      if (!companyId || logs.length === 0) {
        return {
          uploadMap: new Map<string, EnrichedUploadInfo>(),
          invoiceByUploadId: new Map<string, EnrichedInvoiceInfo>(),
          invoiceByFileName: new Map<string, EnrichedInvoiceInfo>(),
          invoiceByNumber: new Map<string, EnrichedInvoiceInfo>(),
        };
      }

      // Collect doc filenames, upload IDs, invoice numbers
      const docFileNames = Array.from(
        new Set(
          logs
            .filter(l => l.entity_name && (l.entity === 'dokumentum' || l.action === 'feltöltés' || l.action === 'módosítás'))
            .map(l => l.entity_name!)
        )
      );

      const knownUploadIds = Array.from(
        new Set(
          logs
            .map(l => (l.details as any)?.upload_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 20)
        )
      );

      const invoiceNumbers = Array.from(
        new Set(
          logs
            .filter(l => (l.entity === 'számla' && l.entity_name) || (l.details as any)?.ai_invoice_number)
            .map(l => (l.entity === 'számla' ? l.entity_name! : (l.details as any)?.ai_invoice_number))
            .filter(Boolean)
        )
      );

      // Query upload tables
      const minLogTime = logs.length > 0 ? logs[logs.length - 1].created_at : null;
      const maxLogTime = logs.length > 0 ? logs[0].created_at : null;

      const [invUploadsRes, transUploadsRes, reportUploadsRes, timeRangeUploadsRes] = await Promise.all([
        docFileNames.length > 0
          ? supabase
              .from('invoice_uploads')
              .select('id, file_name, metadata, processing_status')
              .eq('company_id', companyId)
              .in('file_name', docFileNames)
          : Promise.resolve({ data: [] }),
        docFileNames.length > 0
          ? supabase
              .from('transaction_uploads')
              .select('id, file_name, metadata')
              .eq('company_id', companyId)
              .in('file_name', docFileNames)
          : Promise.resolve({ data: [] }),
        docFileNames.length > 0
          ? supabase
              .from('report_uploads')
              .select('id, file_name, metadata')
              .eq('company_id', companyId)
              .in('file_name', docFileNames)
          : Promise.resolve({ data: [] }),
        minLogTime && maxLogTime
          ? supabase
              .from('invoice_uploads')
              .select('id, file_name, metadata, processing_status')
              .eq('company_id', companyId)
              .gte('created_at', new Date(new Date(minLogTime).getTime() - 15 * 60 * 1000).toISOString())
              .lte('created_at', new Date(new Date(maxLogTime).getTime() + 15 * 60 * 1000).toISOString())
              .limit(50)
          : Promise.resolve({ data: [] }),
      ]);

      let allInvUploads = (invUploadsRes.data || []) as any[];
      const foundIds = new Set(allInvUploads.map(u => u.id));
      const missingUploadIds = knownUploadIds.filter(id => !foundIds.has(id));
      if (missingUploadIds.length > 0) {
        const { data: byId } = await supabase
          .from('invoice_uploads')
          .select('id, file_name, metadata, processing_status')
          .eq('company_id', companyId)
          .in('id', missingUploadIds);
        if (byId && byId.length > 0) {
          allInvUploads = [...allInvUploads, ...byId];
          byId.forEach(u => foundIds.add(u.id));
        }
      }

      // Merge time range uploads (adds any other email uploads for the company around this time)
      const timeRangeUploads = (timeRangeUploadsRes.data || []) as any[];
      timeRangeUploads.forEach(u => {
        if (!foundIds.has(u.id)) {
          allInvUploads.push(u);
          foundIds.add(u.id);
        }
      });

      const uploadMap = new Map<string, EnrichedUploadInfo>();
      const emailUploadsByTime: EnrichedUploadInfo[] = [];

      allInvUploads.forEach(u => {
        const meta = (u.metadata || {}) as Record<string, any>;
        const info: EnrichedUploadInfo = {
          id: u.id,
          source: meta.source || null,
          sender: meta.sender || null,
          subject: meta.subject || null,
          received_at: meta.received_at || u.created_at || null,
          file_name: u.file_name,
          table: 'invoice_uploads',
        };
        uploadMap.set(u.id, info);
        if (u.file_name) uploadMap.set(u.file_name, info);
        if (info.source === 'email_alias' || !!info.sender) {
          emailUploadsByTime.push(info);
        }
      });

      (transUploadsRes.data || []).forEach(u => {
        const meta = ((u as any).metadata || {}) as Record<string, any>;
        const info: EnrichedUploadInfo = {
          id: u.id,
          source: meta.source || null,
          sender: meta.sender || null,
          subject: meta.subject || null,
          received_at: meta.received_at || (u as any).created_at || null,
          file_name: u.file_name,
          table: 'transaction_uploads',
        };
        uploadMap.set(u.id, info);
        if (u.file_name) uploadMap.set(u.file_name, info);
        if (info.source === 'email_alias' || !!info.sender) {
          emailUploadsByTime.push(info);
        }
      });

      (reportUploadsRes.data || []).forEach(u => {
        const meta = ((u as any).metadata || {}) as Record<string, any>;
        const info: EnrichedUploadInfo = {
          id: u.id,
          source: meta.source || null,
          sender: meta.sender || null,
          subject: meta.subject || null,
          received_at: meta.received_at || (u as any).created_at || null,
          file_name: u.file_name,
          table: 'report_uploads',
        };
        uploadMap.set(u.id, info);
        if (u.file_name) uploadMap.set(u.file_name, info);
        if (info.source === 'email_alias' || !!info.sender) {
          emailUploadsByTime.push(info);
        }
      });

      // Query invoices
      const allUploadIds = allInvUploads.map(u => u.id);
      const [byUploadRes, byNumRes] = await Promise.all([
        allUploadIds.length > 0
          ? supabase
              .from('invoices')
              .select('id, bizonylatsorszam, elado_nev, vevo_nev, brutto_vegosszeg, penznem, invoice_uploads_id')
              .eq('company_id', companyId)
              .in('invoice_uploads_id', allUploadIds)
          : Promise.resolve({ data: [] }),
        invoiceNumbers.length > 0
          ? supabase
              .from('invoices')
              .select('id, bizonylatsorszam, elado_nev, vevo_nev, brutto_vegosszeg, penznem, invoice_uploads_id')
              .eq('company_id', companyId)
              .in('bizonylatsorszam', invoiceNumbers)
          : Promise.resolve({ data: [] }),
      ]);

      const invoiceResults = [byUploadRes, byNumRes];
      const invoiceByUploadId = new Map<string, EnrichedInvoiceInfo>();
      const invoiceByFileName = new Map<string, EnrichedInvoiceInfo>();
      const invoiceByNumber = new Map<string, EnrichedInvoiceInfo>();

      const uploadIdToFileName = new Map<string, string>();
      allInvUploads.forEach(u => uploadIdToFileName.set(u.id, u.file_name));

      invoiceResults.forEach(res => {
        (res.data || []).forEach((inv: any) => {
          const info: EnrichedInvoiceInfo = {
            id: inv.id,
            bizonylatsorszam: inv.bizonylatsorszam,
            elado_nev: inv.elado_nev,
            vevo_nev: inv.vevo_nev,
            brutto_vegosszeg: inv.brutto_vegosszeg != null ? Number(inv.brutto_vegosszeg) : null,
            penznem: inv.penznem,
            invoice_uploads_id: inv.invoice_uploads_id,
          };
          if (inv.invoice_uploads_id) {
            invoiceByUploadId.set(inv.invoice_uploads_id, info);
            const fn = uploadIdToFileName.get(inv.invoice_uploads_id);
            if (fn) invoiceByFileName.set(fn, info);
          }
          if (inv.bizonylatsorszam) {
            invoiceByNumber.set(inv.bizonylatsorszam, info);
          }
        });
      });

      return { uploadMap, invoiceByUploadId, invoiceByFileName, invoiceByNumber, emailUploadsByTime };
    },
    enabled: !!companyId && isOpen && logs.length > 0,
    staleTime: 60_000,
  });

  // Gated loading: ensure both raw audit logs and batch metadata enrichment (senders, subjects, linked invoices)
  // are fully resolved before revealing the timeline, preventing any jarring pop-in layout shift.
  const isEnriching = logs.length > 0 && isEnrichmentLoading && !enrichment;
  const isTimelineLoading = isLoading || isEnriching;

  const getEmailInfo = useCallback((log: AuditLogRow) => {
    const d = (log.details || {}) as Record<string, any>;
    const upload = log.entity_name ? enrichment?.uploadMap.get(log.entity_name) : (d?.upload_id ? enrichment?.uploadMap.get(d.upload_id) : null);

    let sender = d?.sender || upload?.sender || null;
    let subject = d?.subject || upload?.subject || null;
    const isEmail =
      d?.upload_source === 'email_alias' ||
      upload?.source === 'email_alias' ||
      (!log.user_id && (log.entity === 'dokumentum' || d?.table === 'invoice_uploads' || d?.table === 'transaction_uploads' || d?.table === 'report_uploads')) ||
      !!sender;

    // Temporal fallback: if it is an email upload but missing sender/subject,
    // look for the closest email upload within 5 minutes in enrichment
    if (isEmail && (!sender || !subject) && enrichment?.emailUploadsByTime) {
      const logTime = new Date(log.created_at).getTime();
      let bestDiff = 5 * 60 * 1000;
      for (const eu of enrichment.emailUploadsByTime) {
        if (!eu.sender && !eu.subject) continue;
        const uploadTime = eu.received_at ? new Date(eu.received_at).getTime() : 0;
        const diff = Math.abs(uploadTime - logTime);
        if (diff <= bestDiff) {
          bestDiff = diff;
          if (!sender && eu.sender) sender = eu.sender;
          if (!subject && eu.subject) subject = eu.subject;
        }
      }
    }

    return { isEmail, sender, subject };
  }, [enrichment]);

  const getLinkedInvoice = useCallback((log: AuditLogRow) => {
    const d = (log.details || {}) as Record<string, any>;
    const uploadId = d?.upload_id;
    if (uploadId && enrichment?.invoiceByUploadId.has(uploadId)) {
      return enrichment.invoiceByUploadId.get(uploadId)!;
    }
    if (log.entity_name) {
      if (enrichment?.invoiceByFileName.has(log.entity_name)) {
        return enrichment.invoiceByFileName.get(log.entity_name)!;
      }
      if (enrichment?.invoiceByNumber.has(log.entity_name)) {
        return enrichment.invoiceByNumber.get(log.entity_name)!;
      }
    }
    if (d?.ai_invoice_number && enrichment?.invoiceByNumber.has(d.ai_invoice_number)) {
      return enrichment.invoiceByNumber.get(d.ai_invoice_number)!;
    }
    return null;
  }, [enrichment]);


  const filteredLogs = useMemo(() => {
    let result = logs;

    // 1. Action filter
    if (isActionFilterActive && selectedActions.length > 0) {
      result = result.filter(log => {
        const isProcessed = isProcessingComplete(log);
        const email = getEmailInfo(log);
        if (selectedActions.includes('email') && email.isEmail) return true;
        if (selectedActions.includes('feldolgozás') && isProcessed) return true;
        return selectedActions.includes(log.action);
      });
    }

    // 2. Time filter (already applied server-side via customFrom/customTo, but guard here too)
    if (isFilterActive && (customFrom || customTo)) {
      result = result.filter(log => {
        const t = new Date(log.created_at).getTime();
        if (customFrom && t < new Date(customFrom).getTime()) return false;
        if (customTo && t > new Date(customTo).getTime()) return false;
        return true;
      });
    }

    // 3. User filter
    if (isUserFilterActive && selectedUserIds.length > 0) {
      result = result.filter(log => {
        if (selectedUserIds.includes('__system__') && !log.user_id) return true;
        return log.user_id ? selectedUserIds.includes(log.user_id) : false;
      });
    }

    // 4. Doc filter — alphanumeric only, ignores all punctuation
    if (isDocFilterActive && docSearchQuery.trim()) {
      const q = normalize(docSearchQuery);
      result = result.filter(log => {
        const raw = log.entity_name || '';
        const name = normalize(raw);
        // Also match against display name (getDisplayName may append .pdf)
        const nameWithPdf = raw.toLowerCase().endsWith('.pdf') ? name : normalize(raw + '.pdf');
        return name.includes(q) || nameWithPdf.includes(q);
      });
    }

    // 5. Search bar — runs on top of already-filtered result, alphanumeric only
    if (searchQuery.trim()) {
      const q = normalize(searchQuery);
      result = result.filter(log => {
        const raw = log.entity_name || '';
        const name = normalize(raw);
        // Also match against display name (getDisplayName may append .pdf)
        const nameWithPdf = raw.toLowerCase().endsWith('.pdf') ? name : normalize(raw + '.pdf');
        const action = normalize(log.action);
        const entity = normalize(log.entity);
        const user = normalize(getUserName(log.user_id));

        const email = getEmailInfo(log);
        const sender = email.sender ? normalize(email.sender) : '';
        const subject = email.subject ? normalize(email.subject) : '';

        const invoice = getLinkedInvoice(log);
        const invNumber = invoice?.bizonylatsorszam ? normalize(invoice.bizonylatsorszam) : '';
        const supplier = invoice?.elado_nev ? normalize(invoice.elado_nev) : '';

        return (
          name.includes(q) ||
          nameWithPdf.includes(q) ||
          action.includes(q) ||
          entity.includes(q) ||
          user.includes(q) ||
          sender.includes(q) ||
          subject.includes(q) ||
          invNumber.includes(q) ||
          supplier.includes(q)
        );
      });
    }

    return result;
  }, [logs, searchQuery, selectedActions, isActionFilterActive, selectedUserIds, isUserFilterActive, docSearchQuery, isDocFilterActive, isFilterActive, customFrom, customTo, getUserName, getEmailInfo, getLinkedInvoice]);


  // ── Handlers ─────────────────────────────────────────────────────────────

  const timelineItems = useMemo(() => {
    return groupEmailTimelineItems(filteredLogs, getEmailInfo, getLinkedInvoice, isProcessingComplete, getDisplayName);
  }, [filteredLogs, getEmailInfo, getLinkedInvoice]);

  const handlePdfClick = async (log: AuditLogRow) => {
    if (!isLikelyPdf(log)) return;

    // Revoke previous blob URL to free memory
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    setCurrentPreviewLog(log);
    setPreviewTitle(getDisplayName(log));
    setIsPreviewOpen(true);
    setIsLoadingPdf(true);
    setPdfError(false);
    setPdfErrorType(null);
    setPreviewIsImage(false);
    setPreviewActualExt(null);
    setPreviewIsDownloadOnly(false);
    setPreviewDirectUrl(null);
    setPreviewUrl('');

    try {
      let url: string | null = null;
      const originalName = log.entity_name || '';

      if (log.entity === 'számla') {
        const { data } = await supabase.from('invoices').select('image_url, melleklet_url').eq('bizonylatsorszam', originalName).limit(1).maybeSingle();
        url = data?.melleklet_url || data?.image_url;
      }

      if (!url) {
        const details = log.details as any;
        const sourceTable = details?.table;
        const enrichedUpload = log.entity_name ? enrichment?.uploadMap.get(log.entity_name) : null;
        const uploadId = details?.upload_id || details?.id || enrichedUpload?.id;
        const tablesToCheck = sourceTable
          ? [sourceTable]
          : enrichedUpload?.table
            ? [enrichedUpload.table, 'invoice_uploads', 'transaction_uploads', 'report_uploads', 'salary_files', 'bank_statement_uploads']
            : ['invoice_uploads', 'transaction_uploads', 'report_uploads', 'salary_files', 'bank_statement_uploads'];

        for (const t of tablesToCheck) {
          if (uploadId) {
            try {
              const { data: byId } = await supabase.from(t as any).select('file_url').eq('id', uploadId).limit(1).maybeSingle();
              if ((byId as any)?.file_url) {
                url = (byId as any).file_url;
                break;
              }
            } catch {
              // Ignore if column doesn't match table
            }
          }

          let { data } = await supabase.from(t as any).select('file_url').eq('file_name', originalName).limit(1).maybeSingle();
          let currentData = data as any;
          if (!currentData?.file_url && !originalName.toLowerCase().endsWith('.pdf')) {
            const res = await supabase.from(t as any).select('file_url').eq('file_name', originalName + '.pdf').limit(1).maybeSingle();
            currentData = res.data as any;
          }
          if (currentData?.file_url) {
            url = currentData.file_url;
            break;
          }
        }
      }

      if (!url) {
        setPdfErrorType('not_found');
        setPdfError(true);
        return;
      }

      setPreviewDirectUrl(url);

      const lowerName = originalName.toLowerCase();
      const isKnownSpreadsheet = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv');
      const isKnownArchive = lowerName.endsWith('.zip') || lowerName.endsWith('.tar') || lowerName.endsWith('.gz');
      const isKnownDoc = lowerName.endsWith('.xml') || lowerName.endsWith('.txt');

      if (isKnownSpreadsheet || isKnownArchive || isKnownDoc) {
        const ext = lowerName.split('.').pop() || 'fájl';
        setPreviewIsDownloadOnly(true);
        setPreviewActualExt(ext);
        setPreviewUrl(url);
        return;
      }

      // Fetch as blob to bypass Content-Disposition: attachment headers
      const response = await fetch(url);
      if (!response.ok) {
        setPdfErrorType('unreachable');
        setPdfError(true);
        return;
      }
      const blob = await response.blob();

      // Detect actual file type from magic bytes (first 12 bytes)
      const headerBytes = await blob.slice(0, 12).arrayBuffer();
      const h = new Uint8Array(headerBytes);

      const isPdf  = h[0]===0x25 && h[1]===0x50 && h[2]===0x44 && h[3]===0x46; // %PDF
      const isPng  = h[0]===0x89 && h[1]===0x50 && h[2]===0x4E && h[3]===0x47; // \x89PNG
      const isJpeg = h[0]===0xFF && h[1]===0xD8 && h[2]===0xFF;
      const isGif  = h[0]===0x47 && h[1]===0x49 && h[2]===0x46 && h[3]===0x38; // GIF8
      const isWebp = h[0]===0x52 && h[1]===0x49 && h[2]===0x46 && h[3]===0x46 && // RIFF
                     h[8]===0x57 && h[9]===0x45 && h[10]===0x42 && h[11]===0x50; // WEBP
      const isBmp  = h[0]===0x42 && h[1]===0x4D; // BM
      const isPkZip = h[0]===0x50 && h[1]===0x4B; // PK

      if (isPdf) {
        const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        blobUrlRef.current = blobUrl;
        setPreviewUrl(blobUrl);
      } else if (isPng || isJpeg || isGif || isWebp || isBmp) {
        const mimeMap: Record<string, string> = {
          png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif',
          webp: 'image/webp', bmp: 'image/bmp',
        };
        const ext = isPng ? 'png' : isJpeg ? 'jpg' : isGif ? 'gif' : isWebp ? 'webp' : 'bmp';
        const mime = mimeMap[ext];
        const blobUrl = URL.createObjectURL(new Blob([blob], { type: mime }));
        blobUrlRef.current = blobUrl;
        setPreviewIsImage(true);
        setPreviewActualExt(ext);
        setPreviewUrl(blobUrl);
      } else if (isPkZip) {
        const ext = lowerName.split('.').pop() || 'xlsx';
        setPreviewIsDownloadOnly(true);
        setPreviewActualExt(ext);
        setPreviewUrl(url);
      } else {
        const ext = lowerName.split('.').pop() || 'fájl';
        setPreviewIsDownloadOnly(true);
        setPreviewActualExt(ext);
        setPreviewUrl(url);
      }
    } catch (err) {
      console.warn('File preview error:', err);
      setPdfError(true);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <History className="mr-2 h-4 w-4" />
            {t('welcome.activity_log', 'Műveleti napló')}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-[720px] flex flex-col overflow-hidden p-0" onCloseAutoFocus={(e) => e.preventDefault()}>
          <SheetHeader className="px-12 pt-6 pb-0">
            <SheetTitle>{t('welcome.activity_log', 'Műveleti napló')}</SheetTitle>
            <SheetDescription>Az aktuális cég eseményeinek idővonala.</SheetDescription>
          </SheetHeader>

          {/* ── STICKY HEADER (search + filter) ─────────────────────────────── */}
          <ActivityLogFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedActions={selectedActions}
            setSelectedActions={setSelectedActions}
            isActionFilterActive={isActionFilterActive}
            setIsActionFilterActive={setIsActionFilterActive}
            customFrom={customFrom}
            setCustomFrom={setCustomFrom}
            customTo={customTo}
            setCustomTo={setCustomTo}
            isFilterActive={isFilterActive}
            setIsFilterActive={setIsFilterActive}
            selectedUserIds={selectedUserIds}
            setSelectedUserIds={setSelectedUserIds}
            isUserFilterActive={isUserFilterActive}
            setIsUserFilterActive={setIsUserFilterActive}
            companyMembers={companyMembers}
            profileMap={profileMap}
            docSearchQuery={docSearchQuery}
            setDocSearchQuery={setDocSearchQuery}
            isDocFilterActive={isDocFilterActive}
            setIsDocFilterActive={setIsDocFilterActive}
            logs={logs}
          />

          {/* ── TIMELINE CONTENT ──────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-12 py-4">

            {isTimelineLoading ? (
              <div className="space-y-3 py-1">
                {[1, 2, 3, 4, 5].map((idx) => (
                  <div
                    key={idx}
                    className="relative flex items-start gap-4 py-3 px-3 rounded-lg border-b border-border/40"
                  >
                    {/* Icon circle skeleton */}
                    <div className="shrink-0 mt-0.5">
                      <Skeleton className="h-[42px] w-[42px] rounded-full" />
                    </div>

                    {/* Time/Date column skeleton */}
                    <div className="shrink-0 flex flex-col items-center justify-center min-w-[48px] gap-1 mt-0.5">
                      <Skeleton className="h-4 w-12 rounded" />
                      <Skeleton className="h-2.5 w-8 rounded" />
                      <Skeleton className="h-2.5 w-8 rounded" />
                      <Skeleton className="h-2.5 w-10 rounded" />
                    </div>

                    {/* Content skeleton */}
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-52 rounded" />
                      <div className="p-2.5 rounded-md border border-border/30 bg-muted/10 space-y-2">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3.5 w-14 rounded" />
                          <Skeleton className="h-3.5 w-44 rounded" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3.5 w-14 rounded" />
                          <Skeleton className="h-3.5 w-56 rounded" />
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-border/15">
                          <Skeleton className="h-3.5 w-24 rounded" />
                          <Skeleton className="h-6 w-56 rounded-md" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : timelineItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <History className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  {logs.length === 0 ? 'Nincsenek események ebben az időszakban.' : 'Nincs találat a megadott szűrőkkel.'}
                </p>
                <p className="text-xs mt-1 opacity-70">
                  {logs.length === 0 ? 'Próbálj másik időszakot választani.' : 'Módosítsd a keresést vagy szűrőket.'}
                </p>
              </div>
            ) : (
              <div className="relative">
                <div className="space-y-1">
                  {timelineItems.map((item, index) => (
                    <ActivityLogTimelineItem
                      key={item.id}
                      item={item}
                      index={index}
                      getUserName={getUserName}
                      onUserClick={setSelectedUserDialog}
                      onPdfClick={handlePdfClick}
                      onInvoiceClick={setSelectedInvoiceId}
                    />
                  ))}
                </div>

                {/* Result count */}
                <div className="mt-4 pt-3 border-t border-border/30 text-center">
                  <p className="text-xs text-muted-foreground">
                    {timelineItems.length} esemény{timelineItems.length !== logs.length ? ` (${logs.length} összesen)` : ''}
                  </p>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Custom PDF Preview Dialog specific to Audit Logs */}
      <ActivityLogPdfDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        previewTitle={previewTitle}
        previewIsImage={previewIsImage}
        previewActualExt={previewActualExt}
        isLoadingPdf={isLoadingPdf}
        setIsLoadingPdf={setIsLoadingPdf}
        pdfError={pdfError}
        pdfErrorType={pdfErrorType}
        previewIsDownloadOnly={previewIsDownloadOnly}
        previewDirectUrl={previewDirectUrl}
        previewUrl={previewUrl || ''}
        currentPreviewLog={currentPreviewLog}
        onRetry={handlePdfClick}
      />

      {selectedUserDialog && (
        <UserActivityDialog
          userId={selectedUserDialog.userId}
          userName={selectedUserDialog.userName}
          isSystem={selectedUserDialog.isSystem}
          companyId={companyId!}
          open={!!selectedUserDialog}
          onOpenChange={(open) => {
            if (!open) setSelectedUserDialog(null);
          }}
        />
      )}

      {selectedInvoiceId && (
        <InvoiceDetailPopup
          open={!!selectedInvoiceId}
          onOpenChange={(open) => {
            if (!open) setSelectedInvoiceId(null);
          }}
          invoiceId={selectedInvoiceId}
        />
      )}
    </>
  );
}
