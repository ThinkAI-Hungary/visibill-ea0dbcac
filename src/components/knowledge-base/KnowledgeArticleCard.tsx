import React from "react";
import { Link } from "react-router-dom";
import { KnowledgeArticle } from "@/types/knowledgeBase";
import { KnowledgeIcon } from "./KnowledgeIcon";
import { Clock, ArrowRight, ArrowUpRight, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useScopedBasePath } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { FALLBACK_CATEGORY_MAP } from "@/data/knowledgeBaseFallback";
import { useCanAccessKnowledgeMenuPath } from "@/hooks/useKnowledgeBase";
import { parseInlineFormatting } from "./KnowledgeArticleStructuredContent";

interface KnowledgeArticleCardProps {
  article: KnowledgeArticle;
  onSelect: (article: KnowledgeArticle) => void;
}

export const KnowledgeArticleCard = React.memo(function KnowledgeArticleCard({
  article,
  onSelect,
}: KnowledgeArticleCardProps) {
  const basePath = useScopedBasePath();

  const handleCardClick = (e: React.MouseEvent) => {
    // If user clicked directly on the deep-link button/link, don't hijack
    if ((e.target as HTMLElement).closest("a") || (e.target as HTMLElement).closest("button[data-action='jump']")) {
      return;
    }
    onSelect(article);
  };

  const categoryTitle = article.category?.title || FALLBACK_CATEGORY_MAP.get(article.category_id)?.title || "Tudástár";
  const categoryIcon = article.category?.icon || FALLBACK_CATEGORY_MAP.get(article.category_id)?.icon || article.icon;
  const canJump = useCanAccessKnowledgeMenuPath(article.menu_path);

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-sm",
        "transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5",
        "cursor-pointer"
      )}
    >
      <div>
        {/* Card Header: Category & Read Time */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <Badge
            variant="secondary"
            className="flex items-center gap-1.5 bg-secondary/30 text-secondary-foreground border-transparent px-2.5 py-0.5 font-medium"
          >
            <KnowledgeIcon name={categoryIcon} className="h-3 w-3 text-primary" />
            <span>{categoryTitle}</span>
          </Badge>

          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{article.estimated_read_time}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="mt-3 text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {article.title}
        </h3>

        {/* Summary with parsed inline markdown */}
        <div className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-3">
          {parseInlineFormatting(article.summary)}
        </div>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {article.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground border border-border/30"
              >
                <Tag className="h-2.5 w-2.5 text-muted-foreground/70" />
                <span>{tag}</span>
              </span>
            ))}
            {article.tags.length > 4 && (
              <span className="inline-block rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                +{article.tags.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-3 text-xs">
        <span className="inline-flex items-center gap-1 font-medium text-primary group-hover:underline">
          Megtekintés
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>

        {canJump && article.menu_path && (
          <Link
            to={article.menu_path.startsWith("/") ? `${basePath}${article.menu_path === "/" ? "" : article.menu_path}` : article.menu_path}
            data-action="jump"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
            title={`Ugrás az oldalra: ${article.menu_path}`}
          >
            <span>Ugrás az oldalra</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
});
