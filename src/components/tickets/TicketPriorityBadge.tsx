import { Badge } from "@/components/ui/badge";

const priorityConfig = {
  low: {
    label: "Alacsony",
    className: "bg-slate-500/10 text-slate-500 border-slate-500/20",
  },
  medium: {
    label: "Közepes",
    className: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  },
  high: {
    label: "Magas",
    className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  },
  critical: {
    label: "Kritikus",
    className: "bg-red-500/10 text-red-600 border-red-500/20",
  },
} as const;

interface TicketPriorityBadgeProps {
  priority: string | null;
  className?: string;
}

export function TicketPriorityBadge({ priority, className }: TicketPriorityBadgeProps) {
  const config = priorityConfig[(priority || "medium") as keyof typeof priorityConfig] || priorityConfig.medium;

  return (
    <Badge variant="outline" className={`font-medium ${config.className} ${className || ""}`}>
      {config.label}
    </Badge>
  );
}
