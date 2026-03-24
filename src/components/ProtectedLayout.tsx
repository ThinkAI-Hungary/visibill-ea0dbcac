import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

/**
 * ProtectedLayout is the TOP-LEVEL auth gate.
 *
 * If auth is loading or the user is null, it renders ONLY the dark
 * LoadingSpinner — no Sidebar, no Skeleton, zero flash.
 * The AppLayout (sidebar + content shell) only mounts after auth is confirmed.
 */
export function ProtectedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Block: show only the dark spinner, NO sidebar, NO skeleton
  if (loading || !user) {
    return <LoadingSpinner message="Betöltés..." />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
