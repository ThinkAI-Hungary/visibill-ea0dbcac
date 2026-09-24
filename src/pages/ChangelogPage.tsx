import React, { useState, useEffect } from "react";
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
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedScope, setSelectedScope] = useState<ChangelogAppScope | "all">(initialScope);

  const { data: entries = [], isLoading } = useChangelog({
    scope: selectedScope,
    category: selectedCategory,
    searchQuery,
  });

  const { markAsRead } = useHasUnreadChangelog();

  // Mark changelog as viewed when page loads
  useEffect(() => {
    markAsRead();
  }, [markAsRead]);



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
          totalCount={entries.length}
        />
      </div>

      <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
        {isLoading ? (
          <ChangelogTimelineSkeleton />
        ) : (
          <ChangelogTimeline entries={entries} />
        )}
      </div>
    </div>
  );
}
