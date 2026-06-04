import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token } = await req.json().catch(() => ({ token: null }))

    if (!token || typeof token !== 'string' || token.length < 6 || token.length > 128) {
      return new Response(JSON.stringify({ valid: false, error: 'invalid_token' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    // Look up token (service role bypasses RLS).
    const { data: emp, error } = await admin
      .from('employee_rates')
      .select('id, employee_name, company_id, employee_type, user_id')
      .eq('registration_token', token)
      .is('user_id', null)
      .maybeSingle()

    if (error || !emp) {
      return new Response(JSON.stringify({ valid: false, error: 'not_found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: company } = await admin
      .from('companies')
      .select('name')
      .eq('id', emp.company_id)
      .maybeSingle()

    // Return only the minimum data needed to render the registration form.
    return new Response(
      JSON.stringify({
        valid: true,
        data: {
          id: emp.id,
          employee_name: emp.employee_name,
          company_id: emp.company_id,
          employee_type: emp.employee_type,
          company_name: company?.name ?? 'Ismeretlen cég',
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[validate-employee-token] error:', err)
    return new Response(JSON.stringify({ valid: false, error: 'server_error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
