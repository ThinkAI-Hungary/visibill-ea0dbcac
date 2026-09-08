import React from "react";
import { KnowledgeCategory } from "@/types/knowledgeBase";
import { KnowledgeIcon } from "./KnowledgeIcon";
import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";

interface KnowledgeCategoryPillsProps {
  categories: KnowledgeCategory[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  categoryArticleCounts: Record<string, number>;
  totalArticlesCount: number;
}

export const KnowledgeCategoryPills = React.memo(function KnowledgeCategoryPills({
  categories,
  selectedCategoryId,
  onSelectCategory,
  categoryArticleCounts,
  totalArticlesCount,
}: KnowledgeCategoryPillsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      {/* "All" category pill */}
      <button
        type="button"
        onClick={() => onSelectCategory(null)}
        className={cn(
          "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-medium transition-all duration-200 border select-none shrink-0",
          selectedCategoryId === null
            ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25"
            : "bg-card/70 text-card-foreground border-border/60 hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Layers className="h-3.5 w-3.5 shrink-0" />
        <span>Összes téma</span>
        <span
          className={cn(
            "ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
            selectedCategoryId === null
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {totalArticlesCount}
        </span>
      </button>

      {/* Individual category pills */}
      {categories.map((category) => {
        const isSelected = selectedCategoryId === category.id;
        const count = categoryArticleCounts[category.id] ?? 0;

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(isSelected ? null : category.id)}
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-medium transition-all duration-200 border select-none shrink-0",
              isSelected
                ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25"
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
  );
});
