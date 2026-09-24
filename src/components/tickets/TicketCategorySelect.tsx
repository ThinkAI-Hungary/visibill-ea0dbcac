import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { TICKET_CATEGORIES } from "@/utils/ticketCategories";
import { Search, Check, ChevronsUpDown, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketCategorySelectProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  popoverWidth?: string;
  isFilterMode?: boolean;
}

export function TicketCategorySelect({
  value,
  onChange,
  placeholder = "Válassz kategóriát...",
  allowClear = true,
  disabled = false,
  className,
  triggerClassName,
  popoverWidth = "w-[280px]",
  isFilterMode = false,
}: TicketCategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return TICKET_CATEGORIES;
    return TICKET_CATEGORIES.filter((cat) => cat.toLowerCase().includes(q));
  }, [search]);

  const handleSelect = (category: string | null) => {
    onChange(category);
    setOpen(false);
    setSearch("");
  };

  const displayLabel = useMemo(() => {
    if (isFilterMode) {
      if (!value || value === "all") return placeholder || "Összes kategória";
      if (value === "none") return "Kategória nélküliek";
      return value;
    }
    return value || placeholder;
  }, [value, isFilterMode, placeholder]);

  const hasActiveValue = isFilterMode
    ? Boolean(value && value !== "all")
    : Boolean(value);

  return (
    <div className={cn("relative inline-block w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between h-10 px-3 text-left font-normal bg-background text-xs sm:text-sm",
              !hasActiveValue && "text-muted-foreground",
              triggerClassName
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <Tag className="h-3.5 w-3.5 shrink-0 opacity-60 text-primary" />
              <span className="truncate">{displayLabel}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-1.5 opacity-60">
              {allowClear && hasActiveValue && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(isFilterMode ? "all" : null);
                  }}
                  className="p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Szűrő törlése"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className={cn("p-2", popoverWidth)}
          align="start"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Keresés a 37 kategória között..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
                autoFocus
              />
            </div>

            <div className="max-h-[240px] overflow-y-auto space-y-0.5 overscroll-contain pr-1">
              {isFilterMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelect("all")}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs transition-colors hover:bg-accent font-medium",
                      (!value || value === "all") && "bg-accent/60 text-foreground font-semibold"
                    )}
                  >
                    <span>Összes kategória</span>
                    {(!value || value === "all") && (
                      <Check className="h-3.5 w-3.5 text-primary ml-2 shrink-0" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelect("none")}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs transition-colors hover:bg-accent text-muted-foreground",
                      value === "none" && "bg-accent/60 font-medium text-foreground"
                    )}
                  >
                    <span className="italic">Kategória nélküli jegyek</span>
                    {value === "none" && (
                      <Check className="h-3.5 w-3.5 text-primary ml-2 shrink-0" />
                    )}
                  </button>
                  <Separator className="my-1" />
                </>
              ) : (
                allowClear && (
                  <button
                    type="button"
                    onClick={() => handleSelect(null)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs transition-colors hover:bg-accent text-muted-foreground",
                      !value && "bg-accent/60 font-medium text-foreground"
                    )}
                  >
                    <span className="italic">Nincs kategória (Üres)</span>
                    {!value && <Check className="h-3.5 w-3.5 text-primary ml-2 shrink-0" />}
                  </button>
                )
              )}

              {filteredCategories.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  Nincs találat.
                </p>
              ) : (
                filteredCategories.map((cat) => {
                  const isSelected = value === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleSelect(cat)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left text-xs transition-colors hover:bg-accent",
                        isSelected && "bg-primary/10 text-primary font-medium"
                      )}
                    >
                      <span className="truncate">{cat}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary ml-2 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
