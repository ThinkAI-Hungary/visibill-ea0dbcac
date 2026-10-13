import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Hash, Check } from 'lucide-react';
import type { PostingItem } from '../types';

interface PostingGlReassignModalProps {
  item: PostingItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  glAccounts: Array<{ id: string; gl_number: string; short_name: string }>;
  onSelectGlAccount: (itemId: string, newGlAccountId: string) => void;
}

function PostingGlReassignModalInner({
  item,
  open,
  onOpenChange,
  glAccounts,
  onSelectGlAccount,
}: PostingGlReassignModalProps & { item: PostingItem }) {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Fast client-side filter with max 50 visible results (zero DOM lag)
  const filteredAccounts = useMemo(() => {
    if (!glAccounts || glAccounts.length === 0) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return glAccounts.slice(0, 50);
    }

    const matches: Array<{ id: string; gl_number: string; short_name: string }> = [];
    for (const gl of glAccounts) {
      const glNumber = gl.gl_number || '';
      const name = (gl.short_name || '').toLowerCase();
      if (glNumber.startsWith(q) || glNumber.includes(q) || name.includes(q)) {
        matches.push(gl);
        if (matches.length >= 50) break;
      }
    }
    return matches;
  }, [glAccounts, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-5 gap-4">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border/60">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Hash className="w-4 h-4 text-primary" />
            <span>Főkönyvi szám módosítása</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground truncate">
            {item.partner_name} • {item.line_description} ({Math.abs(item.net_amount).toLocaleString('hu-HU')} {item.currency})
          </DialogDescription>
        </DialogHeader>

        {/* Keresőmező */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Keresés szám (pl. 5111) vagy név szerint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-sm"
          />
        </div>

        {/* Eredménylista */}
        <div className="flex-1 overflow-y-auto max-h-[360px] space-y-1 pr-1 border rounded-lg p-1.5 bg-muted/20 divide-y divide-border/30">
          {filteredAccounts.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Nincs találat a keresési feltételre.
            </div>
          ) : (
            filteredAccounts.map((gl) => {
              const isCurrent = gl.id === item.suggested_gl_account_id;
              return (
                <button
                  key={gl.id}
                  type="button"
                  onClick={() => {
                    onSelectGlAccount(item.item_id, gl.id);
                    onOpenChange(false);
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-md text-left text-xs transition-colors hover:bg-primary/10 hover:text-primary ${
                    isCurrent ? 'bg-primary/15 font-semibold text-primary' : 'text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-mono font-bold text-xs bg-muted px-1.5 py-0.5 rounded border border-border/50 shrink-0">
                      {gl.gl_number}
                    </span>
                    <span className="truncate">{gl.short_name}</span>
                  </div>

                  {isCurrent && (
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 shrink-0 gap-1">
                      <Check className="w-3 h-3" />
                      Jelenlegi
                    </Badge>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
          <span>Összes elérhető főkönyvi szám: {glAccounts.length}</span>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-7 text-xs">
            Bezárás
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PostingGlReassignModal(props: PostingGlReassignModalProps) {
  if (!props.open || !props.item) return null;
  return <PostingGlReassignModalInner {...props} item={props.item} />;
}
