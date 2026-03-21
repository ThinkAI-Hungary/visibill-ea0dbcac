import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data: profileStatus, isLoading: profileLoading } = useQuery({
    queryKey: ['profile-check', user?.id],
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user!.id)
        .single();

      if (error && error.code === 'PGRST116') return 'no-profile' as const;
      if (error) throw error;
      if (!profile?.name) return 'incomplete' as const;
      return 'complete' as const;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profileStatus === 'no-profile' || profileStatus === 'incomplete') {
      navigate('/onboarding');
    }
  }, [profileStatus, navigate]);

  if (loading || (profileLoading && !profileStatus)) {
    return <LoadingSpinner />;
  }

  if (!user || profileStatus !== 'complete') {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
