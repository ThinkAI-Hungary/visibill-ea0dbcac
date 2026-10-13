import React, { memo } from 'react';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Check, Folder } from 'lucide-react';
import { PostingItemRow } from './PostingItemRow';
import type { PostingGroup, PostingItem } from '../types';

interface PostingGroupAccordionProps {
  group: PostingGroup;
  approvedItemIds: Set<string>;
  focusedItemId: string | null;
  onToggleApproval: (itemId: string) => void;
  onFocusItem: (itemId: string) => void;
  onOpenReassign: (item: PostingItem) => void;
  onApproveGroup: (group: PostingGroup) => void;
}

export const PostingGroupAccordion = memo(function PostingGroupAccordion({
  group,
  approvedItemIds,
  focusedItemId,
  onToggleApproval,
  onFocusItem,
  onOpenReassign,
  onApproveGroup,
}: PostingGroupAccordionProps) {
  const approvedCount = React.useMemo(() => {
    return group.items.filter((item) => approvedItemIds.has(item.item_id)).length;
  }, [group.items, approvedItemIds]);

  const totalCount = group.items.length;
  const isFullyApproved = approvedCount === totalCount && totalCount > 0;
  const isUnclassified = group.gl_number === 'UNCLASSIFIED';

  const formattedTotalNet = new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 0,
  }).format(Math.abs(group.total_net_amount));

  return (
    <AccordionItem
      value={group.gl_number}
      className={`border rounded-xl mb-3.5 overflow-hidden transition-colors ${
        isFullyApproved
          ? 'border-emerald-500/30 bg-emerald-500/[0.02] dark:border-emerald-800/40'
          : isUnclassified
          ? 'border-amber-500/40 bg-amber-500/[0.02] dark:border-amber-800/40'
          : 'border-border/80 bg-card/60'
      }`}
    >
      <AccordionTrigger className="px-4 py-3.5 hover:no-underline hover:bg-accent/30 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full pr-4 text-left">
          {/* Bal oldal: Főkönyvi szám és megnevezés */}
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                isFullyApproved
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : isUnclassified
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              {isFullyApproved ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Folder className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-base tracking-tight text-foreground">
                  {group.gl_number}
                </span>
                <span className="font-semibold text-sm text-foreground">
                  {group.gl_name}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                  {totalCount} tétel
                </Badge>
                {approvedCount > 0 && (
                  <span
                    className={`font-medium ${
                      isFullyApproved
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground'
                    }`}
                  >
                    ({approvedCount} / {totalCount} jóváhagyva)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Jobb oldal: Csoportösszeg és 'Összes jóváhagyása' gomb */}
          <div className="flex items-center gap-3.5 self-end sm:self-auto">
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">Összesen:</span>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {formattedTotalNet} HUF
              </span>
            </div>

            {!isFullyApproved && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onApproveGroup(group);
                }}
                className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                Összes jóváhagyása
              </Button>
            )}
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4 pt-1 space-y-2">
        {group.items.map((item: PostingItem) => (
          <PostingItemRow
            key={item.item_id}
            item={item}
            isApproved={approvedItemIds.has(item.item_id)}
            isFocused={focusedItemId === item.item_id}
            onToggleApproval={onToggleApproval}
            onFocus={onFocusItem}
            onOpenReassign={onOpenReassign}
          />
        ))}
      </AccordionContent>
    </AccordionItem>
  );
});
