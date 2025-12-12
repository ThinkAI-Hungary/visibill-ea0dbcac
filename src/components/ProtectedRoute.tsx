import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profileLoading, setProfileLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      checkProfile();
    }
  }, [user, loading, navigate]);

  const checkProfile = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name, position, company')
        .eq('user_id', user!.id)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, redirect to onboarding
        navigate('/onboarding');
        return;
      }

      if (error) throw error;

      // Check if profile is complete (at least name is filled)
      if (!profile?.name) {
        navigate('/onboarding');
        return;
      }

      setHasProfile(true);
    } catch (error) {
      console.error('Error checking profile:', error);
      navigate('/onboarding');
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading || profileLoading) {
    return <LoadingSpinner />;
  }

  if (!user || !hasProfile) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;