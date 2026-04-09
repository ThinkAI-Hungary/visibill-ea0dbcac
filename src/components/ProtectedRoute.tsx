import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { ContentSkeleton } from '@/components/ui/content-skeleton';

/** Routes that employee-role users are allowed to visit */
const EMPLOYEE_ALLOWED_ROUTES = ['/working-time'];

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute is the content-level auth + role guard.
 * 
 * IMPORTANT: This component renders INSIDE AppLayout, so the sidebar
 * is already mounted and stable. Loading states here only affect the
 * main content area — never the sidebar.
 * 
 * Uses ContentSkeleton instead of LoadingSpinner to prevent
 * a white-page flash inside the dark sidebar shell.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const { selectedCompany } = useCompany();
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

  // Fetch user role for employee guard
  const { data: userRole, isLoading: roleLoading } = useQuery({
    queryKey: ['user-role-guard', user?.id, selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_members')
        .select('role')
        .eq('company_id', selectedCompany!.id)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error || !data) return null;
      return data.role as string;
    },
    enabled: !!user && !!selectedCompany?.id,
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
    if (userRole === 'employee') {
      const isAllowed = EMPLOYEE_ALLOWED_ROUTES.some(
        (route) => location.pathname === route || location.pathname.startsWith(route + '/')
      );
      if (!isAllowed) {
        navigate('/working-time', { replace: true });
      }
    }
  }, [userRole, location.pathname, navigate]);

  // Show content skeleton (NOT full-page spinner) during loading
  if (loading) {
    return <ContentSkeleton />;
  }

  if (profileLoading && !profileStatus) {
    return <ContentSkeleton />;
  }

  if (!user || profileStatus !== 'complete') {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
