import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Sparkles, Wrench, Zap, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChangelogAppScope } from "@/types/changelog";
import { APP_VERSION, APP_BUILD_DATE } from "@/config/version";

interface ChangelogHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedScope: ChangelogAppScope | "all";
  onSelectScope: (scope: ChangelogAppScope | "all") => void;
  totalCount: number;
}

export const ChangelogHeader: React.FC<ChangelogHeaderProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  selectedScope,
  onSelectScope,
  totalCount,
}) => {
  const categories = [
    { id: "all", label: "Összes", icon: Layers, color: "text-muted-foreground" },
    { id: "feature", label: "Új funkciók", icon: Sparkles, color: "text-emerald-500" },
    { id: "fix", label: "Javítások", icon: Wrench, color: "text-sky-500" },
    { id: "improvement", label: "Fejlesztések", icon: Zap, color: "text-purple-500" },
  ];

  const scopes: Array<{ id: ChangelogAppScope | "all"; label: string }> = [
    { id: "all", label: "Mindkét modul" },
    { id: "eaisybill", label: "eaisyBill" },
    { id: "eaisybooks", label: "eaisyBooks" },
  ];

  return (
    <div className="space-y-4 border-b border-border/80 pb-6">
      {/* Top Banner Tag */}
      <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
        </span>
        Folyamatos platform frissítések
      </div>

      {/* Main Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            Fejlesztői Napló
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kövesd nyomon az eaisybill és eaisyBooks napi javításait, stabilitási fejlesztéseit és új funkcióit.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-2.5 py-1 rounded-md border border-border">
            {APP_VERSION} • build {APP_BUILD_DATE}
          </span>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors select-none",
                  isSelected
                    ? "bg-primary/15 text-primary border border-primary/30 shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted border border-border"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5 shrink-0", isSelected ? "text-primary" : cat.color)} />
                {cat.label}
              </button>
            );
          })}

          <span className="text-border mx-1 hidden md:inline">|</span>

          {/* Scope Pills Grouped */}
          <div className="inline-flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
            {scopes.map((s) => {
              const isSelected = selectedScope === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectScope(s.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium select-none whitespace-nowrap border transition-colors",
                    isSelected
                      ? "bg-background text-foreground border-border/90 shadow-xs"
                      : "border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:border-border/70"
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Instant Search Bar */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Keresés javítások között..."
            className="h-8 pl-8 pr-8 text-xs bg-muted/40 border-border focus-visible:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
