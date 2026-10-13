import React, { memo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowDownRight, ArrowUpRight, ChevronDown } from 'lucide-react';
import type { PostingItem } from '../types';

interface PostingItemRowProps {
  item: PostingItem;
  isApproved: boolean;
  isFocused: boolean;
  onToggleApproval: (itemId: string) => void;
  onFocus: (itemId: string) => void;
  onOpenReassign: (item: PostingItem) => void;
}

export const PostingItemRow = memo(function PostingItemRow({
  item,
  isApproved,
  isFocused,
  onToggleApproval,
  onFocus,
  onOpenReassign,
}: PostingItemRowProps) {
  const isOutbound = item.invoice_direction === 'OUTBOUND';
  const formattedNet = new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 0,
  }).format(Math.abs(item.net_amount));

  return (
    <div
      onClick={() => onFocus(item.item_id)}
      className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border transition-colors cursor-pointer select-none ${
        isApproved
          ? 'bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-950/15 dark:border-emerald-800/40'
          : isFocused
          ? 'bg-accent/40 border-primary/60 dark:bg-accent/25'
          : 'bg-card hover:bg-accent/20 border-border/70'
      }`}
    >
      {/* Bal oldal: Checkbox + Partner + Számlaszám + Tétel leírás */}
      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
        <Checkbox
          checked={isApproved}
          onCheckedChange={() => onToggleApproval(item.item_id)}
          className="mt-0.5 sm:mt-0 shrink-0"
          aria-label={`Tétel jóváhagyása: ${item.line_description}`}
        />

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm truncate max-w-[240px] sm:max-w-[320px] text-foreground">
              {item.partner_name}
            </span>

            {item.partner_tax_number && (
              <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                ({item.partner_tax_number})
              </span>
            )}

            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 font-medium ${
                isOutbound
                  ? 'text-blue-600 border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/30'
                  : 'text-amber-600 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/30'
              }`}
            >
              {isOutbound ? (
                <ArrowUpRight className="w-2.5 h-2.5 inline mr-0.5" />
              ) : (
                <ArrowDownRight className="w-2.5 h-2.5 inline mr-0.5" />
              )}
              {item.invoice_number || 'Számla'}
            </Badge>

            {item.rule_name && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 flex items-center gap-1"
                title={`Alkalmazott szabály: ${item.rule_name}`}
              >
                <Sparkles className="w-2.5 h-2.5" />
                {item.rule_name}
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground truncate" title={item.line_description}>
            {item.line_description}
          </p>
        </div>
      </div>

      {/* Jobb oldal: Összeg + ÁFA + Gyors Áthelyező Gomb */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
        <div className="text-right">
          <div className="text-sm font-bold tabular-nums text-foreground">
            {formattedNet} {item.currency || 'HUF'}
          </div>
          <div className="text-[10px] text-muted-foreground tabular-nums">
            {item.vat_rate ? `${item.vat_rate}` : ''}
            {item.vat_code ? ` (${item.vat_code})` : ''}
          </div>
        </div>

        {/* Gyors áthelyező Gomb (Kattintásra azonnali kereső modal nyílik) */}
        <div className="w-[180px] sm:w-[200px]" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenReassign(item)}
            className="w-full h-8 text-xs font-mono font-medium gap-1.5 justify-between bg-background/80 hover:bg-accent/40 border-border/70 hover:border-primary/50 transition-colors"
            title="Kattints a főkönyvi szám módosításához"
          >
            <span className="truncate">
              {item.suggested_gl_number} - {item.suggested_gl_name}
            </span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" />
          </Button>
        </div>
      </div>
    </div>
  );
});

