export interface KnowledgeCategory {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  order_num: number;
  created_at?: string;
  updated_at?: string;
  article_count?: number;
}

export interface KnowledgeArticle {
  id: string;
  category_id: string;
  title: string;
  summary: string;
  content: string;
  menu_path: string | null;
  tags: string[];
  icon: string;
  estimated_read_time: string;
  order_num: number;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
  category?: KnowledgeCategory;
}

export interface KnowledgeBaseFilterState {
  selectedCategoryId: string | null;
  searchQuery: string;
}
