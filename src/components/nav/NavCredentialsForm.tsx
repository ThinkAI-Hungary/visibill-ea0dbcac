import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, CheckCircle, Shield, Key, RefreshCw, XCircle, Clock, Loader2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';
import { isGroupVatMember } from '@/lib/validationUtils';
import { useTranslation } from 'react-i18next';

interface NavCredentialsFormProps {
  companyId?: string;
  isOwner?: boolean;
  onCredentialsSaved?: () => void;
}

const NavCredentialsForm: React.FC<NavCredentialsFormProps> = ({ companyId, isOwner = true, onCredentialsSaved }) => {
  const { t } = useTranslation(['settings', 'common']);
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
  const [directionalStatus, setDirectionalStatus] = useState<{
    outbound?: {
      status: string;
      completed_at?: string | null;
      created_at?: string;
      error_message?: string | null;
      invoices_fetched?: number | null;
    };
    inbound?: {
      status: string;
      completed_at?: string | null;
      created_at?: string;
      error_message?: string | null;
      invoices_fetched?: number | null;
    };
  }>({});
  const [manualSyncing, setManualSyncing] = useState(false);
  const [companyTaxNumber, setCompanyTaxNumber] = useState<string | null>(null);
  
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
      setCompanyTaxNumber(null);
      setDirectionalStatus({});
      setInitialLoading(false);
      return;
    }
    try {
      const [credRes, compRes, syncLogsRes] = await Promise.all([
        supabase
          .from('user_nav_credentials')
          .select('validation_status, last_validated_at, validation_error, software_id, nav_tax_number')
          .eq('company_id', companyId)
          .maybeSingle(),
        supabase
          .from('companies')
          .select('tax_number')
          .eq('id', companyId)
          .maybeSingle(),
        supabase
          .from('nav_sync_logs')
          .select('invoice_direction, status, error_message, completed_at, created_at, invoices_fetched')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(20)
      ]);
      
      if (!compRes.error && compRes.data?.tax_number) {
        setCompanyTaxNumber(compRes.data.tax_number);
      } else {
        setCompanyTaxNumber(null);
      }

      if (!credRes.error && credRes.data) {
        setCredentialInfo(credRes.data);
        setValidationStatus(credRes.data.validation_status as any);
      } else {
        setCredentialInfo(null);
      }

      if (syncLogsRes.data && syncLogsRes.data.length > 0) {
        const outboundLog = syncLogsRes.data.find((l: any) => l.invoice_direction === 'OUTBOUND');
        const inboundLog = syncLogsRes.data.find((l: any) => l.invoice_direction === 'INBOUND');

        setDirectionalStatus({
          outbound: outboundLog ? {
            status: outboundLog.status,
            completed_at: outboundLog.completed_at || outboundLog.created_at,
            created_at: outboundLog.created_at,
            error_message: outboundLog.error_message,
            invoices_fetched: outboundLog.invoices_fetched
          } : undefined,
          inbound: inboundLog ? {
            status: inboundLog.status,
            completed_at: inboundLog.completed_at || inboundLog.created_at,
            created_at: inboundLog.created_at,
            error_message: inboundLog.error_message,
            invoices_fetched: inboundLog.invoices_fetched
          } : undefined
        });
      } else {
        setDirectionalStatus({});
      }
    } catch (error) {
      reportError({ type: 'api_call', component: 'NavCredentialsForm', action: 'error', message: 'Error loading credential info:', error: error });
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

      // Step 3: Run handleValidate to update DB validation_status
      await handleValidate();

      // Step 4: Trigger initial data sync only on credential save
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        await triggerInitialSync(currentSession.access_token);
      }
      
      toast({
        title: 'Sikeres mentés',
        description: 'NAV hitelesítő adatok sikeresen mentve és validálva.',
      });

      onCredentialsSaved?.();

    } catch (error: any) {
      reportError({ type: 'api_call', component: 'NavCredentialsForm', action: 'error', message: 'Error saving credentials:', error: error });
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
      
      // Get session and explicitly pass Authorization header
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const { data, error } = await supabase.functions.invoke('nav-token', {
        body: { action: 'validate_credentials', company_id: companyId },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

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
        }
      } else {
        setValidationStatus('error');
        await loadCredentialInfo();
      }

    } catch (error: any) {
      reportError({ type: 'api_call', component: 'NavCredentialsForm', action: 'error', message: 'Validation error:', error: error });
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
      // Dynamic sync window: look back to the latest successful sync date (minus 2 days), up to 365 days ago, default 90 days
      const dateTo = new Date();
      const dateFrom = new Date();
      const lastCompletedStr = directionalStatus.inbound?.completed_at || directionalStatus.outbound?.completed_at;
      if (lastCompletedStr) {
        const lastDate = new Date(lastCompletedStr);
        if (!isNaN(lastDate.getTime())) {
          lastDate.setDate(lastDate.getDate() - 2);
          const maxLookback = new Date(dateTo);
          maxLookback.setDate(maxLookback.getDate() - 365);
          const effectiveDate = lastDate < maxLookback ? maxLookback : lastDate;
          dateFrom.setTime(effectiveDate.getTime());
        } else {
          dateFrom.setDate(dateFrom.getDate() - 90);
        }
      } else {
        dateFrom.setDate(dateFrom.getDate() - 90);
      }
      
      const dateToStr = dateTo.toISOString().split('T')[0];
      const dateFromStr = dateFrom.toISOString().split('T')[0];
      
      toast({
        title: 'Adatok szinkronizálása',
        description: `NAV számlák letöltése (${dateFromStr} – ${dateToStr})...`,
      });

      let totalOutbound = 0;
      let totalInbound = 0;
      let outboundErrorMsg: string | null = null;
      let inboundErrorMsg: string | null = null;

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
        outboundErrorMsg = outboundError?.message || outboundData?.error || 'Kimenő lekérdezés sikertelen';
        reportError({ type: 'api_call', component: 'NavCredentialsForm', action: 'error', message: '[NavCredentialsForm] OUTBOUND sync failed:', error: outboundErrorMsg });
      } else {
        totalOutbound = outboundData?.totalInvoices || 0;
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
        inboundErrorMsg = inboundError?.message || inboundData?.error || 'Bejövő lekérdezés sikertelen';
        reportError({ type: 'api_call', component: 'NavCredentialsForm', action: 'error', message: '[NavCredentialsForm] INBOUND sync failed:', error: inboundErrorMsg });
      } else {
        totalInbound = inboundData?.totalInvoices || 0;
      }

      // Trigger categorization webhook only if we got invoices and categorization webhook is configured
      if (!outboundErrorMsg && !inboundErrorMsg && (totalOutbound > 0 || totalInbound > 0) && companyId) {
        try {
          await supabase.functions.invoke('trigger-nav-categorization', {
            body: {
              companyId: companyId,
              syncType: 'initial'
            },
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });
        } catch (categorizationError) {
          reportError({ type: 'api_call', component: 'NavCredentialsForm', action: 'error', message: '[NavCredentialsForm] Categorization webhook failed:', error: categorizationError });
        }
      }
      
      // Reload credential and directional logs
      await loadCredentialInfo();

      // Show appropriate toast based on actual results
      if (outboundErrorMsg && inboundErrorMsg) {
        toast({
          title: 'Szinkronizálási hiba',
          description: `Mindkét irány hibára futott. Bejövő: ${inboundErrorMsg}`,
          variant: 'destructive'
        });
      } else if (inboundErrorMsg) {
        toast({
          title: 'Részleges szinkronizáció',
          description: `Kimenő számlák rendben (${totalOutbound} db), de a bejövő számlák sikertelenek: ${inboundErrorMsg}`,
          variant: 'destructive'
        });
      } else if (outboundErrorMsg) {
        toast({
          title: 'Részleges szinkronizáció',
          description: `Bejövő számlák rendben (${totalInbound} db), de a kimenő számlák sikertelenek: ${outboundErrorMsg}`,
          variant: 'destructive'
        });
      } else if (totalOutbound === 0 && totalInbound === 0) {
        toast({
          title: 'Nincs új adat',
          description: `A megadott időszakban (${dateFromStr} – ${dateToStr}) nem találhatók új NAV számlák.`,
        });
      } else {
        toast({
          title: 'Szinkronizálás kész',
          description: `NAV számlák sikeresen letöltve: ${totalOutbound} kimenő, ${totalInbound} bejövő számla.`,
        });
      }
      
    } catch (error: any) {
      reportError({ type: 'api_call', component: 'NavCredentialsForm', action: 'error', message: '[NavCredentialsForm] Initial sync error:', error: error });
      toast({
        title: 'Szinkronizálási hiba',
        description: error.message || 'Az adatok letöltése sikertelen. Próbálja újra később.',
        variant: 'destructive'
      });
    }
  };

  const handleManualSync = async () => {
    if (!companyId) return;
    setManualSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      await triggerInitialSync(session.access_token);
    } catch (err: any) {
      reportError({ type: 'api_call', component: 'NavCredentialsForm', action: 'error', message: 'Manual sync error:', error: err });
    } finally {
      setManualSyncing(false);
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
      reportError({ type: 'api_call', component: 'NavCredentialsForm', action: 'error', message: 'Error disconnecting NAV credentials:', error: error });
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

    const outboundStatus = directionalStatus.outbound?.status;
    const inboundStatus = directionalStatus.inbound?.status;
    const outboundFailed = outboundStatus === 'failed';
    const inboundFailed = inboundStatus === 'failed';
    const hasDirectionalFailure = isValid && (outboundFailed || inboundFailed);
    const bothFailed = isValid && outboundFailed && inboundFailed;

    return (
      <Card className={`border-2 transition-colors ${
        isValid && !hasDirectionalFailure
          ? 'border-green-500 bg-green-50/60 dark:bg-green-950/20'
          : isValid && hasDirectionalFailure && !bothFailed
          ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20'
          : isInvalid || bothFailed
          ? 'border-red-500 bg-red-50/60 dark:bg-red-950/20'
          : 'border-yellow-500 bg-yellow-50/60 dark:bg-yellow-950/20'
      }`}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {isValid && !hasDirectionalFailure && <CheckCircle className="w-6 h-6 text-green-600 mt-0.5 shrink-0" />}
              {isValid && hasDirectionalFailure && !bothFailed && <AlertTriangle className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />}
              {(isInvalid || bothFailed) && <XCircle className="w-6 h-6 text-red-600 mt-0.5 shrink-0" />}
              {isPending && <Clock className="w-6 h-6 text-yellow-600 mt-0.5 shrink-0" />}
              
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="font-semibold text-lg">
                    {isValid && !hasDirectionalFailure && 'Élő NAV Kapcsolat'}
                    {isValid && hasDirectionalFailure && !bothFailed && 'NAV Kapcsolat: Részleges működés'}
                    {isValid && bothFailed && 'NAV Kapcsolat: Szinkronizáció sikertelen'}
                    {isPending && 'Kapcsolat Ellenőrzése Szükséges'}
                    {isInvalid && 'Nincs NAV Kapcsolat'}
                  </h3>
                  {credentialInfo.last_validated_at && (
                    <p className="text-sm text-muted-foreground">
                      Utolsó token-ellenőrzés: {new Date(credentialInfo.last_validated_at).toLocaleString('hu-HU')}
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

                {/* Irányonkénti szinkronizációs állapot (OUTBOUND / INBOUND) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Kimenő számlák (OUTBOUND) */}
                  <div className={`p-3 rounded-lg border text-xs flex flex-col justify-between space-y-2 ${
                    outboundFailed 
                      ? 'bg-red-100/50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50' 
                      : outboundStatus === 'completed'
                      ? 'bg-green-100/40 dark:bg-green-950/20 border-green-200 dark:border-green-900/50'
                      : 'bg-background/80 border-border'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-medium">
                        <ArrowUpRight className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>Kimenő számlák (OUTBOUND)</span>
                      </div>
                      {outboundFailed ? (
                        <Badge variant="destructive" className="text-[11px] px-2 py-0.5">Sikertelen</Badge>
                      ) : outboundStatus === 'completed' ? (
                        <Badge className="bg-green-600 hover:bg-green-700 text-white text-[11px] px-2 py-0.5">Aktív / Sikeres</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] px-2 py-0.5">Nincs adat</Badge>
                      )}
                    </div>
                    {directionalStatus.outbound?.completed_at && (
                      <div className="text-[11px] text-muted-foreground">
                        Utolsó szinkron: {new Date(directionalStatus.outbound.completed_at).toLocaleString('hu-HU')}
                        {typeof directionalStatus.outbound.invoices_fetched === 'number' && ` (${directionalStatus.outbound.invoices_fetched} számla)`}
                      </div>
                    )}
                    {directionalStatus.outbound?.error_message && (
                      <div className="text-[11px] text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-900/30 p-1.5 rounded font-mono break-words">
                        {directionalStatus.outbound.error_message}
                      </div>
                    )}
                  </div>

                  {/* Bejövő számlák (INBOUND) */}
                  <div className={`p-3 rounded-lg border text-xs flex flex-col justify-between space-y-2 ${
                    inboundFailed 
                      ? 'bg-red-100/50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50' 
                      : inboundStatus === 'completed'
                      ? 'bg-green-100/40 dark:bg-green-950/20 border-green-200 dark:border-green-900/50'
                      : 'bg-background/80 border-border'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-medium">
                        <ArrowDownLeft className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                        <span>Bejövő számlák (INBOUND)</span>
                      </div>
                      {inboundFailed ? (
                        <Badge variant="destructive" className="text-[11px] px-2 py-0.5">Sikertelen</Badge>
                      ) : inboundStatus === 'completed' ? (
                        <Badge className="bg-green-600 hover:bg-green-700 text-white text-[11px] px-2 py-0.5">Aktív / Sikeres</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] px-2 py-0.5">Nincs adat</Badge>
                      )}
                    </div>
                    {directionalStatus.inbound?.completed_at && (
                      <div className="text-[11px] text-muted-foreground">
                        Utolsó szinkron: {new Date(directionalStatus.inbound.completed_at).toLocaleString('hu-HU')}
                        {typeof directionalStatus.inbound.invoices_fetched === 'number' && ` (${directionalStatus.inbound.invoices_fetched} számla)`}
                      </div>
                    )}
                    {directionalStatus.inbound?.error_message && (
                      <div className="text-[11px] text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-900/30 p-1.5 rounded font-mono break-words">
                        {directionalStatus.inbound.error_message}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bejövő számla jogosultsági figyelmeztetés ha hibára fut */}
                {inboundFailed && (
                  <Alert className="mt-2 bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-300/40">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <AlertTitle className="font-semibold text-sm">
                        Bejövő számlák szinkronizálása sikertelen
                      </AlertTitle>
                      <AlertDescription className="text-xs space-y-1 mt-1 leading-relaxed">
                        <p>
                          {directionalStatus.inbound?.error_message?.toLowerCase().includes('forbidden') ||
                           directionalStatus.inbound?.error_message?.toLowerCase().includes('403') ||
                           directionalStatus.inbound?.error_message?.toLowerCase().includes('jogosult') ? (
                            <span>A NAV Online Számla felületén a technikai felhasználó számára <strong>nincs engedélyezve a „Számlák lekérdezése” jogosultság</strong> (HTTP 403 Forbidden).</span>
                          ) : (
                            <span>Hiba: {directionalStatus.inbound?.error_message}</span>
                          )}
                        </p>
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          Megoldás: Lépj be a nav.gov.hu Online Számla felületre az Elsődleges felhasználóval, nyisd meg a Technikai felhasználók listáját, kattints a felhasználóra, és engedélyezd a „Számlák lekérdezése” opciót!
                        </p>
                      </AlertDescription>
                    </div>
                  </Alert>
                )}

                {isGroupVatMember(companyTaxNumber) && (
                  <Alert className="mt-3 bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-300/40">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <AlertTitle className="font-semibold text-sm">
                        {t('settings:integrations.nav.group_vat_warning_title', 'Csoportos ÁFA-alanyiság észlelve')}
                      </AlertTitle>
                      <AlertDescription className="text-xs space-y-1 mt-1 leading-relaxed">
                        <p>
                          {t(
                            'settings:integrations.nav.group_vat_warning_desc_1',
                            'Ez a cég a nyilvántartás szerint csoportos ÁFA-alany tagja (adószám: {{taxNumber}}).',
                            { taxNumber: companyTaxNumber }
                          )}
                        </p>
                        <p>
                          {t(
                            'settings:integrations.nav.group_vat_warning_desc_2',
                            'A csoportos ÁFA szabályai szerint a számlák a Csoport adószámára érkeznek, és a számlázóprogram is a csoportazonosítót jelenti le a NAV felé. Amennyiben a számlák hiányosan szinkronizálódnak, a technikai felhasználót a NAV Online Számla felületén a Csoportos ÁFA-alany (csoportazonosító szám) alatt kell létrehozni és itt bekötni.'
                          )}
                        </p>
                      </AlertDescription>
                    </div>
                  </Alert>
                )}

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
              title="Hitelesítő adatok újratesztelése"
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

  // If connection is valid, show status card, manual sync, and disconnect button
  if (credentialInfo?.validation_status === 'valid') {
    return (
      <div className="space-y-6">
        {getConnectionStatusCard()}
        
        {isOwner ? (
          <Card>
            <CardContent className="pt-6 flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={handleManualSync}
                disabled={loading || validating || manualSyncing}
                className="flex-1"
              >
                {manualSyncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Szinkronizálás folyamatban...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    NAV számlák szinkronizálása most
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={loading || validating || manualSyncing}
                className="flex-1 sm:flex-initial"
              >
                {loading ? (
                  <>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    {t('settings:integrations.nav.disconnecting', 'Leválasztás...')}
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-2 h-4 w-4" />
                    {t('settings:integrations.nav.disconnect', 'Leválasztás')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              {t('settings:integrations.nav.owner_only', 'Csak a cég tulajdonosa kezelheti a NAV integrációt.')}
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
            {t('settings:integrations.nav.owner_only', 'Csak a cég tulajdonosa kezelheti a NAV integrációt.')}
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
          <CardTitle>{t('settings:integrations.nav.credentials_title', 'NAV API Hitelesítő Adatok')}</CardTitle>
        </div>
        <CardDescription>
          {t('settings:integrations.nav.credentials_desc', 'Adja meg a NAV online számla rendszer API hozzáférési adatait')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-1">
            <p>
              {t('settings:integrations.nav.alert_env', 'Éles NAV API környezet használatához valós NAV technikai felhasználó adatok szükségesek.')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('settings:integrations.nav.alert_tax_match', '⚠️ A technikai felhasználóhoz tartozó adószámnak egyeznie kell a NAV-ban regisztrált adatokkal')}
            </p>
          </AlertDescription>
        </Alert>

        {(isGroupVatMember(companyTaxNumber) || isGroupVatMember(formData.nav_tax_number)) && (
          <Alert className="bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-300/40">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <AlertTitle className="font-semibold text-sm">
                {t('settings:integrations.nav.group_vat_form_title', 'Fontos tudnivaló csoportos ÁFA-tagoknak')}
              </AlertTitle>
              <AlertDescription className="text-xs space-y-1 mt-1 leading-relaxed">
                <p>
                  {t(
                    'settings:integrations.nav.group_vat_form_desc_1',
                    'A cég adószáma{{taxInfo}} alapján csoportos ÁFA-alanyiság tagja (4-es ÁFA-kód).',
                    { taxInfo: companyTaxNumber ? ` (${companyTaxNumber})` : '' }
                  )}
                </p>
                <p>
                  {t(
                    'settings:integrations.nav.group_vat_form_desc_2',
                    'A számlák (különösen a kimenő és a beszállítói számlák) zöme a Csoport azonosítójára érkezik a NAV-ba. Kérjük, győződj meg róla, hogy a technikai felhasználót a NAV Online Számla felületén a Csoportos ÁFA-alanyhoz hoztad létre, és annak a csoportos adószámát adod meg itt!'
                  )}
                </p>
              </AlertDescription>
            </div>
          </Alert>
        )}

        {/* Basic Credentials */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="username">{t('settings:integrations.nav.username_label', 'NAV Felhasználónév')}</Label>
            <Input
              id="username"
              type="text"
              value={formData.nav_username}
              onChange={(e) => handleInputChange('nav_username', e.target.value)}
              placeholder={t('settings:integrations.nav.username_placeholder', 'NAV felhasználónév')}
            />
          </div>
          
          <div>
            <Label htmlFor="taxNumber">{t('settings:integrations.nav.tax_number_label', 'Adószám')}</Label>
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
              <p className="text-xs text-destructive mt-1">{t('settings:integrations.nav.tax_number_hint', 'Pontosan 8 számjegy szükséges')}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="password">{t('settings:integrations.nav.password_label', 'NAV Jelszó')}</Label>
          <Input
            id="password"
            type="password"
            value={formData.nav_password}
            onChange={(e) => handleInputChange('nav_password', e.target.value)}
            placeholder={t('settings:integrations.nav.password_placeholder', 'NAV jelszó')}
          />
        </div>

        {/* API Keys */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4" />
            <Label className="text-sm font-medium">{t('settings:integrations.nav.api_keys_label', 'API Kulcsok')}</Label>
          </div>
          
          <div>
            <Label htmlFor="signKey">{t('settings:integrations.nav.sign_key_label', 'Aláíró Kulcs')}</Label>
            <Input
              id="signKey"
              type="password"
              value={formData.nav_sign_key}
              onChange={(e) => handleInputChange('nav_sign_key', e.target.value)}
              placeholder="Aláíró kulcs"
            />
          </div>
          
          <div>
            <Label htmlFor="exchangeKey">{t('settings:integrations.nav.exchange_key_label', 'Csere Kulcs')}</Label>
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
            <Label htmlFor="devName">{t('settings:integrations.nav.dev_name_label', 'Fejlesztő Név (opcionális)')}</Label>
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