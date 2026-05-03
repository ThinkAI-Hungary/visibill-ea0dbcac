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
        .select('invoice_number, supplier_name, invoice_gross_amount, invoice_issue_date')
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

      const bodyHtml = `<p>A NAV rendszer\u00e9ben <strong>${missing.length}</strong> bej\u00f6v\u0151 sz\u00e1mla tal\u00e1lhat\u00f3, amelyhez <strong>nincs felt\u00f6ltve sz\u00e1mlam\u00e1solat</strong> a Visibill-ben.</p>${tableHtml}<p style="margin-top:16px"><a href="https://app.visibill.hu/upload" style="display:inline-block;padding:10px 20px;background:#0070f3;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Sz\u00e1ml\u00e1k felt\u00f6lt\u00e9se</a></p>`

      // Notify all company members
      const { data: members } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', company.id)

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
