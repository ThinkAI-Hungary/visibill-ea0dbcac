import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ChangelogEntry, ChangelogAppScope, ChangelogCategory } from "@/types/changelog";

const LOCAL_STORAGE_LAST_SEEN_KEY = "visibill_last_seen_changelog_release";

export interface ChangelogFilterOptions {
  scope?: ChangelogAppScope | "all";
  category?: string;
  searchQuery?: string;
}

export function useChangelog(options?: ChangelogFilterOptions) {
  const { scope = "all", category = "all", searchQuery = "" } = options || {};

  return useQuery({
    queryKey: ["changelog_entries", scope, category],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ChangelogEntry[]> => {
      let query = supabase
        .from("changelog_entries" as any)
        .select("*")
        .eq("is_published", true)
        .order("release_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (scope === "eaisybill") {
        query = query.in("app_scope", ["all", "eaisybill"]);
      } else if (scope === "eaisybooks") {
        query = query.in("app_scope", ["all", "eaisybooks"]);
      }

      if (category && category !== "all") {
        query = query.eq("category", category);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching changelog entries:", error);
        throw error;
      }

      let entries: ChangelogEntry[] = (data || []).map((row: any) => ({
        id: row.id,
        version: row.version,
        release_date: row.release_date,
        title: row.title,
        summary: row.summary,
        category: row.category as ChangelogCategory,
        app_scope: row.app_scope as ChangelogAppScope,
        items: Array.isArray(row.items) ? row.items : [],
        is_published: row.is_published,
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_by: row.created_by,
      }));

      // In-memory search filtering if query is provided directly to the hook
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        entries = entries.filter((entry) => {
          const matchTitle = entry.title.toLowerCase().includes(q);
          const matchSummary = entry.summary.toLowerCase().includes(q);
          const matchVersion = entry.version.toLowerCase().includes(q);
          const matchItems = entry.items.some(
            (item) =>
              (item.title && item.title.toLowerCase().includes(q)) ||
              (item.description && item.description.toLowerCase().includes(q))
          );
          return matchTitle || matchSummary || matchVersion || matchItems;
        });
      }

      return entries;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to detect if there is any unread / new changelog entry since the user's last visit.
 */
export function useHasUnreadChangelog() {
  const { data: entries } = useChangelog();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!entries || entries.length === 0) {
      setHasUnread(false);
      return;
    }

    try {
      const lastSeen = localStorage.getItem(LOCAL_STORAGE_LAST_SEEN_KEY);
      if (!lastSeen) {
        // If never viewed before, show unread badge
        setHasUnread(true);
        return;
      }

      // Check if the latest entry is newer than lastSeen date or ID
      const latestEntry = entries[0];
      const latestTimestamp = new Date(latestEntry.created_at || latestEntry.release_date).getTime();
      const lastSeenTimestamp = parseInt(lastSeen, 10);

      if (isNaN(lastSeenTimestamp) || latestTimestamp > lastSeenTimestamp) {
        setHasUnread(true);
      } else {
        setHasUnread(false);
      }
    } catch {
      setHasUnread(false);
    }
  }, [entries]);

  const markAsRead = useCallback(() => {
    try {
      const now = Date.now().toString();
      localStorage.setItem(LOCAL_STORAGE_LAST_SEEN_KEY, now);
      setHasUnread(false);
    } catch (e) {
      console.warn("Could not save changelog last seen in localStorage", e);
    }
  }, []);

  return { hasUnread, markAsRead };
}

/**
 * Hook for creating a new changelog entry (used by Admin / Skill).
 */
export function useCreateChangelogEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newEntry: Omit<ChangelogEntry, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("changelog_entries" as any)
        .insert({
          version: newEntry.version,
          release_date: newEntry.release_date,
          title: newEntry.title,
          summary: newEntry.summary,
          category: newEntry.category,
          app_scope: newEntry.app_scope,
          items: newEntry.items,
          is_published: newEntry.is_published ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["changelog_entries"] });
    },
  });
}
