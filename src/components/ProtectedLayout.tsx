import { useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AppLayout } from '@/components/AppLayout';

/**
 * ProtectedLayout combines authentication checking with layout rendering.
 * This ensures the sidebar only appears after confirming the user is authenticated,
 * preventing the flash of layout before redirect to login.
 */
export function ProtectedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <LoadingSpinner message="Azonosítás..." />;
  }

  if (!user) {
    return null; // Redirect in progress
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
