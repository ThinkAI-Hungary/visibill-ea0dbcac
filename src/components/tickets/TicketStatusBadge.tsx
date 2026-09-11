import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

const statusConfig = {
  created: {
    labelKey: "status.created",
    fallback: "Nyitott",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
  },
  new: {
    labelKey: "status.created",
    fallback: "Nyitott",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
  },
  open: {
    labelKey: "status.created",
    fallback: "Nyitott",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
  },
  assigned: {
    labelKey: "status.assigned",
    fallback: "Hozzárendelt",
    className: "bg-blue-600/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  in_progress: {
    labelKey: "status.in_progress",
    fallback: "Folyamatban",
    className: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30",
  },
  resolved: {
    labelKey: "status.resolved",
    fallback: "Megoldva",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  },
} as const;

interface TicketStatusBadgeProps {
  status: string;
  waitingForConfirmation?: boolean;
  className?: string;
}

export function TicketStatusBadge({ status, waitingForConfirmation, className }: TicketStatusBadgeProps) {
  const { t } = useTranslation('tickets');

  if (waitingForConfirmation && status !== "resolved") {
    return (
      <Badge
        variant="outline"
        className={`w-auto min-w-[96px] whitespace-nowrap justify-center text-center shrink-0 rounded-full font-medium bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 px-3 py-0.5 ${className || ""}`}
      >
        {t('status.waiting_for_confirmation', 'Visszaigazolásra vár')}
      </Badge>
    );
  }

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.created;

  return (
    <Badge variant="outline" className={`w-[96px] justify-center text-center shrink-0 rounded-full font-medium ${config.className} ${className || ""}`}>
      {t(config.labelKey, config.fallback)}
    </Badge>
  );
}
