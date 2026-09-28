import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NavSyncDialog } from '@/components/nav/NavSyncDialog';
import { MinimaxSyncDialog } from '@/components/minimax/MinimaxSyncDialog';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import { useCompanyJurisdiction } from '@/hooks/useCompanyJurisdiction';

export function NavSyncButton() {
  const { t } = useTranslation(['invoices', 'common']);
  const { isCroatia } = useCompanyJurisdiction();
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

  const buttonText = syncing
    ? t('invoices:nav_sync.syncing', 'Szinkronizálás...')
    : !canSync
      ? t('invoices:nav_sync.wait_cooldown', {
          time: formatCooldown(cooldownSeconds),
          defaultValue: `Várj ${formatCooldown(cooldownSeconds)}`,
        })
      : isCroatia
        ? t('invoices:minimax_sync.button', 'Minimax szinkronizálás')
        : t('invoices:nav_sync.sync', 'Szinkronizálás');

  const tooltipText = !credentialsExist
    ? isCroatia
      ? t('invoices:minimax_sync.no_credentials', 'Állítsd be a Minimax integrációt az Integrációk oldalon')
      : t('invoices:nav_sync.no_credentials', 'Állítsd be a NAV integrációt az Integrációk oldalon')
    : !canSync
      ? t('invoices:nav_sync.cooldown', {
          time: formatCooldown(cooldownSeconds),
          defaultValue: `Legközelebb ${formatCooldown(cooldownSeconds)} múlva szinkronizálhatsz`,
        })
      : isCroatia
        ? t('invoices:minimax_sync.tooltip', 'Horvát e-számlák szinkronizálása a Minimax API-ból')
        : t('invoices:nav_sync.sync_tooltip', 'NAV számlák szinkronizálása');

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
              className={cn(
                isCroatia &&
                  'border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
              )}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', syncing && 'animate-spin')} />
              {buttonText}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {isCroatia ? (
        <MinimaxSyncDialog
          open={syncDialogOpen}
          onOpenChange={setSyncDialogOpen}
          onSync={async (dateFrom, dateTo, direction, onProgress) => {
            await handleSync(dateFrom, dateTo, (prog) => {
              onProgress?.({
                currentChunk: prog?.currentChunk,
                totalChunks: prog?.totalChunks,
                totalInvoices: prog?.totalInvoices,
              });
            });
          }}
          syncing={syncing}
          canSync={canSync}
          cooldownSeconds={cooldownSeconds}
          formatCooldown={formatCooldown}
        />
      ) : (
        <NavSyncDialog
          open={syncDialogOpen}
          onOpenChange={setSyncDialogOpen}
          onSync={handleSync}
          syncing={syncing}
          canSync={canSync}
          cooldownSeconds={cooldownSeconds}
          formatCooldown={formatCooldown}
        />
      )}
    </>
  );
}
