import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { ContentSkeleton } from '@/components/ui/content-skeleton';

/** Routes that employee-role users are allowed to visit */
const EMPLOYEE_ALLOWED_ROUTES = ['/working-time'];

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const { role, isLoading: roleLoading, isEmployee } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

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

  // Employee guard: redirect to /working-time if on a forbidden page
  useEffect(() => {
    if (isEmployee) {
      const isAllowed = EMPLOYEE_ALLOWED_ROUTES.some(
        (route) => location.pathname === route || location.pathname.startsWith(route + '/')
      );
      if (!isAllowed) {
        navigate('/working-time', { replace: true });
      }
    }
  }, [isEmployee, location.pathname, navigate]);

  if (loading) {
    return <ContentSkeleton />;
  }

  if (profileLoading && !profileStatus) {
    return <ContentSkeleton />;
  }

  if (!user || profileStatus !== 'complete') {
    return null;
  }

  // Block render while role is loading
  if (roleLoading) {
    return <ContentSkeleton />;
  }

  // Block forbidden content for employees (redirect fires via useEffect above)
  if (isEmployee) {
    const isAllowed = EMPLOYEE_ALLOWED_ROUTES.some(
      (route) => location.pathname === route || location.pathname.startsWith(route + '/')
    );
    if (!isAllowed) {
      return null;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
