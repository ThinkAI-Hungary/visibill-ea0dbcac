import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClientData } from '@/pages/Accounty/types';
import { OwnerDropdown, StatusBadge } from './DashboardShared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { TableEmptyState } from '@/components/ui/table-empty-state';

interface ClientListViewProps {
  filteredClients: ClientData[];
  handleUpdateOwner: (clientId: string, ownerId: string) => void;
  searchQuery: string;
  statusFilter: string;
}

export default function ClientListView({
  filteredClients,
  handleUpdateOwner,
  searchQuery,
  statusFilter,
}: ClientListViewProps) {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = (ids: string[]) => setSelectedIds(new Set(ids));
  const clearSelection = () => setSelectedIds(new Set());

  return (
    <div 
      className="bg-card border border-border rounded-lg shadow-soft overflow-hidden focus:outline-none focus:ring-1 focus:ring-primary/20"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target instanceof HTMLInputElement) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedIndex(prev => Math.min(prev + 1, filteredClients.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filteredClients.length) {
          navigate(`/eaisybooks/client/${filteredClients[focusedIndex].id}`);
        } else if (e.key === 'Escape') {
          setFocusedIndex(-1);
          clearSelection();
        }
      }}
    >
      {/* F1: Bulk toolbar */}
      {selectedIds.size > 0 && (
        <div className="px-6 py-3 bg-primary/5 border-b border-primary/10 flex items-center gap-4 animate-in slide-in-from-top-2 duration-200">
          <span className="text-sm font-semibold text-primary">{selectedIds.size} kijelölve</span>
          <button 
            onClick={() => selectAll(filteredClients.map(c => c.id))} 
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Mind kijelölés
          </button>
          <button 
            onClick={clearSelection} 
            className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
          >
            Törlés
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table className="compact-table min-w-[950px]">
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border">
              <TableHead className="px-3 py-4 w-10">
                <Checkbox 
                  className="cursor-pointer" 
                  checked={selectedIds.size === filteredClients.length && filteredClients.length > 0} 
                  onCheckedChange={(checked) => checked ? selectAll(filteredClients.map(c => c.id)) : clearSelection()} 
                />
              </TableHead>
              <TableHead className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cégnév</TableHead>
              <TableHead className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adószám</TableHead>
              <TableHead className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feldolgozatlan</TableHead>
              <TableHead className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hiányzó</TableHead>
              <TableHead className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Határidő</TableHead>
              <TableHead className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Felelős</TableHead>
              <TableHead className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Státusz</TableHead>
              <TableHead className="px-6 py-4 w-12 text-center"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClients.length > 0 ? (
              filteredClients.map((client, idx) => (
                <TableRow 
                  key={client.id} 
                  onClick={() => navigate(`/eaisybooks/client/${client.id}`)}
                  className={cn(
                    "hover:bg-muted/40 transition-colors group cursor-pointer border-l-2 border-l-transparent hover:border-l-primary",
                    selectedIds.has(client.id) && "bg-primary/5 border-l-primary",
                    focusedIndex === idx && "ring-2 ring-primary/30 ring-inset"
                  )}
                >
                  <TableCell className="px-3 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      className="cursor-pointer" 
                      checked={selectedIds.has(client.id)} 
                      onCheckedChange={() => toggleSelect(client.id)} 
                    />
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${client.colorHex} shrink-0`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {client.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center font-mono tabular-nums text-muted-foreground">{client.taxNumber}</TableCell>
                  <TableCell className="px-6 py-4 text-center font-mono tabular-nums font-medium text-foreground">{client.unprocessedCount}</TableCell>
                  <TableCell className="px-6 py-4 text-center">
                    <span className={`font-mono tabular-nums font-medium ${client.missingCount > 0 ? 'text-destructive font-semibold' : 'text-foreground'}`}>
                      {client.missingCount}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center text-muted-foreground">
                    <span className={`${client.status === 'Kritikus' ? 'text-destructive font-semibold' : ''}`}>
                      {client.deadline}
                    </span>
                  </TableCell>
                  <TableCell className="px-6 py-4 flex justify-center">
                    <OwnerDropdown client={client} onUpdateOwner={handleUpdateOwner} />
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center">
                    <StatusBadge status={client.status} />
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button className="text-muted-foreground hover:text-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmptyState 
                colSpan={9} 
                title="Nincs találat" 
                description={`Nincs találat a következőre: "${searchQuery}" ${statusFilter !== 'Minden' ? `és státusz: ${statusFilter}` : ''}`} 
              />
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
