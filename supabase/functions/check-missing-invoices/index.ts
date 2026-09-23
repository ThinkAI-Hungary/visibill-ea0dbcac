import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Require shared cron secret to prevent unauthenticated triggering / email spam.
    const cronSecret = Deno.env.get('CRON_SECRET')
    const provided = req.headers.get('x-cron-secret')
    if (!cronSecret || provided !== cronSecret) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    console.log('[missing-invoices] Starting weekly check...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')

    if (!companies || companies.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No companies' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let totalNotifications = 0

    for (const company of companies) {
      // Get all INBOUND NAV invoice numbers for this company
      const { data: navInvoices } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, supplier_name, supplier_tax_number, invoice_gross_amount, invoice_issue_date')
        .eq('company_id', company.id)
        .eq('invoice_direction', 'INBOUND')

      if (!navInvoices || navInvoices.length === 0) continue

      // Get all uploaded invoice numbers (bizonylatsorszam) for this company
      const { data: uploadedInvoices } = await supabase
        .from('invoices')
        .select('bizonylatsorszam')
        .eq('company_id', company.id)

      const uploadedNumbers = new Set(
        (uploadedInvoices || []).map(inv => inv.bizonylatsorszam).filter(Boolean)
      )

      // Find NAV invoices without uploaded counterpart
      const missing = navInvoices.filter(inv => !uploadedNumbers.has(inv.invoice_number))

      if (missing.length === 0) continue

      // Sync missing invoices into accounty_missing_items so they appear on the magic link portal
      const { data: existingItems } = await supabase
        .from('accounty_missing_items')
        .select('id, invoice_number')
        .eq('company_id', company.id)
        .not('invoice_number', 'is', null)

      const existingMap = new Map<string, string>(
        (existingItems || []).map((i: any) => [i.invoice_number, i.id])
      )

      const missingItemIds: string[] = []
      const toInsert: any[] = []

      for (const inv of missing) {
        if (existingMap.has(inv.invoice_number)) {
          missingItemIds.push(existingMap.get(inv.invoice_number)!)
        } else {
          toInsert.push({
            company_id: company.id,
            category: 'bejovo',
            title: inv.supplier_name || 'Ismeretlen szállító',
            subtitle: `Számlaszám: ${inv.invoice_number}`,
            source: 'nav_detektor',
            priority: Math.abs(inv.invoice_gross_amount || 0) > 500000 ? 'urgent' : 'medium',
            status: 'open',
            amount: inv.invoice_gross_amount,
            invoice_number: inv.invoice_number,
            item_date: inv.invoice_issue_date,
            nav_invoice_id: inv.id || null,
            details: {
              supplier_name: inv.supplier_name,
              supplier_tax_number: inv.supplier_tax_number,
              gross_amount: inv.invoice_gross_amount,
              issue_date: inv.invoice_issue_date,
            },
          })
        }
      }

      if (toInsert.length > 0) {
        const { data: inserted, error: insertErr } = await supabase
          .from('accounty_missing_items')
          .insert(toInsert)
          .select('id')
        if (!insertErr && inserted) {
          for (const row of inserted) {
            missingItemIds.push(row.id)
          }
        } else if (insertErr) {
          console.error(`[missing-invoices] Failed to insert missing items for ${company.name}:`, insertErr)
        }
      }

      // Notify all company members
      const { data: members } = await supabase
        .from('company_members')
        .select('user_id, role')
        .eq('company_id', company.id)

      // Find or create active portal token
      let portalToken: string | null = null
      const minExpiryIso = new Date(Date.now() + 7 * 86400000).toISOString()

      const { data: existingTokens } = await supabase
        .from('accounty_portal_tokens')
        .select('token, requested_item_ids')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .gt('expires_at', minExpiryIso)
        .order('created_at', { ascending: false })
        .limit(1)

      if (existingTokens && existingTokens.length > 0) {
        portalToken = existingTokens[0].token
        // Update requested_item_ids with latest missing item IDs
        await supabase
          .from('accounty_portal_tokens')
          .update({ requested_item_ids: missingItemIds })
          .eq('token', portalToken)
      } else {
        // Resolve created_by: assigned accountant or company owner
        const { data: assignment } = await supabase
          .from('accounty_assignments')
          .select('accountant_user_id')
          .eq('company_id', company.id)
          .limit(1)
          .maybeSingle()

        const ownerMember = (members || []).find((m: any) => m.role === 'owner')
        const creatorUserId = assignment?.accountant_user_id || ownerMember?.user_id || members?.[0]?.user_id

        if (creatorUserId) {
          const newToken = crypto.randomUUID()
          const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()
          const { data: createdToken, error: tokenErr } = await supabase
            .from('accounty_portal_tokens')
            .insert({
              company_id: company.id,
              token: newToken,
              created_by: creatorUserId,
              expires_at: expiresAt,
              is_active: true,
              requested_item_ids: missingItemIds,
            })
            .select('token')
            .single()

          if (!tokenErr && createdToken) {
            portalToken = createdToken.token
          } else if (tokenErr) {
            console.error(`[missing-invoices] Failed to create portal token for ${company.name}:`, tokenErr)
          }
        }
      }

      // Limit the list shown in the email
      const showMax = 10
      const shownInvoices = missing.slice(0, showMax)
      const remaining = missing.length - showMax

      let tableHtml = '<table style="width:100%;border-collapse:collapse;margin:12px 0">'
      tableHtml += '<tr style="background:#f3f4f6"><th style="padding:8px;text-align:left;font-size:12px">Sz\u00e1ll\u00edt\u00f3</th><th style="padding:8px;text-align:left;font-size:12px">Sz\u00e1mlasz\u00e1m</th><th style="padding:8px;text-align:right;font-size:12px">D\u00e1tum</th><th style="padding:8px;text-align:right;font-size:12px">\u00d6sszeg</th></tr>'

      for (const inv of shownInvoices) {
        const amt = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(Math.abs(inv.invoice_gross_amount || 0))
        tableHtml += `<tr><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #e5e7eb">${inv.supplier_name || '\u2014'}</td><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #e5e7eb">${inv.invoice_number}</td><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #e5e7eb;text-align:right">${inv.invoice_issue_date || '\u2014'}</td><td style="padding:6px 8px;font-size:13px;border-bottom:1px solid #e5e7eb;text-align:right">${amt} Ft</td></tr>`
      }
      tableHtml += '</table>'
      if (remaining > 0) {
        tableHtml += `<p style="font-size:13px;color:#6b7280">\u00c9s m\u00e9g tov\u00e1bbi <strong>${remaining}</strong> hi\u00e1nyz\u00f3 sz\u00e1mla...</p>`
      }

      const appUrl = Deno.env.get('APP_URL') || 'https://app.visibill.hu'
      const portalUrl = portalToken
        ? `${appUrl}/portal/${portalToken}?company_name=${encodeURIComponent(company.name)}`
        : `${appUrl}/upload`

      const bodyHtml = `<p>A NAV rendszer\u00e9ben <strong>${missing.length}</strong> bej\u00f6v\u0151 sz\u00e1mla tal\u00e1lhat\u00f3, amelyhez <strong>nincs felt\u00f6ltve sz\u00e1mlam\u00e1solat</strong> a Visibill-ben.</p>${tableHtml}<p style="margin-top:16px"><a href="${portalUrl}" style="display:inline-block;padding:10px 20px;background:#0070f3;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Sz\u00e1ml\u00e1k felt\u00f6lt\u00e9se</a></p>`

      for (const member of (members || [])) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: member.user_id,
              type: 'missing_invoices',
              title: `Hi\u00e1nyz\u00f3 sz\u00e1ml\u00e1k \u2014 ${company.name}`,
              body_html: bodyHtml,
            }),
          })
          totalNotifications++
        } catch (e) {
          console.error(`[missing-invoices] Notify failed:`, e)
        }
      }
    }

    console.log(`[missing-invoices] Done. ${totalNotifications} notifications sent.`)

    return new Response(JSON.stringify({ success: true, notifications: totalNotifications }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[missing-invoices] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
