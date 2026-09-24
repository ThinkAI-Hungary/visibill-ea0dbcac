import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";

interface TicketCategoryBadgeProps {
  category: string | null | undefined;
  className?: string;
  showIcon?: boolean;
}

export function TicketCategoryBadge({
  category,
  className,
  showIcon = true,
}: TicketCategoryBadgeProps) {
  if (!category) return null;

  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/25 shrink-0 ${
        className || ""
      }`}
    >
      {showIcon && <Tag className="h-3 w-3 shrink-0 opacity-70" />}
      <span className="truncate max-w-[140px]">{category}</span>
    </Badge>
  );
}
