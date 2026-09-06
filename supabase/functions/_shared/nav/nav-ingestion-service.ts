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
          await this.syncPartnersFromInvoices(invoices, options.direction, effectiveCompanyId, options.userId);
        }

        // 6. Opcionális tételszintű részletek letöltése (ha kérték)
        if (options.fetchDetailedItems) {
          await this.fetchAndPersistDetails(navClient, invoices, options.direction, effectiveCompanyId);
        }
      }

      // 7. Hitelesítő adatok státuszának előléptetése 'valid'-ra (ADR A-012 / A-024)
      await this.promoteValidationStatus(options.userId, effectiveCompanyId);

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
      if (syncLogId) {
        await this.supabase
          .from('nav_sync_logs')
          .update({
            status: 'failed',
            error_message: err?.message || String(err),
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime
          })
          .eq('id', syncLogId);
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
    userId?: string | null
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

      // 3. Batch INSERT új partnereknek
      if (toInsert.length > 0) {
        await this.supabase.from('partners').insert(toInsert);
      }

      // 4. Update 'both' típusra
      for (const update of toUpdate) {
        await this.supabase
          .from('partners')
          .update({ partner_type: update.partner_type })
          .eq('id', update.id);
      }

    } catch (partnerErr) {
      console.warn('[NavIngestionService] Partner sync warning:', partnerErr);
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
          const hasContent = (details.lineItems && details.lineItems.length > 0) || details.supplierAddress || details.customerAddress;
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

          await this.supabase
            .from('nav_invoices')
            .update(invoiceUpdates)
            .eq('id', dbInvoice.id);

          // 2. Tételsorok idempotens mentése (korábbi tételek törlése + batch beszúrás)
          if (details.lineItems && details.lineItems.length > 0) {
            const resolvedCompanyId = dbInvoice.company_id || companyId || null;
            const itemsToInsert = details.lineItems.map(item => ({
              nav_invoice_id: dbInvoice.id,
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
            }));

            await this.supabase
              .from('nav_invoice_items')
              .delete()
              .eq('nav_invoice_id', dbInvoice.id);

            await this.supabase
              .from('nav_invoice_items')
              .insert(itemsToInsert);
          }
        }
      } catch (detailErr) {
        console.warn(`[NavIngestionService] Failed to fetch details for invoice ${inv.invoice_number}:`, detailErr);
      }
    }
  }

  /**
   * Hitelesítő adatok validációs státuszának előléptetése 'valid'-ra.
   */
  async promoteValidationStatus(userId: string, companyId: string | null): Promise<void> {
    try {
      const matchFilter = companyId
        ? { user_id: userId, company_id: companyId }
        : { user_id: userId };

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
