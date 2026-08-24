import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * send-accounty-monthly-report
 *
 * Havi cron (hónap 1.): minden könyvelőnek részletes havi összesítő emailt küld.
 * Az előző teljes hónap teljesítményét összesíti: feldolgozott tételek,
 * reakcióidők, határidő teljesítés, top problémás ügyfelek.
 *
 * Cron: 0 6 1 * * (hónap 1. 6:00 UTC = 8:00 CET)
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

    console.log('[accounty-monthly-report] Generating monthly report...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Calculate previous month range
    const now = new Date()
    const prevMonth = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth() // 1-indexed
    const prevYear = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
    const monthStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
    const lastDayOfMonth = new Date(prevYear, prevMonth, 0).getDate()
    const monthEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`

    const monthNames = ['', 'január', 'február', 'március', 'április', 'május', 'június',
      'július', 'augusztus', 'szeptember', 'október', 'november', 'december']
    const monthLabel = `${prevYear}. ${monthNames[prevMonth]}`

    console.log(`[accounty-monthly-report] Period: ${monthLabel} (${monthStart} – ${monthEnd})`)

    // 1. Get all accountants and their companies
    const { data: allAssignments, error: assignErr } = await supabase
      .from('accounty_assignments')
      .select('accountant_user_id, company_id')

    if (assignErr) throw assignErr
    if (!allAssignments || allAssignments.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No accountants found', sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const accountantCompanies: Record<string, string[]> = {}
    allAssignments.forEach((a: any) => {
      if (!accountantCompanies[a.accountant_user_id]) accountantCompanies[a.accountant_user_id] = []
      if (!accountantCompanies[a.accountant_user_id].includes(a.company_id)) {
        accountantCompanies[a.accountant_user_id].push(a.company_id)
      }
    })

    const allCompanyIds = [...new Set(allAssignments.map((a: any) => a.company_id))]

    // 2. Get company names
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', allCompanyIds)

    const companyNameMap: Record<string, string> = {}
    ;(companies || []).forEach((c: any) => { companyNameMap[c.id] = c.name })

    // 3. Get resolved items in the previous month (for performance metrics)
    const { data: resolvedInMonth } = await supabase
      .from('accounty_missing_items')
      .select('company_id, created_at, resolved_at')
      .eq('status', 'resolved')
      .gte('resolved_at', monthStart)
      .lte('resolved_at', `${monthEnd}T23:59:59`)
      .in('company_id', allCompanyIds)

    const resolvedByCompany: Record<string, number> = {}
    let totalResolvedItems = 0
    let totalResponseTimeHours = 0
    let responseTimeCount = 0

    ;(resolvedInMonth || []).forEach((r: any) => {
      resolvedByCompany[r.company_id] = (resolvedByCompany[r.company_id] || 0) + 1
      totalResolvedItems++

      if (r.created_at && r.resolved_at) {
        const created = new Date(r.created_at).getTime()
        const resolved = new Date(r.resolved_at).getTime()
        const diffHours = (resolved - created) / (1000 * 60 * 60)
        if (diffHours >= 0 && diffHours < 720) { // max 30 days, filter outliers
          totalResponseTimeHours += diffHours
          responseTimeCount++
        }
      }
    })

    // 4. Get new items created in the month
    const { data: createdInMonth } = await supabase
      .from('accounty_missing_items')
      .select('company_id')
      .gte('created_at', monthStart)
      .lte('created_at', `${monthEnd}T23:59:59`)
      .in('company_id', allCompanyIds)

    const createdByCompany: Record<string, number> = {}
    ;(createdInMonth || []).forEach((c: any) => {
      createdByCompany[c.company_id] = (createdByCompany[c.company_id] || 0) + 1
    })

    // 5. Get deadline completion rate for the month
    const { data: monthDeadlines } = await supabase
      .from('accounty_deadlines')
      .select('company_id, status')
      .gte('due_date', monthStart)
      .lte('due_date', monthEnd)
      .in('company_id', allCompanyIds)

    const totalDeadlines = (monthDeadlines || []).length
    const completedDeadlines = (monthDeadlines || []).filter((d: any) => d.status === 'completed').length

    // 6. Current open missing items
    const { data: currentOpen } = await supabase
      .from('accounty_missing_items')
      .select('company_id')
      .in('status', ['open', 'notified'])
      .in('company_id', allCompanyIds)

    const currentOpenByCompany: Record<string, number> = {}
    ;(currentOpen || []).forEach((c: any) => {
      currentOpenByCompany[c.company_id] = (currentOpenByCompany[c.company_id] || 0) + 1
    })

    // 7. Build and send per accountant
    let totalSent = 0

    for (const [userId, companyIds] of Object.entries(accountantCompanies)) {
      let totalClients = companyIds.length
      let rendben = 0, feldolgozando = 0, kritikus = 0
      let acctResolvedTotal = 0, acctCreatedTotal = 0, acctOpenTotal = 0

      // Top problematic clients (sorted by open missing count)
      const clientStats: { name: string; open: number; created: number; resolved: number }[] = []

      for (const cid of companyIds) {
        const name = companyNameMap[cid] || 'Ismeretlen'
        if (name === 'SANDBOX') { totalClients--; continue }

        const open = currentOpenByCompany[cid] || 0
        const created = createdByCompany[cid] || 0
        const resolved = resolvedByCompany[cid] || 0

        acctOpenTotal += open
        acctCreatedTotal += created
        acctResolvedTotal += resolved

        if (open > 3) kritikus++
        else if (open > 0) feldolgozando++
        else rendben++

        clientStats.push({ name, open, created, resolved })
      }

      // Sort by open missing (worst first) → take top 5
      clientStats.sort((a, b) => b.open - a.open)
      const topClients = clientStats.slice(0, 5)

      const avgResponseTime = responseTimeCount > 0
        ? Math.round(totalResponseTimeHours / responseTimeCount)
        : null
      const avgResponseLabel = avgResponseTime !== null
        ? (avgResponseTime < 24 ? `${avgResponseTime} óra` : `${Math.round(avgResponseTime / 24)} nap`)
        : 'N/A'

      const deadlineRate = totalDeadlines > 0
        ? Math.round((completedDeadlines / totalDeadlines) * 100)
        : 100

      // Build HTML
      const topClientRows = topClients.filter(c => c.open > 0).map(c => `
        <tr>
          <td style="padding:6px 12px;border-top:1px solid #e5e7eb;font-size:13px">${c.name}</td>
          <td style="padding:6px 12px;border-top:1px solid #e5e7eb;font-size:13px;text-align:center;color:#dc2626;font-weight:600">${c.open}</td>
          <td style="padding:6px 12px;border-top:1px solid #e5e7eb;font-size:13px;text-align:center">${c.created}</td>
          <td style="padding:6px 12px;border-top:1px solid #e5e7eb;font-size:13px;text-align:center;color:#059669">${c.resolved}</td>
        </tr>
      `).join('')

      const bodyHtml = `
        <p style="font-size:13px;color:#6b7280;margin-bottom:20px">Havi összesítő: <strong>${monthLabel}</strong></p>

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

        <!-- Performance metrics -->
        <div style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;padding:16px;margin-bottom:20px">
          <h3 style="font-size:14px;font-weight:600;margin:0 0 12px">Havi teljesítmény</h3>
          <div style="display:flex;flex-wrap:wrap;gap:16px;font-size:13px;color:#374151">
            <div>Új hiányzó tételek: <strong>${acctCreatedTotal}</strong></div>
            <div>Megoldott tételek: <strong>${acctResolvedTotal}</strong></div>
            <div>Jelenleg nyitott: <strong>${acctOpenTotal}</strong></div>
          </div>
        </div>

        ${topClientRows.length > 0 ? `
        <!-- Top problematic clients -->
        <h3 style="font-size:14px;font-weight:600;margin:0 0 8px">Legtöbb nyitott tétellel rendelkező ügyfelek</h3>
        <table style="width:100%;border-collapse:collapse;margin:0 0 16px;border:1px solid #e5e7eb;border-radius:6px">
          <thead><tr style="background:#f3f4f6">
            <th style="padding:6px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Ügyfél</th>
            <th style="padding:6px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Nyitott</th>
            <th style="padding:6px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Új (hó)</th>
            <th style="padding:6px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Megoldva</th>
          </tr></thead>
          <tbody>${topClientRows}</tbody>
        </table>
        ` : '<p style="font-size:13px;color:#059669">Nincs nyitott tétellel rendelkező ügyfél – kiváló munka!</p>'}

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
            type: 'accounty_monthly_report',
            title: `Havi portfólió riport – ${monthLabel}`,
            body_html: bodyHtml,
            subject: `eaisyBooks havi riport – ${monthLabel} | ${totalClients} ügyfél`,
          },
        })
        totalSent++
      } catch (notifErr) {
        console.error(`[accounty-monthly-report] Notification failed for user ${userId}:`, notifErr)
      }
    }

    const summary = {
      success: true,
      period: monthLabel,
      accountantsNotified: totalSent,
      totalResolvedItems,
      avgResponseTimeHours: responseTimeCount > 0 ? Math.round(totalResponseTimeHours / responseTimeCount) : null,
      deadlineCompletionRate: totalDeadlines > 0 ? `${Math.round((completedDeadlines / totalDeadlines) * 100)}%` : '100%',
    }

    console.log('[accounty-monthly-report] Done.', JSON.stringify(summary))

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[accounty-monthly-report] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
