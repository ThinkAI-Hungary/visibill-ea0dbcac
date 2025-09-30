import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const body = await req.json()
    const {
      navUsername,
      navPassword,
      navTaxNumber,
      navSignKey,
      navExchangeKey,
      softwareDevName,
      softwareDevContact,
      isTestEnvironment = true
    } = body

    // Validate required fields
    if (!navUsername || !navPassword || !navTaxNumber || !navSignKey || !navExchangeKey) {
      return new Response(
        JSON.stringify({ error: 'All NAV credentials are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call the database function to save credentials
    const { data, error } = await supabaseClient.rpc('save_nav_credentials', {
      p_nav_username: navUsername,
      p_nav_password: navPassword,
      p_nav_tax_number: navTaxNumber,
      p_nav_sign_key: navSignKey,
      p_nav_exchange_key: navExchangeKey,
      p_software_dev_name: softwareDevName || null,
      p_software_dev_contact: softwareDevContact || null,
      p_is_test_environment: isTestEnvironment
    })

    if (error) {
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})