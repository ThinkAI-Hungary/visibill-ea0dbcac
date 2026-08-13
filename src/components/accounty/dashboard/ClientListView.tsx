import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClientData } from '@/pages/Accounty/types';
import { OwnerDropdown, StatusBadge } from './DashboardShared';

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
      className="bg-card border border-border rounded-xl shadow-soft overflow-hidden focus:outline-none focus:ring-1 focus:ring-primary/20"
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
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-4 w-10">
                <input 
                  type="checkbox" 
                  className="rounded border-border focus:ring-primary" 
                  checked={selectedIds.size === filteredClients.length && filteredClients.length > 0} 
                  onChange={(e) => e.target.checked ? selectAll(filteredClients.map(c => c.id)) : clearSelection()} 
                />
              </th>
              <th className="px-6 py-4">Cégnév</th>
              <th className="px-6 py-4 text-center">Adószám</th>
              <th className="px-6 py-4 text-center">Feldolgozatlan</th>
              <th className="px-6 py-4 text-center">Hiányzó</th>
              <th className="px-6 py-4 text-center">Határidő</th>
              <th className="px-6 py-4 text-center">Felelős</th>
              <th className="px-6 py-4 text-center">Státusz</th>
              <th className="px-6 py-4 w-12 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredClients.length > 0 ? (
              filteredClients.map((client, idx) => (
                <tr 
                  key={client.id} 
                  onClick={() => navigate(`/eaisybooks/client/${client.id}`)}
                  className={cn(
                    "hover:bg-accent/50 transition-colors group cursor-pointer",
                    selectedIds.has(client.id) && "bg-primary/5",
                    focusedIndex === idx && "ring-2 ring-primary/30 ring-inset"
                  )}
                >
                  <td className="px-3 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      className="rounded border-border focus:ring-primary" 
                      checked={selectedIds.has(client.id)} 
                      onChange={() => toggleSelect(client.id)} 
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${client.colorHex} shrink-0`}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {client.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-muted-foreground">{client.taxNumber}</td>
                  <td className="px-6 py-4 text-center font-medium text-foreground">{client.unprocessedCount}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`font-medium ${client.missingCount > 0 ? 'text-red-600' : 'text-foreground'}`}>
                      {client.missingCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-muted-foreground">
                    <span className={`${client.status === 'Kritikus' ? 'text-red-600 font-medium' : ''}`}>
                      {client.deadline}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex justify-center">
                    <OwnerDropdown client={client} onUpdateOwner={handleUpdateOwner} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={client.status} />
                  </td>
                  <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <button className="text-muted-foreground/60 hover:text-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="py-12 text-center text-muted-foreground">
                  Nincs találat a következőre: "{searchQuery}" {statusFilter !== 'Minden' && `és státusz: ${statusFilter}`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
