import React, { useState } from 'react';
import { useAggreg8, type Aggreg8Consent } from '@/hooks/useAggreg8';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Landmark,
  Plus,
  RefreshCw,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  companyId: string;
}

export function Aggreg8BankConnections({ companyId }: Props) {
  const {
    consents,
    isLoading,
    isError,
    error,
    isFlowLoading,
    isSyncing,
    refetch,
    startAddBankFlow,
    startOnDemandSync,
    startExtendConsent,
    revokeConsent,
  } = useAggreg8(companyId);

  const [deletingConsent, setDeletingConsent] = useState<Aggreg8Consent | null>(null);

  // Helper for formatting Hungarian currency
  const formatCurrency = (amount: number | null | undefined, currency = 'HUF') => {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: currency === 'HUF' ? 0 : 2,
    }).format(amount);
  };

  // Helper for PSD2 expiration countdown
  const getExpirationBadge = (expirationDateStr: string | null) => {
    if (!expirationDateStr) return null;
    const now = new Date();
    const expDate = new Date(expirationDateStr);
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          PSD2 felhatalmazás lejárt
        </Badge>
      );
    }

    if (diffDays <= 14) {
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {diffDays} nap van hátra
        </Badge>
      );
    }

    return (
      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {diffDays} nap érvényes
      </Badge>
    );
  };

  // 1. Loading State (Skeleton)
  if (isLoading) {
    return (
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  // 2. Error State
  if (isError) {
    return (
      <Card className="border border-destructive/30 bg-destructive/5 shadow-sm">
        <CardContent className="p-6 text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <h3 className="text-base font-semibold text-foreground">Hiba történt a banki kapcsolatok betöltésekor</h3>
          <p className="text-sm text-muted-foreground">{(error as any)?.message || 'Ismeretlen hiba lépett fel.'}</p>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="transition-colors duration-150 mt-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Újrapróbálkozás
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Élő Banki Kapcsolatok (PSD2 Open Banking)
            </CardTitle>
            <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
              Aggreg8
            </Badge>
            {isSyncing && (
              <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20 flex items-center gap-1.5 animate-pulse">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Szinkronizálás folyamatban...
              </Badge>
            )}
          </div>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            Automatikus, valós idejű banki tranzakció-szinkronizáció és számlapárosítás az európai PSD2 szabvány szerint.
          </CardDescription>
        </div>

        <Button
          onClick={startAddBankFlow}
          disabled={isFlowLoading}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-colors duration-150 shrink-0"
        >
          {isFlowLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Csatlakozás...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Új bank csatlakoztatása
            </>
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 3. Empty State */}
        {consents.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-8 text-center bg-card/50 space-y-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="text-base font-semibold text-foreground">Még nincs csatlakoztatott bankszámlád</h4>
              <p className="text-sm text-muted-foreground">
                Kattints az új bank hozzáadására, válaszd ki a bankodat (OTP, Erste, K&H, Raiffeisen, MBH stb.), és lépj be a netbankoddal. A tranzakciók automatikusan bekerülnek a könyvelésbe.
              </p>
            </div>
            <Button
              onClick={startAddBankFlow}
              disabled={isFlowLoading}
              variant="outline"
              className="border-primary/40 hover:bg-primary/5 text-primary font-medium transition-colors duration-150"
            >
              <Plus className="h-4 w-4 mr-2" />
              Bank csatlakoztatása most
            </Button>
          </div>
        ) : (
          /* 4. Data State: List of connected banks */
          <div className="grid grid-cols-1 gap-4">
            {consents.map((consent) => (
              <div
                key={consent.id}
                className="border border-border/80 rounded-xl p-5 bg-card hover:border-border transition-colors duration-150 space-y-4"
              >
                {/* Bank Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    {consent.bank_logo_url ? (
                      <img
                        src={consent.bank_logo_url}
                        alt={consent.bank_name || 'Bank'}
                        className="h-9 w-9 object-contain rounded-md bg-white p-1 border border-border"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold">
                        <Landmark className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-base font-semibold text-foreground leading-tight">
                        {consent.bank_name || 'Ismeretlen Bank'}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Létrehozva: {new Date(consent.created_at).toLocaleDateString('hu-HU')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getExpirationBadge(consent.passive_sync_expiration_date)}
                  </div>
                </div>

                {/* Sub-accounts under this consent */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Csatlakoztatott számlák ({consent.accounts?.length || 0})
                  </div>

                  {consent.accounts && consent.accounts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {consent.accounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="bg-muted/40 border border-border/50 rounded-lg p-3 flex items-center justify-between"
                        >
                          <div className="space-y-0.5 overflow-hidden pr-2">
                            <div className="text-sm font-medium text-foreground truncate">
                              {acc.account_name || 'Folyószámla'}
                            </div>
                            <div className="text-xs font-mono text-muted-foreground truncate">
                              {acc.account_number}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-semibold text-primary">
                              {formatCurrency(acc.balance, acc.currency)}
                            </div>
                            {acc.last_synced_at && (
                              <div className="text-[10px] text-muted-foreground">
                                Szinkr.: {new Date(acc.last_synced_at).toLocaleDateString('hu-HU')}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Nincsenek aktív számlák ehhez a kapcsolathoz.</p>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startOnDemandSync(consent.info_sharing_consent_id)}
                      disabled={isFlowLoading}
                      className="text-xs h-8 transition-colors duration-150"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Frissítés most
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startExtendConsent(consent.info_sharing_consent_id)}
                      disabled={isFlowLoading}
                      className="text-xs h-8 transition-colors duration-150"
                    >
                      <Calendar className="h-3.5 w-3.5 mr-1.5" />
                      180 napos megújítás
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeletingConsent(consent)}
                    className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Kapcsolat bontása
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog for Revoking Bank Consent */}
      <AlertDialog open={!!deletingConsent} onOpenChange={(open) => !open && setDeletingConsent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan bontani szeretnéd ezt a bankkapcsolatot?</AlertDialogTitle>
            <AlertDialogDescription>
              A(z) <span className="font-semibold text-foreground">{deletingConsent?.bank_name}</span> banki hozzáférési jogosultság visszavonásra kerül. Az automatikus háttérszinkronizáció leáll, a korábban már leszinkronizált tranzakciók viszont megmaradnak a rendszerben.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="transition-colors duration-150">Mégsem</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingConsent) {
                  revokeConsent(deletingConsent.id, deletingConsent.info_sharing_consent_id);
                  setDeletingConsent(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors duration-150"
            >
              Kapcsolat bontása
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
