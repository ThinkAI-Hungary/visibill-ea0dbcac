import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * accounty-generate-deadlines
 * 
 * Határidő generátor: az accounty_tax_profiles alapján automatikusan
 * létrehozza a következő hónap(ok) adóügyi határidőit az
 * accounty_deadlines táblában.
 * 
 * Emellett havi bér-hiányt is generál (accounty_missing_items, category='ber').
 * 
 * Futtatás: havonta 1x cron-ból (hónap elején).
 */

// Magyar adóügyi fix határidők (nap a hónapon belül)
const TAX_DEADLINES: Record<string, { day: number; title: string; type: string }[]> = {
  // Havi ÁFA bevallás
  monthly_vat: [
    { day: 20, title: 'ÁFA bevallás', type: 'afa' },
  ],
  // Negyedéves ÁFA bevallás (jan/ápr/júl/okt)
  quarterly_vat: [
    { day: 20, title: 'ÁFA bevallás (negyedéves)', type: 'afa' },
  ],
  // Éves ÁFA
  yearly_vat: [
    { day: 25, title: 'ÁFA bevallás (éves)', type: 'afa' },
  ],
  // Havi járulékok
  monthly_contribution: [
    { day: 12, title: 'Járulékbevallás + befizetés', type: 'jarulek' },
  ],
  // KATA
  kata: [
    { day: 12, title: 'KATA adó befizetés', type: 'kata' },
  ],
  // Bér
  payroll: [
    { day: 10, title: 'Bérszámfejtés leadás', type: 'ber' },
    { day: 12, title: 'Bér járulékok befizetése', type: 'ber' },
  ],
}

