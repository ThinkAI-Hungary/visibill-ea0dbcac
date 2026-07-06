import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Shows a subtle banner at the top of the page when the user loses internet connection.
 * Auto-hides when connection is restored.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg animate-in slide-in-from-top duration-300">
      <WifiOff className="w-4 h-4" />
      <span>Nincs internetkapcsolat — az alkalmazás offline módban működik</span>
    </div>
  );
}
