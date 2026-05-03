import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    console.log(`[EXPORT] Exporting data for user ${user.id}`);

    // Query all user data in parallel
    const [
      profileResult,
      subscriptionResult,
      settingsResult,
      invoicesResult,
      bankStatementsResult,
      projectsResult,
      navCredentialsResult,
      navInvoicesResult,
      nylasTokensResult,
      invoiceUploadsResult,
      bankStatementUploadsResult,
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('user_subscriptions').select('*').eq('user_id', user.id).single(),
      supabase.from('settings').select('*').eq('user_id', user.id),
      supabase.from('invoices').select('*').eq('user_id', user.id),
      supabase.from('bank_statements').select('*').eq('user_id', user.id),
      supabase.from('projects').select('*').eq('user_id', user.id),
      supabase.from('user_nav_credentials').select('nav_username, nav_tax_number, software_id, software_dev_name, software_dev_contact, is_test_environment, validation_status, last_validated_at, created_at, updated_at').eq('user_id', user.id).single(),
      supabase.from('nav_invoices').select('*').eq('user_id', user.id),
      supabase.from('nylas_tokens').select('email_address, provider, created_at, updated_at, expires_at').eq('user_id', user.id),
      supabase.from('invoice_uploads').select('*').eq('user_id', user.id),
      supabase.from('bank_statement_uploads').select('*').eq('user_id', user.id),
    ]);

    // Get bank transactions for each statement
    const bankStatementsWithTransactions = await Promise.all(
      (bankStatementsResult.data || []).map(async (statement) => {
        const { data: transactions } = await supabase
          .from('bank_transactions')
          .select('*')
          .eq('bank_statement_id', statement.id);
        
        return {
          statement,
          transactions: transactions || [],
        };
      })
    );

    // Compile export data
    const exportData = {
      export_metadata: {
        exported_at: new Date().toISOString(),
        user_id: user.id,
        export_version: '1.0',
      },
      profile: profileResult.data || null,
      subscription: subscriptionResult.data || null,
      settings: settingsResult.data || [],
      invoices: invoicesResult.data || [],
      bank_statements: bankStatementsWithTransactions,
      projects: projectsResult.data || [],
      nav_data: {
        credentials: navCredentialsResult.data || null, // Metadata only, no secrets
        invoices: navInvoicesResult.data || [],
      },
      email_integration: nylasTokensResult.data || [],
      uploads: {
        invoices: invoiceUploadsResult.data || [],
        bank_statements: bankStatementUploadsResult.data || [],
      },
    };

    console.log(`[EXPORT] Successfully exported data for user ${user.id}`);

    return new Response(JSON.stringify(exportData), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[EXPORT] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
