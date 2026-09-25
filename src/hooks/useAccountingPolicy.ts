import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import type { 
  CompanyAccountingPolicy, 
  CompanyAccountingRule, 
  AccountingRuleCategory 
} from '@/types/accountingPolicy';

export function useAccountingPolicy(companyId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKeyPolicies = ['accounting-policies', companyId];
  const queryKeyRules = ['accounting-rules', companyId];

  // 1. Fetch policies for company
  const { 
    data: policies = [], 
    isLoading: policiesLoading,
    refetch: refetchPolicies 
  } = useQuery({
    queryKey: queryKeyPolicies,
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_accounting_policies' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('version', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as CompanyAccountingPolicy[];
    },
    enabled: !!companyId && !!user,
  });

  // 2. Fetch all rules for company
  const { 
    data: allRules = [], 
    isLoading: rulesLoading,
    refetch: refetchRules 
  } = useQuery({
    queryKey: queryKeyRules,
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('company_accounting_rules' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as CompanyAccountingRule[];
    },
    enabled: !!companyId && !!user,
  });

  const activePolicy = policies.find(p => p.is_active) || null;
  const latestPolicy = policies[0] || null;

  // Active rules in effect
  const activeRules = allRules.filter(r => r.status === 'active');

  // Rules for the latest/active policy
  const currentPolicyRules = latestPolicy 
    ? allRules.filter(r => r.policy_id === latestPolicy.id)
    : activeRules;

  // Helper: get rules by category
  const getRulesByCategory = (category: AccountingRuleCategory, policyId?: string) => {
    const targetRules = policyId 
      ? allRules.filter(r => r.policy_id === policyId)
      : currentPolicyRules;
    return targetRules.filter(r => r.rule_category === category);
  };

  // 3. Upload & Trigger Processing Mutation
  const uploadPolicyMutation = useMutation({
    mutationFn: async ({ file, text }: { file: File; text?: string }) => {
      if (!companyId || !user) throw new Error('Cég vagy felhasználó nincs kiválasztva');

      // Sanitize file name
      const safeName = file.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      
      const storagePath = `${companyId}/${Date.now()}_${safeName}`;

      // A) Upload to storage bucket
      const { error: uploadErr } = await supabase.storage
        .from('accounting_policies')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        });

      if (uploadErr) {
        throw new Error(`Fájlfeltöltési hiba: ${uploadErr.message}`);
      }

      // Calculate next version number
      const highestVersion = policies.reduce((max, p) => Math.max(max, p.version || 0), 0);
      const nextVersion = highestVersion + 1;

      // B) Insert DB record
      const { data: newPolicy, error: dbErr } = await supabase
        .from('company_accounting_policies' as any)
        .insert({
          company_id: companyId,
          version: nextVersion,
          file_name: file.name,
          file_path: storagePath,
          file_size: file.size,
          file_type: file.type || (file.name.endsWith('.docx') ? 'docx' : 'application/pdf'),
          status: 'uploaded',
          uploaded_by: user.id,
          is_active: false,
        })
        .select()
        .single();

      if (dbErr || !newPolicy) {
        throw new Error(`Adatbázis rögzítési hiba: ${dbErr?.message}`);
      }

      const policyRecord = newPolicy as unknown as CompanyAccountingPolicy;

      // C) Invoke Edge Function to process document
      try {
        const { data: efData, error: efErr } = await supabase.functions.invoke('process-accounting-policy', {
          body: {
            policyId: policyRecord.id,
            extractedText: text || undefined,
          },
        });

        if (efErr) {
          console.warn('Edge function invoke error, policy saved:', efErr);
        }

        return { policy: policyRecord, efResult: efData };
      } catch (procErr: any) {
        console.warn('Processing call warning:', procErr);
        return { policy: policyRecord, error: procErr.message };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeyPolicies });
      queryClient.invalidateQueries({ queryKey: queryKeyRules });
      toast({
        title: 'Számviteli politika feltöltve',
        description: 'A dokumentum feldolgozása elindult, a szabályok kinyerése folyamatban.',
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Hiba a feltöltés során',
        description: err.message || 'Nem sikerült a számviteli politika feltöltése.',
      });
    },
  });

  // 4. Trigger reprocessing
  const processPolicyMutation = useMutation({
    mutationFn: async ({ policyId, text }: { policyId: string; text?: string }) => {
      const { data, error } = await supabase.functions.invoke('process-accounting-policy', {
        body: { policyId, extractedText: text },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeyPolicies });
      queryClient.invalidateQueries({ queryKey: queryKeyRules });
      toast({
        title: 'Feldolgozás befejezve',
        description: 'A szabályok sikeresen kinyerve a dokumentumból.',
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Feldolgozási hiba',
        description: err.message || 'Nem sikerült kinyerni a szabályokat.',
      });
    },
  });

  // 5. Activate Policy & Confirm Rules
  const activatePolicyMutation = useMutation({
    mutationFn: async (policyId: string) => {
      const { error } = await supabase.rpc('activate_company_accounting_policy' as any, {
        p_policy_id: policyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeyPolicies });
      queryClient.invalidateQueries({ queryKey: queryKeyRules });
      toast({
        title: 'Szabályok élesítve',
        description: 'A számviteli politika és szabályai aktívvá váltak a cég könyvelésében.',
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Hiba az élesítés során',
        description: err.message || 'Nem sikerült élesíteni a szabályzatot.',
      });
    },
  });

  // 6. Update single rule
  const updateRuleMutation = useMutation({
    mutationFn: async ({ 
      ruleId, 
      ruleValue, 
      status 
    }: { 
      ruleId: string; 
      ruleValue?: Record<string, any>; 
      status?: 'draft' | 'active' | 'inactive' 
    }) => {
      const updates: any = {
        updated_at: new Date().toISOString(),
        user_overridden: true,
      };
      if (ruleValue !== undefined) updates.rule_value = ruleValue;
      if (status !== undefined) updates.status = status;

      const { error } = await supabase
        .from('company_accounting_rules' as any)
        .update(updates)
        .eq('id', ruleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeyRules });
      toast({
        title: 'Szabály módosítva',
        description: 'A szabály beállítása sikeresen frissítve.',
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Hiba a mentéskor',
        description: err.message,
      });
    },
  });

  // 7. Delete Policy
  const deletePolicyMutation = useMutation({
    mutationFn: async (policy: CompanyAccountingPolicy) => {
      // Remove file from storage
      if (policy.file_path) {
        await supabase.storage
          .from('accounting_policies')
          .remove([policy.file_path])
          .catch((e) => console.warn('Storage delete warning:', e));
      }

      // Delete DB record (cascade deletes rules)
      const { error } = await supabase
        .from('company_accounting_policies' as any)
        .delete()
        .eq('id', policy.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeyPolicies });
      queryClient.invalidateQueries({ queryKey: queryKeyRules });
      toast({
        title: 'Szabályzat törölve',
        description: 'A számviteli politika sikeresen eltávolítva.',
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Törlési hiba',
        description: err.message,
      });
    },
  });

  // 8. Download document helper
  const getPolicyDownloadUrl = async (filePath: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from('accounting_policies')
      .createSignedUrl(filePath, 300); // 5 min signed url

    if (error || !data?.signedUrl) {
      throw new Error('Nem sikerült letöltési linket generálni.');
    }
    return data.signedUrl;
  };

  return {
    policies,
    activePolicy,
    latestPolicy,
    rules: currentPolicyRules,
    activeRules,
    getRulesByCategory,
    isLoading: policiesLoading || rulesLoading,
    refetchPolicies,
    refetchRules,
    uploadPolicyMutation,
    processPolicyMutation,
    activatePolicyMutation,
    updateRuleMutation,
    deletePolicyMutation,
    getPolicyDownloadUrl,
  };
}

/**
 * Lightweight helper hook to query a single accounting rule value for a company.
 * Returns defaultValue if not configured or still loading.
 */
export function useCompanyAccountingRule<T = any>(
  companyId?: string,
  ruleKey?: string,
  defaultValue?: T
): { value: T; isConfigured: boolean; rule: CompanyAccountingRule | null; isLoading: boolean } {
  const { data: rule, isLoading } = useQuery({
    queryKey: ['company-accounting-rule', companyId, ruleKey],
    queryFn: async () => {
      if (!companyId || !ruleKey) return null;
      const { data, error } = await supabase
        .from('company_accounting_rules' as any)
        .select('*')
        .eq('company_id', companyId)
        .eq('rule_key', ruleKey)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn(`Failed to fetch rule ${ruleKey}:`, error);
        return null;
      }
      return data as unknown as CompanyAccountingRule | null;
    },
    enabled: !!companyId && !!ruleKey,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  return {
    value: (rule?.rule_value as T) ?? defaultValue as T,
    isConfigured: !!rule,
    rule: rule || null,
    isLoading,
  };
}
