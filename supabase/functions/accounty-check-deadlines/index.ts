import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * accounty-check-deadlines
 *
 * Napi cron: megkeresi az `accounty_deadlines` táblából azokat a
 * határidőket, amelyek 3 napon belül esedékesek és még pending/in_progress
 * státuszúak. Az érintett könyvelőknek értesítést küld a
 * send-accounty-notification Edge Function-ön keresztül.
 *
 * Cron: 0 5 * * * (napi 5:00 UTC = 7:00 CET)
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ── Auth: require CRON_SECRET_ACCOUNTY or valid user token ──
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

    console.log('[accounty-check-deadlines] Starting deadline reminder check...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Calculate the target date: today + 3 days
    const today = new Date()
    const target = new Date(today)
    target.setUTCDate(target.getUTCDate() + 3)
    const targetDate = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(target.getUTCDate()).padStart(2, '0')}`

    // Also check for TODAY deadlines (last chance reminder)
    const todayDate = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`

    console.log(`[accounty-check-deadlines] Checking deadlines for ${targetDate} (3-day) and ${todayDate} (today)`)

    // 1. Get deadlines due in 3 days or today
    const { data: upcomingDeadlines, error: dlErr } = await supabase
      .from('accounty_deadlines')
      .select('id, company_id, deadline_type, title, due_date, status')
      .in('status', ['pending', 'in_progress'])
      .in('due_date', [targetDate, todayDate])

    if (dlErr) throw dlErr

    if (!upcomingDeadlines || upcomingDeadlines.length === 0) {
      console.log('[accounty-check-deadlines] No upcoming deadlines found.')
      return new Response(JSON.stringify({ success: true, notified: 0, message: 'No upcoming deadlines' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Group deadlines by company
    const byCompany: Record<string, any[]> = {}
    upcomingDeadlines.forEach((dl: any) => {
      if (!byCompany[dl.company_id]) byCompany[dl.company_id] = []
      byCompany[dl.company_id].push(dl)
    })

    let totalNotified = 0

    for (const [companyId, deadlines] of Object.entries(byCompany)) {
      // 3. Get company name
      const { data: companyData } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single()
      const companyName = (companyData as any)?.name || 'Ismeretlen cég'

      // 4. Get assigned accountants
      const { data: assignedUsers } = await supabase
        .from('accounty_assignments')
        .select('accountant_user_id')
        .eq('company_id', companyId)

      if (!assignedUsers || assignedUsers.length === 0) continue

      // 5. Build email content
      const deadlineRows = deadlines.map((dl: any) => {
        const isToday = dl.due_date === todayDate
        const urgencyStyle = isToday
          ? 'background:#fef2f2;color:#991b1b;font-weight:600'
          : 'background:#fffbeb;color:#92400e'
        const urgencyLabel = isToday ? 'MA' : '3 nap'

        return `<tr>
          <td style="padding:8px 12px;border-top:1px solid #e5e7eb;font-size:13px">${dl.title}</td>
          <td style="padding:8px 12px;border-top:1px solid #e5e7eb;font-size:13px">${dl.due_date}</td>
          <td style="padding:8px 12px;border-top:1px solid #e5e7eb;font-size:13px">
            <span style="padding:2px 8px;border-radius:4px;font-size:11px;${urgencyStyle}">${urgencyLabel}</span>
          </td>
        </tr>`
      }).join('')

      const bodyHtml = `
        <p><strong>${companyName}</strong> céghez <strong>${deadlines.length}</strong> közelgő határidő van:</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0;border:1px solid #e5e7eb;border-radius:6px">
          <thead><tr style="background:#f3f4f6">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Határidő</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Dátum</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Sürgősség</th>
          </tr></thead>
          <tbody>${deadlineRows}</tbody>
        </table>
        <p style="margin-top:16px">
          <a href="https://app.visibill.hu/accounty/tax-calendar"
             style="display:inline-block;padding:10px 24px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">
            Adónaptár megnyitása
          </a>
        </p>
      `

      const todayDeadlines = deadlines.filter((dl: any) => dl.due_date === todayDate)
      const subjectPrefix = todayDeadlines.length > 0 ? 'Sürgős: ' : ''

      // 6. Send to each accountant
      const uniqueUserIds = [...new Set(assignedUsers.map((a: any) => a.accountant_user_id))]
      for (const userId of uniqueUserIds) {
        try {
          await supabase.functions.invoke('send-accounty-notification', {
            body: {
              user_id: userId,
              type: 'accounty_deadline_reminder',
              title: `${deadlines.length} közelgő határidő – ${companyName}`,
              body_html: bodyHtml,
              subject: `${subjectPrefix}Határidő emlékeztető: ${companyName} (${deadlines.length} db)`,
              company_name: companyName,
              company_id: companyId,
            },
          })
          totalNotified++
        } catch (notifErr) {
          console.error(`[accounty-check-deadlines] Notification failed for user ${userId}:`, notifErr)
        }
      }

      console.log(`[accounty-check-deadlines] ${companyName}: ${deadlines.length} deadlines, notified ${uniqueUserIds.length} accountants`)
    }

    const summary = {
      success: true,
      deadlinesFound: upcomingDeadlines.length,
      companiesAffected: Object.keys(byCompany).length,
      notificationsSent: totalNotified,
    }

    console.log('[accounty-check-deadlines] Done.', JSON.stringify(summary))

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[accounty-check-deadlines] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
