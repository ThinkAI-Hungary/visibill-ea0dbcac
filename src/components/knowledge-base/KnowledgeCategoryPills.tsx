import React, { useMemo } from "react";
import { KnowledgeCategory } from "@/types/knowledgeBase";
import { KnowledgeIcon } from "./KnowledgeIcon";
import { cn } from "@/lib/utils";
import { Layers, BookOpen, Receipt, Sparkles } from "lucide-react";

export type KnowledgeAppScope = "all" | "eaisybill" | "eaisybooks";

interface KnowledgeCategoryPillsProps {
  categories: KnowledgeCategory[];
  selectedScope: KnowledgeAppScope;
  onSelectScope: (scope: KnowledgeAppScope) => void;
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  categoryArticleCounts: Record<string, number>;
  totalArticlesCount: number;
  eaisybillArticlesCount: number;
  eaisybooksArticlesCount: number;
}

const isBooksCategory = (catId: string) => catId.startsWith("books_");

export const KnowledgeCategoryPills = React.memo(function KnowledgeCategoryPills({
  categories,
  selectedScope,
  onSelectScope,
  selectedCategoryId,
  onSelectCategory,
  categoryArticleCounts,
  totalArticlesCount,
  eaisybillArticlesCount,
  eaisybooksArticlesCount,
}: KnowledgeCategoryPillsProps) {
  // Filter categories shown in Row 2 based on selected scope in Row 1
  const visibleCategories = useMemo(() => {
    if (selectedScope === "eaisybill") {
      return categories.filter((c) => !isBooksCategory(c.id));
    }
    if (selectedScope === "eaisybooks") {
      return categories.filter((c) => isBooksCategory(c.id));
    }
    return categories;
  }, [categories, selectedScope]);

  const handleScopeChange = (newScope: KnowledgeAppScope) => {
    onSelectScope(newScope);
    // If current category does not belong to new scope, clear category filter
    if (selectedCategoryId) {
      const isBooks = isBooksCategory(selectedCategoryId);
      if (newScope === "eaisybill" && isBooks) {
        onSelectCategory(null);
      } else if (newScope === "eaisybooks" && !isBooks) {
        onSelectCategory(null);
      }
    }
  };

  // Scope pill label and count for "All" in Row 2
  const scopeAllLabel = useMemo(() => {
    if (selectedScope === "eaisybill") return "Összes eaisyBill téma";
    if (selectedScope === "eaisybooks") return "Összes eaisyBooks téma";
    return "Összes téma";
  }, [selectedScope]);

  const scopeAllCount = useMemo(() => {
    if (selectedScope === "eaisybill") return eaisybillArticlesCount;
    if (selectedScope === "eaisybooks") return eaisybooksArticlesCount;
    return totalArticlesCount;
  }, [selectedScope, eaisybillArticlesCount, eaisybooksArticlesCount, totalArticlesCount]);

  return (
    <div className="w-full space-y-3.5 py-1">
      {/* ── 1. FELSŐ SOR: Modul Hatókör (Összes kategória / eaisyBill / eaisyBooks) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="inline-flex items-center gap-1.5 rounded-2xl border border-border/70 bg-card/80 p-1.5 backdrop-blur-sm shadow-2xs">
          {/* Összes kategória tab */}
          <button
            type="button"
            onClick={() => handleScopeChange("all")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 select-none",
              selectedScope === "all"
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Layers className="h-3.5 w-3.5 shrink-0" />
            <span>Összes kategória</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                selectedScope === "all"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {totalArticlesCount}
            </span>
          </button>

          {/* eaisyBill tab */}
          <button
            type="button"
            onClick={() => handleScopeChange("eaisybill")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 select-none",
              selectedScope === "eaisybill"
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Receipt className="h-3.5 w-3.5 shrink-0" />
            <span>eaisyBill</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                selectedScope === "eaisybill"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {eaisybillArticlesCount}
            </span>
          </button>

          {/* eaisyBooks tab */}
          <button
            type="button"
            onClick={() => handleScopeChange("eaisybooks")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 select-none",
              selectedScope === "eaisybooks"
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <BookOpen className="h-3.5 w-3.5 shrink-0" />
            <span>eaisyBooks</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                selectedScope === "eaisybooks"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {eaisybooksArticlesCount}
            </span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>
            {selectedScope === "eaisybill"
              ? "eaisyBill funkciók és modulok"
              : selectedScope === "eaisybooks"
              ? "eaisyBooks könyvelői modulok és adminisztráció"
              : "Teljes rendszer tudásbázis"}
          </span>
        </div>
      </div>

      {/* ── 2. MÁSODIK SOR: A kiválasztott hatókör kategóriái ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* "Összes" gomb az adott hatókörön belül */}
        <button
          type="button"
          onClick={() => onSelectCategory(null)}
          className={cn(
            "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200 border select-none shrink-0",
            selectedCategoryId === null
              ? "bg-primary text-primary-foreground border-primary shadow-xs shadow-primary/25"
              : "bg-card/70 text-card-foreground border-border/60 hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Layers className="h-3.5 w-3.5 shrink-0" />
          <span>{scopeAllLabel}</span>
          <span
            className={cn(
              "ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
              selectedCategoryId === null
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {scopeAllCount}
          </span>
        </button>

        {/* Egyedi kategória gombok */}
        {visibleCategories.map((category) => {
          const isSelected = selectedCategoryId === category.id;
          const count = categoryArticleCounts[category.id] ?? 0;

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelectCategory(isSelected ? null : category.id)}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200 border select-none shrink-0",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-xs shadow-primary/25"
                  : "bg-card/70 text-card-foreground border-border/60 hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <KnowledgeIcon name={category.icon} className="h-3.5 w-3.5 shrink-0" />
              <span>{category.title}</span>
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
                  isSelected
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
