import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NavSyncDialog } from '@/components/nav/NavSyncDialog';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInvoiceContext } from '../../context/useInvoiceContext';

export function NavSyncButton() {
  const { t } = useTranslation(['invoices', 'common']);
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
              {syncing
                ? t('invoices:nav_sync.syncing', 'Szinkronizálás...')
                : !canSync
                  ? t('invoices:nav_sync.wait_cooldown', { time: formatCooldown(cooldownSeconds), defaultValue: `Várj ${formatCooldown(cooldownSeconds)}` })
                  : t('invoices:nav_sync.sync', 'Szinkronizálás')}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {!credentialsExist
              ? t('invoices:nav_sync.no_credentials', 'Állítsd be a NAV integrációt az Integrációk oldalon')
              : !canSync
                ? t('invoices:nav_sync.cooldown', { time: formatCooldown(cooldownSeconds), defaultValue: `Legközelebb ${formatCooldown(cooldownSeconds)} múlva szinkronizálhatsz` })
                : t('invoices:nav_sync.sync_tooltip', 'NAV számlák szinkronizálása')}
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
