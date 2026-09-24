export type ChangelogCategory = 'feature' | 'fix' | 'improvement' | 'perf';
export type ChangelogAppScope = 'all' | 'eaisybill' | 'eaisybooks';

export interface ChangelogItem {
  type: 'new' | 'fix' | 'improvement' | 'perf';
  title: string;
  description: string;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  release_date: string;
  title: string;
  summary: string;
  category: ChangelogCategory;
  app_scope: ChangelogAppScope;
  items: ChangelogItem[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
}
