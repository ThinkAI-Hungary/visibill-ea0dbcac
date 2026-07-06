import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * send-accounty-weekly-report
 *
 * Heti cron (hétfő reggel): minden könyvelőnek portfólió összesítő emailt küld.
 * KPI-k: ügyfél státusz megoszlás, nyitott hiányzó tételek, közelgő határidők.
 *
 * Cron: 0 6 * * 1 (hétfő 6:00 UTC = 8:00 CET)
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ── Auth ──
    const cronSecret = Deno.env.get('CRON_SECRET_ACCOUNTY')
    const authHeader = req.headers.get('Authorization')
    let authorized = false

    if (cronSecret) {
      const secretHeader = req.headers.get('x-cron-secret')
      if (secretHeader === cronSecret) authorized = true
    }

    if (!authorized && authHeader) {
      const token = authHeader.replace('Bearer ', '')
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

    console.log('[accounty-weekly-report] Generating weekly report...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // 1. Get all unique accountants
    const { data: allAssignments, error: assignErr } = await supabase
      .from('accounty_assignments')
      .select('accountant_user_id, company_id')

    if (assignErr) throw assignErr
    if (!allAssignments || allAssignments.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No accountants found', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Group companies by accountant
    const accountantCompanies: Record<string, string[]> = {}
    allAssignments.forEach((a: any) => {
      if (!accountantCompanies[a.accountant_user_id]) accountantCompanies[a.accountant_user_id] = []
      if (!accountantCompanies[a.accountant_user_id].includes(a.company_id)) {
        accountantCompanies[a.accountant_user_id].push(a.company_id)
      }
    })

    // 2. Get all company names
    const allCompanyIds = [...new Set(allAssignments.map((a: any) => a.company_id))]
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', allCompanyIds)

    const companyNameMap: Record<string, string> = {}
    ;(companies || []).forEach((c: any) => { companyNameMap[c.id] = c.name })

    // 3. Get all open missing items counts per company
    const { data: missingItems } = await supabase
      .from('accounty_missing_items')
      .select('company_id')
      .in('status', ['open', 'notified'])
      .in('company_id', allCompanyIds)

    const missingCountMap: Record<string, number> = {}
    ;(missingItems || []).forEach((m: any) => {
      missingCountMap[m.company_id] = (missingCountMap[m.company_id] || 0) + 1
    })

    // 4. Get upcoming deadlines (next 7 days)
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const next7 = new Date(today)
    next7.setUTCDate(next7.getUTCDate() + 7)
    const next7Str = next7.toISOString().split('T')[0]

    const { data: upcomingDeadlines } = await supabase
      .from('accounty_deadlines')
      .select('company_id, title, due_date')
      .in('status', ['pending', 'in_progress'])
      .gte('due_date', todayStr)
      .lte('due_date', next7Str)
      .in('company_id', allCompanyIds)
      .order('due_date', { ascending: true })

    const deadlinesByCompany: Record<string, any[]> = {}
    ;(upcomingDeadlines || []).forEach((d: any) => {
      if (!deadlinesByCompany[d.company_id]) deadlinesByCompany[d.company_id] = []
      deadlinesByCompany[d.company_id].push(d)
    })

    // 5. Get resolved items in last 7 days
    const last7 = new Date(today)
    last7.setUTCDate(last7.getUTCDate() - 7)
    const last7Str = last7.toISOString().split('T')[0]

    const { data: resolvedItems } = await supabase
      .from('accounty_missing_items')
      .select('company_id')
      .eq('status', 'resolved')
      .gte('resolved_at', last7Str)
      .in('company_id', allCompanyIds)

    const resolvedCountMap: Record<string, number> = {}
    ;(resolvedItems || []).forEach((r: any) => {
      resolvedCountMap[r.company_id] = (resolvedCountMap[r.company_id] || 0) + 1
    })

    // 6. Build and send report per accountant
    let totalSent = 0

    for (const [userId, companyIds] of Object.entries(accountantCompanies)) {
      // Compute per-company stats
      let totalClients = companyIds.length
      let rendben = 0, feldolgozando = 0, kritikus = 0
      let totalMissing = 0, totalResolved = 0, totalDeadlines = 0

      const clientRows: string[] = []
      const deadlineRows: string[] = []

      for (const cid of companyIds) {
        const name = companyNameMap[cid] || 'Ismeretlen'
        if (name === 'SANDBOX') { totalClients--; continue }
        const missing = missingCountMap[cid] || 0
        const resolved = resolvedCountMap[cid] || 0
        totalMissing += missing
        totalResolved += resolved

        let status: string
        if (missing > 3) { status = 'Kritikus'; kritikus++ }
        else if (missing > 0) { status = 'Feldolgozandó'; feldolgozando++ }
        else { status = 'Rendben'; rendben++ }

        const statusStyle = status === 'Kritikus'
          ? 'background:#fef2f2;color:#991b1b'
          : status === 'Feldolgozandó'
            ? 'background:#fffbeb;color:#92400e'
            : 'background:#f0fdf4;color:#065f46'

        clientRows.push(`<tr>
          <td style="padding:6px 12px;border-top:1px solid #e5e7eb;font-size:13px">${name}</td>
          <td style="padding:6px 12px;border-top:1px solid #e5e7eb;font-size:13px;text-align:center">
            <span style="padding:2px 8px;border-radius:4px;font-size:11px;${statusStyle}">${status}</span>
          </td>
          <td style="padding:6px 12px;border-top:1px solid #e5e7eb;font-size:13px;text-align:center">${missing}</td>
          <td style="padding:6px 12px;border-top:1px solid #e5e7eb;font-size:13px;text-align:center;color:#059669">${resolved > 0 ? `+${resolved}` : '–'}</td>
        </tr>`)

        // Collect deadlines for this company
        const dls = deadlinesByCompany[cid] || []
        totalDeadlines += dls.length
        dls.forEach((dl: any) => {
          deadlineRows.push(`<tr>
            <td style="padding:4px 12px;border-top:1px solid #e5e7eb;font-size:12px">${name}</td>
            <td style="padding:4px 12px;border-top:1px solid #e5e7eb;font-size:12px">${dl.title}</td>
            <td style="padding:4px 12px;border-top:1px solid #e5e7eb;font-size:12px;font-weight:600">${dl.due_date}</td>
          </tr>`)
        })
      }

      // Build HTML
      const weekLabel = `${last7Str.slice(5)} – ${todayStr.slice(5)}`

      const bodyHtml = `
        <p style="font-size:13px;color:#6b7280;margin-bottom:16px">Heti összesítő: ${weekLabel}</p>

        <!-- KPI Cards -->
        <div style="display:flex;gap:8px;margin-bottom:20px">
          <div style="flex:1;padding:12px;background:#f0fdf4;border-radius:8px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#059669">${rendben}</div>
            <div style="font-size:11px;color:#6b7280">Rendben</div>
          </div>
          <div style="flex:1;padding:12px;background:#fffbeb;border-radius:8px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#d97706">${feldolgozando}</div>
            <div style="font-size:11px;color:#6b7280">Feldolgozandó</div>
          </div>
          <div style="flex:1;padding:12px;background:#fef2f2;border-radius:8px;text-align:center">
            <div style="font-size:24px;font-weight:700;color:#dc2626">${kritikus}</div>
            <div style="font-size:11px;color:#6b7280">Kritikus</div>
          </div>
        </div>

        <!-- Summary stats -->
        <div style="display:flex;gap:16px;margin-bottom:20px;font-size:13px;color:#374151">
          <div>Nyitott hiányzó tételek: <strong>${totalMissing}</strong></div>
          <div>Megoldva ezen a héten: <strong>${totalResolved}</strong></div>
          <div>Közelgő határidők: <strong>${totalDeadlines}</strong></div>
        </div>

        <!-- Client table -->
        <table style="width:100%;border-collapse:collapse;margin:12px 0;border:1px solid #e5e7eb;border-radius:6px">
          <thead><tr style="background:#f3f4f6">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Ügyfél</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Státusz</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Hiányzó</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Megoldva</th>
          </tr></thead>
          <tbody>${clientRows.join('')}</tbody>
        </table>

        ${deadlineRows.length > 0 ? `
        <!-- Upcoming deadlines -->
        <h3 style="font-size:14px;font-weight:600;margin:20px 0 8px">Közelgő határidők (7 nap)</h3>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px">
          <thead><tr style="background:#f3f4f6">
            <th style="padding:6px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280">Ügyfél</th>
            <th style="padding:6px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280">Határidő</th>
            <th style="padding:6px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280">Dátum</th>
          </tr></thead>
          <tbody>${deadlineRows.join('')}</tbody>
        </table>
        ` : ''}

        <p style="margin-top:20px">
          <a href="https://app.visibill.hu/accounty"
             style="display:inline-block;padding:10px 24px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">
            Portfólió megnyitása
          </a>
        </p>
      `

      try {
        await supabase.functions.invoke('send-accounty-notification', {
          body: {
            user_id: userId,
            type: 'accounty_weekly_report',
            title: `Heti portfólió riport`,
            body_html: bodyHtml,
            subject: `eaisyBooks heti riport – ${totalClients} ügyfél, ${totalMissing} nyitott tétel`,
          },
        })
        totalSent++
      } catch (notifErr) {
        console.error(`[accounty-weekly-report] Notification failed for user ${userId}:`, notifErr)
      }
    }

    const summary = {
      success: true,
      accountantsNotified: totalSent,
      totalAccountants: Object.keys(accountantCompanies).length,
    }

    console.log('[accounty-weekly-report] Done.', JSON.stringify(summary))

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[accounty-weekly-report] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
