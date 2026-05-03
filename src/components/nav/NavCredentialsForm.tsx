import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Shield, Key, RefreshCw, XCircle, Clock, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface NavCredentialsFormProps {
  companyId?: string;
  isOwner?: boolean;
  onCredentialsSaved?: () => void;
}

const NavCredentialsForm: React.FC<NavCredentialsFormProps> = ({ companyId, isOwner = true, onCredentialsSaved }) => {
  const { toast } = useToast();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'pending' | 'valid' | 'invalid' | 'error'>('pending');
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [credentialInfo, setCredentialInfo] = useState<{
    validation_status: string | null;
    last_validated_at: string | null;
    validation_error: string | null;
    software_id: string | null;
    nav_tax_number: string | null;
  } | null>(null);
  
  const [formData, setFormData] = useState({
    nav_username: '',
    nav_password: '',
    nav_tax_number: '',
    nav_sign_key: '',
    nav_exchange_key: '',
    software_dev_name: '',
    software_dev_contact: '',
    is_test_environment: false
  });

  // Track whether component is mounted for cleanup
  const isMountedRef = useRef(true);

  useEffect(() => {
    loadCredentialInfo();
  }, [companyId]);

  // Reset form state when component unmounts (user navigates away)
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Reset to default state on unmount
      setFormData({
        nav_username: '',
        nav_password: '',
        nav_tax_number: '',
        nav_sign_key: '',
        nav_exchange_key: '',
        software_dev_name: '',
        software_dev_contact: '',
        is_test_environment: false
      });
      setValidationStatus('pending');
      setDebugInfo(null);
    };
  }, []);

  const loadCredentialInfo = async () => {
    setInitialLoading(true);
    if (!companyId) {
      setCredentialInfo(null);
      setInitialLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('user_nav_credentials')
        .select('validation_status, last_validated_at, validation_error, software_id, nav_tax_number')
        .eq('company_id', companyId)
        .maybeSingle();
      
      if (!error && data) {
        setCredentialInfo(data);
        setValidationStatus(data.validation_status as any);
      } else {
        setCredentialInfo(null);
      }
    } catch (error) {
      console.error('Error loading credential info:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationStatus('pending');
  };

  const validateForm = () => {
    const errors: string[] = [];
    
    if (!formData.nav_username) errors.push('NAV felhasználónév kötelező');
    if (formData.nav_username && !/^[a-zA-Z0-9]+$/.test(formData.nav_username)) {
      errors.push('Felhasználónév csak betűket és számokat tartalmazhat');
    }
    if (!formData.nav_password) errors.push('NAV jelszó kötelező');
    if (!formData.nav_tax_number.match(/^\d{8}$/)) errors.push('Adószám pontosan 8 számjegy kell legyen');
    if (!formData.nav_sign_key) errors.push('Aláíró kulcs kötelező');
    if (!formData.nav_exchange_key) errors.push('Csere kulcs kötelező');
    
    return errors;
  };

  const handleSave = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      toast({
        title: 'Hiányos adatok',
        description: errors.join(', '),
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    setValidating(true);
    
    // Prepare sanitized payload for debug
    const payload = {
      navUsername: formData.nav_username,
      navTaxNumber: formData.nav_tax_number,
      navSignKey: '***masked***',
      navExchangeKey: '***masked***',
      navPassword: '***masked***',
      softwareDevName: formData.software_dev_name || null,
      softwareDevContact: formData.software_dev_contact || null,
      isTestEnvironment: formData.is_test_environment
    };
    
    try {
      // Get session and explicitly pass Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Step 1: Validate credentials INLINE first (without saving to DB)
      toast({
        title: 'Kapcsolat tesztelése...',
        description: 'NAV API kapcsolat ellenőrzése a mentés előtt...',
      });

      const { data: validationData, error: validationError } = await supabase.functions.invoke('nav-token', {
        body: {
          action: 'validate_credentials_inline',
          credentials: {
            nav_username: formData.nav_username,
            nav_password: formData.nav_password,
            nav_tax_number: formData.nav_tax_number,
            nav_sign_key: formData.nav_sign_key,
            nav_exchange_key: formData.nav_exchange_key,
          }
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      // Store debug info from validation
      setDebugInfo({
        timestamp: new Date().toISOString(),
        payload,
        response: {
          status: validationError ? 'error' : (validationData?.success ? 'success' : 'error'),
          error: validationError?.message || validationData?.error,
          data: validationData ? { ...validationData } : null
        }
      });

      if (validationError) throw new Error(validationError.message);
      if (validationData?.error) throw new Error(validationData.error);

      // If validation failed, do NOT save credentials
      if (!validationData?.success || validationData?.status !== 'valid') {
        setValidationStatus('invalid');
        toast({
          title: 'Sikertelen NAV kapcsolat',
          description: validationData?.message || 'A megadott hitelesítő adatok érvénytelenek. A kapcsolat nem kerül mentésre.',
          variant: 'destructive'
        });
        return;
      }

      // Step 2: Validation succeeded → now save credentials to DB
      const { data, error } = await supabase.functions.invoke('save-credentials', {
        body: {
          navUsername: formData.nav_username,
          navPassword: formData.nav_password,
          navTaxNumber: formData.nav_tax_number,
          navSignKey: formData.nav_sign_key,
          navExchangeKey: formData.nav_exchange_key,
          softwareDevName: formData.software_dev_name || null,
          softwareDevContact: formData.software_dev_contact || null,
          isTestEnvironment: formData.is_test_environment,
          companyId: companyId || null
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      // Check for errors in the save response
      if (error) {
        const errorData = (error as any).context || {};
        const errorMsg = errorData.error || data?.error || error.message;
        const debugId = errorData.debugId || data?.debugId;
        const hint = errorData.hint || data?.hint;
        
        throw new Error(
          `${errorMsg}${hint ? `\n💡 ${hint}` : ''}${debugId ? `\n🔍 Debug ID: ${debugId}` : ''}`
        );
      }
      
      if (data?.error) {
        const debugId = data?.debugId;
        const hint = data?.hint;
        throw new Error(
          `${data.error}${hint ? `\n💡 ${hint}` : ''}${debugId ? `\n🔍 Debug ID: ${debugId}` : ''}`
        );
      }

      // Step 3: Run handleValidate to update DB validation_status and trigger initial sync
      await handleValidate();
      
      toast({
        title: 'Sikeres mentés',
        description: 'NAV hitelesítő adatok sikeresen mentve és validálva.',
      });

      onCredentialsSaved?.();

    } catch (error: any) {
      console.error('Error saving credentials:', error);
      toast({
        title: 'Mentési hiba',
        description: error.message || 'Nem sikerült menteni az adatokat',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setValidating(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      console.log('[NavCredentialsForm] Starting credential validation');
      
      // Get session and explicitly pass Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const { data, error } = await supabase.functions.invoke('nav-token', {
        body: { action: 'validate_credentials', company_id: companyId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });
      console.log('[NavCredentialsForm] nav-token response', { data, error });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const result = data;
      
      if (result.success) {
        setValidationStatus(result.status);
        await loadCredentialInfo(); // Reload credential info
        if (result.status === 'valid') {
          toast({
            title: 'Sikeres validálás',
            description: result.message,
          });
          
          // Trigger 1 year data sync after successful validation
          await triggerInitialSync(session.access_token);
        }
      } else {
        setValidationStatus('error');
        await loadCredentialInfo();
      }

    } catch (error: any) {
      console.error('Validation error:', error);
      setValidationStatus('error');
      toast({
        title: 'Validálási hiba',
        description: error.message || 'Nem sikerült validálni a hitelesítő adatokat',
        variant: 'destructive'
      });
    } finally {
      setValidating(false);
    }
  };

  const triggerInitialSync = async (accessToken: string) => {
    try {
      console.log('[NavCredentialsForm] Triggering 1-month initial sync with full details');
      
      // Calculate date range for 1 month back (30 days)
      const dateTo = new Date();
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - 30);
      
      const dateToStr = dateTo.toISOString().split('T')[0];
      const dateFromStr = dateFrom.toISOString().split('T')[0];
      
      toast({
        title: 'Adatok szinkronizálása',
        description: 'NAV számlák letöltése az elmúlt 30 napra, minden tétellel együtt...',
      });

      let totalOutbound = 0;
      let totalInbound = 0;
      let hasError = false;

      // Sync OUTBOUND invoices
      const { data: outboundData, error: outboundError } = await supabase.functions.invoke('nav-query-outbound-invoices', {
        body: {
          dateFrom: dateFromStr,
          dateTo: dateToStr,
          invoiceDirection: 'OUTBOUND',
          companyId: companyId
        },
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (outboundError || outboundData?.error) {
        console.error('[NavCredentialsForm] OUTBOUND sync failed:', outboundError || outboundData?.error);
        hasError = true;
      } else {
        totalOutbound = outboundData?.totalInvoices || 0;
        console.log('[NavCredentialsForm] OUTBOUND sync complete:', totalOutbound, 'invoices');
      }
      
      // Sync INBOUND invoices
      const { data: inboundData, error: inboundError } = await supabase.functions.invoke('nav-query-outbound-invoices', {
        body: {
          dateFrom: dateFromStr,
          dateTo: dateToStr,
          invoiceDirection: 'INBOUND',
          companyId: companyId
        },
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (inboundError || inboundData?.error) {
        console.error('[NavCredentialsForm] INBOUND sync failed:', inboundError || inboundData?.error);
        hasError = true;
      } else {
        totalInbound = inboundData?.totalInvoices || 0;
        console.log('[NavCredentialsForm] INBOUND sync complete:', totalInbound, 'invoices');
      }

      // Trigger categorization webhook only if we got invoices
      if (!hasError && (totalOutbound > 0 || totalInbound > 0) && companyId) {
        try {
          console.log('[NavCredentialsForm] Triggering categorization webhook for initial sync');
          await supabase.functions.invoke('trigger-nav-categorization', {
            body: {
              companyId: companyId,
              syncType: 'initial'
            },
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });
          console.log('[NavCredentialsForm] Categorization webhook triggered successfully');
        } catch (categorizationError) {
          console.error('[NavCredentialsForm] Categorization webhook failed:', categorizationError);
        }
      }
      
      // Show appropriate toast based on actual results
      if (hasError) {
        toast({
          title: 'Szinkronizálási hiba',
          description: 'Az adatok letöltése részlegesen sikertelen. Próbálja újra később.',
          variant: 'destructive'
        });
      } else if (totalOutbound === 0 && totalInbound === 0) {
        toast({
          title: 'Nincs új adat',
          description: 'Az elmúlt 30 napban nem találhatók NAV számlák.',
        });
      } else {
        toast({
          title: 'Szinkronizálás kész',
          description: `Az elmúlt 30 nap NAV számlái sikeresen letöltve: ${totalOutbound} kimenő, ${totalInbound} bejövő számla.`,
        });
      }
      
    } catch (error: any) {
      console.error('[NavCredentialsForm] Initial sync error:', error);
      toast({
        title: 'Szinkronizálási hiba',
        description: 'Az adatok letöltése részlegesen sikertelen. Próbálja újra később.',
        variant: 'destructive'
      });
    }
  };



  const handleDisconnect = async () => {
    if (!confirm('Biztosan le szeretné választani a NAV API kapcsolatot? Ez törli az összes mentett hitelesítő adatot.')) {
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('delete-nav-credentials', {
        body: { companyId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Sikeres leválasztás",
        description: "A NAV API kapcsolat sikeresen leválasztva.",
      });

      // Reset local state
      setCredentialInfo(null);
      setValidationStatus('pending');
      setFormData({
        nav_username: '',
        nav_password: '',
        nav_tax_number: '',
        nav_sign_key: '',
        nav_exchange_key: '',
        software_dev_name: '',
        software_dev_contact: '',
        is_test_environment: false
      });

      // Notify parent if callback provided
      onCredentialsSaved?.();

    } catch (error: any) {
      console.error('Error disconnecting NAV credentials:', error);
      toast({
        title: "Hiba",
        description: error.message || "Nem sikerült leválasztani a NAV kapcsolatot.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getConnectionStatusCard = () => {
    if (!credentialInfo) return null;

    const isValid = credentialInfo.validation_status === 'valid';
    const isPending = credentialInfo.validation_status === 'pending';
    const isInvalid = credentialInfo.validation_status === 'invalid' || credentialInfo.validation_status === 'error';

    return (
      <Card className={`border-2 ${isValid ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : isInvalid ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'}`}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {isValid && <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />}
              {isPending && <Clock className="w-6 h-6 text-yellow-600 mt-0.5" />}
              {isInvalid && <XCircle className="w-6 h-6 text-red-600 mt-0.5" />}
              
              <div className="flex-1 space-y-2">
                <div>
                  <h3 className="font-semibold text-lg">
                    {isValid && 'Élő NAV Kapcsolat'}
                    {isPending && 'Kapcsolat Ellenőrzése Szükséges'}
                    {isInvalid && 'Nincs NAV Kapcsolat'}
                  </h3>
                  {credentialInfo.last_validated_at && (
                    <p className="text-sm text-muted-foreground">
                      Utolsó ellenőrzés: {new Date(credentialInfo.last_validated_at).toLocaleString('hu-HU')}
                    </p>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {credentialInfo.software_id && (
                    <div>
                      <span className="font-medium">Software ID:</span> {credentialInfo.software_id}
                    </div>
                  )}
                  {credentialInfo.nav_tax_number && (
                    <div>
                      <span className="font-medium">Adószám:</span> {credentialInfo.nav_tax_number}
                    </div>
                  )}
                </div>

                {isInvalid && credentialInfo.validation_error && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Kapcsolati hiba</AlertTitle>
                    <AlertDescription className="text-sm">
                      {credentialInfo.validation_error}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleValidate}
              disabled={validating}
              className="ml-2"
            >
              <RefreshCw className={`w-4 h-4 ${validating ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Loading skeleton
  if (initialLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  // If connection is valid, show only status card and disconnect button
  if (credentialInfo?.validation_status === 'valid') {
    return (
      <div className="space-y-6">
        {getConnectionStatusCard()}
        
        {isOwner ? (
          <Card>
            <CardContent className="pt-6">
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Leválasztás...
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Leválasztás
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Csak a cég tulajdonosa kezelheti a NAV integrációt.
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  // Non-owner: show read-only notice when no valid connection
  if (!isOwner) {
    return (
      <div className="space-y-6">
        {getConnectionStatusCard()}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Csak a cég tulajdonosa kezelheti a NAV integrációt.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {getConnectionStatusCard()}
      
    
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <CardTitle>NAV API Hitelesítő Adatok</CardTitle>
        </div>
        <CardDescription>
          Adja meg a NAV online számla rendszer API hozzáférési adatait
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-1">
            <p>
              Éles NAV API környezet használatához valós NAV technikai felhasználó adatok szükségesek.
            </p>
            <p className="text-sm text-muted-foreground">
              ⚠️ A technikai felhasználóhoz tartozó adószámnak egyeznie kell a NAV-ban regisztrált adatokkal
            </p>
          </AlertDescription>
        </Alert>

        {/* Basic Credentials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="username">NAV Felhasználónév</Label>
            <Input
              id="username"
              type="text"
              value={formData.nav_username}
              onChange={(e) => handleInputChange('nav_username', e.target.value)}
              placeholder="NAV felhasználónév"
            />
          </div>
          
          <div>
            <Label htmlFor="taxNumber">Adószám</Label>
            <Input
              id="taxNumber"
              type="text"
              value={formData.nav_tax_number}
              onChange={(e) => handleInputChange('nav_tax_number', e.target.value)}
              placeholder="12345678"
              maxLength={8}
              className={formData.nav_tax_number && !/^\d{8}$/.test(formData.nav_tax_number) ? 'border-destructive' : ''}
            />
            {formData.nav_tax_number && !/^\d{8}$/.test(formData.nav_tax_number) && (
              <p className="text-xs text-destructive mt-1">Pontosan 8 számjegy szükséges</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="password">NAV Jelszó</Label>
          <Input
            id="password"
            type="password"
            value={formData.nav_password}
            onChange={(e) => handleInputChange('nav_password', e.target.value)}
            placeholder="NAV jelszó"
          />
        </div>

        {/* API Keys */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            <Label className="text-sm font-medium">API Kulcsok</Label>
          </div>
          
          <div>
            <Label htmlFor="signKey">Aláíró Kulcs</Label>
            <Input
              id="signKey"
              type="password"
              value={formData.nav_sign_key}
              onChange={(e) => handleInputChange('nav_sign_key', e.target.value)}
              placeholder="Aláíró kulcs"
            />
          </div>
          
          <div>
            <Label htmlFor="exchangeKey">Csere Kulcs</Label>
            <Input
              id="exchangeKey"
              type="password"
              value={formData.nav_exchange_key}
              onChange={(e) => handleInputChange('nav_exchange_key', e.target.value)}
              placeholder="Csere kulcs"
            />
          </div>
        </div>

        {/* Optional Developer Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="devName">Fejlesztő Név (opcionális)</Label>
            <Input
              id="devName"
              type="text"
              value={formData.software_dev_name}
              onChange={(e) => handleInputChange('software_dev_name', e.target.value)}
              placeholder="Cég/fejlesztő neve"
            />
          </div>
          
          <div>
            <Label htmlFor="devContact">Fejlesztő Elérhetőség (opcionális)</Label>
            <Input
              id="devContact"
              type="email"
              value={formData.software_dev_contact}
              onChange={(e) => handleInputChange('software_dev_contact', e.target.value)}
              placeholder="email@example.com"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={loading || validating}
            className="flex-1"
          >
            {loading && !validating ? 'Mentés...' : validating ? 'Kapcsolat tesztelése...' : 'Tesztelés és Mentés'}
          </Button>
        </div>

        {/* Debug Panel */}
        {debugInfo && (
          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
              className="w-full justify-between"
            >
              <span className="text-sm">🔍 Debug részletek</span>
              <Badge variant="outline" className="ml-2">
                {debugInfo.response.status === 'success' ? '✓' : '✗'}
              </Badge>
            </Button>
            
            {showDebug && (
              <div className="mt-3 p-3 bg-muted rounded-lg space-y-2 text-xs font-mono">
                <div>
                  <strong>Időpont:</strong> {new Date(debugInfo.timestamp).toLocaleString('hu-HU')}
                </div>
                <div>
                  <strong>Státusz:</strong> {debugInfo.response.status}
                </div>
                {debugInfo.response.data?.debugId && (
                  <div>
                    <strong>Debug ID:</strong> {debugInfo.response.data.debugId}
                  </div>
                )}
                <div>
                  <strong>Elküldött adatok:</strong>
                  <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-x-auto">
                    {JSON.stringify(debugInfo.payload, null, 2)}
                  </pre>
                </div>
                {debugInfo.response.error && (
                  <div>
                    <strong className="text-destructive">Hiba:</strong>
                    <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-x-auto">
                      {debugInfo.response.error}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
};

export default NavCredentialsForm;