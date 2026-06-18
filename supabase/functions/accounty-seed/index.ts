import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * accounty-seed
 * 
 * Seed edge function: a hívó user-t hozzárendeli könyvelőként
 * az összes céghez az accounty_assignments táblában.
 * Service_role kulccsal fut → RLS bypass.
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Get the calling user from the Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No auth header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify the JWT to get user ID
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[accounty-seed] User: ${user.id} (${user.email})`)

    // Get the user's eaisybill companies (from company_members)
    const { data: memberCompanies, error: memberErr } = await supabase
      .from('company_members')
      .select('company_id, companies:company_id(id, name)')
      .eq('user_id', user.id)

    if (memberErr) throw memberErr

    // Find accounting firm (the company owned by this user — their own firm)
    const { data: ownedCompanies } = await supabase
      .from('companies')
      .select('id, name')
      .eq('owner_id', user.id)

    const firm = (ownedCompanies || [])[0] || null
    const firmId = firm?.id || null

    // Assign user to ALL their eaisybill companies (including the firm)
    const clientCompanies = (memberCompanies || [])
      .map((m: any) => m.companies)
      .filter((c: any) => c)
    let inserted = 0

    for (const company of clientCompanies) {
      const { error } = await supabase
        .from('accounty_assignments')
        .upsert({
          accountant_user_id: user.id,
          company_id: company.id,
          accounting_firm_id: firmId,
          role: 'iroda_admin',
          is_primary: true,
          source: 'sync',
        }, {
          onConflict: 'accountant_user_id,company_id',
        })

      if (!error) inserted++
      else console.warn(`[accounty-seed] Skip ${company.name}: ${error.message}`)
    }

    // Create tax profiles
    for (const company of clientCompanies) {
      await supabase
        .from('accounty_tax_profiles')
        .upsert({
          company_id: company.id,
          vat_frequency: 'monthly',
          contribution_frequency: 'monthly',
          is_kata: false,
          is_kiva: false,
        }, {
          onConflict: 'company_id',
        })
    }

    const result = {
      success: true,
      userId: user.id,
      email: user.email,
      firmId,
      companiesAssigned: inserted,
      totalCompanies: clientCompanies.length,
    }
    console.log('[accounty-seed] Done!', JSON.stringify(result))

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[accounty-seed] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
