import React, { Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ControlCenterUser } from '../api/types';
import { Skeleton } from './common/ManagementSkeleton';
import { AlertTriangle, FolderOpen, Server, Users, ShieldCheck } from 'lucide-react';

const ErrorControlPanel = lazy(() => import('./errors/ErrorControlPanel').then(m => ({ default: m.ErrorControlPanel })));
const PermissionsPanel = lazy(() => import('./permissions/PermissionsPanel').then(m => ({ default: m.PermissionsPanel })));
const FilesPanel = lazy(() => import('./files/FilesPanel').then(m => ({ default: m.FilesPanel })));
const WorkerPanel = lazy(() => import('./worker/WorkerPanel').then(m => ({ default: m.WorkerPanel })));
const UsersControlPanel = lazy(() => import('./user/UsersControlPanel').then(m => ({ default: m.UsersControlPanel })));

export type ControlCenterTab = 'errors' | 'permissions' | 'files' | 'worker' | 'users';

interface ControlCenterProps {
  initialTab: ControlCenterTab;
  onOpenCompany: (id: string) => void;
  allUsers: ControlCenterUser[];
  overviewLoading: boolean;
  companyCostMap: Map<string, any>;
}

function ControlCenterComponent({
  initialTab,
  onOpenCompany,
  allUsers,
  overviewLoading,
  companyCostMap,
}: ControlCenterProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = initialTab;

  const setTab = (newTab: ControlCenterTab) => {
    setSearchParams({ view: newTab });
  };

  return (
    <div className="space-y-4 page-animate">
      {/* Tab bar (sticky, hardware-accelerated with minimal blur radius) */}
      <div className="sticky top-0 z-30 -mx-6 px-6 -mt-2.5 pt-2.5 pb-2 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex border-b border-border bg-muted/20 rounded-lg p-1 w-fit gap-1 overflow-x-auto max-w-full">
          <button
            onClick={() => setTab('errors')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap border ${
              tab === 'errors'
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Hibák
          </button>
          <button
            onClick={() => setTab('files')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap border ${
              tab === 'files'
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Fájlok
          </button>
          <button
            onClick={() => setTab('worker')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap border ${
              tab === 'worker'
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            Worker
          </button>
          <button
            onClick={() => setTab('users')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap border ${
              tab === 'users'
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Felhasználók
          </button>
          <button
            onClick={() => setTab('permissions')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap border ${
              tab === 'permissions'
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Jogosultságok
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="w-full overflow-hidden">
        <div className="w-full" style={{ minWidth: 900 }}>
          <Suspense fallback={
            <div className="space-y-4 p-4">
              <Skeleton className="h-10 w-64 rounded-md" />
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
          }>
            {tab === 'errors' && <ErrorControlPanel onOpenCompany={onOpenCompany} allUsers={allUsers} />}
            {tab === 'permissions' && <PermissionsPanel allUsers={allUsers} />}
            {tab === 'files' && <FilesPanel allUsers={allUsers} />}
            {tab === 'worker' && <WorkerPanel />}
            {tab === 'users' && (
              <UsersControlPanel
                allUsers={allUsers}
                overviewLoading={overviewLoading}
                companyCostMap={companyCostMap}
                onOpenCompany={onOpenCompany}
              />
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export const ControlCenter = React.memo(ControlCenterComponent);
