import { supabase } from '@/integrations/supabase/client';
import type {
  OpgCashRegister,
  OpgTransaction,
  OpgSyncLog,
  OpgTransactionFilter,
  OpgTurnoverKpi,
  OpgDailySummary,
  CreateOpgRegisterInput,
  UpdateOpgRegisterInput,
} from '@/types/opg';

export class OpgService {
  /**
   * Pénztárgépek listázása adott céghez
   */
  static async getCashRegisters(companyId: string): Promise<OpgCashRegister[]> {
    if (!companyId) return [];

    const { data, error } = await (supabase as any)
      .from('opg_cash_registers')
      .select(`
        *,
        petty_cash_register:petty_cash_registers(id, name, is_default)
      `)
      .eq('company_id', companyId)
      .order('name', { ascending: true });

    if (error) {
      console.error('[OpgService.getCashRegisters] Error:', error);
      throw error;
    }

    return (data || []) as OpgCashRegister[];
  }

  /**
   * Pénztárgépek automatikus felderítése és importálása NAV-ból a technikai felhasználó segítségével
   */
  static async discoverCashRegisters(companyId: string): Promise<{ discoveredCount: number; registers: OpgCashRegister[] }> {
    if (!companyId) return { discoveredCount: 0, registers: [] };

    const { data, error } = await supabase.functions.invoke('nav-opg-proxy', {
      body: {
        action: 'discover_registers',
        company_id: companyId,
      },
    });

    if (error) {
      throw new Error(error.message || 'Nem sikerült elérni a NAV felderítő szolgáltatást.');
    }

    if (!data?.success) {
      throw new Error(data?.error || 'A NAV pénztárgép felderítés nem sikerült.');
    }

    return data.data || { discoveredCount: 0, registers: [] };
  }

  /**
   * Új pénztárgép rögzítése
   */
  static async createCashRegister(input: CreateOpgRegisterInput): Promise<OpgCashRegister> {
    const { data: user } = await supabase.auth.getUser();

    const insertPayload = {
      company_id: input.company_id,
      ap_code: input.ap_code.trim().toUpperCase(),
      name: input.name.trim(),
      location: input.location?.trim() || null,
      petty_cash_register_id: input.petty_cash_register_id || null,
      cash_booking_mode: input.cash_booking_mode || 'daily_z_summary',
      sync_interval_minutes: input.sync_interval_minutes || 60,
      status: input.status || 'active',
      created_by: user?.user?.id || null,
    };

    const { data, error } = await (supabase as any)
      .from('opg_cash_registers')
      .insert(insertPayload)
      .select(`
        *,
        petty_cash_register:petty_cash_registers(id, name, is_default)
      `)
      .single();

    if (error) {
      console.error('[OpgService.createCashRegister] Error:', error);
      throw error;
    }

    return data as OpgCashRegister;
  }

  /**
   * Pénztárgép adatainak módosítása
   */
  static async updateCashRegister(input: UpdateOpgRegisterInput): Promise<OpgCashRegister> {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.ap_code !== undefined) updatePayload.ap_code = input.ap_code.trim().toUpperCase();
    if (input.location !== undefined) updatePayload.location = input.location?.trim() || null;
    if (input.petty_cash_register_id !== undefined) updatePayload.petty_cash_register_id = input.petty_cash_register_id || null;
    if (input.cash_booking_mode !== undefined) updatePayload.cash_booking_mode = input.cash_booking_mode;
    if (input.sync_interval_minutes !== undefined) updatePayload.sync_interval_minutes = input.sync_interval_minutes;
    if (input.status !== undefined) updatePayload.status = input.status;

    const { data, error } = await (supabase as any)
      .from('opg_cash_registers')
      .update(updatePayload)
      .eq('id', input.id)
      .select(`
        *,
        petty_cash_register:petty_cash_registers(id, name, is_default)
      `)
      .single();

    if (error) {
      console.error('[OpgService.updateCashRegister] Error:', error);
      throw error;
    }

