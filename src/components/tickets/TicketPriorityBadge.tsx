import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { CustomTooltip } from "@/components/ui/custom-tooltip";

const priorityConfig = {
  low: {
    labelKey: "priority.low",
    fallback: "Alacsony",
    className: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    dotClassName: "bg-slate-400 dark:bg-slate-500 ring-slate-400/25",
  },
  medium: {
    labelKey: "priority.medium",
    fallback: "Közepes",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    dotClassName: "bg-amber-500 ring-amber-500/25",
  },
  high: {
    labelKey: "priority.high",
    fallback: "Magas",
    className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    dotClassName: "bg-orange-500 ring-orange-500/25",
  },
  critical: {
    labelKey: "priority.critical",
    fallback: "Kritikus",
    className: "bg-red-500/10 text-red-600 border-red-500/20",
    dotClassName: "bg-red-500 ring-red-500/25",
  },
} as const;

interface TicketPriorityBadgeProps {
  priority: string | null;
  className?: string;
  dotOnly?: boolean;
}

export function TicketPriorityBadge({ priority, className, dotOnly }: TicketPriorityBadgeProps) {
  const { t } = useTranslation('tickets');
  const config = priorityConfig[(priority || "medium") as keyof typeof priorityConfig] || priorityConfig.medium;
  const label = t(config.labelKey, config.fallback);

  if (dotOnly) {
    return (
      <CustomTooltip content={<span className="font-semibold">{label}</span>} side="top" delayDuration={100}>
        <span
          data-testid="priority-dot"
          className={`inline-flex items-center justify-center p-0.5 select-none shrink-0 ${className || ""}`}
          aria-label={`${t('priority_label', 'Prioritás')}: ${label}`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ring-2 transition-transform hover:scale-125 ${config.dotClassName}`}
          />
        </span>
      </CustomTooltip>
    );
  }

  return (
    <Badge variant="outline" className={`w-[96px] justify-center text-center shrink-0 rounded-full font-medium ${config.className} ${className || ""}`}>
      {label}
    </Badge>
  );
}

