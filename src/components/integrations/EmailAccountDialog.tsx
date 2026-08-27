import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, AlertTriangle, Loader2, RefreshCw, Mail, Send, Settings2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CompanyEmailAccount, SaveEmailAccountForm } from '@/hooks/useEmailAccounts';

interface EmailAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: CompanyEmailAccount | null;
  onSave: (form: SaveEmailAccountForm) => Promise<void>;
  onTestConnection: (type: 'imap' | 'smtp', accountId?: string, config?: any) => Promise<any>;
  isSaving: boolean;
}

export const EmailAccountDialog: React.FC<EmailAccountDialogProps> = ({
  open,
  onOpenChange,
  account,
  onSave,
  onTestConnection,
  isSaving,
}) => {
  const [activeTab, setActiveTab] = useState<'imap' | 'smtp'>('imap');

  // General settings
  const [name, setName] = useState('Alapértelmezett fiók');
  const [isActive, setIsActive] = useState(true);
  const [isDefaultSmtp, setIsDefaultSmtp] = useState(false);
  const [isDefaultImap, setIsDefaultImap] = useState(false);

  // IMAP settings
  const [isImapEnabled, setIsImapEnabled] = useState(true);
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [imapUsername, setImapUsername] = useState('');
  const [imapPassword, setImapPassword] = useState('');
  const [imapEncryption, setImapEncryption] = useState('SSL/TLS');

  // SMTP settings
  const [isSmtpEnabled, setIsSmtpEnabled] = useState(true);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpEncryption, setSmtpEncryption] = useState('SSL/TLS');

  // Live test states
  const [testingImap, setTestingImap] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [imapTestResult, setImapTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (account) {
      setName(account.name || 'Levelező fiók');
      setIsActive(account.is_active ?? true);
      setIsDefaultSmtp(account.is_default_smtp ?? false);
      setIsDefaultImap(account.is_default_imap ?? false);

      setIsImapEnabled(account.is_imap_enabled ?? true);
      setImapHost(account.imap_host || '');
      setImapPort(account.imap_port ? String(account.imap_port) : '993');
      setImapUsername(account.imap_username || '');
      setImapPassword(account.imap_password_secret_id ? '***masked***' : '');
      setImapEncryption(account.imap_encryption || 'SSL/TLS');

      setIsSmtpEnabled(account.is_smtp_enabled ?? true);
      setSmtpHost(account.smtp_host || '');
      setSmtpPort(account.smtp_port ? String(account.smtp_port) : '465');
      setSmtpUsername(account.smtp_username || '');
      setSmtpPassword(account.smtp_password_secret_id ? '***masked***' : '');
      setSmtpEncryption(account.smtp_encryption || 'SSL/TLS');
    } else {
      setName('');
      setIsActive(true);
      setIsDefaultSmtp(false);
      setIsDefaultImap(false);

      setIsImapEnabled(true);
      setImapHost('');
      setImapPort('993');
      setImapUsername('');
      setImapPassword('');
      setImapEncryption('SSL/TLS');

      setIsSmtpEnabled(true);
      setSmtpHost('');
      setSmtpPort('465');
      setSmtpUsername('');
      setSmtpPassword('');
      setSmtpEncryption('SSL/TLS');
    }
    setImapTestResult(null);
    setSmtpTestResult(null);
  }, [account, open]);

  const handleTestImap = async () => {
    if (!imapHost || !imapUsername || (!imapPassword && !account?.imap_password_secret_id)) {
      setImapTestResult({ success: false, message: 'IMAP host, felhasználónév és jelszó megadása kötelező a teszteléshez.' });
      return;
    }

    setTestingImap(true);
    setImapTestResult(null);

    try {
      const res = await onTestConnection('imap', account?.id, {
        host: imapHost,
        port: parseInt(imapPort) || 993,
        username: imapUsername,
        password: imapPassword,
        encryption: imapEncryption,
      });
      setImapTestResult({ success: true, message: res.message || 'IMAP kapcsolat sikeres.' });
    } catch (err: any) {
      setImapTestResult({ success: false, message: err.message || 'IMAP kapcsolódási hiba.' });
    } finally {
      setTestingImap(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!smtpHost || !smtpUsername || (!smtpPassword && !account?.smtp_password_secret_id)) {
      setSmtpTestResult({ success: false, message: 'SMTP host, felhasználónév és jelszó megadása kötelező a teszteléshez.' });
      return;
    }

    setTestingSmtp(true);
    setSmtpTestResult(null);

    try {
      const res = await onTestConnection('smtp', account?.id, {
        host: smtpHost,
        port: parseInt(smtpPort) || 465,
        username: smtpUsername,
        password: smtpPassword,
        encryption: smtpEncryption,
      });
      setSmtpTestResult({ success: true, message: res.message || 'SMTP kapcsolat sikeres.' });
    } catch (err: any) {
      setSmtpTestResult({ success: false, message: err.message || 'SMTP kapcsolódási hiba.' });
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isImapEnabled && imapHost && (!imapPort || !imapUsername || (!imapPassword && !account?.imap_password_secret_id))) {
      setImapTestResult({ success: false, message: 'IMAP engedélyezése esetén a host, port, felhasználónév és jelszó kötelező.' });
      setActiveTab('imap');
      return;
    }

    if (isSmtpEnabled && smtpHost && (!smtpPort || !smtpUsername || (!smtpPassword && !account?.smtp_password_secret_id))) {
      setSmtpTestResult({ success: false, message: 'SMTP engedélyezése esetén a host, port, felhasználónév és jelszó kötelező.' });
      setActiveTab('smtp');
      return;
    }

    await onSave({
      id: account?.id,
      name: name.trim() || 'Levelező fiók',
      is_active: isActive,
      is_default_smtp: isDefaultSmtp,
      is_default_imap: isDefaultImap,
      is_imap_enabled: isImapEnabled,
      imap_host: isImapEnabled ? imapHost : '',
      imap_port: parseInt(imapPort) || 993,
      imap_username: isImapEnabled ? imapUsername : '',
      imap_password: imapPassword,
      imap_encryption: imapEncryption,
      is_smtp_enabled: isSmtpEnabled,
      smtp_host: isSmtpEnabled ? smtpHost : '',
      smtp_port: parseInt(smtpPort) || 465,
      smtp_username: isSmtpEnabled ? smtpUsername : '',
      smtp_password: smtpPassword,
      smtp_encryption: smtpEncryption,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            {account ? 'Levelező fiók szerkesztése' : 'Új levelező fiók hozzáadása'}
          </DialogTitle>
          <DialogDescription>
            Konfiguráld a bejövő (IMAP) és kimenő (SMTP) levelező kiszolgáló adatait.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Profile Name & Toggles */}
          <div className="p-4 rounded-lg bg-muted/40 border space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account-name">Fiók elnevezése</Label>
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="pl. Pénzügyi számlafiók, Ügyfélszolgálat"
                required
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-4 pt-1">
              <div className="flex items-center justify-between gap-2 p-2.5 rounded bg-background border">
                <Label htmlFor="toggle-active" className="text-xs cursor-pointer">Fiók aktív</Label>
                <Switch id="toggle-active" checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="flex items-center justify-between gap-2 p-2.5 rounded bg-background border">
                <Label htmlFor="toggle-def-smtp" className="text-xs cursor-pointer">Alapértelmezett SMTP</Label>
                <Switch id="toggle-def-smtp" checked={isDefaultSmtp} onCheckedChange={setIsDefaultSmtp} />
              </div>

              <div className="flex items-center justify-between gap-2 p-2.5 rounded bg-background border">
                <Label htmlFor="toggle-def-imap" className="text-xs cursor-pointer">Alapértelmezett IMAP</Label>
                <Switch id="toggle-def-imap" checked={isDefaultImap} onCheckedChange={setIsDefaultImap} />
              </div>
            </div>
          </div>

          {/* Protocols Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'imap' | 'smtp')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="imap" className="gap-2">
                <Mail className="w-4 h-4 text-blue-500" />
                Bejövő (IMAP)
              </TabsTrigger>
              <TabsTrigger value="smtp" className="gap-2">
                <Send className="w-4 h-4 text-green-500" />
                Kimenő (SMTP)
              </TabsTrigger>
            </TabsList>

            {/* IMAP Tab */}
            <TabsContent value="imap" className="space-y-4 pt-4">
              <div className="flex items-center justify-between p-2.5 rounded bg-muted/30 border">
                <Label htmlFor="enable-imap" className="text-sm font-medium cursor-pointer">
                  IMAP szinkronizáció bekapcsolása ezen a fiókon
                </Label>
                <Switch id="enable-imap" checked={isImapEnabled} onCheckedChange={setIsImapEnabled} />
              </div>

              {isImapEnabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="imap-host">IMAP Szerver / Host</Label>
                      <Input
                        id="imap-host"
                        value={imapHost}
                        onChange={(e) => setImapHost(e.target.value)}
                        placeholder="imap.gmail.com"
                        required={isImapEnabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imap-port">Port</Label>
                      <Input
                        id="imap-port"
                        value={imapPort}
                        onChange={(e) => setImapPort(e.target.value)}
                        placeholder="993"
                        required={isImapEnabled}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="imap-user">Felhasználónév (Email)</Label>
                    <Input
                      id="imap-user"
                      value={imapUsername}
                      onChange={(e) => setImapUsername(e.target.value)}
                      placeholder="user@ceg.hu"
                      required={isImapEnabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="imap-pass">Jelszó / App Password</Label>
                    <Input
                      id="imap-pass"
                      type="password"
                      value={imapPassword}
                      onChange={(e) => setImapPassword(e.target.value)}
                      placeholder={account?.imap_password_secret_id ? '•••••••••••• (Változatlan)' : 'Jelszó'}
                      required={isImapEnabled && !account?.imap_password_secret_id}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="imap-encrypt">Titkosítás</Label>
                    <Select value={imapEncryption} onValueChange={setImapEncryption}>
                      <SelectTrigger id="imap-encrypt">
                        <SelectValue placeholder="Titkosítás" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SSL/TLS">SSL/TLS (Port 993)</SelectItem>
                        <SelectItem value="STARTTLS">STARTTLS (Port 143)</SelectItem>
                        <SelectItem value="NONE">Nincs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {imapTestResult && (
                    <Alert variant={imapTestResult.success ? 'default' : 'destructive'} className={imapTestResult.success ? 'border-green-200 bg-green-50/50 dark:bg-green-950/10' : ''}>
                      <AlertTitle className="text-xs font-semibold flex items-center gap-1.5">
                        {imapTestResult.success ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                        {imapTestResult.success ? 'Sikeres IMAP kapcsolat' : 'IMAP kapcsolódási hiba'}
                      </AlertTitle>
                      <AlertDescription className="text-xs">{imapTestResult.message}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleTestImap}
                    disabled={testingImap}
                  >
                    {testingImap ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        Kapcsolódás...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-2" />
                        IMAP Kapcsolat Tesztelése
                      </>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* SMTP Tab */}
            <TabsContent value="smtp" className="space-y-4 pt-4">
              <div className="flex items-center justify-between p-2.5 rounded bg-muted/30 border">
                <Label htmlFor="enable-smtp" className="text-sm font-medium cursor-pointer">
                  SMTP küldés bekapcsolása ezen a fiókon
                </Label>
                <Switch id="enable-smtp" checked={isSmtpEnabled} onCheckedChange={setIsSmtpEnabled} />
              </div>

              {isSmtpEnabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="smtp-host">SMTP Szerver / Host</Label>
                      <Input
                        id="smtp-host"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.gmail.com"
                        required={isSmtpEnabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-port">Port</Label>
                      <Input
                        id="smtp-port"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        placeholder="465"
                        required={isSmtpEnabled}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-user">Felhasználónév (Email)</Label>
                    <Input
                      id="smtp-user"
                      value={smtpUsername}
                      onChange={(e) => setSmtpUsername(e.target.value)}
                      placeholder="user@ceg.hu"
                      required={isSmtpEnabled}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-pass">Jelszó / App Password</Label>
                    <Input
                      id="smtp-pass"
                      type="password"
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder={account?.smtp_password_secret_id ? '•••••••••••• (Változatlan)' : 'Jelszó'}
                      required={isSmtpEnabled && !account?.smtp_password_secret_id}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-encrypt">Titkosítás</Label>
                    <Select value={smtpEncryption} onValueChange={setSmtpEncryption}>
                      <SelectTrigger id="smtp-encrypt">
                        <SelectValue placeholder="Titkosítás" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SSL/TLS">SSL/TLS (Port 465)</SelectItem>
                        <SelectItem value="STARTTLS">STARTTLS (Port 587)</SelectItem>
                        <SelectItem value="NONE">Nincs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {smtpTestResult && (
                    <Alert variant={smtpTestResult.success ? 'default' : 'destructive'} className={smtpTestResult.success ? 'border-green-200 bg-green-50/50 dark:bg-green-950/10' : ''}>
                      <AlertTitle className="text-xs font-semibold flex items-center gap-1.5">
                        {smtpTestResult.success ? <CheckCircle className="h-3.5 w-3.5 text-green-600" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                        {smtpTestResult.success ? 'Sikeres SMTP kapcsolat' : 'SMTP kapcsolódási hiba'}
                      </AlertTitle>
                      <AlertDescription className="text-xs">{smtpTestResult.message}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleTestSmtp}
                    disabled={testingSmtp}
                  >
                    {testingSmtp ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        Kapcsolódás...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-2" />
                        SMTP Kapcsolat Tesztelése
                      </>
                    )}
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Mégse
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mentés...
                </>
              ) : (
                'Fiók Mentése'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
