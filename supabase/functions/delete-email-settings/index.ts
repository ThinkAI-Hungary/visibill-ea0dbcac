import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // CORS configuration
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const debugId = `del-email-${Date.now()}`

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header', debugId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    
    // Create Supabase client with user context
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token', debugId }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { companyId, accountId } = body

    if (!accountId && !companyId) {
      return new Response(
        JSON.stringify({ error: 'accountId or companyId is required', debugId }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (accountId) {
      const { data, error } = await supabaseClient.rpc('delete_company_email_account', {
        p_account_id: accountId
      })

      if (error) {
        console.error(`[${debugId}] Database error deleting email account:`, error)
        return new Response(
          JSON.stringify({ error: error.message, debugId }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      const { data, error } = await supabaseClient.rpc('delete_company_email_settings', {
        p_company_id: companyId
      })

      if (error) {
        console.error(`[${debugId}] Database error deleting email settings:`, error)
        return new Response(
          JSON.stringify({ error: error.message, debugId }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'E-mail fiók sikeresen törölve a Vaultból és az adatbázisból.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error(`[${debugId}] Deletion error:`, error)
    return new Response(
      JSON.stringify({ error: error.message || 'Hiba lépett fel a törlés során.', debugId }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
