import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * accounty-detect-missing
 * 
 * NAV detektor: megkeresi azon bejövő NAV számlákat, amelyekhez
 * nincs feltöltve bizonylat az invoices táblában.
 * Az eredményt az accounty_missing_items táblába írja (upsert).
 * 
 * Futtatható cron-ból vagy kézzel hívva.
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

    // Check cron secret (from header or body)
    if (cronSecret) {
      const secretHeader = req.headers.get('x-cron-secret')
      if (secretHeader === cronSecret) authorized = true
    }

    // Check user JWT or service role key as fallback
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

    console.log('[accounty-detect-missing] Starting NAV missing invoice detection...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Optional: restrict to specific company
    let targetCompanyId: string | null = null
    try {
      const body = await req.json()
      targetCompanyId = body?.company_id || null
    } catch {
      // No body or not JSON – run for all companies
    }

    // 1. Get companies that have accounty assignments (= managed by accounting firm)
    const assignmentsQuery = supabase
      .from('accounty_assignments')
      .select('company_id')
    
    const { data: assignments, error: assignErr } = await assignmentsQuery
    if (assignErr) throw assignErr

    const managedCompanyIds = [...new Set((assignments || []).map((a: any) => a.company_id))]
    
    if (managedCompanyIds.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No managed companies', inserted: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const companyIdsToCheck = targetCompanyId 
      ? managedCompanyIds.filter(id => id === targetCompanyId)
      : managedCompanyIds

    // Collect new missing items per company for batched notification
    const newItemsByCompany: Record<string, { companyName: string; items: any[] }> = {}
    let totalInserted = 0
    let totalSkipped = 0

    for (const companyId of companyIdsToCheck) {
      // 2. Get all INBOUND NAV invoices for this company
      const { data: navInvoices, error: navErr } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, supplier_name, supplier_tax_number, invoice_gross_amount, invoice_issue_date')
        .eq('company_id', companyId)
        .eq('invoice_direction', 'INBOUND')

      if (navErr) {
        console.error(`[accounty-detect-missing] Error fetching NAV invoices for ${companyId}:`, navErr)
        continue
      }
      if (!navInvoices || navInvoices.length === 0) continue

      // 3. Get all uploaded invoice numbers for this company
      const { data: uploadedInvoices } = await supabase
        .from('invoices')
        .select('bizonylatsorszam')
        .eq('company_id', companyId)

      const uploadedNumbers = new Set(
        (uploadedInvoices || []).map((inv: any) => inv.bizonylatsorszam).filter(Boolean)
      )

      // 4. Find NAV invoices without uploaded counterpart
      const missing = navInvoices.filter((inv: any) => !uploadedNumbers.has(inv.invoice_number))
      if (missing.length === 0) continue

      // 5. Check which ones we already have in accounty_missing_items (avoid duplicates)
      const existingInvoiceNumbers = missing.map((m: any) => m.invoice_number)
      const { data: existing } = await supabase
        .from('accounty_missing_items')
        .select('invoice_number')
        .eq('company_id', companyId)
        .eq('source', 'nav_detektor')
        .in('status', ['open', 'notified'])
        .in('invoice_number', existingInvoiceNumbers)

      const existingSet = new Set((existing || []).map((e: any) => e.invoice_number))

      // 6. Insert new missing items
      const newItems = missing
        .filter((inv: any) => !existingSet.has(inv.invoice_number))
        .map((inv: any) => {
          const amount = Math.abs(inv.invoice_gross_amount || 0)
          const isOld = inv.invoice_issue_date && 
            (new Date().getTime() - new Date(inv.invoice_issue_date).getTime()) > 30 * 24 * 60 * 60 * 1000

          return {
            company_id: companyId,
            category: 'bejovo',
            title: inv.supplier_name || 'Ismeretlen szállító',
            subtitle: `Számla: ${inv.invoice_number}`,
            source: 'nav_detektor',
            priority: amount > 500000 || isOld ? 'urgent' : amount > 100000 ? 'medium' : 'low',
            status: 'open',
            details: `NAV-ban szerepel bejövő számla (${inv.invoice_number}), de nincs hozzá feltöltött bizonylat.`,
            amount: amount || null,
            invoice_number: inv.invoice_number,
            item_date: inv.invoice_issue_date || null,
            nav_invoice_id: inv.id,
            resolve_route: `/upload?company=${companyId}`,
          }
        })

      if (newItems.length > 0) {
        const { error: insertErr } = await supabase
          .from('accounty_missing_items')
          .insert(newItems)

        if (insertErr) {
          console.error(`[accounty-detect-missing] Insert error for ${companyId}:`, insertErr)
          continue
        }
        totalInserted += newItems.length

        // Get company name for notification
        const { data: companyData } = await supabase
          .from('companies')
          .select('name')
          .eq('id', companyId)
          .single()
        const companyName = (companyData as any)?.name || 'Ismeretlen cég'

        // ── Notify assigned accountants about NEW missing items only ──
        try {
          const { data: assignedUsers } = await supabase
            .from('accounty_assignments')
            .select('accountant_user_id')
            .eq('company_id', companyId)

          if (assignedUsers && assignedUsers.length > 0) {
            // Build items summary (show max 5 items)
            const itemsSummary = newItems.slice(0, 5).map((item: any) =>
              `<tr><td style="padding:6px 12px;border-top:1px solid #e5e7eb;font-size:13px">${item.title}</td><td style="padding:6px 12px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">${item.subtitle}</td></tr>`
            ).join('')
            const moreText = newItems.length > 5 ? `<p style="font-size:13px;color:#6b7280;margin-top:8px">...és további ${newItems.length - 5} tétel</p>` : ''

            const bodyHtml = `
              <p><strong>${companyName}</strong> cégnél <strong>${newItems.length}</strong> új hiányzó bejövő számlát azonosítottunk a NAV adatok alapján.</p>
              <table style="width:100%;border-collapse:collapse;margin:12px 0;border:1px solid #e5e7eb;border-radius:6px">
                <thead><tr style="background:#f3f4f6">
                  <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Szállító</th>
                  <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase">Számla</th>
                </tr></thead>
                <tbody>${itemsSummary}</tbody>
              </table>
              ${moreText}
              <p style="margin-top:16px">
                <a href="https://app.visibill.hu/accounty/missing-invoices" 
                   style="display:inline-block;padding:10px 24px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">
                  Hiányzó számlák megtekintése
                </a>
              </p>
            `

            // Send to each assigned accountant
            const uniqueUserIds = [...new Set(assignedUsers.map((a: any) => a.accountant_user_id))]
            for (const userId of uniqueUserIds) {
              try {
                await supabase.functions.invoke('send-accounty-notification', {
                  body: {
                    user_id: userId,
                    type: 'accounty_missing_invoice',
                    title: `${newItems.length} új hiányzó számla – ${companyName}`,
                    body_html: bodyHtml,
                    subject: `Hiányzó számlák: ${companyName} (${newItems.length} db)`,
                    company_name: companyName,
                    company_id: companyId,
                  },
                })
              } catch (notifErr) {
                console.error(`[accounty-detect-missing] Notification failed for user ${userId}:`, notifErr)
              }
            }
            console.log(`[accounty-detect-missing] Notified ${uniqueUserIds.length} accountants about ${newItems.length} NEW missing items for ${companyName}`)
          }
        } catch (notifErr) {
          console.error(`[accounty-detect-missing] Notification error for ${companyId}:`, notifErr)
        }
      }
      totalSkipped += existingSet.size

      console.log(`[accounty-detect-missing] Company ${companyId}: ${newItems.length} new, ${existingSet.size} already tracked, ${uploadedNumbers.size} uploaded`)
    }

    // 7. Auto-resolve: if a previously missing invoice now has an upload, mark it resolved
    const { data: openItems } = await supabase
      .from('accounty_missing_items')
      .select('id, company_id, invoice_number')
      .eq('source', 'nav_detektor')
      .in('status', ['open', 'notified'])
      .in('company_id', companyIdsToCheck)

    let totalResolved = 0
    if (openItems && openItems.length > 0) {
      // Group by company for batch checking
      const byCompany: Record<string, any[]> = {}
      openItems.forEach((item: any) => {
        if (!byCompany[item.company_id]) byCompany[item.company_id] = []
        byCompany[item.company_id].push(item)
      })

      for (const [compId, items] of Object.entries(byCompany)) {
        const invoiceNumbers = items.map(i => i.invoice_number).filter(Boolean)
        if (invoiceNumbers.length === 0) continue

        const { data: nowUploaded } = await supabase
          .from('invoices')
          .select('bizonylatsorszam')
          .eq('company_id', compId)
          .in('bizonylatsorszam', invoiceNumbers)

        const nowUploadedSet = new Set((nowUploaded || []).map((u: any) => u.bizonylatsorszam))
        const toResolve = items.filter(i => nowUploadedSet.has(i.invoice_number))

        if (toResolve.length > 0) {
          await supabase
            .from('accounty_missing_items')
            .update({ status: 'resolved', resolved_at: new Date().toISOString() })
            .in('id', toResolve.map(i => i.id))

          totalResolved += toResolve.length
        }
      }
    }

    // ── 8. Client Status Change Detection ──
    // Compute current status for each company, compare with last_computed_status,
    // and notify if it changed (especially if it worsened).
    let totalStatusChanges = 0

    for (const companyId of companyIdsToCheck) {
      try {
        // Count open missing items for this company
        const { count: missingCount } = await supabase
          .from('accounty_missing_items')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .in('status', ['open', 'notified'])

        const missing = missingCount || 0

        // computeStatus logic (mirrors frontend useAccountyHelpers.ts)
        let currentStatus: string
        if (missing > 3) currentStatus = 'Kritikus'
        else if (missing > 0) currentStatus = 'Feldolgozandó'
        else currentStatus = 'Rendben'

        // Get all assignments for this company to check last_computed_status
        const { data: assigns } = await supabase
          .from('accounty_assignments')
          .select('id, accountant_user_id, last_computed_status')
          .eq('company_id', companyId)

        if (!assigns || assigns.length === 0) continue

        // Check if status changed (use first assignment's last_computed_status as reference)
        const previousStatus = (assigns[0] as any).last_computed_status || 'Rendben'

        if (currentStatus !== previousStatus) {
          // Get company name
          const { data: companyData } = await supabase
            .from('companies')
            .select('name')
            .eq('id', companyId)
            .single()
          const companyName = (companyData as any)?.name || 'Ismeretlen cég'

          const statusColors: Record<string, string> = {
            'Rendben': '#059669',
            'Feldolgozandó': '#d97706',
            'Kritikus': '#dc2626',
          }

          const worsened = (
            (previousStatus === 'Rendben' && currentStatus !== 'Rendben') ||
            (previousStatus === 'Feldolgozandó' && currentStatus === 'Kritikus')
          )

          const bodyHtml = `
            <p><strong>${companyName}</strong> ügyfél státusza megváltozott:</p>
            <div style="display:flex;align-items:center;gap:12px;margin:16px 0;padding:16px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
              <div style="text-align:center">
                <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Előző</div>
                <span style="padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;color:${statusColors[previousStatus] || '#6b7280'};background:${previousStatus === 'Kritikus' ? '#fef2f2' : previousStatus === 'Feldolgozandó' ? '#fffbeb' : '#f0fdf4'}">${previousStatus}</span>
              </div>
              <div style="font-size:20px;color:#9ca3af">→</div>
              <div style="text-align:center">
                <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">Jelenlegi</div>
                <span style="padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;color:${statusColors[currentStatus] || '#6b7280'};background:${currentStatus === 'Kritikus' ? '#fef2f2' : currentStatus === 'Feldolgozandó' ? '#fffbeb' : '#f0fdf4'}">${currentStatus}</span>
              </div>
            </div>
            <p style="font-size:13px;color:#6b7280">Nyitott hiányzó tételek: <strong>${missing}</strong></p>
            ${worsened ? '<p style="font-size:13px;color:#dc2626;font-weight:600">Az ügyfél státusza romlott — azonnali intézkedés szükséges lehet.</p>' : '<p style="font-size:13px;color:#059669">Az ügyfél státusza javult.</p>'}
            <p style="margin-top:16px">
              <a href="https://app.visibill.hu/accounty/client/${companyId}"
                 style="display:inline-block;padding:10px 24px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">
                Ügyfél megtekintése
              </a>
            </p>
          `

          // Notify each assigned accountant
          const uniqueUserIds = [...new Set(assigns.map((a: any) => a.accountant_user_id))]
          for (const userId of uniqueUserIds) {
            try {
              await supabase.functions.invoke('send-accounty-notification', {
                body: {
                  user_id: userId,
                  type: 'accounty_client_status',
                  title: `Ügyfél státusz változás – ${companyName}`,
                  body_html: bodyHtml,
                  subject: `${companyName}: ${previousStatus} → ${currentStatus}`,
                  company_name: companyName,
                  company_id: companyId,
                },
              })
            } catch (notifErr) {
              console.error(`[accounty-detect-missing] Status notification failed for user ${userId}:`, notifErr)
            }
          }

          totalStatusChanges++
          console.log(`[accounty-detect-missing] Status change for ${companyName}: ${previousStatus} → ${currentStatus}`)
        }

        // Update last_computed_status on all assignments for this company
        await supabase
          .from('accounty_assignments')
          .update({ last_computed_status: currentStatus })
          .eq('company_id', companyId)

      } catch (statusErr) {
        console.error(`[accounty-detect-missing] Status check error for ${companyId}:`, statusErr)
      }
    }

    const summary = {
      success: true,
      companiesChecked: companyIdsToCheck.length,
      newMissingItems: totalInserted,
      alreadyTracked: totalSkipped,
      autoResolved: totalResolved,
      statusChangesDetected: totalStatusChanges,
    }

    console.log(`[accounty-detect-missing] Done.`, JSON.stringify(summary))

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[accounty-detect-missing] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
