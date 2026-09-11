import { Badge } from "@/components/ui/badge";

const statusConfig = {
  created: {
    label: "Nyitott",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
  },
  new: {
    label: "Nyitott",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
  },
  open: {
    label: "Nyitott",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25",
  },
  assigned: {
    label: "Hozzárendelt",
    className: "bg-blue-600/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  in_progress: {
    label: "Folyamatban",
    className: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30",
  },
  resolved: {
    label: "Megoldva",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
  },
} as const;

interface TicketStatusBadgeProps {
  status: string;
  waitingForConfirmation?: boolean;
  className?: string;
}

export function TicketStatusBadge({ status, waitingForConfirmation, className }: TicketStatusBadgeProps) {
  if (waitingForConfirmation && status !== "resolved") {
    return (
      <Badge
        variant="outline"
        className={`w-auto min-w-[96px] whitespace-nowrap justify-center text-center shrink-0 rounded-full font-medium bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 px-3 py-0.5 ${className || ""}`}
      >
        Visszaigazolásra vár
      </Badge>
    );
  }

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.created;

  return (
    <Badge variant="outline" className={`w-[96px] justify-center text-center shrink-0 rounded-full font-medium ${config.className} ${className || ""}`}>
      {config.label}
    </Badge>
  );
}