function getQuarterlyMonths(): number[] {
  return [1, 4, 7, 10] // Jan, Apr, Jul, Oct
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ── Auth: require CRON_SECRET or valid user token ──
    const cronSecret = Deno.env.get('CRON_SECRET')
    const authHeader = req.headers.get('Authorization')
    let authorized = false

    if (cronSecret) {
      const secretHeader = req.headers.get('x-cron-secret')
      if (secretHeader === cronSecret) authorized = true
    }

    if (!authorized && authHeader) {
      const tempClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      const { data: { user } } = await tempClient.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      if (user) authorized = true
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('[accounty-generate-deadlines] Starting deadline generation...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Determine target month (current month + 1, or from body)
    let targetYear: number
    let targetMonth: number // 1-indexed

    try {
      const body = await req.json()
      targetYear = body?.year || new Date().getFullYear()
      targetMonth = body?.month || new Date().getMonth() + 2 // next month
      if (targetMonth > 12) {
        targetMonth = 1
        targetYear++
      }
    } catch {
      const now = new Date()
      targetYear = now.getFullYear()
      targetMonth = now.getMonth() + 2
      if (targetMonth > 12) {
        targetMonth = 1
        targetYear++
      }
    }

    console.log(`[accounty-generate-deadlines] Target: ${targetYear}-${String(targetMonth).padStart(2, '0')}`)

    // 1. Get all managed companies with tax profiles
    const { data: assignments } = await supabase
      .from('accounty_assignments')
      .select('company_id')

    const managedCompanyIds = [...new Set((assignments || []).map((a: any) => a.company_id))]
    if (managedCompanyIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No managed companies' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Get tax profiles
    const { data: profiles } = await supabase
      .from('accounty_tax_profiles')
      .select('*')
      .in('company_id', managedCompanyIds)

    const profileMap: Record<string, any> = {}
    ;(profiles || []).forEach((p: any) => {
      profileMap[p.company_id] = p
    })

    let totalDeadlines = 0
    let totalBerItems = 0

    for (const companyId of managedCompanyIds) {
      const profile = profileMap[companyId]
      const deadlinesToInsert: any[] = []

      // ── ÁFA határidők ──
      const vatFreq = profile?.vat_frequency || 'monthly'
      if (vatFreq === 'monthly') {
        for (const dl of TAX_DEADLINES.monthly_vat) {
          deadlinesToInsert.push({
            company_id: companyId,
            deadline_type: dl.type,
            title: dl.title,
            due_date: `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dl.day).padStart(2, '0')}`,
            status: 'pending',
          })
        }
      } else if (vatFreq === 'quarterly') {
        if (getQuarterlyMonths().includes(targetMonth)) {
          for (const dl of TAX_DEADLINES.quarterly_vat) {
            deadlinesToInsert.push({
              company_id: companyId,
              deadline_type: dl.type,
              title: dl.title,
              due_date: `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dl.day).padStart(2, '0')}`,
              status: 'pending',
            })
          }
        }
      } else if (vatFreq === 'yearly') {
        if (targetMonth === 2) { // February deadline for yearly VAT
          for (const dl of TAX_DEADLINES.yearly_vat) {
            deadlinesToInsert.push({
              company_id: companyId,
              deadline_type: dl.type,
              title: dl.title,
              due_date: `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dl.day).padStart(2, '0')}`,
              status: 'pending',
            })
          }
        }
      }

      // ── Járulék határidők (minden hónapban) ──
      for (const dl of TAX_DEADLINES.monthly_contribution) {
        deadlinesToInsert.push({
          company_id: companyId,
          deadline_type: dl.type,
          title: dl.title,
          due_date: `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dl.day).padStart(2, '0')}`,
          status: 'pending',
        })
      }

      // ── KATA ha releváns ──
      if (profile?.is_kata) {
        for (const dl of TAX_DEADLINES.kata) {
          deadlinesToInsert.push({
            company_id: companyId,
            deadline_type: dl.type,
            title: dl.title,
            due_date: `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dl.day).padStart(2, '0')}`,
            status: 'pending',
          })
        }
      }

      // ── Bér határidők ──
      for (const dl of TAX_DEADLINES.payroll) {
        deadlinesToInsert.push({
          company_id: companyId,
          deadline_type: dl.type,
          title: dl.title,
          due_date: `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dl.day).padStart(2, '0')}`,
          status: 'pending',
        })
      }

      // 3. Check for existing deadlines (avoid duplicates)
      if (deadlinesToInsert.length > 0) {
        const startOfMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
        const endOfMonth = `${targetYear}-${String(targetMonth).padStart(2, '0')}-31`

        const { data: existingDeadlines } = await supabase
          .from('accounty_deadlines')
          .select('deadline_type, due_date')
          .eq('company_id', companyId)
          .gte('due_date', startOfMonth)
          .lte('due_date', endOfMonth)

        const existingKey = new Set(
          (existingDeadlines || []).map((d: any) => `${d.deadline_type}_${d.due_date}`)
        )

        const newDeadlines = deadlinesToInsert.filter(d =>
          !existingKey.has(`${d.deadline_type}_${d.due_date}`)
        )

        if (newDeadlines.length > 0) {
          const { error } = await supabase
            .from('accounty_deadlines')
            .insert(newDeadlines)

          if (error) {
            console.error(`[accounty-generate-deadlines] Insert error for ${companyId}:`, error)
          } else {
            totalDeadlines += newDeadlines.length
          }
        }
      }

      // 4. Generate monthly bér missing items (payroll reminders)
      const berDueDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-10`
      
      // Check if we already have a bér item for this month
      const { data: existingBer } = await supabase
        .from('accounty_missing_items')
        .select('id')
        .eq('company_id', companyId)
        .eq('source', 'ber_cron')
        .eq('category', 'ber')
        .gte('item_date', `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`)
        .lte('item_date', `${targetYear}-${String(targetMonth).padStart(2, '0')}-31`)
        .limit(1)

      if (!existingBer || existingBer.length === 0) {
        const monthNames = ['', 'január', 'február', 'március', 'április', 'május', 'június',
          'július', 'augusztus', 'szeptember', 'október', 'november', 'december']
        
        const { error: berErr } = await supabase
          .from('accounty_missing_items')
          .insert({
            company_id: companyId,
            category: 'ber',
            title: `Bérszámfejtési adatok – ${targetYear}. ${monthNames[targetMonth]}`,
            subtitle: 'Havi kötelező nyilatkozat és jelenléti ív',
            source: 'ber_cron',
            priority: 'medium',
            status: 'open',
            details: `A ${targetYear}. ${monthNames[targetMonth]}i bérszámfejtéshez szükséges adatok (jelenléti ív, szabadságok, túlórák, egyéb változások) bekérése.`,
            item_date: berDueDate,
            resolve_route: `/accounty/client/${companyId}`,
          })

        if (!berErr) {
          totalBerItems++
        }
      }
    }

    const summary = {
      success: true,
      targetPeriod: `${targetYear}-${String(targetMonth).padStart(2, '0')}`,
      companiesProcessed: managedCompanyIds.length,
      deadlinesCreated: totalDeadlines,
      payrollRemindersCreated: totalBerItems,
    }

    console.log(`[accounty-generate-deadlines] Done.`, JSON.stringify(summary))

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[accounty-generate-deadlines] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