    return data as OpgCashRegister;
  }

  /**
   * Pénztárgép törlése
   */
  static async deleteCashRegister(id: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('opg_cash_registers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[OpgService.deleteCashRegister] Error:', error);
      throw error;
    }
  }

  /**
   * Pénztárgép kapcsolat tesztelése (NAV OPG / AP kód ellenőrzés)
   */
  static async testCashRegisterConnection(registerId: string): Promise<{ success: boolean; message: string; timestamp: string }> {
    const { data: register, error: fetchErr } = await (supabase as any)
      .from('opg_cash_registers')
      .select('*')
      .eq('id', registerId)
      .single();

    if (fetchErr || !register) {
      throw new Error('A pénztárgép nem található.');
    }

    const timestamp = new Date().toISOString();
    const isApValid = /^[A-Z0-9]{8,12}$/i.test(register.ap_code.replace(/[^A-Z0-9]/gi, ''));

    if (!isApValid) {
      await (supabase as any)
        .from('opg_cash_registers')
        .update({
          status: 'error',
          last_failed_sync_at: timestamp,
          last_error_message: 'Érvénytelen AP kód formátum.',
          updated_at: timestamp,
        })
        .eq('id', registerId);

      return {
        success: false,
        message: `Kapcsolódási hiba: Az AP kód (${register.ap_code}) formátuma érvénytelen.`,
        timestamp,
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('nav-opg-proxy', {
        body: {
          action: 'query_status',
          company_id: register.company_id,
          register_id: register.id,
          ap_code: register.ap_code,
        },
      });

      if (error || !data?.success) {
        const errorMsg = error?.message || data?.error || 'A NAV OPG kapcsolat nem jött létre.';
        await (supabase as any)
          .from('opg_cash_registers')
          .update({
            status: 'error',
            last_failed_sync_at: timestamp,
            last_error_message: errorMsg,
            updated_at: timestamp,
          })
          .eq('id', registerId);

        return {
          success: false,
          message: errorMsg,
          timestamp,
        };
      }

      const statusData = data.data;
      if (!statusData.found) {
        await (supabase as any)
          .from('opg_cash_registers')
          .update({
            status: 'error',
            last_failed_sync_at: timestamp,
            last_error_message: statusData.message,
            updated_at: timestamp,
          })
          .eq('id', registerId);

        return {
          success: false,
          message: statusData.message,
          timestamp,
        };
      }

      const lastComm = statusData.lastCommunicationDate
        ? new Date(statusData.lastCommunicationDate).toLocaleString('hu-HU')
        : 'N/A';
      const fileRange = `Elérhető naplófájlok: #${statusData.minAvailableFileNumber} - #${statusData.maxAvailableFileNumber}`;

      await (supabase as any)
        .from('opg_cash_registers')
        .update({
          status: 'active',
          last_successful_sync_at: timestamp,
          last_error_message: null,
          updated_at: timestamp,
        })
        .eq('id', registerId);

      return {
        success: true,
        message: `NAV OPG kapcsolat aktív! Utolsó kommunikáció: ${lastComm}. ${fileRange}`,
        timestamp,
      };
    } catch (err: any) {
      const errorMsg = err.message || 'Kapcsolódási hiba a NAV átjáróval.';
      await (supabase as any)
        .from('opg_cash_registers')
        .update({
          status: 'error',
          last_failed_sync_at: timestamp,
          last_error_message: errorMsg,
          updated_at: timestamp,
        })
        .eq('id', registerId);

      return {
        success: false,
        message: errorMsg,
        timestamp,
      };
    }
  }

  /**
   * OPG Tranzakciók lekérdezése szűréssel
   */
  static async getTransactions(
    companyId: string,
    filters?: OpgTransactionFilter
  ): Promise<OpgTransaction[]> {
    if (!companyId) return [];

    let query = (supabase as any)
      .from('opg_transactions')
      .select(`
        *,
        cash_register:opg_cash_registers(id, name, ap_code)
      `)
      .eq('company_id', companyId);

    if (filters?.opg_id && filters.opg_id !== 'all') {
      query = query.eq('opg_id', filters.opg_id);
    }

    if (filters?.startDate) {
      query = query.gte('transaction_date', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('transaction_date', filters.endDate);
    }

    if (filters?.type && filters.type !== 'all') {
      query = query.eq('transaction_type', filters.type);
    }

    if (filters?.status && filters.status !== 'all') {
      query = query.eq('processing_status', filters.status);
    }

    if (filters?.search && filters.search.trim()) {
      const term = filters.search.trim();
      query = query.or(`receipt_number.ilike.%${term}%,external_transaction_id.ilike.%${term}%`);
    }

    query = query.order('transaction_date', { ascending: false }).order('transaction_time', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('[OpgService.getTransactions] Error:', error);
      throw error;
    }

    return (data || []) as OpgTransaction[];
  }

  /**
   * Forgalmi KPI mutatók összesítése
   */
  static async getTurnoverKpis(
    companyId: string,
    startDate?: string,
    endDate?: string,
    opgId?: string
  ): Promise<OpgTurnoverKpi> {
    if (!companyId) {
      return {
        totalGross: 0,
        totalCash: 0,
        totalCard: 0,
        otherTotal: 0,
        transactionCount: 0,
        zReportCount: 0,
        pendingCashBookingCount: 0,
        activeRegisterCount: 0,
      };
    }

    // 1. Pénztárgépek darabszáma
    const { count: activeCount } = await (supabase as any)
      .from('opg_cash_registers')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'active');

    // 2. Tranzakciók lekérése az összesítéshez
    let query = (supabase as any)
      .from('opg_transactions')
      .select('total_gross_amount, cash_amount, card_amount, other_payment_amount, transaction_type, processing_status')
      .eq('company_id', companyId);

    if (startDate) query = query.gte('transaction_date', startDate);
    if (endDate) query = query.lte('transaction_date', endDate);
    if (opgId && opgId !== 'all') query = query.eq('opg_id', opgId);

    const { data: rows, error } = await query;

    if (error) {
      console.error('[OpgService.getTurnoverKpis] Error:', error);
      if ((error as any).code === 'PGRST205' || (error as any).code === '42P01') {
        return {
          totalGross: 0,
          totalCash: 0,
          totalCard: 0,
          otherTotal: 0,
          transactionCount: 0,
          zReportCount: 0,
          pendingCashBookingCount: 0,
          activeRegisterCount: 0,
        };
      }
      throw error;
    }

    let totalGross = 0;
    let totalCash = 0;
    let totalCard = 0;
    let otherTotal = 0;
    let transactionCount = 0;
    let zReportCount = 0;
    let pendingCashBookingCount = 0;

    (rows || []).forEach((row: any) => {
      // Csak normál nyugták és simplified_invoices számítanak be az egyedi forgalomba,
      // vagy ha csak Z-report van, akkor a z-reportok.
      // Ahhoz, hogy ne legyen duplázódás a KPI összegzésben:
      // Ha z_report, a darabszámát számoljuk, és ha nincs más nyugta az adott napon.
      if (row.transaction_type === 'z_report') {
        zReportCount++;
      } else {
        transactionCount++;
        const multiplier = row.transaction_type === 'storno' || row.transaction_type === 'refund' ? -1 : 1;
        totalGross += Number(row.total_gross_amount || 0) * multiplier;
        totalCash += Number(row.cash_amount || 0) * multiplier;
        totalCard += Number(row.card_amount || 0) * multiplier;
        otherTotal += Number(row.other_payment_amount || 0) * multiplier;
      }

      if (row.processing_status === 'new' && Number(row.cash_amount || 0) !== 0) {
        pendingCashBookingCount++;
      }
    });

    // Ha nincsenek külön nyugták (csak Z-zárások szerepelnek a rendszerben), a Z-zárásokból képezzük a forgalmat:
    if (transactionCount === 0 && zReportCount > 0) {
      (rows || []).forEach((row: any) => {
        if (row.transaction_type === 'z_report') {
          totalGross += Number(row.total_gross_amount || 0);
          totalCash += Number(row.cash_amount || 0);
          totalCard += Number(row.card_amount || 0);
          otherTotal += Number(row.other_payment_amount || 0);
        }
      });
    }

    return {
      totalGross: Math.round(totalGross),
      totalCash: Math.round(totalCash),
      totalCard: Math.round(totalCard),
      otherTotal: Math.round(otherTotal),
      transactionCount,
      zReportCount,
      pendingCashBookingCount,
      activeRegisterCount: activeCount || 0,
    };
  }

  /**
   * Napi bontású forgalmi kimutatás
   */
  static async getDailyTurnover(
    companyId: string,
    startDate?: string,
    endDate?: string,
    opgId?: string
  ): Promise<OpgDailySummary[]> {
    if (!companyId) return [];

    let query = (supabase as any)
      .from('opg_transactions')
      .select('transaction_date, total_gross_amount, cash_amount, card_amount, other_payment_amount, transaction_type')
      .eq('company_id', companyId);

    if (startDate) query = query.gte('transaction_date', startDate);
    if (endDate) query = query.lte('transaction_date', endDate);
    if (opgId && opgId !== 'all') query = query.eq('opg_id', opgId);

    query = query.order('transaction_date', { ascending: false });

    const { data: rows, error } = await query;

    if (error) {
      console.error('[OpgService.getDailyTurnover] Error:', error);
      throw error;
    }

    const dailyMap = new Map<string, OpgDailySummary>();

    (rows || []).forEach((r: any) => {
      const date = r.transaction_date;
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          gross_total: 0,
          cash_total: 0,
          card_total: 0,
          other_total: 0,
          receipt_count: 0,
          z_report_count: 0,
          storno_count: 0,
        });
      }

      const item = dailyMap.get(date)!;
      const isNegative = r.transaction_type === 'storno' || r.transaction_type === 'refund';
      const mult = isNegative ? -1 : 1;

      if (r.transaction_type === 'z_report') {
        item.z_report_count++;
      } else if (r.transaction_type === 'storno') {
        item.storno_count++;
        item.gross_total += Number(r.total_gross_amount || 0) * mult;
        item.cash_total += Number(r.cash_amount || 0) * mult;
        item.card_total += Number(r.card_amount || 0) * mult;
      } else {
        item.receipt_count++;
        item.gross_total += Number(r.total_gross_amount || 0) * mult;
        item.cash_total += Number(r.cash_amount || 0) * mult;
        item.card_total += Number(r.card_amount || 0) * mult;
        item.other_total += Number(r.other_payment_amount || 0) * mult;
      }
    });

    return Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Egyetlen tranzakció házipénztárba könyvelése
   */
  static async bookTransactionToPettyCash(
    transactionId: string
  ): Promise<{ success: boolean; cashEntryId?: string; error?: string }> {
    try {
      // 1. Próbáljuk meg az RPC-t hívni
      const { data, error } = await (supabase as any).rpc('process_opg_transaction_to_petty_cash', {
        p_transaction_id: transactionId,
      });

      if (!error && data) {
        return { success: true, cashEntryId: data };
      }

      // Ha az RPC nem érhető el vagy nem létezik még a távoli környezetben, fallback kliens oldalon:
      if (error && (error.message?.includes('function') || error.code === '42883')) {
        return await this.fallbackBookTransactionToPettyCash(transactionId);
      }

      if (error) throw error;
      return { success: true, cashEntryId: data };
    } catch (err: any) {
      console.error('[OpgService.bookTransactionToPettyCash] Error:', err);
      return { success: false, error: err.message || 'Könyvelési hiba történt.' };
    }
  }

  /**
   * Összes függő készpénzes tétel könyvelése a házipénztárba
   */
  static async bookAllPendingToPettyCash(
    companyId: string,
    opgId?: string
  ): Promise<{ processed: number; skipped: number; errors: number }> {
    try {
      const { data, error } = await (supabase as any).rpc('process_pending_opg_transactions', {
        p_company_id: companyId,
        p_opg_id: opgId && opgId !== 'all' ? opgId : null,
      });

      if (!error && data && data.length > 0) {
        return {
          processed: data[0].processed_count || 0,
          skipped: data[0].skipped_count || 0,
          errors: data[0].error_count || 0,
        };
      }

      // Fallback ha nincs RPC
      return await this.fallbackBookPendingToPettyCash(companyId, opgId);
    } catch (err: any) {
      console.warn('[OpgService.bookAllPendingToPettyCash] RPC failed, using fallback:', err);
      return await this.fallbackBookPendingToPettyCash(companyId, opgId);
    }
  }

  /**
   * Kliensoldali fallback könyvelés egyetlen tételre
   */
  private static async fallbackBookTransactionToPettyCash(
    transactionId: string
  ): Promise<{ success: boolean; cashEntryId?: string; error?: string }> {
    const { data: tx, error: txErr } = await (supabase as any)
      .from('opg_transactions')
      .select('*, opg_cash_registers(petty_cash_register_id, ap_code, cash_booking_mode)')
      .eq('id', transactionId)
      .single();

    if (txErr || !tx) {
      return { success: false, error: 'A tranzakció nem található.' };
    }

    if (tx.cash_entry_id) {
      return { success: true, cashEntryId: tx.cash_entry_id };
    }

    let cashAmount = Number(tx.cash_amount || 0);
    if (cashAmount === 0) {
      await (supabase as any)
        .from('opg_transactions')
        .update({ processing_status: 'skipped' })
        .eq('id', transactionId);
      return { success: true };
    }

    if (tx.transaction_type === 'storno' || tx.transaction_type === 'refund') {
      cashAmount = -Math.abs(cashAmount);
    }

    // Cél házipénztár keresése
    let targetRegisterId = tx.opg_cash_registers?.petty_cash_register_id;
    if (!targetRegisterId) {
      const { data: defaultPcr } = await (supabase as any)
        .from('petty_cash_registers')
        .select('id')
        .eq('company_id', tx.company_id)
        .eq('is_default', true)
        .maybeSingle();

      targetRegisterId = defaultPcr?.id;
    }

    if (!targetRegisterId) {
      const { data: anyPcr } = await (supabase as any)
        .from('petty_cash_registers')
        .select('id')
        .eq('company_id', tx.company_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      targetRegisterId = anyPcr?.id;
    }

    if (!targetRegisterId) {
      await (supabase as any)
        .from('opg_transactions')
        .update({
          processing_status: 'error',
          error_message: 'Nincs elérhető házipénztár a könyveléshez.',
        })
        .eq('id', transactionId);
      return { success: false, error: 'Nincs házipénztár beállítva a céghez.' };
    }

    const description =
      tx.transaction_type === 'z_report'
        ? `OPG Napi zárás (${tx.receipt_number}) - AP: ${tx.opg_cash_registers?.ap_code || 'N/A'}`
        : tx.transaction_type === 'storno'
        ? `OPG Sztornó (${tx.receipt_number}) - AP: ${tx.opg_cash_registers?.ap_code || 'N/A'}`
        : `OPG Nyugta készpénzbevétel (${tx.receipt_number}) - AP: ${tx.opg_cash_registers?.ap_code || 'N/A'}`;

    const { data: newEntry, error: insertErr } = await (supabase as any)
      .from('petty_cash_entries')
      .insert({
        company_id: tx.company_id,
        register_id: targetRegisterId,
        entry_date: tx.transaction_date,
        description,
        amount: cashAmount,
        currency: 'HUF',
        source_type: 'cash_sale',
        source_id: tx.id,
        source_table: 'opg_transactions',
        routed_by: 'opg_auto',
      })
      .select('id')
      .single();

    if (insertErr || !newEntry) {
      await (supabase as any)
        .from('opg_transactions')
        .update({
          processing_status: 'error',
          error_message: insertErr?.message || 'Nem sikerült a tétel beszúrása.',
        })
        .eq('id', transactionId);
      return { success: false, error: insertErr?.message };
    }

    await (supabase as any)
      .from('opg_transactions')
      .update({
        processing_status: 'processed',
        cash_entry_id: newEntry.id,
        error_message: null,
      })
      .eq('id', transactionId);

    return { success: true, cashEntryId: newEntry.id };
  }

  /**
   * Kliensoldali fallback kötegelt könyvelés
   */
  private static async fallbackBookPendingToPettyCash(
    companyId: string,
    opgId?: string
  ): Promise<{ processed: number; skipped: number; errors: number }> {
    let query = (supabase as any)
      .from('opg_transactions')
      .select('id, cash_amount, transaction_type, opg_id, opg_cash_registers(cash_booking_mode)')
      .eq('company_id', companyId)
      .eq('processing_status', 'new');

    if (opgId && opgId !== 'all') {
      query = query.eq('opg_id', opgId);
    }

    const { data: rows } = await query;
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const r of rows || []) {
      const mode = r.opg_cash_registers?.cash_booking_mode || 'daily_z_summary';
      if (mode === 'daily_z_summary' && !['z_report', 'storno', 'refund'].includes(r.transaction_type)) {
        await (supabase as any)
          .from('opg_transactions')
          .update({ processing_status: 'skipped' })
          .eq('id', r.id);
        skipped++;
        continue;
      }

      if (mode === 'itemized_receipt' && r.transaction_type === 'z_report') {
        await (supabase as any)
          .from('opg_transactions')
          .update({ processing_status: 'skipped' })
          .eq('id', r.id);
        skipped++;
        continue;
      }

      const res = await this.fallbackBookTransactionToPettyCash(r.id);
      if (res.success && res.cashEntryId) {
        processed++;
      } else if (res.success) {
        skipped++;
      } else {
        errors++;
      }
    }

    return { processed, skipped, errors };
  }

  /**
   * Szinkronizáció indítása és végrehajtása
   */
  static async syncTransactions(
    companyId: string,
    opgId?: string,
    periodFrom?: string,
    periodTo?: string
  ): Promise<{ fetched: number; newRecords: number; duplicates: number; errors: number }> {
    const { data: user } = await supabase.auth.getUser();

    // 1. Audit napló bejegyzés indítása
    const { data: logEntry } = await (supabase as any)
      .from('opg_sync_logs')
      .insert({
        company_id: companyId,
        opg_id: opgId && opgId !== 'all' ? opgId : null,
        period_from: periodFrom || null,
        period_to: periodTo || null,
        status: 'running',
        created_by: user?.user?.id || null,
      })
      .select('id')
      .single();

    const logId = logEntry?.id;

    try {
      // 2. Valós NAV OPG szinkronizáció meghívása az Edge Function-ön keresztül
      const { data, error } = await supabase.functions.invoke('nav-opg-proxy', {
        body: {
          action: 'sync_transactions',
          company_id: companyId,
          register_id: opgId && opgId !== 'all' ? opgId : null,
          period_from: periodFrom,
          period_to: periodTo,
        },
      });

      if (error) {
        throw new Error(error.message || 'Nem sikerült elérni a NAV OPG szinkronizációs átjárót.');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'A NAV OPG szinkronizáció sikertelen.');
      }

      const syncStats = data.data || { fetched: 0, newRecords: 0, duplicates: 0, errors: 0 };

      // 3. Napló véglegesítése
      if (logId) {
        await (supabase as any)
          .from('opg_sync_logs')
          .update({
            status: syncStats.errors === 0 ? 'success' : syncStats.newRecords > 0 ? 'partial' : 'failed',
            finished_at: new Date().toISOString(),
            records_fetched: syncStats.fetched,
            records_new: syncStats.newRecords,
            records_duplicated: syncStats.duplicates,
            records_errors: syncStats.errors,
          })
          .eq('id', logId);
      }

      return syncStats;
    } catch (err: any) {
      if (logId) {
        await (supabase as any)
          .from('opg_sync_logs')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            error_message: err.message || 'Ismeretlen szinkronizációs hiba.',
          })
          .eq('id', logId);
      }
      throw err;
    }
  }

  /**
   * Szinkronizációs naplók listázása
   */
  static async getSyncLogs(companyId: string, opgId?: string): Promise<OpgSyncLog[]> {
    if (!companyId) return [];

    let query = (supabase as any)
      .from('opg_sync_logs')
      .select(`
        *,
        cash_register:opg_cash_registers(id, name, ap_code)
      `)
      .eq('company_id', companyId);

    if (opgId && opgId !== 'all') {
      query = query.eq('opg_id', opgId);
    }

    query = query.order('started_at', { ascending: false }).limit(100);

    const { data, error } = await query;

    if (error) {
      console.error('[OpgService.getSyncLogs] Error:', error);
      throw error;
    }

    return (data || []) as OpgSyncLog[];
  }

  /**
   * Kezdő adatok (Demo pénztárgépek és tranzakciók) létrehozása, ha a cég még nem rendelkezik OPG beállítással
   */
  static async seedMockDataIfEmpty(companyId: string): Promise<boolean> {
    const existing = await this.getCashRegisters(companyId);
    if (existing.length > 0) return false;

    // Keresünk házipénztárt
    const { data: pcr } = await (supabase as any)
      .from('petty_cash_registers')
      .select('id')
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle();

    // Létrehozunk 2 mintagépet
    const reg1 = await this.createCashRegister({
      company_id: companyId,
      ap_code: 'A12345678',
      name: 'Főpénztár - Üzlethelyiség',
      location: '1052 Budapest, Kossuth Lajos u. 12.',
      petty_cash_register_id: pcr?.id || null,
      cash_booking_mode: 'daily_z_summary',
      sync_interval_minutes: 60,
    });

    const reg2 = await this.createCashRegister({
      company_id: companyId,
      ap_code: 'A87654321',
      name: 'Mobil OPG - Kiszállítás',
      location: 'Mobil egység (Transporter 01)',
      petty_cash_register_id: pcr?.id || null,
      cash_booking_mode: 'itemized_receipt',
      sync_interval_minutes: 30,
    });

    // Indítunk egy szinkront, hogy azonnal legyenek látványos tételek
    await this.syncTransactions(companyId, reg1.id);
    await this.syncTransactions(companyId, reg2.id);

    return true;
  }

  /**
   * Segédfüggvény élethű NAV OPG tranzakciók generálásához
   */
  private static createMockTransactions(register: OpgCashRegister, _periodFrom?: string, _periodTo?: string): any[] {
    const results: any[] = [];
    const today = new Date();
    const dates = [
      new Date(today.getTime() - 2 * 24 * 3600 * 1000).toISOString().split('T')[0],
      new Date(today.getTime() - 1 * 24 * 3600 * 1000).toISOString().split('T')[0],
      today.toISOString().split('T')[0],
    ];

    let seq = Math.floor(Math.random() * 8000) + 1000;

    for (const d of dates) {
      let dayCash = 0;
      let dayCard = 0;
      let dayGross = 0;
      let dayVat27 = 0;
      let dayVat5 = 0;

      // 4-8 db nyugta naponta
      const receiptCount = 5;
      for (let i = 0; i < receiptCount; i++) {
        seq++;
        const hour = String(9 + i * 2).padStart(2, '0');
        const min = String(Math.floor(Math.random() * 50) + 5).padStart(2, '0');
        const isCard = i % 2 === 1;
        const gross = (Math.floor(Math.random() * 25) + 3) * 500; // 1,500 - 14,000 Ft
        const vat27 = Math.round(gross * (27 / 127));
        const net27 = gross - vat27;

        const cash = isCard ? 0 : gross;
        const card = isCard ? gross : 0;

        dayGross += gross;
        dayCash += cash;
        dayCard += card;
        dayVat27 += vat27;

        results.push({
          external_transaction_id: `NAV-OPG-${register.ap_code}-${d}-${seq}`,
          receipt_number: `NY-${d.replace(/-/g, '')}/${seq}`,
          transaction_date: d,
          transaction_time: `${hour}:${min}:00`,
          transaction_type: 'receipt',
          total_gross_amount: gross,
          cash_amount: cash,
          card_amount: card,
          szep_card_amount: 0,
          voucher_amount: 0,
          other_payment_amount: 0,
          payment_method_breakdown: { cash, card, szep_card: 0, voucher: 0, other: 0 },
          vat_breakdown: {
            vat_27: { net: net27, vat: vat27, gross },
          },
          source_payload: { ap: register.ap_code, version: '1.4', simulated: true },
        });
      }

      // Esetenként 1 db sztornó
      if (d === dates[1]) {
        seq++;
        const stornoGross = 2500;
        const stornoVat = Math.round(stornoGross * (27 / 127));
        results.push({
          external_transaction_id: `NAV-OPG-${register.ap_code}-${d}-${seq}-ST`,
          receipt_number: `SZ-${d.replace(/-/g, '')}/${seq}`,
          transaction_date: d,
          transaction_time: '15:20:00',
          transaction_type: 'storno',
          total_gross_amount: stornoGross,
          cash_amount: stornoGross,
          card_amount: 0,
          szep_card_amount: 0,
          voucher_amount: 0,
          other_payment_amount: 0,
          payment_method_breakdown: { cash: stornoGross, card: 0, szep_card: 0, voucher: 0, other: 0 },
          vat_breakdown: {
            vat_27: { net: stornoGross - stornoVat, vat: stornoVat, gross: stornoGross },
          },
          source_payload: { ap: register.ap_code, reason: 'Téves beütés sztornózása' },
        });
      }

      // Napi Z-zárás a nap végén (20:00)
      seq++;
      results.push({
        external_transaction_id: `NAV-OPG-${register.ap_code}-${d}-ZCLOSE`,
        receipt_number: `Z-${d.replace(/-/g, '')}/${String(seq).slice(-3)}`,
        transaction_date: d,
        transaction_time: '20:00:00',
        transaction_type: 'z_report',
        total_gross_amount: dayGross,
        cash_amount: dayCash,
        card_amount: dayCard,
        szep_card_amount: 0,
        voucher_amount: 0,
        other_payment_amount: 0,
        payment_method_breakdown: { cash: dayCash, card: dayCard, szep_card: 0, voucher: 0, other: 0 },
        vat_breakdown: {
          vat_27: { net: dayGross - dayVat27, vat: dayVat27, gross: dayGross },
          vat_5: { net: 0, vat: 0, gross: 0 },
        },
        source_payload: { ap: register.ap_code, type: 'daily_z_closure', verified: true },
      });
    }

    return results;
  }
}
