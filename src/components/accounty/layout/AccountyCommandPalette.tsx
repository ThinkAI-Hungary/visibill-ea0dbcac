import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Briefcase } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface AccountyCommandPaletteProps {
  cmdOpen: boolean;
  setCmdOpen: (v: boolean) => void;
  cmdQuery: string;
  setCmdQuery: (q: string) => void;
  filteredPages: any[];
  filteredClients: any[];
  navigate: (path: string) => void;
}

export default function AccountyCommandPalette({
  cmdOpen,
  setCmdOpen,
  cmdQuery,
  setCmdQuery,
  filteredPages,
  filteredClients,
  navigate,
}: AccountyCommandPaletteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Combine items to enable unified keyboard index tracking
  const combinedItems = useMemo(() => {
    const items: Array<{ name: string; path?: string; id?: string; type: 'page' | 'client'; icon?: any; taxNumber?: string }> = [];
    filteredPages.forEach(p => {
      items.push({ name: p.name, path: p.path, type: 'page', icon: p.icon });
    });
    filteredClients.forEach(c => {
      items.push({ name: c.name, id: c.id, type: 'client', taxNumber: c.taxNumber });
    });
    return items;
  }, [filteredPages, filteredClients]);

  // Reset selectedIndex whenever the search query or items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [combinedItems]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setCmdOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, combinedItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + combinedItems.length) % Math.max(1, combinedItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = combinedItems[selectedIndex];
      if (selected) {
        if (selected.type === 'page' && selected.path) {
          navigate(selected.path);
        } else if (selected.type === 'client' && selected.id) {
          navigate(`/eaisybooks/client/${selected.id}/overview`);
        }
        setCmdOpen(false);
        setCmdQuery('');
      }
    }
  };

  return (
    <Dialog open={cmdOpen} onOpenChange={(v) => { setCmdOpen(v); if (!v) setCmdQuery(''); }}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden [&>button]:hidden bg-background/80 dark:bg-background/80 backdrop-blur-md border border-border shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            placeholder="Keresés oldal vagy ügyfél..."
            value={cmdQuery}
            onChange={(e) => setCmdQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={() => { setCmdOpen(false); setCmdQuery(''); }}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-2">
          {filteredPages.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Oldalak</p>
              {filteredPages.map((p, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={p.path}
                    onClick={() => { navigate(p.path); setCmdOpen(false); setCmdQuery(''); }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-150 text-left",
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm scale-[1.01]"
                        : "hover:bg-accent text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <p.icon className={cn("w-4 h-4 shrink-0", isSelected ? "text-primary-foreground" : "text-muted-foreground")} />
                      <span>{p.name}</span>
                    </div>
                    {isSelected && <span className="text-[10px] opacity-75 font-mono">↵</span>}
                  </button>
                );
              })}
            </div>
          )}
          {filteredClients.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ügyfelek</p>
              {filteredClients.map((c, idx) => {
                const globalIdx = filteredPages.length + idx;
                const isSelected = globalIdx === selectedIndex;
                return (
                  <button
                    key={c.id}
                    onClick={() => { navigate(`/eaisybooks/client/${c.id}/overview`); setCmdOpen(false); setCmdQuery(''); }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-150 text-left",
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm scale-[1.01]"
                        : "hover:bg-accent text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Briefcase className={cn("w-4 h-4 shrink-0", isSelected ? "text-primary-foreground" : "text-primary")} />
                      <div>
                        <span>{c.name}</span>
                        <span className={cn("text-xs ml-2", isSelected ? "text-primary-foreground/75" : "text-muted-foreground")}>{c.taxNumber}</span>
                      </div>
                    </div>
                    {isSelected && <span className="text-[10px] opacity-75 font-mono">↵</span>}
                  </button>
                );
              })}
            </div>
          )}
          {filteredPages.length === 0 && filteredClients.length === 0 && cmdQuery && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nincs találat: "{cmdQuery}"
            </div>
          )}
        </div>
        {combinedItems.length > 0 && (
          <div className="border-t border-border px-4 py-2 bg-muted/40 dark:bg-muted/10 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-card border border-border rounded font-mono shadow-sm">↑↓</span> navigálás
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-card border border-border rounded font-mono shadow-sm">Enter</span> kiválasztás
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-card border border-border rounded font-mono shadow-sm">Esc</span> bezárás
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
