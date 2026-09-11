import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

const priorityConfig = {
  low: {
    labelKey: "priority.low",
    fallback: "Alacsony",
    className: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  },
  medium: {
    labelKey: "priority.medium",
    fallback: "Közepes",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  },
  high: {
    labelKey: "priority.high",
    fallback: "Magas",
    className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  },
  critical: {
    labelKey: "priority.critical",
    fallback: "Kritikus",
    className: "bg-red-500/10 text-red-600 border-red-500/20",
  },
} as const;

interface TicketPriorityBadgeProps {
  priority: string | null;
  className?: string;
}

export function TicketPriorityBadge({ priority, className }: TicketPriorityBadgeProps) {
  const { t } = useTranslation('tickets');
  const config = priorityConfig[(priority || "medium") as keyof typeof priorityConfig] || priorityConfig.medium;

  return (
    <Badge variant="outline" className={`w-[96px] justify-center text-center shrink-0 rounded-full font-medium ${config.className} ${className || ""}`}>
      {t(config.labelKey, config.fallback)}
    </Badge>
  );
}
