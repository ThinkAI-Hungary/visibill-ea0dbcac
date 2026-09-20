import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { ApiDocsView } from '@/components/settings/ApiDocsExplorer';

export default function ApiDocsPage() {
  const { user } = useAuth();

  // Fetch active API keys if logged in to prefill the Live Tester with a key prefix
  const { data: apiKeys = [] } = useQuery({
    queryKey: queryKeys.apiKeys(user?.id),
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from('api_keys')
        .select('key_prefix, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const defaultApiKey = apiKeys.length > 0 ? `${apiKeys[0].key_prefix}...` : '';

  return (
    <div className="fixed inset-0 w-full h-full overflow-y-auto bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto pb-16">
        <ApiDocsView defaultApiKey={defaultApiKey} isInline={false} />
      </div>
    </div>
  );
}
