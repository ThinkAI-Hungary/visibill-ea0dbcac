import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Mail,
  Send,
  RefreshCw,
  Edit2,
  Trash2,
  Star,
  ShieldCheck,
  PowerOff,
  Power,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CompanyEmailAccount } from '@/hooks/useEmailAccounts';

interface EmailAccountCardProps {
  account: CompanyEmailAccount;
  isOwner: boolean;
  onEdit: (account: CompanyEmailAccount) => void;
  onDelete: (accountId: string) => void;
  onSetDefault: (accountId: string, type: 'smtp' | 'imap' | 'both') => void;
  onTestConnection: (type: 'imap' | 'smtp', accountId: string, config: any) => Promise<any>;
}

export const EmailAccountCard: React.FC<EmailAccountCardProps> = ({
  account,
  isOwner,
  onEdit,
  onDelete,
  onSetDefault,
  onTestConnection,
}) => {
  const [testingImap, setTestingImap] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testAlert, setTestAlert] = useState<{ type: 'imap' | 'smtp'; success: boolean; message: string } | null>(null);

  const getStatusBadge = (status: string | undefined, enabled: boolean) => {
    if (!enabled) {
      return (
        <Badge variant="outline" className="text-[11px] text-muted-foreground border-dashed whitespace-nowrap shrink-0">
          Kikapcsolva
        </Badge>
      );
    }
    switch (status) {
      case 'valid':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50 text-[11px] whitespace-nowrap shrink-0">
            <CheckCircle className="w-3 h-3 mr-1 shrink-0" />
            Aktív
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="text-[11px] whitespace-nowrap shrink-0">
            <XCircle className="w-3 h-3 mr-1 shrink-0" />
            Hiba
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="secondary" className="text-[11px] whitespace-nowrap shrink-0">
            <Clock className="w-3 h-3 mr-1 shrink-0" />
            Tesztelésre vár
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-[11px] whitespace-nowrap shrink-0">{status}</Badge>;
    }
  };

  const handleQuickTestImap = async () => {
    if (!account.imap_host || !account.imap_username) return;
    setTestingImap(true);
    setTestAlert(null);
    try {
      const res = await onTestConnection('imap', account.id, {
        host: account.imap_host,
        port: account.imap_port || 993,
        username: account.imap_username,
        encryption: account.imap_encryption || 'SSL/TLS',
      });
      setTestAlert({ type: 'imap', success: true, message: res.message || 'IMAP kapcsolat sikeres.' });
    } catch (err: any) {
      setTestAlert({ type: 'imap', success: false, message: err.message || 'IMAP tesztelési hiba.' });
    } finally {
      setTestingImap(false);
    }
  };

  const handleQuickTestSmtp = async () => {
    if (!account.smtp_host || !account.smtp_username) return;
    setTestingSmtp(true);
    setTestAlert(null);
    try {
      const res = await onTestConnection('smtp', account.id, {
        host: account.smtp_host,
        port: account.smtp_port || 465,
        username: account.smtp_username,
        encryption: account.smtp_encryption || 'SSL/TLS',
      });
      setTestAlert({ type: 'smtp', success: true, message: res.message || 'SMTP kapcsolat sikeres.' });
    } catch (err: any) {
      setTestAlert({ type: 'smtp', success: false, message: err.message || 'SMTP tesztelési hiba.' });
    } finally {
      setTestingSmtp(false);
    }
  };

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return 'Még nem futott';
    try {
      return new Date(dateStr).toLocaleString('hu-HU');
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <Card className={`transition-all border-border/80 hover:border-primary/30 shadow-sm ${!account.is_active ? 'opacity-70 bg-muted/20' : 'bg-card'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-base tracking-tight">
                {account.name}
              </h4>
              {!account.is_active && (
                <Badge variant="outline" className="text-xs text-muted-foreground font-normal">
                  Inaktív
                </Badge>
              )}
            </div>

            {/* Badges placed below the name */}
            {(account.is_default_smtp || account.is_default_imap) && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {account.is_default_smtp && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs gap-1 py-0.5 font-medium">
                    <Star className="w-3 h-3 fill-primary/30" />
                    Alapértelmezett SMTP
                  </Badge>
                )}
                {account.is_default_imap && (
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs gap-1 py-0.5 font-medium">
                    <Mail className="w-3 h-3" />
                    Alapértelmezett IMAP
                  </Badge>
                )}
              </div>
            )}

            <CardDescription className="text-xs flex items-center gap-3 text-muted-foreground flex-wrap pt-0.5">
              <span>Létrehozva: {new Date(account.created_at).toLocaleDateString('hu-HU')}</span>
              {account.imap_last_synced_at && (
                <span>• Utolsó IMAP szinkron: {formatLastSync(account.imap_last_synced_at)}</span>
              )}
            </CardDescription>
          </div>

          {/* Top Actions */}
          {isOwner && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5"
                onClick={() => onEdit(account)}
              >
                <Edit2 className="w-3.5 h-3.5" />
                Szerkesztés
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <span className="sr-only">Műveletek</span>
                    •••
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!account.is_default_smtp && account.is_smtp_enabled && (
                    <DropdownMenuItem onClick={() => onSetDefault(account.id, 'smtp')}>
                      <Send className="w-3.5 h-3.5 mr-2" />
                      Legyen alapértelmezett kimenő (SMTP)
                    </DropdownMenuItem>
                  )}
                  {!account.is_default_imap && account.is_imap_enabled && (
                    <DropdownMenuItem onClick={() => onSetDefault(account.id, 'imap')}>
                      <Mail className="w-3.5 h-3.5 mr-2" />
                      Legyen alapértelmezett bejövő (IMAP)
                    </DropdownMenuItem>
                  )}
                  {(!account.is_default_smtp || !account.is_default_imap) && (
                    <DropdownMenuItem onClick={() => onSetDefault(account.id, 'both')}>
                      <Star className="w-3.5 h-3.5 mr-2" />
                      Legyen mindenben alapértelmezett
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Fiók törlése
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {/* IMAP & SMTP Status Grid */}
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          {/* IMAP Box */}
          <div className="p-3 rounded-lg bg-muted/40 border border-border/50 space-y-2">
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <span className="font-medium text-foreground flex items-center gap-1.5 whitespace-nowrap">
                <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                Bejövő (IMAP)
              </span>
              {getStatusBadge(account.imap_status, account.is_imap_enabled)}
            </div>

            {account.is_imap_enabled && account.imap_host ? (
              <div className="space-y-1 text-muted-foreground">
                <div className="truncate">
                  <span className="text-foreground/70 font-mono">{account.imap_username}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span>{account.imap_host}:{account.imap_port || 993}</span>
                  <span>({account.imap_encryption})</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-[11px]">Nincs konfigurálva</p>
            )}

            {isOwner && account.is_imap_enabled && account.imap_host && (
              <div className="pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] w-full justify-start text-muted-foreground hover:text-foreground"
                  onClick={handleQuickTestImap}
                  disabled={testingImap}
                >
                  {testingImap ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3 mr-1" />
                  )}
                  IMAP kapcsolat tesztelése
                </Button>
              </div>
            )}
          </div>

          {/* SMTP Box */}
          <div className="p-3 rounded-lg bg-muted/40 border border-border/50 space-y-2">
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <span className="font-medium text-foreground flex items-center gap-1.5 whitespace-nowrap">
                <Send className="w-3.5 h-3.5 text-green-500 shrink-0" />
                Kimenő (SMTP)
              </span>
              {getStatusBadge(account.smtp_status, account.is_smtp_enabled)}
            </div>

            {account.is_smtp_enabled && account.smtp_host ? (
              <div className="space-y-1 text-muted-foreground">
                <div className="truncate">
                  <span className="text-foreground/70 font-mono">{account.smtp_username}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span>{account.smtp_host}:{account.smtp_port || 465}</span>
                  <span>({account.smtp_encryption})</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-[11px]">Nincs konfigurálva</p>
            )}

            {isOwner && account.is_smtp_enabled && account.smtp_host && (
              <div className="pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[11px] w-full justify-start text-muted-foreground hover:text-foreground"
                  onClick={handleQuickTestSmtp}
                  disabled={testingSmtp}
                >
                  {testingSmtp ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3 mr-1" />
                  )}
                  SMTP kapcsolat tesztelése
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Live Test Results Alert */}
        {testAlert && (
          <Alert variant={testAlert.success ? 'default' : 'destructive'} className="py-2 text-xs">
            <div className="flex items-center gap-1.5 font-medium">
              {testAlert.success ? <CheckCircle className="w-3.5 h-3.5 text-green-600" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              <span>{testAlert.type.toUpperCase()}: {testAlert.message}</span>
            </div>
          </Alert>
        )}

        {/* Background error indicators if any */}
        {account.imap_validation_error && account.imap_status === 'error' && (
          <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="break-all">{account.imap_validation_error}</span>
          </div>
        )}
        {account.smtp_validation_error && account.smtp_status === 'error' && (
          <div className="p-2 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span className="break-all">{account.smtp_validation_error}</span>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Delete Confirmation AlertDialog */}
    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Levelező fiók törlése
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 pt-1 text-sm">
            <span>
              Biztosan törölni szeretnéd a(z) <strong className="text-foreground">{account.name}</strong> levelező fiókot?
            </span>
            <span className="block text-xs text-muted-foreground">
              A fiókhoz tartozó IMAP és SMTP konfiguráció, valamint a titkosított jelszavak véglegesen eltávolításra kerülnek a rendszerből.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 pt-2">
          <AlertDialogCancel>Mégse</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => onDelete(account.id)}
          >
            Fiók Törlése
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
};
