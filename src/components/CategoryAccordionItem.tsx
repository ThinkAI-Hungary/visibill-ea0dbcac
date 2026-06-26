import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { resolveIcon } from '@/components/IconPicker';

export interface CategoryInvoice {
  id: string;
  invoice_number: string | null;
  invoice_direction: string | null;
  supplier_name: string | null;
  invoice_issue_date: string | null;
  invoice_gross_amount: number | null;
  penznem: string | null;
  /** Which DB table this invoice lives in */
  source: 'invoices' | 'nav_invoices';
}

interface CategoryAccordionItemProps {
  name: string;
  description: string;
  color: string;
  iconName: string | null;
  invoiceCount: number;
  /** HUF-only total — used for progress bar ratio */
  totalAmount: number;
  totalAllAmount: number;
  /** Per-currency totals, e.g. { HUF: 12000, USD: 45.5 } */
  currencyTotals: Record<string, number>;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Format a single currency amount. HUF → "12 000 Ft", others → "45,50 USD" */
function formatCurrencyAmount(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 2 }).format(amount);
  return currency === 'HUF' ? `${formatted} Ft` : `${formatted} ${currency}`;
}

/** Build "X Ft | Y USD | Z EUR" display string from currencyTotals map */
export function formatCurrencyTotals(currencyTotals: Record<string, number>): string {
  const parts = Object.entries(currencyTotals)
    .filter(([, amt]) => amt !== 0)
    .sort(([a], [b]) => {
      if (a === 'HUF') return -1;
      if (b === 'HUF') return 1;
      return a.localeCompare(b);
    })
    .map(([currency, amount]) => formatCurrencyAmount(amount, currency));
  return parts.length > 0 ? parts.join(' | ') : '0 Ft';
}

export function CategoryAccordionItem({
  name,
  description,
  color,
  iconName,
  invoiceCount,
  totalAmount,
  totalAllAmount,
  currencyTotals,
  onToggle,
  onEdit,
  onDelete,
}: CategoryAccordionItemProps) {
  const IconComponent = resolveIcon(iconName);
  const tags = description ? description.split(',').map(t => t.trim()).filter(Boolean) : [];
  const isEmpty = invoiceCount === 0;
  const pct = totalAllAmount > 0 ? Math.round((totalAmount / totalAllAmount) * 100) : 0;

  const amountDisplay = isEmpty ? '0 Ft' : formatCurrencyTotals(currencyTotals);


  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-primary/5 cursor-pointer select-none"
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        {/* Click indicator arrow */}
        <ChevronRight className="h-4 w-4 text-muted-foreground/60 transition-transform duration-200 flex-shrink-0 group-hover:translate-x-0.5" />
        
        {/* Icon */}
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: color + '20', color: color }}
        >
          <IconComponent className="h-4 w-4" />
        </span>
        
        {/* Name + tags */}
        <div className="flex-1 min-w-0">
          <span className={`font-semibold text-sm ${isEmpty ? 'text-muted-foreground' : 'text-foreground'}`}>
            {name}
          </span>
          {tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-nowrap overflow-hidden">
              {tags.slice(0, 3).map((tag, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0 max-w-[120px] truncate flex-shrink-0"
                  title={tag}
                >
                  {tag}
                </Badge>
              ))}
              {tags.length > 3 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                  +{tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 flex-shrink-0 w-[420px]">
          {/* Progress bar */}
          <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(pct, isEmpty ? 0 : 1)}%`, backgroundColor: color }}
            />
          </div>

          {/* Invoice count */}
          <div className="text-right w-10 flex-shrink-0">
            <div className={`text-sm font-bold tabular-nums ${isEmpty ? 'text-muted-foreground' : ''}`}>
              {invoiceCount}
            </div>
          </div>

          {/* Amount — single line, wider container handles long strings */}
          <div className="text-right flex-1 min-w-0">
            <div
              className={`text-sm font-bold tabular-nums truncate ${isEmpty ? 'text-muted-foreground' : ''}`}
              style={!isEmpty ? { color } : undefined}
              title={amountDisplay}
            >
              {amountDisplay}
            </div>
          </div>
        </div>

        {/* Edit/Delete buttons */}
        <div className="flex gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
