import { Badge } from "@/components/ui/badge";
import { CircleDot, Loader2, CheckCircle2 } from "lucide-react";

const statusConfig = {
  created: {
    label: "Új",
    icon: CircleDot,
    className: "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20",
  },
  in_progress: {
    label: "Folyamatban",
    icon: Loader2,
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20",
  },
  resolved: {
    label: "Megoldva",
    icon: CheckCircle2,
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20",
  },
} as const;

interface TicketStatusBadgeProps {
  status: string;
  className?: string;
}

export function TicketStatusBadge({ status, className }: TicketStatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.created;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`gap-1.5 font-medium ${config.className} ${className || ""}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
