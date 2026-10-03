// =============================================================================
// NAV Online Számla v3 – Szinkronizációs & Adatbázis Ingestion Szolgáltatás
// =============================================================================
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { NavCredentials, NavSyncOptions, NavSyncResult, NavInvoiceDigest } from './types.ts';
import { NavClient } from './nav-client.ts';
import { sanitizeTaxNumber } from './crypto.ts';

export interface IngestionOptions extends NavSyncOptions {
  userId: string;
  syncType?: 'manual' | 'cron' | 'single_query';
  fetchDetailedItems?: boolean;
}

export class NavIngestionService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Cég vagy felhasználó NAV hitelesítő adatainak lekérése a titkosított tárolóból.
   */
  async getCredentials(userId: string, companyId?: string | null): Promise<NavCredentials> {
    const { data: credsResult, error: credsError } = await this.supabase.rpc(
      'get_nav_credentials',
      { p_user_id: userId, p_company_id: companyId || null }
    );

    if (credsError || !credsResult || credsResult.error) {
      const msg = credsError?.message || credsResult?.error || 'A NAV hitelesítő adatok nem találhatók.';
      throw new Error(msg);
    }

    return credsResult as NavCredentials;
  }

  /**
   * Teljes szinkronizációs folyamat végrehajtása naplózással, dedup mentéssel és partner cache-eléssel.
   */
  async executeSync(options: IngestionOptions): Promise<NavSyncResult> {
    const startTime = Date.now();
    const effectiveCompanyId = options.companyId || null;

    // 1. Hitelesítő adatok lekérése
    const credentials = await this.getCredentials(options.userId, effectiveCompanyId);
    const navClient = new NavClient(credentials);

    // 2. Szinkronizációs log létrehozása
    let syncLogId: string | undefined;
    if (options.syncType !== 'single_query') {
      try {
        const { data: syncLog } = await this.supabase
          .from('nav_sync_logs')
          .insert({
            user_id: options.userId,
            company_id: effectiveCompanyId,
            sync_type: options.syncType || 'manual',
            invoice_direction: options.direction,
            date_from: options.dateFrom,
            date_to: options.dateTo,
            status: 'running'
          })
          .select('id')
          .single();

        syncLogId = syncLog?.id;
      } catch (logErr) {
        console.warn('[NavIngestionService] Sync log creation warning:', logErr);
      }
    }

    try {
      // 3. Számlák lekérése a NAV API-ból
      const invoices = options.page
        ? await navClient.queryInvoiceDigest(options)
        : await navClient.fetchAllInvoices(options);

      let totalInserted = 0;

      // 4. Számlák mentése és dedup upsert
      if (invoices.length > 0) {
        totalInserted = await this.persistInvoices(invoices, options.direction, effectiveCompanyId, options.userId);

        // 5. Partnerek automatikus szinkronizálása / frissítése (ADR A-024)
        if (effectiveCompanyId) {
          await this.syncPartnersFromInvoices(invoices, options.direction, effectiveCompanyId, options.userId, navClient);
        }

        // 6. Opcionális tételszintű részletek letöltése (ha kérték)
        if (options.fetchDetailedItems) {
          await this.fetchAndPersistDetails(navClient, invoices, options.direction, effectiveCompanyId);
        }

        // 7. Automatikus tranzakció újrapárosítás indítása (ha érkeztek új számlák)
        if (effectiveCompanyId && totalInserted > 0) {
          try {
            await this.supabase.rpc('pgmq_send_retry', {
              queue_name: 'transaction_jobs',
              msg: {
                job_type: 'rematch',
                company_id: effectiveCompanyId,
                user_id: options.userId,
                source: 'nav_sync',
                sync_log_id: syncLogId,
              }
            });
            console.log(`[NavIngestionService] Rematch job enqueued for company ${effectiveCompanyId} (${totalInserted} new invoices)`);
          } catch (qErr) {
            console.warn('[NavIngestionService] Failed to enqueue rematch job:', qErr);
          }
        }
      }

      // 7. Hitelesítő adatok státuszának előléptetése 'valid'-ra (ADR A-012 / A-024)
      await this.promoteValidationStatus(options.userId, effectiveCompanyId, options.direction);

      // 8. Szinkronizációs log lezárása sikeres státusszal
      if (syncLogId) {
        await this.supabase
          .from('nav_sync_logs')
          .update({
            status: 'completed',
            invoices_fetched: invoices.length,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime
          })
          .eq('id', syncLogId);
      }

      return {
        success: true,
        totalFetched: invoices.length,
        totalInserted,
        syncLogId,
        invoices,
        page: options.page
      };

    } catch (err: any) {
      // Hiba naplózása a sync logba
      const errMsg = err?.message || String(err);
      if (syncLogId) {
        await this.supabase
          .from('nav_sync_logs')
          .update({
            status: 'failed',
            error_message: errMsg,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime
          })
          .eq('id', syncLogId);
      }

      // Ha a bejövő (INBOUND) számlák lekérdezése 403 / FORBIDDEN jogosultsági hiba miatt bukott el,
      // jelöljük a user_nav_credentials rekordot invalid-ként a pontos magyarázattal,
      // így a felhasználó a felületen azonnal látja a teendőt, és az auto-sync sem próbálkozik feleslegesen.
      if (
        options.direction === 'INBOUND' &&
        (errMsg.includes('FORBIDDEN') || errMsg.includes('Jogosultság szükséges') || errMsg.includes('403'))
      ) {
        try {
          const matchFilter = effectiveCompanyId
            ? { company_id: effectiveCompanyId }
            : { user_id: options.userId };
          await this.supabase
            .from('user_nav_credentials')
            .update({
              validation_status: 'invalid',
              validation_error: 'A technikai felhasználó kulcsai helyesek, de hiányzik a „Számlák lekérdezése” jogosultság a NAV portálon! Kérjük, engedélyezd az onlineszamla.nav.gov.hu felületen.',
              last_validated_at: new Date().toISOString()
            })
            .match(matchFilter);
        } catch (credUpdateErr) {
          console.warn('[NavIngestionService] Failed to update invalid status for forbidden credentials:', credUpdateErr);
        }
      }

      throw err;
    }
  }

  /**
   * Számlák mentése a nav_invoices táblába deduplikációval.
   */
  async persistInvoices(
    invoices: NavInvoiceDigest[],
    direction: 'INBOUND' | 'OUTBOUND',
    companyId: string | null,
    userId: string
  ): Promise<number> {
    const invoicesToInsert = invoices.map(inv => ({
      ...inv,
      company_id: companyId,
      user_id: userId,
      invoice_direction: direction,
      fetched_at: new Date().toISOString()
    }));

    // Számlaszám és cég alapján deduplikálunk a batch upsert előtt
    const seen = new Map<string, (typeof invoicesToInsert)[0]>();
    for (const inv of invoicesToInsert) {
      const key = `${inv.company_id || ''}_${inv.invoice_number}`;
      seen.set(key, inv);
    }
    const dedupedInvoices = Array.from(seen.values());

    // Batch upsert 100-as darabokban
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < dedupedInvoices.length; i += batchSize) {
      const batch = dedupedInvoices.slice(i, i + batchSize);
      const { error } = await this.supabase
        .from('nav_invoices')
        .upsert(batch, {
          onConflict: 'company_id,invoice_number',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('[NavIngestionService] Invoices batch upsert error:', error);
        throw new Error(`Számlák adatbázis mentése sikertelen: ${error.message}`);
      }
      insertedCount += batch.length;
    }

    return insertedCount;
  }

  /**
   * Partnerek automatikus létrehozása és frissítése ADR A-024 szerint.
   */
  async syncPartnersFromInvoices(
    invoices: NavInvoiceDigest[],
    direction: 'INBOUND' | 'OUTBOUND',
    companyId: string,
    userId?: string | null,
    navClient?: NavClient
  ): Promise<void> {
    try {
      const requiredType = direction === 'OUTBOUND' ? 'customer' : 'supplier';

      // 1. Egyedi adószámok összegyűjtése a számlákból
      const partnerMap = new Map<string, { name: string; taxNumber: string }>();
      for (const inv of invoices) {
        const taxNumber = direction === 'OUTBOUND' ? inv.customer_tax_number : inv.supplier_tax_number;
        const name = direction === 'OUTBOUND' ? inv.customer_name : inv.supplier_name;
        const baseTax = sanitizeTaxNumber(taxNumber);

        if (baseTax && name && !partnerMap.has(baseTax)) {
          partnerMap.set(baseTax, { name, taxNumber });
        }
      }

      if (partnerMap.size === 0) return;

      // 2. Meglévő partnerek lekérdezése
      const { data: existingPartners } = await this.supabase
        .from('partners')
        .select('id, tax_number, partner_type')
        .eq('company_id', companyId);

      const existingBaseMap = new Map<string, { id: string; partner_type: string }>();
      (existingPartners || []).forEach((p: any) => {
        const base = sanitizeTaxNumber(p.tax_number);
        if (base) existingBaseMap.set(base, { id: p.id, partner_type: p.partner_type });
      });

      const toInsert: any[] = [];
      const toUpdate: { id: string; partner_type: string }[] = [];

      for (const [baseTax, partner] of partnerMap.entries()) {
        const existing = existingBaseMap.get(baseTax);
        if (!existing) {
          toInsert.push({
            company_id: companyId,
            user_id: userId || null,
            name: partner.name,
            tax_number: partner.taxNumber,
            partner_type: requiredType
          });
        } else if (existing.partner_type !== 'both' && existing.partner_type !== requiredType) {
          toUpdate.push({
            id: existing.id,
            partner_type: 'both'
          });
        }
      }

      // 3. Batch INSERT új partnereknek - NAV adóalanyi lekérdezéssel gazdagítva 8-1-2-re (max 10 partner/szinkron a timeout megelőzésére)
      if (toInsert.length > 0) {
        if (navClient) {
          const maxTaxpayerEnrichment = 10;
          let enrichedCount = 0;
          for (const item of toInsert) {
            if (enrichedCount >= maxTaxpayerEnrichment) break;
            const clean8 = sanitizeTaxNumber(item.tax_number);
            if (clean8 && clean8.length === 8) {
              try {
                const taxpayerDetails = await navClient.queryTaxpayer(clean8);
                if (taxpayerDetails?.taxpayerValidity && taxpayerDetails.taxNumber) {
                  item.tax_number = taxpayerDetails.taxNumber;
                  if (taxpayerDetails.taxpayerShortName || taxpayerDetails.taxpayerName) {
                    item.name = taxpayerDetails.taxpayerShortName || taxpayerDetails.taxpayerName;
                  }
                  if (taxpayerDetails.address?.formattedAddress) {
                    item.address = taxpayerDetails.address.formattedAddress;
                  }
                }
                enrichedCount++;
              } catch {
                // Nem blokkoló: ha a NAV queryTaxpayer sikertelen, marad a számla fejlécéből vett adat
              }
            }
          }
        }
        await this.supabase.from('partners').insert(toInsert);
      }

      // 4. Update 'both' típusra
      for (const update of toUpdate) {
        await this.supabase
          .from('partners')
          .update({ partner_type: update.partner_type })
          .eq('id', update.id);
      }

    } catch {
      // Csendes hibakezelés konzol naplózás nélkül
    }
  }

  /**
   * Részletes számla tételek lekérése és mentése.
   */
  async fetchAndPersistDetails(
    navClient: NavClient,
    invoices: NavInvoiceDigest[],
    direction: 'INBOUND' | 'OUTBOUND',
    companyId: string | null
  ): Promise<void> {
    for (const inv of invoices) {
      try {
        const details = await navClient.queryInvoiceData(inv.invoice_number, direction);

        // Számla ID és company_id kikeresése a nav_invoices táblából
        let query = this.supabase
          .from('nav_invoices')
          .select('id, company_id')
          .eq('invoice_number', inv.invoice_number);

        if (companyId) query = query.eq('company_id', companyId);
        const { data: dbInvoice } = await query.maybeSingle();

        if (dbInvoice?.id) {
          const hasContent = (details.lineItems && details.lineItems.length > 0) || details.supplierAddress || details.customerAddress || !!details.vatSummary;
          if (!hasContent) {
            console.warn(`[NavIngestionService] No details returned by NAV for ${inv.invoice_number}, skipping details_fetched mark.`);
            continue;
          }

          // 1. Szülő nav_invoices rekord frissítése a kiegészítő adatokkal
          const invoiceUpdates: Record<string, any> = { details_fetched: true };
          if (details.supplierAddress) invoiceUpdates.supplier_address = details.supplierAddress;
          if (details.customerAddress) invoiceUpdates.customer_address = details.customerAddress;
          if (details.isCashAccounting !== undefined) invoiceUpdates.is_cash_accounting = details.isCashAccounting;
          if (details.originalInvoiceNumber) invoiceUpdates.original_invoice_number = details.originalInvoiceNumber;
          if (details.vatSummary) {
            invoiceUpdates.vat_summary = details.vatSummary;
            if (details.vatSummary.hasReverseCharge) {
              invoiceUpdates.is_reverse_charge = true;
              invoiceUpdates.reverse_charge_category = 'DOMESTIC_142';
            }
          }

          // 2. Szülő rekord és tételsorok atomi, idempotens mentése tárolt eljárással (RPC)
          const resolvedCompanyId = dbInvoice.company_id || companyId || null;
          const itemsToInsert = (details.lineItems && details.lineItems.length > 0)
            ? details.lineItems.map(item => ({
                company_id: resolvedCompanyId,
                line_number: item.lineNumber,
                line_description: item.lineDescription || null,
                quantity: item.quantity || null,
                unit_of_measure: item.unitOfMeasure || null,
                unit_price: item.unitPrice || null,
                net_amount: item.netAmount || 0,
                vat_rate: item.vatRate || null,
                vat_amount: item.vatAmount || 0,
                gross_amount: item.grossAmount || 0,
                product_code: item.productCode || null,
                line_delivery_period_from: item.lineDeliveryPeriodFrom || null,
                line_delivery_period_to: item.lineDeliveryPeriodTo || null
              }))
            : [];

          const { error: rpcErr } = await this.supabase.rpc('save_nav_invoice_details_and_items', {
            p_invoice_id: dbInvoice.id,
            p_invoice_updates: invoiceUpdates,
            p_line_items: itemsToInsert,
          });

          if (rpcErr) {
            console.error(`[NavIngestionService] Failed to persist details via RPC for ${inv.invoice_number}:`, rpcErr);
            throw rpcErr;
          }
        }
      } catch (detailErr) {
        console.warn(`[NavIngestionService] Failed to fetch details for invoice ${inv.invoice_number}:`, detailErr);
      }
    }
  }

  /**
   * Hiányzó számlarészletek és tételsorok kötegelt lekérése a háttérmunkás (Worker) vagy UI számára.
   */
  async fetchDetailsBatch(
    userId: string,
    companyId: string,
    options?: {
      limit?: number;
      invoiceId?: string;
      invoiceNumbers?: string[];
    }
  ): Promise<{
    processedCount: number;
    failedCount: number;
    remainingCount: number;
  }> {
    // 1. Hitelesítő adatok lekérése
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const { data: credRow } = await this.supabase
        .from('user_nav_credentials')
        .select('user_id')
        .eq('company_id', companyId)
        .eq('validation_status', 'valid')
        .limit(1)
        .maybeSingle();

      if (credRow?.user_id) {
        effectiveUserId = credRow.user_id;
      } else {
        throw new Error(`Nem található érvényes NAV hitelesítő adat a(z) ${companyId} céghez.`);
      }
    }

    const credentials = await this.getCredentials(effectiveUserId, companyId);
    const navClient = new NavClient(credentials);

    // 2. Érintett számlák lekérdezése
    let query = this.supabase
      .from('nav_invoices')
      .select('id, invoice_number, invoice_direction, company_id')
      .eq('company_id', companyId)
      .or('details_fetched.is.null,details_fetched.eq.false');

    if (options?.invoiceId) {
      query = query.eq('id', options.invoiceId);
    } else if (options?.invoiceNumbers && options.invoiceNumbers.length > 0) {
      query = query.in('invoice_number', options.invoiceNumbers);
    } else {
      const limit = Math.min(Math.max(options?.limit || 20, 1), 50);
      query = query.order('invoice_issue_date', { ascending: false }).limit(limit);
    }

    const { data: pendingInvoices, error: queryErr } = await query;
    if (queryErr) throw queryErr;

    if (!pendingInvoices || pendingInvoices.length === 0) {
      const { count: remainingCount } = await this.supabase
        .from('nav_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .or('details_fetched.is.null,details_fetched.eq.false');

      return { processedCount: 0, failedCount: 0, remainingCount: remainingCount || 0 };
    }

    let processedCount = 0;
    let failedCount = 0;

    for (const inv of pendingInvoices) {
      try {
        const direction = (inv.invoice_direction as 'INBOUND' | 'OUTBOUND') || 'INBOUND';
        let details: any = null;
        try {
          details = await navClient.queryInvoiceData(inv.invoice_number, direction);
        } catch (dirErr: any) {
          const altDirection = direction === 'INBOUND' ? 'OUTBOUND' : 'INBOUND';
          try {
            details = await navClient.queryInvoiceData(inv.invoice_number, altDirection);
          } catch {
            throw dirErr;
          }
        }

        const invoiceUpdates: Record<string, any> = { details_fetched: true };
        if (details.supplierAddress) invoiceUpdates.supplier_address = details.supplierAddress;
        if (details.customerAddress) invoiceUpdates.customer_address = details.customerAddress;
        if (details.isCashAccounting !== undefined) invoiceUpdates.is_cash_accounting = details.isCashAccounting;
        if (details.originalInvoiceNumber) invoiceUpdates.original_invoice_number = details.originalInvoiceNumber;
        if (details.vatSummary) {
          invoiceUpdates.vat_summary = details.vatSummary;
          if (details.vatSummary.hasReverseCharge) {
            invoiceUpdates.is_reverse_charge = true;
            invoiceUpdates.reverse_charge_category = 'DOMESTIC_142';
          }
        }

        // Szülő rekord és tételsorok atomi, idempotens mentése tárolt eljárással (RPC)
        const resolvedCompanyId = inv.company_id || companyId;
        const itemsToInsert = (details.lineItems && details.lineItems.length > 0)
          ? details.lineItems.map((item: any) => ({
              company_id: resolvedCompanyId,
              line_number: item.lineNumber,
              line_description: item.lineDescription || null,
              quantity: item.quantity || null,
              unit_of_measure: item.unitOfMeasure || null,
              unit_price: item.unitPrice || null,
              net_amount: item.netAmount || 0,
              vat_rate: item.vatRate || null,
              vat_amount: item.vatAmount || 0,
              gross_amount: item.grossAmount || 0,
              product_code: item.productCode || null,
              line_delivery_period_from: item.lineDeliveryPeriodFrom || null,
              line_delivery_period_to: item.lineDeliveryPeriodTo || null
            }))
          : [];

        const { error: rpcErr } = await this.supabase.rpc('save_nav_invoice_details_and_items', {
          p_invoice_id: inv.id,
          p_invoice_updates: invoiceUpdates,
          p_line_items: itemsToInsert,
        });

        if (rpcErr) {
          throw rpcErr;
        }

        processedCount++;
      } catch (err: any) {
        console.warn(`[NavIngestionService] Failed to fetch details for ${inv.invoice_number}:`, err);
        failedCount++;
        const msg = String(err?.message || err);
        if (msg.includes('nem található') || msg.includes('Nem létező') || msg.includes('INVALID_INVOICE')) {
          await this.supabase
            .from('nav_invoices')
            .update({ details_fetched: true })
            .eq('id', inv.id);
        }
      }
    }

    const { count: remainingCount } = await this.supabase
      .from('nav_invoices')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .or('details_fetched.is.null,details_fetched.eq.false');

    return {
      processedCount,
      failedCount,
      remainingCount: remainingCount || 0
    };
  }

  /**
   * Hitelesítő adatok validációs státuszának előléptetése 'valid'-ra.
   */
  async promoteValidationStatus(userId: string, companyId: string | null, direction?: NavInvoiceDirection): Promise<void> {
    try {
      const matchFilter = companyId
        ? { company_id: companyId }
        : { user_id: userId };

      // Ha csak OUTBOUND szinkron futott le sikeresen, de a bejövő számlák lekérdezése hiányzik,
      // ne írjuk felül a meglévő 'invalid' státuszt!
      if (direction === 'OUTBOUND') {
        const { data: existing } = await this.supabase
          .from('user_nav_credentials')
          .select('validation_status, validation_error')
          .match(matchFilter)
          .maybeSingle();

        if (existing?.validation_status === 'invalid' && existing?.validation_error?.includes('Számlák lekérdezése')) {
          return;
        }
      }

      await this.supabase
        .from('user_nav_credentials')
        .update({
          validation_status: 'valid',
          validation_error: null,
          last_validated_at: new Date().toISOString()
        })
        .match(matchFilter);
    } catch (err) {
      console.warn('[NavIngestionService] Validation status update warning:', err);
    }
  }
}
