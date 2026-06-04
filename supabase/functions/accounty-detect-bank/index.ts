import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * accounty-detect-bank
 * 
 * Bank detektor: megkeresi azon banki tranzakciókat (terheléseket)
 * a `transactions` táblából, amelyekhez nincs párosított számla
 * (matched_invoice_id IS NULL és nincs hozzá nav_invoices.transaction_id sem).
 * Az eredményt az accounty_missing_items táblába írja.
 * 
 * A `transactions` tábla a fő banki tranzakciós tábla (company_id scope-pal).
 */
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('[accounty-detect-bank] Starting bank transaction detection...')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // Optional: restrict to specific company
    let targetCompanyId: string | null = null
    try {
      const body = await req.json()
      targetCompanyId = body?.company_id || null
    } catch {
      // No body
    }

    // 1. Get managed companies
    const { data: assignments } = await supabase
      .from('accounty_assignments')
      .select('company_id')
    
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
      // 2. Get DEBIT transactions without matched invoice
      //    (amount < 0 = terhelés / kimenő pénz, matched_invoice_id IS NULL)
      const minAmount = 10000 // Only track significant transactions
      const { data: unmatchedTxns, error: txnErr } = await supabase
        .from('transactions')
        .select('id, transaction_date, description, amount')
        .eq('company_id', companyId)
        .lt('amount', -minAmount) // negative = debit/outgoing
        .is('matched_invoice_id', null)

      if (txnErr) {
        console.error(`[accounty-detect-bank] Error fetching transactions for ${companyId}:`, txnErr)
        continue
      }
      if (!unmatchedTxns || unmatchedTxns.length === 0) continue

      // 3. Also exclude transactions already linked from nav_invoices.transaction_id
      const txnIds = unmatchedTxns.map((t: any) => t.id)
      const { data: navLinked } = await supabase
        .from('nav_invoices')
        .select('transaction_id')
        .eq('company_id', companyId)
        .in('transaction_id', txnIds)

      const navLinkedIds = new Set((navLinked || []).map((n: any) => n.transaction_id))

      const trulyUnmatched = unmatchedTxns.filter((t: any) => !navLinkedIds.has(t.id))
      if (trulyUnmatched.length === 0) continue

      // 4. Check which ones we already track in accounty_missing_items
      const { data: existing } = await supabase
        .from('accounty_missing_items')
        .select('transaction_id')
        .eq('company_id', companyId)
        .eq('source', 'bank_detektor')
        .in('status', ['open', 'notified'])
        .not('transaction_id', 'is', null)

      const existingTransactionIds = new Set(
        (existing || []).map((e: any) => e.transaction_id)
      )

      // 5. Insert new missing items
      const newItems = trulyUnmatched
        .filter((t: any) => !existingTransactionIds.has(t.id))
        .map((t: any) => {
          const absAmount = Math.abs(t.amount)
          return {
            company_id: companyId,
            category: 'bank',
            title: t.description?.substring(0, 100) || 'Ismeretlen tranzakció',
            subtitle: `Tranzakció dátum: ${t.transaction_date || '–'}`,
            source: 'bank_detektor',
            priority: absAmount > 500000 ? 'urgent' : absAmount > 100000 ? 'medium' : 'low',
            status: 'open',
            details: `Banki terhelés (${new Intl.NumberFormat('hu-HU').format(absAmount)} Ft) amelyhez nem található párosított számla.`,
            amount: absAmount,
            item_date: t.transaction_date,
            transaction_id: t.id,
            resolve_route: `/upload?company=${companyId}`,
          }
        })

      if (newItems.length > 0) {
        const { error: insertErr } = await supabase
          .from('accounty_missing_items')
          .insert(newItems)

        if (insertErr) {
          console.error(`[accounty-detect-bank] Insert error for ${companyId}:`, insertErr)
          continue
        }
        totalInserted += newItems.length
      }
      totalSkipped += existingTransactionIds.size

      console.log(`[accounty-detect-bank] Company ${companyId}: ${newItems.length} new, ${existingTransactionIds.size} already tracked`)
    }

    // 6. Auto-resolve: if a transaction now has a matched_invoice_id, resolve the item
    const { data: openItems } = await supabase
      .from('accounty_missing_items')
      .select('id, transaction_id')
      .eq('source', 'bank_detektor')
      .in('status', ['open', 'notified'])
      .in('company_id', companyIdsToCheck)
      .not('transaction_id', 'is', null)

    let totalResolved = 0
    if (openItems && openItems.length > 0) {
      const openTxnIds = openItems.map((i: any) => i.transaction_id)
      
      // Check which transactions now have a match
      const { data: nowMatched } = await supabase
        .from('transactions')
        .select('id')
        .in('id', openTxnIds)
        .not('matched_invoice_id', 'is', null)

      const nowMatchedIds = new Set((nowMatched || []).map((t: any) => t.id))
      const toResolve = openItems.filter((i: any) => nowMatchedIds.has(i.transaction_id))

      if (toResolve.length > 0) {
        await supabase
          .from('accounty_missing_items')
          .update({ status: 'resolved', resolved_at: new Date().toISOString() })
          .in('id', toResolve.map((i: any) => i.id))

        totalResolved = toResolve.length
      }
    }

    const summary = {
      success: true,
      companiesChecked: companyIdsToCheck.length,
      newUnmatchedTransactions: totalInserted,
      alreadyTracked: totalSkipped,
      autoResolved: totalResolved,
    }

    console.log(`[accounty-detect-bank] Done.`, JSON.stringify(summary))

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[accounty-detect-bank] Error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
