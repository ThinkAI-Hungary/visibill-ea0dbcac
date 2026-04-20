import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { useScopedNavigate, extractPageSegment } from '@/lib/navigation';

/** Page segments that employee-role users are allowed to visit */
const EMPLOYEE_ALLOWED_PAGES = ['/working-time'];

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const { role, isLoading: roleLoading, isEmployee } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const scopedNavigate = useScopedNavigate();

  // Check cache synchronously to avoid 1-frame flash on route transitions.
  // When React Router mounts a new ProtectedRoute, useQuery's observer
  // briefly returns isLoading:true even if the cache has data.
  const profileQueryKey = ['profile-check', user?.id];
  const cachedProfile = queryClient.getQueryData(profileQueryKey);

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
      navigate('/categories');
    }
  }, [profileStatus, navigate]);

  // Employee guard: redirect to working-time if on a forbidden page
  useEffect(() => {
    if (isEmployee) {
      const currentPage = extractPageSegment(location.pathname);
      const isAllowed = EMPLOYEE_ALLOWED_PAGES.some(
        (page) => currentPage === page || currentPage.startsWith(page + '/')
      );
      if (!isAllowed) {
        scopedNavigate('working-time', { replace: true });
      }
    }
  }, [isEmployee, location.pathname, scopedNavigate]);

  if (loading) {
    return <ContentSkeleton />;
  }

  if (profileLoading && !profileStatus && !cachedProfile) {
    return <ContentSkeleton />;
  }

  if (!user || profileStatus !== 'complete') {
    return null;
  }

  // Block render while role is loading
  if (roleLoading) {
    return <ContentSkeleton />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
