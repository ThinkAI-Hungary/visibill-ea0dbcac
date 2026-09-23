import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('accounty');
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
          <p className="text-lg font-semibold text-foreground">{t('portfolio.empty.no_match', 'Nincs találat')}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t('portfolio.empty.search_result', {
              query: searchQuery,
              status: statusFilter !== 'Minden' ? t('portfolio.empty.status_suffix', { status: statusFilter }) : '',
              defaultValue: `Keresés: "${searchQuery}"`
            })}
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => { setSearchQuery(''); setStatusFilter('Minden'); }}>
            <X className="w-4 h-4" />
            {t('portfolio.filters.clear_filters', 'Szűrők visszaállítása')}
          </Button>
        </div>
      )}
    </div>
  );
}
