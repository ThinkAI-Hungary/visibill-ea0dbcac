import { Badge } from "@/components/ui/badge";

const statusConfig = {
  created: {
    label: "Nyitott",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  new: {
    label: "Nyitott",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  open: {
    label: "Nyitott",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  assigned: {
    label: "Hozzárendelt",
    className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  in_progress: {
    label: "Folyamatban",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  resolved: {
    label: "Megoldva",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
} as const;

interface TicketStatusBadgeProps {
  status: string;
  className?: string;
}

export function TicketStatusBadge({ status, className }: TicketStatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.created;

  return (
    <Badge variant="outline" className={`w-[96px] justify-center text-center shrink-0 rounded-full font-medium ${config.className} ${className || ""}`}>
      {config.label}
    </Badge>
  );
}

