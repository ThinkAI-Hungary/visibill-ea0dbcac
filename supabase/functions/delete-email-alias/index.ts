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
      throw new Error('Unauthorized');
    }

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

    // Delete Mailgun route if it exists (using US region)
    if (alias.mailgun_route_id) {
      const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
      if (mailgunApiKey) {
        const deleteResponse = await fetch(
          `https://api.mailgun.net/v3/routes/${alias.mailgun_route_id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Basic ${btoa(`api:${mailgunApiKey}`)}`,
            },
          }
        );

        if (!deleteResponse.ok) {
          console.error('Failed to delete Mailgun route:', await deleteResponse.text());
          // Continue anyway to delete from our database
        } else {
          console.log('Mailgun route deleted:', alias.mailgun_route_id);
        }
      }
    }

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
