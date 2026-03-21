import { Outlet } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';

/**
 * ProtectedLayout provides the sidebar + content shell.
 * Auth gating is handled exclusively by ProtectedRoute (wrapping each page's children),
 * so this component does NOT duplicate loading / user checks — that was causing
 * a double full-page spinner flash (P0-1).
 */
export function ProtectedLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
