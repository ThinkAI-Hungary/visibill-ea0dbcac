import React, { useState, useEffect, useMemo, useDeferredValue } from "react";
import { ChangelogHeader } from "@/components/changelog/ChangelogHeader";
import { ChangelogTimeline } from "@/components/changelog/ChangelogTimeline";
import { ChangelogTimelineSkeleton } from "@/components/changelog/ChangelogTimelineSkeleton";
import { useChangelog, useHasUnreadChangelog } from "@/hooks/useChangelog";
import type { ChangelogAppScope } from "@/types/changelog";
import { useSearchParams } from "react-router-dom";

export default function ChangelogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get("category") || "all";
  const initialScopeParam = searchParams.get("scope");
  const initialScope: ChangelogAppScope | "all" =
    initialScopeParam === "eaisybill" || initialScopeParam === "eaisybooks" || initialScopeParam === "all"
      ? initialScopeParam
      : "all";

  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedScope, setSelectedScope] = useState<ChangelogAppScope | "all">(initialScope);

  const { data: rawEntries = [], isLoading } = useChangelog({
    scope: selectedScope,
    category: selectedCategory,
  });

  const { markAsRead } = useHasUnreadChangelog();

  // Mark changelog as viewed when page loads
  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  // Client-side search filtering (0ms latency, zero skeleton flicker)
  const filteredEntries = useMemo(() => {
    if (!deferredSearchQuery.trim()) return rawEntries;
    const q = deferredSearchQuery.trim().toLowerCase();
    return rawEntries.filter((entry) => {
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
  }, [rawEntries, deferredSearchQuery]);

  // Sync state with URL params
  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    const newParams = new URLSearchParams(searchParams);
    if (cat !== "all") {
      newParams.set("category", cat);
    } else {
      newParams.delete("category");
    }
    setSearchParams(newParams, { replace: true });
  };

  const handleSelectScope = (scope: ChangelogAppScope | "all") => {
    setSelectedScope(scope);
    const newParams = new URLSearchParams(searchParams);
    if (scope !== "all") {
      newParams.set("scope", scope);
    } else {
      newParams.delete("scope");
    }
    setSearchParams(newParams, { replace: true });
  };

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col w-full max-w-4xl mx-auto space-y-4">
      <div className="shrink-0">
        <ChangelogHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          selectedScope={selectedScope}
          onSelectScope={handleSelectScope}
          totalCount={filteredEntries.length}
        />
      </div>

      <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
        {isLoading && rawEntries.length === 0 ? (
          <ChangelogTimelineSkeleton />
        ) : (
          <ChangelogTimeline entries={filteredEntries} />
        )}
      </div>
    </div>
  );
}
