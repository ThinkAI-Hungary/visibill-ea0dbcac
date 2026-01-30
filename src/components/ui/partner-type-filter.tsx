import { cn } from '@/lib/utils';

export type PartnerTypeFilterValue = 'all' | 'customer' | 'supplier';

interface PartnerTypeFilterProps {
  value: PartnerTypeFilterValue;
  onChange: (value: PartnerTypeFilterValue) => void;
  className?: string;
}

export function PartnerTypeFilter({
  value,
  onChange,
  className,
}: PartnerTypeFilterProps) {
  const options: { value: PartnerTypeFilterValue; label: string }[] = [
    { value: 'all', label: 'Összes' },
    { value: 'customer', label: 'Vevő' },
    { value: 'supplier', label: 'Szállító' },
  ];

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg bg-muted p-1 gap-1",
        className
      )}
      role="radiogroup"
      aria-label="Partner típus szűrő"
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
          role="radio"
          aria-checked={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
