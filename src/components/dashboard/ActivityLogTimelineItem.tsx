import {
  Plus, Pencil, Trash2, Upload, Link2, FileText, Banknote,
  ArrowLeftRight, Tag, ClipboardList, Mail, CheckCircle2, Bot, User, ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { formatCurrency } from '@/lib/locale/formatters';
import type { TimelineItem, AuditLogRow } from './ActivityLogSheet';
import { isLikelyPdf, getDisplayName, decodeSenderEmail } from './ActivityLogSheet';

const ACTION_CONFIG: Record<string, { icon: typeof Plus; color: string; label: string }> = {
  'létrehozás': { icon: Plus, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30', label: 'létrehozott' },
  'módosítás': { icon: Pencil, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30', label: 'módosított' },
  'törlés': { icon: Trash2, color: 'text-red-500 bg-red-50 dark:bg-red-950/30', label: 'törölt' },
  'feltöltés': { icon: Upload, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30', label: 'feltöltött' },
  'párosítás': { icon: Link2, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30', label: 'párosított' },
};

const ENTITY_CONFIG: Record<string, { icon: typeof FileText; label: string }> = {
  'számla': { icon: FileText, label: 'számlát' },
  'bérjegyzék': { icon: Banknote, label: 'bérjegyzéket' },
  'tranzakció': { icon: ArrowLeftRight, label: 'tranzakciót' },
  'kategória': { icon: Tag, label: 'kategóriát' },
  'dokumentum': { icon: ClipboardList, label: 'dokumentumot' },
};

export interface ActivityLogTimelineItemProps {
  item: TimelineItem;
  index: number;
  getUserName: (userId: string | null) => string;
  onUserClick: (info: { userId: string | null; userName: string; isSystem: boolean }) => void;
  onPdfClick: (log: AuditLogRow) => void;
  onInvoiceClick: (invoiceId: string) => void;
}

export function ActivityLogTimelineItem({
  item,
  index,
  getUserName,
  onUserClick,
  onPdfClick,
  onInvoiceClick,
}: ActivityLogTimelineItemProps) {
  if (item.type === 'grouped_email') {
    const isMultiFile = item.files.length > 1;
    return (
      <div
        className={`relative flex items-start gap-4 py-3 px-3 rounded-lg transition-colors border-b border-border/60 ${
          index % 2 === 0 ? 'bg-slate-100 dark:bg-secondary/30' : 'bg-white dark:bg-transparent'
        }`}
      >
        {/* Icon dot */}
        <div className="relative z-10 shrink-0 mt-0.5">
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-border/50 text-amber-500 bg-amber-50 dark:bg-amber-950/30">
            <Mail className="h-5 w-5" />
          </div>
          <button
            onClick={() => onUserClick({ userId: null, userName: 'Rendszer', isSystem: true })}
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background transition-transform hover:scale-110 outline-none bg-indigo-100 text-indigo-600 cursor-pointer"
            title="Kattints a részletekért: Rendszer"
          >
            <Bot className="h-[10px] w-[10px]" />
          </button>
        </div>

        {/* Time & Date */}
        <div className="shrink-0 flex flex-col items-center justify-center min-w-[48px] text-center mt-0.5">
          <span className="text-[15px] font-bold text-foreground tracking-tight leading-none mb-1">
            {format(new Date(item.created_at), 'HH:mm', { locale: hu })}
          </span>
          <div className="flex flex-col items-center text-[10px] text-muted-foreground font-medium uppercase tracking-wide leading-tight mt-0.5">
            <span>{format(new Date(item.created_at), 'MMM', { locale: hu })}</span>
            <span>{format(new Date(item.created_at), 'd.', { locale: hu })}</span>
            <span>{format(new Date(item.created_at), 'yyyy', { locale: hu })}</span>
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Row 1: Action sentence */}
          <p className="text-sm leading-snug">
            <span className="text-muted-foreground">A </span>
            <button
              onClick={() => onUserClick({ userId: null, userName: 'Rendszer', isSystem: true })}
              className="font-semibold hover:text-primary transition-colors hover:underline outline-none cursor-pointer"
            >
              rendszer
            </button>
            <span className="text-muted-foreground">
              {' '}felé érkezett {isMultiFile ? `${item.files.length} dokumentum` : 'egy dokumentum'} e-mailből
            </span>
          </p>

          {/* Row 2: Email Card */}
          <div className="mt-1.5 p-2.5 rounded-md bg-amber-500/5 border border-amber-500/20 flex flex-col gap-1.5 text-xs">
            {item.sender ? (
              <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                <Mail className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="font-semibold text-foreground">Feladó:</span>
                <span className="truncate select-all text-foreground/90" title={item.sender}>
                  {decodeSenderEmail(item.sender)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                <Mail className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="font-semibold text-foreground">Feladó:</span>
                <span className="truncate italic text-muted-foreground/80">(Ismeretlen feladó)</span>
              </div>
            )}
            {item.subject && (
              <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                <span className="font-semibold text-foreground shrink-0">Tárgy:</span>
                <span className="truncate italic text-foreground/80">"{item.subject}"</span>
              </div>
            )}

            {/* If single file */}
            {!isMultiFile && item.files[0] && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-amber-500/10 mt-0.5">
                <span className="text-muted-foreground shrink-0">Csatolmány:</span>
                <button
                  onClick={() => onPdfClick(item.files[0].log)}
                  className="font-medium text-amber-700 dark:text-amber-300 hover:underline inline-flex items-center gap-1 truncate cursor-pointer"
                >
                  <FileText className="h-3 w-3 shrink-0" />
                  {item.files[0].displayName}
                </button>
              </div>
            )}

            {/* If multiple files */}
            {isMultiFile && (
              <div className="pt-1.5 border-t border-amber-500/15 mt-0.5 flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Csatolmányok ({item.files.length} db):
                </span>
                <div className="space-y-1">
                  {item.files.map((file, fIdx) => (
                    <div
                      key={file.log.id || fIdx}
                      className="flex items-center justify-between gap-2 p-1.5 rounded bg-background/50 border border-amber-500/10 text-xs"
                    >
                      <button
                        onClick={() => onPdfClick(file.log)}
                        className="font-medium text-amber-700 dark:text-amber-300 hover:underline inline-flex items-center gap-1.5 truncate max-w-[280px] text-left cursor-pointer"
                        title={`Dokumentum megtekintése: ${file.displayName}`}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="truncate">{file.displayName}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (item.type === 'processed_doc') {
    return (
      <div
        className={`relative flex items-start gap-4 py-3 px-3 rounded-lg transition-colors border-b border-border/60 ${
          index % 2 === 0 ? 'bg-slate-100 dark:bg-secondary/30' : 'bg-white dark:bg-transparent'
        }`}
      >
        {/* Icon dot */}
        <div className="relative z-10 shrink-0 mt-0.5">
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-border/50 text-green-600 bg-green-50 dark:bg-green-950/30">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <button
            onClick={() => onUserClick({ userId: null, userName: 'Rendszer', isSystem: true })}
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background transition-transform hover:scale-110 outline-none bg-indigo-100 text-indigo-600 cursor-pointer"
            title="Kattints a részletekért: Rendszer"
          >
            <Bot className="h-[10px] w-[10px]" />
          </button>
        </div>

        {/* Time & Date */}
        <div className="shrink-0 flex flex-col items-center justify-center min-w-[48px] text-center mt-0.5">
          <span className="text-[15px] font-bold text-foreground tracking-tight leading-none mb-1">
            {format(new Date(item.created_at), 'HH:mm', { locale: hu })}
          </span>
          <div className="flex flex-col items-center text-[10px] text-muted-foreground font-medium uppercase tracking-wide leading-tight mt-0.5">
            <span>{format(new Date(item.created_at), 'MMM', { locale: hu })}</span>
            <span>{format(new Date(item.created_at), 'd.', { locale: hu })}</span>
            <span>{format(new Date(item.created_at), 'yyyy', { locale: hu })}</span>
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Row 1: Action sentence */}
          <p className="text-sm leading-snug">
            <span className="text-muted-foreground">A </span>
            <button
              onClick={() => onUserClick({ userId: null, userName: 'Rendszer', isSystem: true })}
              className="font-semibold hover:text-primary transition-colors hover:underline outline-none cursor-pointer"
            >
              rendszer
            </button>
            <span className="text-muted-foreground"> feldolgozott egy dokumentumot</span>
          </p>

          {/* Row 2: Details Card */}
          <div className="mt-1.5 p-2.5 rounded-md bg-green-500/5 border border-green-500/20 flex flex-col gap-1.5 text-xs">
            {/* 1. Feladó */}
            {item.sender && (
              <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                <Mail className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="font-semibold text-foreground">Feladó:</span>
                <span className="truncate select-all text-foreground/90" title={item.sender}>
                  {decodeSenderEmail(item.sender)}
                </span>
              </div>
            )}

            {/* 2. Tárgy */}
            {item.subject && (
              <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                <span className="font-semibold text-foreground shrink-0">Tárgy:</span>
                <span className="truncate italic text-foreground/80">"{item.subject}"</span>
              </div>
            )}

            {/* 3. Csatolmány */}
            <div className={`flex items-center gap-1.5 text-muted-foreground ${item.sender || item.subject ? 'pt-1 border-t border-green-500/10' : ''}`}>
              <span className="font-semibold text-foreground shrink-0">Csatolmány:</span>
              <button
                onClick={() => onPdfClick(item.sourceLog)}
                className="font-medium text-green-700 dark:text-green-300 hover:underline inline-flex items-center gap-1 truncate cursor-pointer"
                title={`Dokumentum megtekintése: ${item.displayName}`}
              >
                <FileText className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                <span className="truncate">{item.displayName}</span>
              </button>
            </div>

            {/* 4. Létrejött számla */}
            {item.linkedInvoice && (
              <div className="flex items-center gap-2 pt-1 border-t border-green-500/15 flex-wrap">
                <span className="font-semibold text-foreground shrink-0">Létrejött számla:</span>
                <button
                  onClick={() => onInvoiceClick(item.linkedInvoice!.id)}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20 shadow-xs cursor-pointer"
                  title="Kattints a számla megtekintéséhez"
                >
                  <FileText className="h-3 w-3" />
                  <span>{item.linkedInvoice.bizonylatsorszam}</span>
                  {item.linkedInvoice.elado_nev && (
                    <span className="text-muted-foreground font-normal truncate max-w-[150px]">
                      ({item.linkedInvoice.elado_nev})
                    </span>
                  )}
                  {item.linkedInvoice.brutto_vegosszeg != null && (
                    <span className="text-foreground font-semibold">
                      {formatCurrency(item.linkedInvoice.brutto_vegosszeg, item.linkedInvoice.penznem || 'HUF')}
                    </span>
                  )}
                  <ExternalLink className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                </button>
              </div>
            )}

            {/* If manual upload (no sender): indicate source */}
            {!item.sender && (
              <div className="flex items-center gap-2 pt-1 border-t border-green-500/10 text-[11px] text-muted-foreground">
                <span>Manuális feltöltésből</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Regular audit log entry (manual user actions, pairings, etc.)
  if (item.type !== 'regular_log') return null;
  const log = item.log;
  const actionCfg = ACTION_CONFIG[log.action] || ACTION_CONFIG['módosítás'];
  const entityCfg = ENTITY_CONFIG[log.entity] || { label: log.entity, icon: FileText };
  const userName = getUserName(log.user_id);
  const ActionIcon = actionCfg.icon;

  return (
    <div
      className={`relative flex items-start gap-4 py-3 px-3 rounded-lg transition-colors border-b border-border/60 ${
        index % 2 === 0 ? 'bg-slate-100 dark:bg-secondary/30' : 'bg-white dark:bg-transparent'
      }`}
    >
      {/* Icon dot */}
      <div className="relative z-10 shrink-0 mt-0.5">
        <div className={`flex h-[42px] w-[42px] items-center justify-center rounded-full border border-border/50 ${actionCfg.color}`}>
          <ActionIcon className="h-5 w-5" />
        </div>
        <button
          onClick={() => onUserClick({ userId: log.user_id, userName, isSystem: !log.user_id })}
          className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background transition-transform hover:scale-110 outline-none cursor-pointer ${
            !log.user_id ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'
          }`}
          title={`Kattints a részletekért: ${userName}`}
        >
          {!log.user_id ? (
            <Bot className="h-[10px] w-[10px]" />
          ) : (
            <User className="h-[10px] w-[10px]" />
          )}
        </button>
      </div>

      {/* Time & Date */}
      <div className="shrink-0 flex flex-col items-center justify-center min-w-[48px] text-center mt-0.5">
        <span className="text-[15px] font-bold text-foreground tracking-tight leading-none mb-1">
          {format(new Date(log.created_at), 'HH:mm', { locale: hu })}
        </span>
        <div className="flex flex-col items-center text-[10px] text-muted-foreground font-medium uppercase tracking-wide leading-tight mt-0.5">
          <span>{format(new Date(log.created_at), 'MMM', { locale: hu })}</span>
          <span>{format(new Date(log.created_at), 'd.', { locale: hu })}</span>
          <span>{format(new Date(log.created_at), 'yyyy', { locale: hu })}</span>
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Row 1: action sentence */}
        <p className="text-sm leading-snug">
          <button
            onClick={() => onUserClick({ userId: log.user_id, userName, isSystem: !log.user_id })}
            className="font-semibold hover:text-primary transition-colors hover:underline outline-none cursor-pointer"
          >
            {userName}
          </button>
          {' '}
          <span className="text-muted-foreground">{actionCfg.label} egy {entityCfg.label}</span>
        </p>

        {/* Row 2: Content details */}
        {getDisplayName(log) && (
          <p className="text-xs mt-0.5">
            {isLikelyPdf(log) ? (
              <button
                onClick={() => onPdfClick(log)}
                className="font-medium hover:underline inline-flex items-center gap-1 transition-colors text-blue-500 hover:text-blue-600 cursor-pointer"
              >
                <FileText className="h-3 w-3 shrink-0" />
                {getDisplayName(log)}
              </button>
            ) : (
              <span className="font-medium text-foreground">{getDisplayName(log)}</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
