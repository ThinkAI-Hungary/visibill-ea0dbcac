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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useScopedBasePath } from "@/lib/navigation";
import { toast } from "@/hooks/use-toast";

import { FALLBACK_CATEGORY_MAP } from "@/data/knowledgeBaseFallback";
import { useCanAccessKnowledgeMenuPath } from "@/hooks/useKnowledgeBase";

interface KnowledgeArticleReaderProps {
  article: KnowledgeArticle;
  onBack: () => void;
  onSelectArticle: (article: KnowledgeArticle) => void;
  relatedArticles?: KnowledgeArticle[];
}

/**
 * Lightweight, robust markdown renderer for knowledge base articles.
 * Renders headings, lists, inline code, bolding, and links cleanly.
 */
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");

  const renderedElements: React.ReactNode[] = [];
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushList = (key: number) => {
    if (!currentList) return null;
    const { type, items } = currentList;
    currentList = null;

    if (type === "ul") {
      return (
        <ul key={`list-${key}`} className="my-3 ml-6 list-disc space-y-1.5 text-sm text-foreground/90 leading-relaxed">
          {items.map((item, idx) => (
            <li key={idx}>{parseInlineFormatting(item)}</li>
          ))}
        </ul>
      );
    }
    return (
      <ol key={`list-${key}`} className="my-3 ml-6 list-decimal space-y-1.5 text-sm text-foreground/90 leading-relaxed">
        {items.map((item, idx) => (
          <li key={idx}>{parseInlineFormatting(item)}</li>
        ))}
      </ol>
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      if (currentList) {
        renderedElements.push(flushList(i));
      }
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      if (currentList) renderedElements.push(flushList(i));
      renderedElements.push(
        <h1 key={i} className="mt-6 mb-3 text-2xl font-bold tracking-tight text-foreground border-b border-border/50 pb-2">
          {parseInlineFormatting(line.replace(/^#\s+/, ""))}
        </h1>
      );
      continue;
    }

    if (line.startsWith("## ")) {
      if (currentList) renderedElements.push(flushList(i));
      renderedElements.push(
        <h2 key={i} className="mt-5 mb-2.5 text-xl font-bold tracking-tight text-foreground">
          {parseInlineFormatting(line.replace(/^##\s+/, ""))}
        </h2>
      );
      continue;
    }

    if (line.startsWith("### ")) {
      if (currentList) renderedElements.push(flushList(i));
      renderedElements.push(
        <h3 key={i} className="mt-4 mb-2 text-base font-semibold text-foreground">
          {parseInlineFormatting(line.replace(/^###\s+/, ""))}
        </h3>
      );
      continue;
    }

    // Unordered list item
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const itemText = line.replace(/^[-*]\s+/, "");
      if (!currentList || currentList.type !== "ul") {
        if (currentList) renderedElements.push(flushList(i));
        currentList = { type: "ul", items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Ordered list item (e.g. "1. ")
    if (/^\d+\.\s+/.test(line)) {
      const itemText = line.replace(/^\d+\.\s+/, "");
      if (!currentList || currentList.type !== "ol") {
        if (currentList) renderedElements.push(flushList(i));
        currentList = { type: "ol", items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Normal paragraph
    if (currentList) {
      renderedElements.push(flushList(i));
    }

    renderedElements.push(
      <p key={i} className="my-2.5 text-sm leading-relaxed text-foreground/90">
        {parseInlineFormatting(line)}
      </p>
    );
  }

  if (currentList) {
    renderedElements.push(flushList(lines.length));
  }

  return <div className="space-y-1">{renderedElements}</div>;
}

/**
 * Parses inline Markdown elements: **bold**, `inline code`
 */
function parseInlineFormatting(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  // Regex matching `code` or **bold**
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/;

  while (remaining.length > 0) {
    const match = remaining.match(regex);
    if (!match || match.index === undefined) {
      parts.push(remaining);
      break;
    }

    const before = remaining.slice(0, match.index);
    if (before) {
      parts.push(before);
    }

    const matchedToken = match[0];
    if (matchedToken.startsWith("`") && matchedToken.endsWith("`")) {
      const codeContent = matchedToken.slice(1, -1);
      parts.push(
        <code
          key={`code-${keyIndex++}`}
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] text-primary border border-border/50"
        >
          {codeContent}
        </code>
      );
    } else if (matchedToken.startsWith("**") && matchedToken.endsWith("**")) {
      const boldContent = matchedToken.slice(2, -2);
      parts.push(
        <strong key={`bold-${keyIndex++}`} className="font-semibold text-foreground">
          {boldContent}
        </strong>
      );
    }

    remaining = remaining.slice(match.index + matchedToken.length);
  }

  return <>{parts}</>;
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
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
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

          {/* Lead Summary */}
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-foreground/90">
            {article.summary}
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-muted/80 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Content Body */}
        <div className="pt-6">
          <MarkdownRenderer content={article.content} />
        </div>

        {/* Bottom Callout / Ticket Help Banner */}
        <div className="mt-10 rounded-2xl border border-border/70 bg-gradient-to-r from-primary/5 via-secondary/10 to-transparent p-5 sm:p-6">
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
