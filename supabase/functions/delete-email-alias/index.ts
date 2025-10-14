import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Unauthorized');
    }

    console.log('Authenticated user:', user.id);

    const { alias_id } = await req.json();

    if (!alias_id) {
      throw new Error('Alias ID is required');
    }

    // Get the alias from database
    const { data: alias, error: fetchError } = await supabase
      .from('email_aliases')
      .select('*')
      .eq('id', alias_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !alias) {
      throw new Error('Alias not found');
    }

    console.log('Deleting alias:', alias.alias_email);

    // Delete from database
    const { error: deleteError } = await supabase
      .from('email_aliases')
      .delete()
      .eq('id', alias_id)
      .eq('user_id', user.id);

    if (deleteError) {
      throw deleteError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in delete-email-alias:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
