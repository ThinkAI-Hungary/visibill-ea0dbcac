import React from 'react';
import { Search, X, Briefcase } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

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
  return (
    <Dialog open={cmdOpen} onOpenChange={(v) => { setCmdOpen(v); if (!v) setCmdQuery(''); }}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden [&>button]:hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            placeholder="Keresés oldal vagy ügyfél..."
            value={cmdQuery}
            onChange={(e) => setCmdQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setCmdOpen(false);
            }}
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
              {filteredPages.map((p) => (
                <button
                  key={p.path}
                  onClick={() => { navigate(p.path); setCmdOpen(false); setCmdQuery(''); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left"
                >
                  <p.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-foreground">{p.name}</span>
                </button>
              ))}
            </div>
          )}
          {filteredClients.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ügyfelek</p>
              {filteredClients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { navigate(`/accounty/client/${c.id}`); setCmdOpen(false); setCmdQuery(''); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-left"
                >
                  <Briefcase className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <span className="text-foreground font-medium">{c.name}</span>
                    <span className="text-muted-foreground text-xs ml-2">{c.taxNumber}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {filteredPages.length === 0 && filteredClients.length === 0 && cmdQuery && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Nincs találat: "{cmdQuery}"
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
