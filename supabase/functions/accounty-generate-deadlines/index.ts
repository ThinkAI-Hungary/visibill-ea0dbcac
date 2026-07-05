import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Hungarian public holidays & business-day adjustment ──

/**
 * Computus (Anonymous Gregorian algorithm) — Easter Sunday kiszámítása.
 */
function getEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function addUTCDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + n)
  return r
}

/**
 * Magyar munkaszüneti napok egy adott évre.
 * Fix ünnepek + húsvét-alapú mozgó ünnepek (Nagypéntek, Húsvéthétfő, Pünkösdhétfő).
 */
function getHungarianHolidays(year: number): Set<string> {
  const holidays = new Set<string>()
  const add = (m: number, d: number) =>
    holidays.add(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)

  // Fix ünnepek
  add(1, 1)    // Újév
  add(3, 15)   // Nemzeti ünnep
  add(5, 1)    // Munka ünnepe
  add(8, 20)   // Államalapítás ünnepe
  add(10, 23)  // 1956-os forradalom ünnepe
  add(11, 1)   // Mindenszentek
  add(12, 25)  // Karácsony
  add(12, 26)  // Karácsony 2. napja

  // Mozgó ünnepek (húsvét-alapú)
  const easter = getEasterSunday(year)
  holidays.add(fmtDate(addUTCDays(easter, -2)))  // Nagypéntek
  holidays.add(fmtDate(addUTCDays(easter, 1)))   // Húsvéthétfő
  holidays.add(fmtDate(addUTCDays(easter, 50)))  // Pünkösdhétfő

  return holidays
}

/**
 * Ha a megadott dátum hétvégére vagy magyar munkaszüneti napra esik,
 * az első rákövetkező munkanapra tolja.
 */
function adjustToBusinessDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  let date = new Date(Date.UTC(y, m - 1, d))
  // Mindkét évre kell az ünneplista, mert december végén átléphet januárba
  const allHolidays = new Set([
    ...getHungarianHolidays(y),
    ...getHungarianHolidays(y + 1),
  ])

  let safety = 14 // max 2 hét tolás (biztonsági limit)
  while (safety-- > 0) {
    const dow = date.getUTCDay() // 0=Vasárnap, 6=Szombat
    const str = fmtDate(date)
    if (dow === 0 || dow === 6 || allHolidays.has(str)) {
      date = addUTCDays(date, 1)
    } else {
      break
    }
  }
  return fmtDate(date)
}

/** Dátum építés + munkanap-korrekció egyben. */
function buildDueDate(year: number, month: number, day: number): string {
  const raw = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  return adjustToBusinessDay(raw)
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
 * Ha egy határidő hétvégére vagy magyar munkaszüneti napra esik,
 * automatikusan az első rákövetkező munkanapra tolja (adjustToBusinessDay).
 * 
 * Futtatás: havonta 1x cron-ból (hónap elején).
 * Extra: body { action: 'fix_existing' } → meglévő határidők korrekciója.
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
      const token = authHeader.replace('Bearer ', '')
      // Allow service_role key as direct auth (for admin/cron calls)
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (serviceRoleKey && token === serviceRoleKey) {
        authorized = true
      } else {
        const tempClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        )
        const { data: { user } } = await tempClient.auth.getUser(token)
        if (user) authorized = true
      }
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

    // Parse request body (once)
    let body: Record<string, unknown> = {}
    try { body = await req.json() } catch { /* no body / not JSON – OK */ }

    // ── Fix existing deadlines mode ──
    if (body?.action === 'fix_existing') {
      console.log('[accounty-generate-deadlines] Fixing existing deadlines (business-day adjustment)...')

      const { data: pending, error: fetchErr } = await supabase
        .from('accounty_deadlines')
        .select('id, due_date')
        .in('status', ['pending', 'in_progress'])

      if (fetchErr) throw fetchErr

      let fixed = 0
      for (const dl of (pending || [])) {
        const adjusted = adjustToBusinessDay(dl.due_date)
        if (adjusted !== dl.due_date) {
          const { error: upErr } = await supabase
            .from('accounty_deadlines')
            .update({ due_date: adjusted })
            .eq('id', dl.id)
          if (!upErr) fixed++
          else console.error(`[fix_existing] Update error for ${dl.id}:`, upErr)
        }
      }

      const result = {
        success: true,
        action: 'fix_existing',
        totalChecked: (pending || []).length,
        totalFixed: fixed,
      }
      console.log('[accounty-generate-deadlines] fix_existing done:', JSON.stringify(result))

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Deduplicate existing deadlines mode ──
    if (body?.action === 'dedup') {
      console.log('[accounty-generate-deadlines] Deduplicating deadlines...')

      // Fetch ALL non-completed deadlines
      const { data: all, error: fetchErr } = await supabase
        .from('accounty_deadlines')
        .select('id, company_id, deadline_type, due_date, title, created_at')
        .order('created_at', { ascending: true })

      if (fetchErr) throw fetchErr

      // Group by company_id + deadline_type + due_date → keep the first (oldest), delete the rest
      const groups: Record<string, { keep: string; dupes: string[] }> = {}
      for (const d of (all || [])) {
        const key = `${d.company_id}_${d.deadline_type}_${d.due_date}_${d.title}`
        if (!groups[key]) {
          groups[key] = { keep: d.id, dupes: [] }
        } else {
          groups[key].dupes.push(d.id)
        }
      }

      const allDupeIds = Object.values(groups).flatMap(g => g.dupes)
      let deleted = 0

      // Delete in batches of 100
      for (let i = 0; i < allDupeIds.length; i += 100) {
        const batch = allDupeIds.slice(i, i + 100)
        const { error: delErr } = await supabase
          .from('accounty_deadlines')
          .delete()
          .in('id', batch)
        if (!delErr) deleted += batch.length
        else console.error(`[dedup] Delete batch error:`, delErr)
      }

      const result = {
        success: true,
        action: 'dedup',
        totalRecords: (all || []).length,
        duplicatesRemoved: deleted,
        uniqueRemaining: (all || []).length - deleted,
      }
      console.log('[accounty-generate-deadlines] dedup done:', JSON.stringify(result))

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Determine target month (current month + 1, or from body)
    let targetYear = (body?.year as number) || new Date().getFullYear()
    let targetMonth = (body?.month as number) || new Date().getMonth() + 2 // 1-indexed, next month
    if (targetMonth > 12) {
      targetMonth = 1
      targetYear++
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
            due_date: buildDueDate(targetYear, targetMonth, dl.day),
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
              due_date: buildDueDate(targetYear, targetMonth, dl.day),
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
              due_date: buildDueDate(targetYear, targetMonth, dl.day),
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
          due_date: buildDueDate(targetYear, targetMonth, dl.day),
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
            due_date: buildDueDate(targetYear, targetMonth, dl.day),
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
          due_date: buildDueDate(targetYear, targetMonth, dl.day),
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
      const berDueDate = buildDueDate(targetYear, targetMonth, 10)
      
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
