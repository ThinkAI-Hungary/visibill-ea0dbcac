import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorControlPanel } from './errors/ErrorControlPanel';
import { PermissionsPanel } from './permissions/PermissionsPanel';
import { FilesPanel } from './files/FilesPanel';
import { WorkerPanel } from './worker/WorkerPanel';
import { UsersControlPanel } from './user/UsersControlPanel';
import { ControlCenterUser } from '../api/types';
import { AlertTriangle, FolderOpen, Server, Users, ShieldCheck } from 'lucide-react';

export type ControlCenterTab = 'errors' | 'permissions' | 'files' | 'worker' | 'users';

interface ControlCenterProps {
  initialTab: ControlCenterTab;
  onOpenCompany: (id: string) => void;
  allUsers: ControlCenterUser[];
  overviewLoading: boolean;
  companyCostMap: Map<string, any>;
}

export function ControlCenter({
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
    <div className="space-y-6 page-animate overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border bg-muted/20 rounded-lg p-1 w-fit gap-1">
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

      {/* Tab content */}
      <div className="w-full overflow-hidden">
        <div className="w-full" style={{ minWidth: 900 }}>
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
        </div>
      </div>
    </div>
  );
}
