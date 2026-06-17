import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { resolveIcon } from '@/components/IconPicker';

interface CategoryAccordionItemProps {
  name: string;
  description: string;
  color: string;
  iconName: string | null;
  invoiceCount: number;
  totalAmount: number;
  totalAllAmount: number;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function CategoryAccordionItem({
  name,
  description,
  color,
  iconName,
  invoiceCount,
  totalAmount,
  totalAllAmount,
  onToggle,
  onEdit,
  onDelete,
}: CategoryAccordionItemProps) {
  const IconComponent = resolveIcon(iconName);
  const tags = description ? description.split(',').map(t => t.trim()).filter(Boolean) : [];
  const isEmpty = invoiceCount === 0;
  const pct = totalAllAmount > 0 ? Math.round((totalAmount / totalAllAmount) * 100) : 0;

  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) return '0 Ft';
    return new Intl.NumberFormat('hu-HU').format(amount) + ' Ft';
  };

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
            <div className="flex flex-wrap gap-1 mt-1">
              {tags.slice(0, 4).map((tag, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0"
                >
                  {tag}
                </Badge>
              ))}
              {tags.length > 4 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  +{tags.length - 4}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Progress bar */}
          <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(pct, isEmpty ? 0 : 1)}%`, backgroundColor: color }}
            />
          </div>

          {/* Invoice count */}
          <div className="text-right w-12">
            <div className={`text-sm font-bold tabular-nums ${isEmpty ? 'text-muted-foreground' : ''}`}>
              {invoiceCount}
            </div>
          </div>

          {/* Amount */}
          <div className="text-right w-28">
            <div className={`text-sm font-bold tabular-nums ${isEmpty ? 'text-muted-foreground' : ''}`}
                 style={!isEmpty ? { color } : undefined}>
              {formatAmount(totalAmount)}
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
