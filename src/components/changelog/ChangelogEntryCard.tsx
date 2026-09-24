import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Wrench, Zap, CheckCircle2, Plus, Laptop, BookOpen, Layers, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChangelogEntry } from "@/types/changelog";

interface ChangelogEntryCardProps {
  entry: ChangelogEntry;
  isActive?: boolean;
}

export const ChangelogEntryCard: React.FC<ChangelogEntryCardProps> = ({ entry, isActive = false }) => {
  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "feature":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3 shrink-0" />
            Új funkció
          </span>
        );
      case "fix":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500 dark:text-sky-400 border border-sky-500/20 text-[10px] font-bold uppercase tracking-wider">
            <Wrench className="w-3 h-3 shrink-0" />
            Javítás
          </span>
        );
      case "improvement":
      case "perf":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20 text-[10px] font-bold uppercase tracking-wider">
            <Zap className="w-3 h-3 shrink-0" />
            Fejlesztés
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border text-[10px] font-medium">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            Frissítés
          </span>
        );
    }
  };

  const getScopeBadge = (scope: string) => {
    switch (scope) {
      case "eaisybill":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-medium">
            <Laptop className="w-2.5 h-2.5 shrink-0" />
            eaisyBill
          </span>
        );
      case "eaisybooks":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 text-[10px] font-medium">
            <BookOpen className="w-2.5 h-2.5 shrink-0" />
            eaisyBooks
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border text-[10px] font-medium">
            <Layers className="w-2.5 h-2.5 shrink-0" />
            Minden modul
          </span>
        );
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case "new":
        return <Plus className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5 stroke-[2.5]" />;
      case "fix":
        return <CheckCircle2 className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5 stroke-[2]" />;
      case "perf":
        return <Zap className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5 stroke-[2]" />;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5 stroke-[2]" />;
    }
  };

  return (
    <Card
      className={cn(
        "rounded-xl bg-card transition-all duration-300 group overflow-hidden",
        isActive
          ? "border-primary/50 shadow-lg shadow-primary/5 ring-1 ring-primary/20"
          : "border-border/80 shadow-md hover:border-border"
      )}
    >
      <CardContent className="p-5 lg:p-6 space-y-4">
        {/* Top Badges & Version */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {getCategoryBadge(entry.category)}
            {getScopeBadge(entry.app_scope)}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground font-mono bg-muted/40 px-2 py-0.5 rounded border border-border/60 flex items-center gap-1">
              <Tag className="w-2.5 h-2.5 text-muted-foreground/70" />
              {entry.version}
            </span>
          </div>
        </div>

        {/* Title and Summary */}
        <div>
          <h3
            className={cn(
              "text-base lg:text-lg font-bold tracking-tight transition-colors",
              isActive ? "text-primary" : "text-foreground group-hover:text-primary"
            )}
          >
            {entry.title}
          </h3>
          <p className="text-xs lg:text-sm text-muted-foreground mt-1.5 leading-relaxed">
            {entry.summary}
          </p>
        </div>

        {/* Bullet points / Highlights */}
        {entry.items && entry.items.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-border/60 text-xs text-foreground/90">
            {entry.items.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5 leading-relaxed">
                {getItemIcon(item.type)}
                <div>
                  <strong className="text-foreground font-semibold mr-1.5">{item.title}:</strong>
                  <span className="text-muted-foreground">{item.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
