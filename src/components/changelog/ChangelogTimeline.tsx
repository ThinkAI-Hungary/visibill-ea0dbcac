import React, { useState, useEffect, useRef } from "react";
import { ChangelogEntryCard } from "./ChangelogEntryCard";
import type { ChangelogEntry } from "@/types/changelog";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { hu } from "date-fns/locale";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChangelogTimelineProps {
  entries: ChangelogEntry[];
}

export const ChangelogTimeline: React.FC<ChangelogTimelineProps> = ({ entries }) => {
  const [activeEntryId, setActiveEntryId] = useState<string>(entries[0]?.id || "");
  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Update activeEntryId when entries change
  useEffect(() => {
    if (entries.length > 0 && (!activeEntryId || !entries.some((e) => e.id === activeEntryId))) {
      setActiveEntryId(entries[0].id);
    }
  }, [entries, activeEntryId]);

  // Track active entry while scrolling the container
  const handleScroll = () => {
    if (!containerRef.current) return;
    const containerTop = containerRef.current.getBoundingClientRect().top;
    let closestId = entries[0]?.id || "";
    let minDistance = Infinity;

    for (const entry of entries) {
      const el = entryRefs.current[entry.id];
      if (el) {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top - containerTop - 50);
        if (distance < minDistance) {
          minDistance = distance;
          closestId = entry.id;
        }
      }
    }

    if (closestId && closestId !== activeEntryId) {
      setActiveEntryId(closestId);
    }
  };

  const activeIndex = Math.max(
    0,
    entries.findIndex((e) => e.id === activeEntryId)
  );

  const formatEntryDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const date = parseISO(dateStr);
      if (isToday(date)) return "Ma";
      if (isYesterday(date)) return "Tegnap";
      return format(date, "yyyy. MMMM d.", { locale: hu });
    } catch {
      return dateStr;
    }
  };

  const formatRawDate = (dateStr?: string, createdAtStr?: string) => {
    if (!dateStr) return "";
    try {
      const date = parseISO(dateStr);
      const baseDate = format(date, "yyyy.MM.dd");

      let timePart = "";
      if (dateStr.includes("T") || (dateStr.includes(":") && dateStr.includes(" "))) {
        timePart = format(date, "HH:mm");
      } else if (createdAtStr) {
        try {
          const createdDate = parseISO(createdAtStr);
          if (format(date, "yyyy-MM-dd") === format(createdDate, "yyyy-MM-dd")) {
            timePart = format(createdDate, "HH:mm");
          }
        } catch {
          // ignore parsing error
        }
      }

      return timePart ? `${baseDate} ${timePart}` : baseDate;
    } catch {
      return dateStr;
    }
  };

  const scrollToEntry = (entryId: string) => {
    const el = entryRefs.current[entryId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setActiveEntryId(entryId);
    }
  };

  if (entries.length === 0) {
    return (
      <div className="py-16 text-center space-y-3 border border-dashed border-border rounded-xl bg-card/50">
        <Search className="w-8 h-8 text-muted-foreground/60 mx-auto" />
        <h3 className="text-base font-semibold text-foreground">Nincs találat a megadott szűrésre</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Próbálj meg más kategóriát vagy kevesebb keresőszót használni a keresőmezőben.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 h-full w-full overflow-y-auto pr-3 sm:pr-6 scroll-smooth focus:outline-none [scrollbar-width:thin] [scrollbar-color:hsl(var(--primary)/0.4)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-primary/40 hover:[&::-webkit-scrollbar-thumb]:bg-primary/70 [&::-webkit-scrollbar-thumb]:rounded-full"
    >
      {/* Vertical Timeline Body */}
      <div className="relative border-l-2 border-border/80 ml-3 sm:ml-44 space-y-8 pb-12 pt-2">
        {entries.map((entry, index) => {
          const isActive = entry.id === activeEntryId;
          const isPassed = index <= activeIndex;
          const relativeDate = formatEntryDate(entry.release_date);
          const rawDate = formatRawDate(entry.release_date, entry.created_at);

          return (
            <div
              key={entry.id}
              data-entry-id={entry.id}
              ref={(el) => {
                entryRefs.current[entry.id] = el;
              }}
              className="relative pl-6 sm:pl-8 group transition-all"
            >
              {/* Timeline Date Label on Left Side (Desktop) */}
              <div
                onClick={() => scrollToEntry(entry.id)}
                className="sm:absolute sm:-left-44 sm:w-36 sm:text-right top-0.5 text-xs cursor-pointer select-none mb-1 sm:mb-0"
              >
                <span
                  className={cn(
                    "font-semibold block transition-colors",
                    isActive
                      ? "text-primary font-bold"
                      : isPassed
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {relativeDate}
                </span>
                <span className="text-muted-foreground font-mono text-[11px] block whitespace-nowrap">
                  {rawDate}
                </span>
              </div>

              {/* Timeline Bullet Dot */}
              <div
                onClick={() => scrollToEntry(entry.id)}
                className={cn(
                  "absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-4 border-background transition-all cursor-pointer",
                  isActive
                    ? "bg-primary ring-4 ring-primary/25 scale-125 shadow-[0_0_12px_rgba(13,148,136,0.6)]"
                    : isPassed
                    ? "bg-primary/80 scale-100"
                    : "bg-muted-foreground/40 scale-90 group-hover:bg-muted-foreground group-hover:scale-110"
                )}
              />

              {/* Entry Card Content with active state highlight */}
              <ChangelogEntryCard entry={entry} isActive={isActive} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
