import React from "react";
import {
  Compass,
  Receipt,
  Landmark,
  BookOpen,
  Users,
  Wrench,
  Shield,
  Upload,
  RotateCcw,
  Coins,
  Calculator,
  TicketCheck,
  FileText,
  Clock,
  Sparkles,
  Briefcase,
  Building2,
  Layers,
  Bot,
  Truck,
  Calendar,
  Bell,
  Send,
  FolderKanban,
  BarChart3,
  Rocket,
  Brain,
  ClipboardList,
  ShieldCheck,
  HelpCircle,
  LucideProps,
} from "lucide-react";

interface KnowledgeIconProps extends LucideProps {
  name?: string | null;
}

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  Compass,
  Receipt,
  Landmark,
  BookOpen,
  Users,
  Wrench,
  Shield,
  Upload,
  RotateCcw,
  Coins,
  Calculator,
  TicketCheck,
  FileText,
  Clock,
  Sparkles,
  Briefcase,
  Building2,
  Layers,
  Bot,
  Truck,
  Calendar,
  Bell,
  Send,
  FolderKanban,
  BarChart3,
  Rocket,
  Brain,
  ClipboardList,
  ShieldCheck,
};

export const KnowledgeIcon = React.memo(function KnowledgeIcon({
  name,
  ...props
}: KnowledgeIconProps) {
  if (!name) {
    return <BookOpen {...props} />;
  }

  const IconComponent = ICON_MAP[name] || HelpCircle;
  return <IconComponent {...props} />;
});
