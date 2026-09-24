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
  Shield,
  Calendar,
  AlertTriangle,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface Props {
  companyId: string;
  isOwner?: boolean;
}

export function Aggreg8BankConnections({ companyId, isOwner = true }: Props) {
  const {
    consents,
    isLoading,
    isError,
    error,
    isFlowLoading,
    isAddingBank,
    syncingConsentId,
    extendingConsentId,
    isSyncing,
    refetch,
    startAddBankFlow,
    startOnDemandSync,
    startExtendConsent,
    revokeConsent,
  } = useAggreg8(companyId);

  const [deletingConsent, setDeletingConsent] = useState<Aggreg8Consent | null>(null);

  // Helper for displaying bank/integration name
  const getDisplayBankName = (bankName: string | null | undefined) => {
    if (!bankName || bankName === 'Aggreg8 Bank' || bankName === 'Ismeretlen Bank') {
      return 'Aggreg8.io integráció';
    }
    return bankName;
  };
  // Helper for formatting Hungarian date
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('hu-HU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Helper for formatting Hungarian date + time
  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      const datePart = d.toLocaleDateString('hu-HU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const timePart = d.toLocaleTimeString('hu-HU', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return `${datePart} ${timePart}`;
    } catch {
      return dateStr;
    }
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
        <Badge
          variant="outline"
          className="border-amber-500 text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium"
          title={`Érvényes eddig: ${formatDate(expirationDateStr)}`}
        >
          <AlertTriangle className="h-3 w-3" />
          Még {diffDays} nap van hátra
        </Badge>
      );
    }

    return (
      <Badge
        variant="secondary"
        className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center gap-1 font-medium"
        title={`Érvényes eddig: ${formatDate(expirationDateStr)}`}
      >
        <CheckCircle2 className="h-3 w-3" />
        Még {diffDays} napig érvényes
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
    <div className="space-y-4">
      <Card className="border border-border shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Automatikus banki szinkronizáció
            </CardTitle>
            <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
              Aggreg8
            </Badge>
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
              Valós idejű
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

        {isOwner && (
          <Button
            onClick={startAddBankFlow}
            disabled={isFlowLoading || isSyncing}
            className={cn(
              "font-medium transition-all duration-150 shrink-0",
              (isFlowLoading || isSyncing) && !isAddingBank
                ? "bg-muted text-muted-foreground italic border border-border/50 cursor-not-allowed hover:bg-muted font-normal shadow-none pointer-events-none"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            )}
          >
            {isAddingBank ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Csatlakozás...
              </>
            ) : (
              <>
                <Plus className={cn("h-4 w-4 mr-2", (isFlowLoading || isSyncing) && "opacity-50")} />
                Új bank csatlakoztatása
              </>
            )}
          </Button>
        )}
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
            {isOwner && (
              <Button
                onClick={startAddBankFlow}
                disabled={isFlowLoading || isSyncing}
                variant="outline"
                className={cn(
                  "font-medium transition-all duration-150",
                  (isFlowLoading || isSyncing) && !isAddingBank
                    ? "bg-muted text-muted-foreground italic border border-border/50 cursor-not-allowed hover:bg-muted font-normal shadow-none pointer-events-none"
                    : "border-primary/40 hover:bg-primary/5 text-primary"
                )}
              >
                {isAddingBank ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Csatlakozás...
                  </>
                ) : (
                  <>
                    <Plus className={cn("h-4 w-4 mr-2", (isFlowLoading || isSyncing) && "opacity-50")} />
                    Bank csatlakoztatása most
                  </>
                )}
              </Button>
            )}
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
                        alt={getDisplayBankName(consent.bank_name)}
                        className="h-9 w-9 object-contain rounded-md bg-white p-1 border border-border"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary font-bold">
                        <Landmark className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-base font-semibold text-foreground leading-tight">
                        {getDisplayBankName(consent.bank_name)}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Létrehozva: {formatDate(consent.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getExpirationBadge(consent.passive_sync_expiration_date || consent.active_sync_expiration_date)}
                  </div>
                </div>

                {/* Sub-accounts under this consent */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Csatlakoztatott számlák ({consent.accounts?.length || 0})
                  </div>

                  {consent.accounts && consent.accounts.length > 0 ? (
                    <div className={cn("grid gap-2.5", consent.accounts.length > 1 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
                      {consent.accounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="bg-muted/40 border border-border/50 rounded-lg p-3 sm:p-3.5 space-y-2.5 transition-colors"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">
                              {acc.account_name || 'Folyószámla'}
                            </div>
                            <div className="text-xs font-mono text-muted-foreground truncate">
                              {acc.account_number}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <span>Csatlakoztatva:</span>
                              <span className="font-medium text-foreground/90">
                                {formatDate(acc.created_at)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span title="Automatikusan szinkronizálva az Aggreg8 háttérfolyamata vagy manuális frissítés által">
                                Utolsó szinkronizáció:
                              </span>
                              {acc.last_synced_at ? (
                                <span className="font-medium text-foreground/90">
                                  {formatDateTime(acc.last_synced_at)}
                                </span>
                              ) : (
                                <span className="italic text-muted-foreground/70">Még nem történt</span>
                              )}
                              {typeof acc.last_synced_count === 'number' && acc.last_synced_count > 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                  +{acc.last_synced_count} tétel
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Nincsenek aktív számlák ehhez a kapcsolathoz.</p>
                  )}
                </div>

                {/* Card Actions Footer - Only for Company Owners */}
                {isOwner && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const isThisSyncing = syncingConsentId === consent.info_sharing_consent_id;
                        return (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startOnDemandSync(consent.info_sharing_consent_id)}
                            disabled={isFlowLoading || isSyncing}
                            className={cn(
                              "text-xs h-8 transition-colors duration-150",
                              isThisSyncing && "border-primary/60 text-primary bg-primary/5"
                            )}
                          >
                            <RefreshCw
                              className={cn(
                                "h-3.5 w-3.5 mr-1.5",
                                isThisSyncing && "animate-spin text-primary"
                              )}
                            />
                            {isThisSyncing ? 'Frissítés...' : 'Frissítés most'}
                          </Button>
                        );
                      })()}

                      {(() => {
                        const isThisExtending = extendingConsentId === consent.info_sharing_consent_id;
                        return (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startExtendConsent(consent.info_sharing_consent_id)}
                            disabled={isFlowLoading || isSyncing}
                            className={cn(
                              "text-xs h-8 transition-colors duration-150",
                              isThisExtending && "border-primary/60 text-primary bg-primary/5"
                            )}
                          >
                            <Calendar
                              className={cn(
                                "h-3.5 w-3.5 mr-1.5",
                                isThisExtending && "animate-spin text-primary"
                              )}
                            />
                            {isThisExtending ? 'Megújítás...' : '180 napos megújítás'}
                          </Button>
                        );
                      })()}
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingConsent(consent)}
                      disabled={isFlowLoading || isSyncing}
                      className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors duration-150 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      Kapcsolat bontása
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    {!isOwner && (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Csak a cég tulajdonosa kezelheti a banki integrációt.
        </AlertDescription>
      </Alert>
    )}

    {/* Confirmation Dialog for Revoking Bank Consent */}
    <AlertDialog open={!!deletingConsent} onOpenChange={(open) => !open && setDeletingConsent(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Biztosan bontani szeretnéd ezt a bankkapcsolatot?</AlertDialogTitle>
          <AlertDialogDescription>
            A(z) <span className="font-semibold text-foreground">{getDisplayBankName(deletingConsent?.bank_name)}</span> banki hozzáférési jogosultság visszavonásra kerül. Az automatikus háttérszinkronizáció leáll, a korábban már leszinkronizált tranzakciók viszont megmaradnak a rendszerben.
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
  </div>
  );
}
