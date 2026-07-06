import React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientData } from '@/pages/Accounty/types';
import { ClientCard } from './DashboardShared';

interface ClientGridViewProps {
  filteredClients: ClientData[];
  handleUpdateOwner: (clientId: string, ownerId: string) => void;
  searchQuery: string;
  statusFilter: string;
  setSearchQuery: (q: string) => void;
  setStatusFilter: (s: string) => void;
}

export default function ClientGridView({
  filteredClients,
  handleUpdateOwner,
  searchQuery,
  statusFilter,
  setSearchQuery,
  setStatusFilter,
}: ClientGridViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {filteredClients.map((client, idx) => (
        <div key={client.id} className={`stagger-${Math.min(idx + 1, 8)}`}>
          <ClientCard client={client} onUpdateOwner={handleUpdateOwner} />
        </div>
      ))}
      {filteredClients.length === 0 && (
        <div className="col-span-full py-16 text-center">
          <Search className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-semibold text-foreground">Nincs találat</p>
          <p className="text-sm text-muted-foreground mt-1">
            Keresés: "{searchQuery}" {statusFilter !== 'Minden' && `· Státusz: ${statusFilter}`}
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => { setSearchQuery(''); setStatusFilter('Minden'); }}>
            <X className="w-4 h-4" />
            Szűrők törlése
          </Button>
        </div>
      )}
    </div>
  );
}
