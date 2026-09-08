import React from "react";
import { Search, X, BookOpen, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface KnowledgeBaseHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalArticles: number;
  filteredArticles: number;
}

export const KnowledgeBaseHeader = React.memo(function KnowledgeBaseHeader({
  searchQuery,
  onSearchChange,
  totalArticles,
  filteredArticles,
}: KnowledgeBaseHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-background to-secondary/15 p-6 sm:p-8 shadow-sm backdrop-blur-sm">
      {/* Decorative background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />

      <div className="relative z-10 max-w-3xl">
        <div className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <BookOpen className="h-3.5 w-3.5" />
          </span>
          <span>Egységes Tudástár & Felhasználói Kézikönyv</span>
        </div>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Miben segíthetünk ma?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Keress az eaisyBill és eaisyBooks funkciói, könyvelési folyamatai, jogszabályi szabályai és útmutatói között.
        </p>

        {/* Search Input */}
        <div className="relative mt-5 flex items-center">
          <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Keresés kulcsszavak, funkciók vagy modulok alapján... (pl. számla, bank, áfa, nav)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-11 pl-10 pr-10 text-sm bg-background/90 border-border/80 shadow-sm focus-visible:ring-primary focus-visible:border-primary rounded-xl"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSearchChange("")}
              className="absolute right-1.5 h-7 w-7 p-0 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Keresés törlése</span>
            </Button>
          )}
        </div>

        {/* Real-time query feedback */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            {searchQuery.trim() ? (
              <>
                Találatok a(z) <strong className="text-foreground">"{searchQuery}"</strong> kifejezésre:{" "}
                <span className="font-semibold text-primary">{filteredArticles}</span> / {totalArticles} cikk
              </>
            ) : (
              <>Összesen <span className="font-semibold text-foreground">{totalArticles}</span> útmutató és funkcióleírás</>
            )}
          </span>
        </div>
      </div>
    </div>
  );
});
