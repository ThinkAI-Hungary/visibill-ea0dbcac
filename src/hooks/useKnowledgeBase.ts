import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KnowledgeCategory, KnowledgeArticle } from "@/types/knowledgeBase";
import {
  FALLBACK_KNOWLEDGE_CATEGORIES,
  FALLBACK_KNOWLEDGE_ARTICLES,
  FALLBACK_CATEGORY_MAP,
} from "@/data/knowledgeBaseFallback";
import { useEaisybillPermissions, URL_TO_MODULE } from "@/hooks/useEaisybillPermissions";
import { useHasAccountyAccess } from "@/hooks/useHasEaisybillAccess";

/**
 * Standard debounce hook to delay state updates.
 */
export function useDebounce<T>(value: T, delayMs: number = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Checks whether the current user has permission to navigate to a knowledge article's menu_path.
 * Supports root, core eaisybill modules, and eaisybooks accounting modules.
 */
export function useCanAccessKnowledgeMenuPath(menuPath?: string | null): boolean {
  const { canAccess } = useEaisybillPermissions();
  const { data: hasAccountyAccess } = useHasAccountyAccess();

  return useMemo(() => {
    if (!menuPath) return false;
    if (menuPath === "/") return true;
    if (menuPath.startsWith("/eaisybooks")) {
      return Boolean(hasAccountyAccess);
    }
    const moduleKey = URL_TO_MODULE[menuPath];
    if (moduleKey) {
      return canAccess(moduleKey);
    }
    return true;
  }, [menuPath, canAccess, hasAccountyAccess]);
}

/**
 * Hook to load all knowledge base categories.
 * Falls back to static dataset on network / table error.
 */
export function useKnowledgeCategories() {
  return useQuery<KnowledgeCategory[]>({
    queryKey: ["knowledge-base", "categories"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("knowledge_base_categories" as any)
          .select("*")
          .order("order_num", { ascending: true });

        if (error || !data || data.length === 0) {
          if (error) console.warn("Supabase knowledge_base_categories query warning:", error);
          return FALLBACK_KNOWLEDGE_CATEGORIES;
        }

        return data as KnowledgeCategory[];
      } catch (err) {
        console.warn("Using fallback knowledge base categories:", err);
        return FALLBACK_KNOWLEDGE_CATEGORIES;
      }
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to load knowledge base articles with optional category and search filtering.
 * Reactively attaches the corresponding category object to each article.
 */
export function useKnowledgeArticles(
  categoryId?: string | null,
  searchQuery?: string
) {
  const debouncedSearch = useDebounce(searchQuery ?? "", 250);
  const { data: categories = [] } = useKnowledgeCategories();

  const query = useQuery<KnowledgeArticle[]>({
    queryKey: ["knowledge-base", "articles", categoryId ?? "all", debouncedSearch],
    queryFn: async () => {
      let articles: KnowledgeArticle[] = [];

      try {
        let dbQuery = supabase
          .from("knowledge_base_articles" as any)
          .select("*")
          .eq("is_published", true)
          .order("order_num", { ascending: true });

        if (categoryId) {
          dbQuery = dbQuery.eq("category_id", categoryId);
        }

        const { data, error } = await dbQuery;

        if (error || !data || data.length === 0) {
          if (error) console.warn("Supabase knowledge_base_articles query warning:", error);
          articles = FALLBACK_KNOWLEDGE_ARTICLES;
        } else {
          articles = data as KnowledgeArticle[];
        }
      } catch (err) {
        console.warn("Using fallback knowledge base articles:", err);
        articles = FALLBACK_KNOWLEDGE_ARTICLES;
      }

      // Filter by category if fallback was used
      if (categoryId) {
        articles = articles.filter((a) => a.category_id === categoryId);
      }

      // Filter by search query if present
      if (searchQuery && searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        articles = articles.filter((a) => {
          const inTitle = a.title.toLowerCase().includes(q);
          const inSummary = a.summary.toLowerCase().includes(q);
          const inTags = a.tags && a.tags.some((t) => t.toLowerCase().includes(q));
          const inContent = a.content.toLowerCase().includes(q);
          return inTitle || inSummary || inTags || inContent;
        });
      }

      return articles;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });

  // Reactively enrich articles with category objects (guarantees category is never null/undefined)
  const enrichedArticles = useMemo(() => {
    const categoryMap = new Map<string, KnowledgeCategory>();
    // Pre-fill with fallback categories
    for (const cat of FALLBACK_KNOWLEDGE_CATEGORIES) {
      categoryMap.set(cat.id, cat);
    }
    // Override with any live categories loaded from DB
    for (const cat of categories) {
      categoryMap.set(cat.id, cat);
    }

    const rawList = query.data || FALLBACK_KNOWLEDGE_ARTICLES;
    return rawList.map((art) => ({
      ...art,
      category: categoryMap.get(art.category_id) || FALLBACK_CATEGORY_MAP.get(art.category_id),
    }));
  }, [query.data, categories]);

  return {
    ...query,
    data: enrichedArticles,
  };
}

/**
 * Hook to retrieve a single knowledge base article by ID.
 */
export function useKnowledgeArticle(articleId?: string | null) {
  const { data: articles = [], isLoading } = useKnowledgeArticles();

  const article = articles.find((a) => a.id === articleId) ?? null;

  return {
    article,
    isLoading,
  };
}
