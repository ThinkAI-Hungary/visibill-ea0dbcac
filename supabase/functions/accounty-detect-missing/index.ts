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
    // ── Auth: require CRON_SECRET or valid user token ──
    const cronSecret = Deno.env.get('CRON_SECRET')
    const authHeader = req.headers.get('Authorization')
    let authorized = false

    // Check cron secret (from header or body)
    if (cronSecret) {
      const secretHeader = req.headers.get('x-cron-secret')
      if (secretHeader === cronSecret) authorized = true
    }

    // Check user JWT as fallback (for manual trigger from admin UI)
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

    const summary = {
      success: true,
      companiesChecked: companyIdsToCheck.length,
      newMissingItems: totalInserted,
      alreadyTracked: totalSkipped,
      autoResolved: totalResolved,
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
