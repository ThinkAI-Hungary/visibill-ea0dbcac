-- Migration: 20260907210000_search_knowledge_base_rpc.sql
-- Description: RPC function for Knowledge Base Full Text Search with Hungarian tokenization, rank scoring and page context matching
-- Used for both UI search and AI Assistant RAG context injection

-- Drop legacy 3-param overload if it exists to prevent ambiguous function call errors
DROP FUNCTION IF EXISTS public.search_knowledge_base(text, text, integer);

CREATE OR REPLACE FUNCTION public.search_knowledge_base(
  search_query TEXT DEFAULT NULL,
  page_path TEXT DEFAULT NULL,
  target_category TEXT DEFAULT NULL,
  match_limit INT DEFAULT 3
)
RETURNS TABLE (
  id TEXT,
  category_id TEXT,
  title TEXT,
  summary TEXT,
  content TEXT,
  menu_path TEXT,
  tags TEXT[],
  rank REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clean_query TEXT;
  v_query_str TEXT;
  v_tsquery TSQUERY;
  v_clean_page TEXT;
BEGIN
  v_clean_query := trim(coalesce(search_query, ''));
  v_clean_page := trim(coalesce(page_path, ''));

  -- Tokenize search query with Hungarian root and prefix expansion
  IF v_clean_query <> '' THEN
    SELECT string_agg(term, ' | ') INTO v_query_str
    FROM (
      SELECT DISTINCT term
      FROM (
        SELECT w AS term
        FROM (
          SELECT unnest(regexp_split_to_array(lower(regexp_replace(v_clean_query, '[^\w\s]', ' ', 'g')), '\s+')) AS w
        ) raw_words
        WHERE length(w) >= 2 
          AND w NOT IN ('a', 'az', 'és', 'hogy', 'ha', 'de', 'nem', 'van', 'kell', 'egy', 'mik', 'mi', 'mit', 'hol', 'mert', 'volt', 'lesz')
        
        UNION
        
        SELECT w || ':*' AS term
        FROM (
          SELECT unnest(regexp_split_to_array(lower(regexp_replace(v_clean_query, '[^\w\s]', ' ', 'g')), '\s+')) AS w
        ) raw_words
        WHERE length(w) >= 3
          AND w NOT IN ('a', 'az', 'és', 'hogy', 'ha', 'de', 'nem', 'van', 'kell', 'egy', 'mik', 'mi', 'mit', 'hol', 'mert', 'volt', 'lesz')
          
        UNION
        
        SELECT regexp_replace(w, '(nak|nek|ban|ben|ból|ből|ról|ről|hoz|hez|höz|val|vel|tól|től|kor|ig|ért|on|en|ön|ok|ek|ök|ak|ja|je|om|od|unk|ünk|otok|etek|ötök|uk|ük|juk|jük|[aáeéiíoóöőuúüűktn])+$', '') || ':*' AS term
        FROM (
          SELECT unnest(regexp_split_to_array(lower(regexp_replace(v_clean_query, '[^\w\s]', ' ', 'g')), '\s+')) AS w
        ) raw_words
        WHERE length(w) >= 4
          AND w NOT IN ('a', 'az', 'és', 'hogy', 'ha', 'de', 'nem', 'van', 'kell', 'egy', 'mik', 'mi', 'mit', 'hol', 'mert', 'volt', 'lesz')
      ) all_terms
      WHERE length(term) >= 3 AND term <> ':*'
    ) distinct_terms;

    IF v_query_str IS NOT NULL AND v_query_str <> '' THEN
      BEGIN
        v_tsquery := to_tsquery('simple', v_query_str);
      EXCEPTION WHEN OTHERS THEN
        v_tsquery := NULL;
      END;
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    a.id,
    a.category_id,
    a.title,
    a.summary,
    a.content,
    a.menu_path,
    a.tags,
    (
      CASE 
        WHEN v_clean_page <> '' AND a.menu_path = v_clean_page THEN 1.0::REAL
        WHEN v_clean_page <> '' AND a.menu_path IS NOT NULL AND a.menu_path <> '/' AND v_clean_page LIKE (a.menu_path || '%') THEN 0.8::REAL
        WHEN v_tsquery IS NOT NULL AND a.fts @@ v_tsquery THEN (ts_rank(a.fts, v_tsquery) + 0.2)::REAL
        WHEN v_clean_query <> '' AND (a.title ILIKE '%' || v_clean_query || '%' OR a.tags && ARRAY[lower(v_clean_query)]) THEN 0.3::REAL
        ELSE 0.1::REAL
      END
    )::REAL AS rank
  FROM public.knowledge_base_articles a
  WHERE a.is_published = true
    AND (target_category IS NULL OR a.category_id = target_category)
    AND (
      (v_clean_page <> '' AND a.menu_path IS NOT NULL AND (a.menu_path = v_clean_page OR (a.menu_path <> '/' AND v_clean_page LIKE (a.menu_path || '%'))))
      OR (v_tsquery IS NOT NULL AND a.fts @@ v_tsquery)
      OR (v_clean_query <> '' AND (a.title ILIKE '%' || v_clean_query || '%' OR a.tags && ARRAY[lower(v_clean_query)]))
      OR (v_clean_query = '' AND v_clean_page = '' AND target_category IS NOT NULL)
    )
  ORDER BY rank DESC, a.order_num ASC
  LIMIT match_limit;
END;
$$;

-- Security & Permissions
REVOKE EXECUTE ON FUNCTION public.search_knowledge_base(TEXT, TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_knowledge_base(TEXT, TEXT, TEXT, INT) TO authenticated, service_role;

COMMENT ON FUNCTION public.search_knowledge_base IS 'Full text search over knowledge base articles with Hungarian tokenization, page context matching and ranking. Accessible to authenticated users and service_role.';
