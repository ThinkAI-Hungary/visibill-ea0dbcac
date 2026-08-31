import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NavSyncDialog } from '@/components/nav/NavSyncDialog';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInvoiceContext } from '../../context/useInvoiceContext';

export function NavSyncButton() {
  const {
    syncDialogOpen,
    setSyncDialogOpen,
    handleSync,
    syncing,
    canSync,
    cooldownSeconds,
    formatCooldown,
    credentialsExist,
    writable,
  } = useInvoiceContext();

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSyncDialogOpen(true)}
              disabled={syncing || !credentialsExist || !canSync || !writable}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', syncing && 'animate-spin')} />
              {syncing ? 'Szinkronizálás...' : !canSync ? `Várj ${formatCooldown(cooldownSeconds)}` : 'Szinkronizálás'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {!credentialsExist
              ? 'Állítsd be a NAV integrációt az Integrációk oldalon'
              : !canSync
                ? `Legközelebb ${formatCooldown(cooldownSeconds)} múlva szinkronizálhatsz`
                : 'NAV számlák szinkronizálása'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <NavSyncDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        onSync={handleSync}
        syncing={syncing}
        canSync={canSync}
        cooldownSeconds={cooldownSeconds}
        formatCooldown={formatCooldown}
      />
    </>
  );
}
