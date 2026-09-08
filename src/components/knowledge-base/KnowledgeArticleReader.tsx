import React, { useState } from "react";
import { Link } from "react-router-dom";
import { KnowledgeArticle } from "@/types/knowledgeBase";
import { KnowledgeIcon } from "./KnowledgeIcon";
import {
  ArrowLeft,
  ArrowUpRight,
  Clock,
  Share2,
  Check,
  LifeBuoy,
  BookOpen,
  Sparkles,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useScopedBasePath } from "@/lib/navigation";
import { toast } from "@/hooks/use-toast";

import { FALLBACK_CATEGORY_MAP } from "@/data/knowledgeBaseFallback";
import { useCanAccessKnowledgeMenuPath } from "@/hooks/useKnowledgeBase";
import {
  KnowledgeArticleStructuredContent,
  parseInlineFormatting,
} from "./KnowledgeArticleStructuredContent";

interface KnowledgeArticleReaderProps {
  article: KnowledgeArticle;
  onBack: () => void;
  onSelectArticle: (article: KnowledgeArticle) => void;
  relatedArticles?: KnowledgeArticle[];
}

export const KnowledgeArticleReader = React.memo(function KnowledgeArticleReader({
  article,
  onBack,
  onSelectArticle,
  relatedArticles = [],
}: KnowledgeArticleReaderProps) {
  const basePath = useScopedBasePath();
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(window.location.href).catch((err) => {
        console.warn("Clipboard copy failed:", err);
      });
    }
    setCopied(true);
    toast({
      title: "Cikk linkje másolva",
      description: "A cikk közvetlen hivatkozása a vágólapra került.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const canJump = useCanAccessKnowledgeMenuPath(article.menu_path);

  const jumpUrl = canJump && article.menu_path
    ? article.menu_path.startsWith("/")
      ? `${basePath}${article.menu_path === "/" ? "" : article.menu_path}`
      : article.menu_path
    : null;

  const categoryTitle = article.category?.title || FALLBACK_CATEGORY_MAP.get(article.category_id)?.title || "Tudástár";
  const categoryIcon = article.category?.icon || FALLBACK_CATEGORY_MAP.get(article.category_id)?.icon || article.icon;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card/70"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Vissza az összes útmutatóhoz</span>
        </Button>

        <div className="flex items-center gap-2">
          {jumpUrl && (
            <Button
              asChild
              size="sm"
              className="rounded-xl gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              <Link to={jumpUrl}>
                <span>Ugrás a funkcióhoz</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="rounded-xl gap-1.5 text-xs border-border/80 hover:bg-card/70"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Share2 className="h-3.5 w-3.5" />}
            <span>{copied ? "Másolva" : "Megosztás"}</span>
          </Button>
        </div>
      </div>

      {/* Main Article Container */}
      <article className="rounded-3xl border border-border/70 bg-card/80 p-6 sm:p-10 shadow-sm backdrop-blur-sm">
        {/* Article Metadata Header */}
        <header className="border-b border-border/60 pb-6">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <Badge
              variant="secondary"
              className="flex items-center gap-1.5 bg-secondary/40 text-secondary-foreground px-3 py-1 font-medium rounded-lg"
            >
              <KnowledgeIcon name={categoryIcon} className="h-3.5 w-3.5 text-primary" />
              <span>{categoryTitle}</span>
            </Badge>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Olvasási idő: {article.estimated_read_time}</span>
            </div>
          </div>

          <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {article.title}
          </h1>

          {/* Lead Summary with Lucide Sparkles icon and inline formatting */}
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 text-sm leading-relaxed text-foreground/90 flex items-start gap-3 shadow-2xs">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary mt-0.5">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider block mb-1">
                Rendszer Összefoglaló
              </span>
              <div className="font-medium text-foreground/90 leading-relaxed">
                {parseInlineFormatting(article.summary)}
              </div>
            </div>
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-lg bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground border border-border/40 font-medium"
                >
                  <Tag className="h-3 w-3 text-muted-foreground/70" />
                  <span>{tag}</span>
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Structured Content Body */}
        <div className="pt-8">
          <KnowledgeArticleStructuredContent article={article} jumpUrl={jumpUrl} />
        </div>

        {/* Bottom Callout / Ticket Help Banner */}
        <div className="mt-12 rounded-2xl border border-border/70 bg-gradient-to-r from-primary/5 via-secondary/10 to-transparent p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LifeBuoy className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Nem találtad meg a választ a kérdésedre?
                </h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Kérdezz a technikai csapattól hibajegyben, vagy jelezz funkciókérést!
                </p>
              </div>
            </div>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl border-primary/30 text-primary hover:bg-primary/10 shrink-0"
            >
              <Link to={`${basePath}/tickets`}>
                Hibajegy megnyitása
              </Link>
            </Button>
          </div>
        </div>
      </article>

      {/* Related Articles in Same Category */}
      {relatedArticles.length > 0 && (
        <section className="space-y-3 pt-4">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <span>Kapcsolódó útmutatók a(z) {categoryTitle} témakörben</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relatedArticles.map((rel) => (
              <div
                key={rel.id}
                onClick={() => onSelectArticle(rel)}
                className="group flex flex-col justify-between rounded-xl border border-border/60 bg-card/60 p-4 hover:border-primary/40 hover:bg-card transition-all cursor-pointer"
              >
                <div>
                  <h4 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {rel.title}
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {rel.summary}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{rel.estimated_read_time}</span>
                  <span className="text-primary font-medium group-hover:underline">Olvasás →</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
});
