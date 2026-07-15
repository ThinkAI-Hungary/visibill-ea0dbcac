import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Clock, AlertTriangle, Loader2, Key, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useEmailSettings } from '@/hooks/useEmailSettings';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';

const EmailSettingsForm: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const isOwner = selectedCompany?.owner_id === user?.id;

  const {
    settings,
    isLoading,
    saveMutation,
    deleteMutation,
    testConnectionMutation,
  } = useEmailSettings();

  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [imapUsername, setImapUsername] = useState('');
  const [imapPassword, setImapPassword] = useState('');
  const [imapEncryption, setImapEncryption] = useState('SSL/TLS');

  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpEncryption, setSmtpEncryption] = useState('SSL/TLS');

  const [imapTesting, setImapTesting] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  
  // Local validation statuses for instant feedback
  const [imapTestResult, setImapTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Sync form states with database settings
  useEffect(() => {
    if (settings) {
      setImapHost(settings.imap_host || '');
      setImapPort(settings.imap_port ? String(settings.imap_port) : '993');
      setImapUsername(settings.imap_username || '');
      setImapPassword(settings.imap_password_secret_id ? '***masked***' : '');
      setImapEncryption(settings.imap_encryption || 'SSL/TLS');

      setSmtpHost(settings.smtp_host || '');
      setSmtpPort(settings.smtp_port ? String(settings.smtp_port) : '465');
      setSmtpUsername(settings.smtp_username || '');
      setSmtpPassword(settings.smtp_password_secret_id ? '***masked***' : '');
      setSmtpEncryption(settings.smtp_encryption || 'SSL/TLS');
    } else {
      // Clear form if no settings
      setImapHost('');
      setImapPort('993');
      setImapUsername('');
      setImapPassword('');
      setImapEncryption('SSL/TLS');

      setSmtpHost('');
      setSmtpPort('465');
      setSmtpUsername('');
      setSmtpPassword('');
      setSmtpEncryption('SSL/TLS');
    }
    setImapTestResult(null);
    setSmtpTestResult(null);
  }, [settings]);

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Beállítások betöltése...</span>
        </div>
      </div>
    );
  }

  const handleTestImap = async () => {
    if (!imapHost || !imapUsername || (!imapPassword && !settings?.imap_password_secret_id)) {
      setImapTestResult({ success: false, message: 'IMAP host, felhasználónév és jelszó megadása kötelező a teszteléshez.' });
      return;
    }
    
    setImapTesting(true);
    setImapTestResult(null);
    
    try {
      const res = await testConnectionMutation.mutateAsync({
        type: 'imap',
        config: {
          host: imapHost,
          port: parseInt(imapPort),
          username: imapUsername,
          password: imapPassword,
          encryption: imapEncryption
        }
      });
      setImapTestResult({ success: true, message: res.message || 'Kapcsolat sikeres.' });
    } catch (err: any) {
      setImapTestResult({ success: false, message: err.message || 'IMAP kapcsolódási hiba.' });
    } finally {
      setImapTesting(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!smtpHost || !smtpUsername || (!smtpPassword && !settings?.smtp_password_secret_id)) {
      setSmtpTestResult({ success: false, message: 'SMTP host, felhasználónév és jelszó megadása kötelező a teszteléshez.' });
      return;
    }
    
    setSmtpTesting(true);
    setSmtpTestResult(null);
    
    try {
      const res = await testConnectionMutation.mutateAsync({
        type: 'smtp',
        config: {
          host: smtpHost,
          port: parseInt(smtpPort),
          username: smtpUsername,
          password: smtpPassword,
          encryption: smtpEncryption
        }
      });
      setSmtpTestResult({ success: true, message: res.message || 'Kapcsolat sikeres.' });
    } catch (err: any) {
      setSmtpTestResult({ success: false, message: err.message || 'SMTP kapcsolódási hiba.' });
    } finally {
      setSmtpTesting(false);
    }
  };

  const handleSave = async () => {
    // Basic validation
    if (imapHost && (!imapPort || !imapUsername || !imapPassword)) {
      setImapTestResult({ success: false, message: 'IMAP beállításoknál minden mező kötelező.' });
      return;
    }
    if (smtpHost && (!smtpPort || !smtpUsername || !smtpPassword)) {
      setSmtpTestResult({ success: false, message: 'SMTP beállításoknál minden mező kötelező.' });
      return;
    }

    await saveMutation.mutateAsync({
      imap_host: imapHost,
      imap_port: parseInt(imapPort) || 0,
      imap_username: imapUsername,
      imap_password: imapPassword,
      imap_encryption: imapEncryption,
      smtp_host: smtpHost,
      smtp_port: parseInt(smtpPort) || 0,
      smtp_username: smtpUsername,
      smtp_password: smtpPassword,
      smtp_encryption: smtpEncryption,
    });
  };

  const handleDisconnect = async () => {
    if (window.confirm('Biztosan le szeretné választani a saját levelező szervert? Ez törli a mentett SMTP/IMAP adatokat.')) {
      await deleteMutation.mutateAsync();
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    switch (status) {
      case 'valid':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800/50"><CheckCircle className="w-3.5 h-3.5 mr-1" />Aktív</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3.5 h-3.5 mr-1" />Hiba</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3.5 h-3.5 mr-1" />Tesztelésre vár</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {settings && (
        <Card className="border-green-500 bg-green-50/30 dark:bg-green-950/10">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="space-y-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  Saját levelező szerver csatlakoztatva
                </h3>
                <p className="text-sm text-muted-foreground">
                  A saját levelező kiszolgálók beállításai érvényesek. A számlák szinkronizálása és az e-mailek küldése a saját fiókodon keresztül történik.
                </p>
                <div className="flex gap-4 flex-wrap pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">IMAP Státusz:</span>
                    {getStatusBadge(settings.imap_status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">SMTP Státusz:</span>
                    {getStatusBadge(settings.smtp_status)}
                  </div>
                </div>
              </div>
              {isOwner && (
                <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={deleteMutation.isPending} className="border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
                  Leválasztás
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6 items-stretch">
        {/* IMAP Card */}
        <Card className="border-primary/10 flex flex-col h-full">
          <CardHeader className="min-h-[95px] flex flex-col justify-start space-y-1.5 pb-3">
            <CardTitle className="text-lg flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span>IMAP Beállítások</span>
                <Badge variant="secondary" className="text-xs font-normal bg-muted text-muted-foreground border-none">Bejövő</Badge>
              </div>
              {settings?.imap_host && getStatusBadge(settings.imap_status)}
            </CardTitle>
            <CardDescription>Számlák automatikus letöltése a postaládádból</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between space-y-6 pt-2">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="imap-host">IMAP Szerver / IP</Label>
                  <Input
                    id="imap-host"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    placeholder="imap.gmail.com"
                    disabled={!isOwner}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imap-port">Port</Label>
                  <Input
                    id="imap-port"
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                    placeholder="993"
                    disabled={!isOwner}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="imap-user">Felhasználónév</Label>
                <Input
                  id="imap-user"
                  value={imapUsername}
                  onChange={(e) => setImapUsername(e.target.value)}
                  placeholder="username@domain.com"
                  disabled={!isOwner}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imap-pass">Jelszó</Label>
                <Input
                  id="imap-pass"
                  type="password"
                  value={imapPassword}
                  onChange={(e) => setImapPassword(e.target.value)}
                  placeholder={settings?.imap_password_secret_id ? '••••••••••••' : 'Jelszó'}
                  disabled={!isOwner}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imap-encrypt">Titkosítás</Label>
                <Select value={imapEncryption} onValueChange={setImapEncryption} disabled={!isOwner}>
                  <SelectTrigger id="imap-encrypt">
                    <SelectValue placeholder="Válassz titkosítást" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SSL/TLS">SSL/TLS</SelectItem>
                    <SelectItem value="STARTTLS">STARTTLS</SelectItem>
                    <SelectItem value="NONE">Nincs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              {imapTestResult && (
                <Alert variant={imapTestResult.success ? 'default' : 'destructive'} className={imapTestResult.success ? 'border-green-200 bg-green-50/50 dark:bg-green-950/10' : ''}>
                  <AlertTitle className="text-sm font-semibold flex items-center gap-1.5">
                    {imapTestResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    {imapTestResult.success ? 'Sikeres kapcsolat' : 'Kapcsolódási hiba'}
                  </AlertTitle>
                  <AlertDescription className="text-xs break-words">{imapTestResult.message}</AlertDescription>
                </Alert>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full mt-auto"
                onClick={handleTestImap}
                disabled={imapTesting || !isOwner}
              >
                {imapTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Kapcsolódás...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    IMAP Kapcsolat Tesztelése
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* SMTP Card */}
        <Card className="border-primary/10 flex flex-col h-full">
          <CardHeader className="min-h-[95px] flex flex-col justify-start space-y-1.5 pb-3">
            <CardTitle className="text-lg flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span>SMTP Beállítások</span>
                <Badge variant="secondary" className="text-xs font-normal bg-muted text-muted-foreground border-none">Kimenő</Badge>
              </div>
              {settings?.smtp_host && getStatusBadge(settings.smtp_status)}
            </CardTitle>
            <CardDescription>E-mailek küldése a saját fiókod nevében</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between space-y-6 pt-2">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="smtp-host">SMTP Szerver / IP</Label>
                  <Input
                    id="smtp-host"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    disabled={!isOwner}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">Port</Label>
                  <Input
                    id="smtp-port"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="465"
                    disabled={!isOwner}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-user">Felhasználónév</Label>
                <Input
                  id="smtp-user"
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                  placeholder="username@domain.com"
                  disabled={!isOwner}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-pass">Jelszó</Label>
                <Input
                  id="smtp-pass"
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder={settings?.smtp_password_secret_id ? '••••••••••••' : 'Jelszó'}
                  disabled={!isOwner}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtp-encrypt">Titkosítás</Label>
                <Select value={smtpEncryption} onValueChange={setSmtpEncryption} disabled={!isOwner}>
                  <SelectTrigger id="smtp-encrypt">
                    <SelectValue placeholder="Válassz titkosítást" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SSL/TLS">SSL/TLS</SelectItem>
                    <SelectItem value="STARTTLS">STARTTLS</SelectItem>
                    <SelectItem value="NONE">Nincs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              {smtpTestResult && (
                <Alert variant={smtpTestResult.success ? 'default' : 'destructive'} className={smtpTestResult.success ? 'border-green-200 bg-green-50/50 dark:bg-green-950/10' : ''}>
                  <AlertTitle className="text-sm font-semibold flex items-center gap-1.5">
                    {smtpTestResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    {smtpTestResult.success ? 'Sikeres kapcsolat' : 'Kapcsolódási hiba'}
                  </AlertTitle>
                  <AlertDescription className="text-xs break-words">{smtpTestResult.message}</AlertDescription>
                </Alert>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full mt-auto"
                onClick={handleTestSmtp}
                disabled={smtpTesting || !isOwner}
              >
                {smtpTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Kapcsolódás...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    SMTP Kapcsolat Tesztelése
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {isOwner && (
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="px-6"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Mentés...
              </>
            ) : (
              'Beállítások Mentése'
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default EmailSettingsForm;
