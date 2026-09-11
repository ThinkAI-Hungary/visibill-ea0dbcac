import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import {
  useKnowledgeCategories,
  useKnowledgeArticles,
} from "@/hooks/useKnowledgeBase";
import { KnowledgeArticle } from "@/types/knowledgeBase";
import { KnowledgeBaseHeader } from "@/components/knowledge-base/KnowledgeBaseHeader";
import {
  KnowledgeCategoryPills,
  KnowledgeAppScope,
} from "@/components/knowledge-base/KnowledgeCategoryPills";
import { KnowledgeArticleCard } from "@/components/knowledge-base/KnowledgeArticleCard";
import { KnowledgeArticleReader } from "@/components/knowledge-base/KnowledgeArticleReader";
import { useScopedBasePath } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { BookOpen, SearchX, LifeBuoy, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";

export default function KnowledgeBasePage() {
  const { t } = useTranslation(['common']);
  const { articleId } = useParams<{ articleId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const basePath = useScopedBasePath();

  const initialCategory = searchParams.get("category") || null;
  const initialQuery = searchParams.get("q") || "";
  const initialScopeParam = searchParams.get("scope");
  const initialScope: KnowledgeAppScope =
    initialScopeParam === "eaisybill" || initialScopeParam === "eaisybooks" || initialScopeParam === "all"
      ? initialScopeParam
      : initialCategory
      ? initialCategory.startsWith("books_")
        ? "eaisybooks"
        : "eaisybill"
      : "all";

  const [selectedScope, setSelectedScope] = useState<KnowledgeAppScope>(initialScope);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);

  // Sync state if URL query params change (e.g. back/forward navigation)
  useEffect(() => {
    const urlCategory = searchParams.get("category") || null;
    const urlQuery = searchParams.get("q") || "";
    const urlScope = searchParams.get("scope");
    setSelectedCategoryId(urlCategory);
    setSearchQuery(urlQuery);
    if (urlScope === "eaisybill" || urlScope === "eaisybooks" || urlScope === "all") {
      setSelectedScope(urlScope);
    } else if (urlCategory) {
      setSelectedScope(urlCategory.startsWith("books_") ? "eaisybooks" : "eaisybill");
    }
  }, [searchParams]);

  // Sync state to URL search params
  const updateQueryParams = useCallback(
    (scope: KnowledgeAppScope, catId: string | null, query: string) => {
      const params = new URLSearchParams(searchParams);
      if (scope !== "all") {
        params.set("scope", scope);
      } else {
        params.delete("scope");
      }
      if (catId) {
        params.set("category", catId);
      } else {
        params.delete("category");
      }
      if (query.trim()) {
        params.set("q", query.trim());
      } else {
        params.delete("q");
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleSelectScope = useCallback(
    (scope: KnowledgeAppScope) => {
      setSelectedScope(scope);
      let nextCat = selectedCategoryId;
      if (selectedCategoryId) {
        const isBooks = selectedCategoryId.startsWith("books_");
        if (scope === "eaisybill" && isBooks) nextCat = null;
        if (scope === "eaisybooks" && !isBooks) nextCat = null;
      }
      setSelectedCategoryId(nextCat);
      updateQueryParams(scope, nextCat, searchQuery);
    },
    [selectedCategoryId, searchQuery, updateQueryParams]
  );

  const handleSelectCategory = useCallback(
    (catId: string | null) => {
      setSelectedCategoryId(catId);
      updateQueryParams(selectedScope, catId, searchQuery);
    },
    [selectedScope, searchQuery, updateQueryParams]
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      updateQueryParams(selectedScope, selectedCategoryId, query);
    },
    [selectedScope, selectedCategoryId, updateQueryParams]
  );

  const handleClearFilters = useCallback(() => {
    setSelectedScope("all");
    setSelectedCategoryId(null);
    setSearchQuery("");
    const params = new URLSearchParams(searchParams);
    params.delete("scope");
    params.delete("category");
    params.delete("q");
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  // Data queries
  const { data: categories = [], isLoading: isLoadingCategories } = useKnowledgeCategories();
  const { data: allArticles = [], isLoading: isLoadingArticles } = useKnowledgeArticles();

  // Category counts computed from full article list
  const {
    categoryArticleCounts,
    totalArticlesCount,
    eaisybillArticlesCount,
    eaisybooksArticlesCount,
  } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of categories) {
      counts[cat.id] = 0;
    }
    let eaisyBillCount = 0;
    let eaisyBooksCount = 0;

    for (const art of allArticles) {
      if (counts[art.category_id] !== undefined) {
        counts[art.category_id]++;
      } else {
        counts[art.category_id] = 1;
      }
      if (art.category_id.startsWith("books_")) {
        eaisyBooksCount++;
      } else {
        eaisyBillCount++;
      }
    }
    return {
      categoryArticleCounts: counts,
      totalArticlesCount: allArticles.length,
      eaisybillArticlesCount: eaisyBillCount,
      eaisybooksArticlesCount: eaisyBooksCount,
    };
  }, [categories, allArticles]);

  // Filtered articles list based on selected scope, category and search
  const filteredArticles = useMemo(() => {
    return allArticles.filter((article) => {
      // 1. Module scope filter
      if (selectedScope === "eaisybill" && article.category_id.startsWith("books_")) {
        return false;
      }
      if (selectedScope === "eaisybooks" && !article.category_id.startsWith("books_")) {
        return false;
      }

      // 2. Specific category filter
      if (selectedCategoryId && article.category_id !== selectedCategoryId) {
        return false;
      }

      // 3. Search query filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = article.title.toLowerCase().includes(q);
        const inSummary = article.summary.toLowerCase().includes(q);
        const inTags = article.tags && article.tags.some((t) => t.toLowerCase().includes(q));
        const inContent = article.content.toLowerCase().includes(q);
        return inTitle || inSummary || inTags || inContent;
      }
      return true;
    });
  }, [allArticles, selectedScope, selectedCategoryId, searchQuery]);

  // Current active article if articleId is in route
  const activeArticle = useMemo(() => {
    if (!articleId) return null;
    return allArticles.find((a) => a.id === articleId) ?? null;
  }, [articleId, allArticles]);

  // Related articles in same category for reader
  const relatedArticles = useMemo(() => {
    if (!activeArticle) return [];
    return allArticles
      .filter((a) => a.category_id === activeArticle.category_id && a.id !== activeArticle.id)
      .slice(0, 4);
  }, [activeArticle, allArticles]);

  // Handle article selection (retaining search query parameters)
  const handleSelectArticle = useCallback(
    (article: KnowledgeArticle) => {
      const targetBase = basePath ? `${basePath}/knowledge-base` : "/knowledge-base";
      const search = location.search;
      navigate(`${targetBase}/${article.id}${search}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [basePath, location.search, navigate]
  );

  // Handle back to list (retaining search query parameters)
  const handleBackToList = useCallback(() => {
    const targetBase = basePath ? `${basePath}/knowledge-base` : "/knowledge-base";
    const search = location.search;
    navigate(`${targetBase}${search}`);
  }, [basePath, location.search, navigate]);

  // Handle invalid articleId in route params (auto-redirect to list + toast feedback)
  useEffect(() => {
    if (articleId && !isLoadingArticles && allArticles.length > 0) {
      const exists = allArticles.some((a) => a.id === articleId);
      if (!exists) {
        toast({
          title: "Útmutató nem található",
          description: `A keresett útmutató ("${articleId}") nem létezik vagy törölve lett.`,
          variant: "destructive",
        });
        const targetBase = basePath ? `${basePath}/knowledge-base` : "/knowledge-base";
        const search = location.search;
        navigate(`${targetBase}${search}`, { replace: true });
      }
    }
  }, [articleId, isLoadingArticles, allArticles, basePath, location.search, navigate]);

  // Loading state
  const isLoading = isLoadingCategories || isLoadingArticles;

  return (
    <div className="min-h-screen px-4 py-6 sm:px-8 sm:py-8 space-y-6 max-w-7xl mx-auto">
      {activeArticle ? (
        /* ── Reader View ── */
        <KnowledgeArticleReader
          article={activeArticle}
          onBack={handleBackToList}
          onSelectArticle={handleSelectArticle}
          relatedArticles={relatedArticles}
        />
      ) : (
        /* ── Master List View ── */
        <div className="space-y-6">
          {/* Header Banner with Search */}
          <KnowledgeBaseHeader
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            totalArticles={totalArticlesCount}
            filteredArticles={filteredArticles.length}
          />

          {/* 2-Tier Header: Module Scope (Összes, eaisyBill, eaisyBooks) + Subcategories */}
          <div className="flex items-center justify-between gap-4">
            <KnowledgeCategoryPills
              categories={categories}
              selectedScope={selectedScope}
              onSelectScope={handleSelectScope}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={handleSelectCategory}
              categoryArticleCounts={categoryArticleCounts}
              totalArticlesCount={totalArticlesCount}
              eaisybillArticlesCount={eaisybillArticlesCount}
              eaisybooksArticlesCount={eaisybooksArticlesCount}
            />
          </div>

          {/* Article Grid / Empty State */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-56 rounded-2xl border border-border/50 bg-card/40 animate-pulse p-5"
                />
              ))}
            </div>
          ) : filteredArticles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredArticles.map((article) => (
                <KnowledgeArticleCard
                  key={article.id}
                  article={article}
                  onSelect={handleSelectArticle}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 p-12 text-center bg-card/30">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-4">
                <SearchX className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {t('common:knowledge_base.empty_title', 'Nem található útmutató a megadott feltételekkel')}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-md">
                {t('common:knowledge_base.empty_desc', 'Próbáld meg módosítani a keresési kifejezést, vagy válassz másik témakört.')}
              </p>
              <div className="mt-5 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="rounded-xl"
                >
                  {t('common:knowledge_base.clear_filters', 'Szűrők törlése')}
                </Button>
              </div>
            </div>
          )}

          {/* Bottom Support Banner */}
          <div className="mt-10 rounded-2xl border border-border/70 bg-card/60 p-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    {t('common:knowledge_base.support_title', 'Nem találod a megoldást a Tudástárban?')}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {t('common:knowledge_base.support_desc', 'Nyiss hibajegyet a fejlesztőknek, vagy kérj segítséget az ügyfélszolgálattól.')}
                  </p>
                </div>
              </div>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="rounded-xl border-primary/30 text-primary hover:bg-primary/10 gap-1.5 shrink-0"
              >
                <Link to={`${basePath}/tickets`}>
                  <span>{t('common:knowledge_base.support_button', 'Ugrás a Hibajegyekhez')}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
