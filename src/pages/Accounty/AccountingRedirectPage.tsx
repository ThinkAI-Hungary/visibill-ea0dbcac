import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEvClientSettings } from '@/hooks/useEvData';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function AccountingRedirectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Fetch EV settings to determine if they are EV or TAO
  const { data: evSettings, isLoading } = useEvClientSettings(id);

  useEffect(() => {
    if (isLoading) return;
    
    const clientName = evSettings ? 'ev' : 'tao';
    // Fallback: If client name contains "EV" we can also default to EV
    const isEv = !!evSettings;
    
    if (isEv) {
      navigate(`/accounty/client/${id}/ev`, { replace: true });
    } else {
      navigate(`/accounty/client/${id}/tao`, { replace: true });
    }
  }, [id, evSettings, isLoading, navigate]);

  return (
    <div className="flex h-[300px] w-full items-center justify-center">
      <LoadingSpinner message="Könyvelőmodul kiválasztása..." />
    </div>
  );
}
