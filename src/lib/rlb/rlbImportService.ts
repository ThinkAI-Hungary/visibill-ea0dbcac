/**
 * RLB-60 Könyvelési Adat Importáló Szolgáltatás
 * ===============================================
 * Felelős az értelmezett RLB XML és CSV adatok tranzakciós és kötegelt
 * perzisztálásáért a Supabase adatbázisba:
 * - chart_of_accounts_presets (számlatükör sablon létrehozása / feloldása)
 * - gl_accounts (főkönyvi számlák upsert preset_id és gl_number alapján)
 * - gl_audit_imports (audit import meta rekord)
 * - gl_audit_accounts (audit számlák tárolása)
 * - gl_audit_partners (audit partnertörzs tárolása)
 * - gl_journal_entries (naplósorok kötegelt mentése 250-es csomagokban)
 */

import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';
import type { RlbXmlParseResult, RlbCsvParseResult } from './rlbParser';

export interface RlbImportProgress {
  stage: 'preset' | 'accounts' | 'import_record' | 'partners' | 'entries' | 'completed';
  current: number;
  total: number;
  message: string;
}

export interface ImportRlbXmlParams {
  companyId: string;
  userId?: string | null;
  fileName: string;
  storagePath?: string | null;
  xmlResult: RlbXmlParseResult;
  presetMode: 'original' | 'existing';
  selectedPresetId?: string;
  dryRun?: boolean;
  onProgress?: (progress: RlbImportProgress) => void;
}

export interface ImportRlbCsvParams {
  companyId: string;
  userId?: string | null;
  fileName: string;
  csvResult: RlbCsvParseResult;
  presetMode: 'original' | 'existing';
  selectedPresetId?: string;
  onProgress?: (progress: RlbImportProgress) => void;
}

export interface RlbImportResult {
  success: boolean;
  importId?: string;
  presetId: string;
  accountsImported: number;
  partnersImported: number;
  entriesImported: number;
  vouchersImported: number;
  dryRun: boolean;
  error?: string;
}

/**
 * Resolves an existing chart of accounts preset or creates a new dedicated company preset
 */
async function resolveOrCreatePreset(
  companyId: string,
  suggestedName: string,
  presetMode: 'original' | 'existing',
  selectedPresetId?: string
): Promise<string> {
  if (presetMode === 'existing' && selectedPresetId) {
    return selectedPresetId;
  }

  const presetName = suggestedName.trim() || 'RLB Számlatükör';

  // Check if an existing preset already matches this name for this company
  const { data: existingPreset, error: queryError } = await supabase
    .from('chart_of_accounts_presets')
    .select('id')
    .eq('company_id', companyId)
    .eq('name', presetName)
    .maybeSingle();

  if (queryError) {
    reportError({
      type: 'db_query',
      component: 'rlbImportService',
      action: 'resolvePreset',
      message: `Hiba a sablon keresésekor: ${queryError.message}`,
      error: queryError,
    });
  }

  if (existingPreset?.id) {
    return existingPreset.id;
  }

  // Create a new custom preset
  const { data: createdPreset, error: insertError } = await supabase
    .from('chart_of_accounts_presets')
    .insert({
      company_id: companyId,
      name: presetName,
      type: 'custom',
      is_active: true,
    })
    .select('id')
    .single();

  if (insertError || !createdPreset) {
    reportError({
      type: 'db_query',
      component: 'rlbImportService',
      action: 'createPreset',
      message: `Hiba az új számlatükör sablon létrehozásakor: ${insertError?.message}`,
      error: insertError,
    });
    throw new Error(`Nem sikerült létrehozni a számlatükör sablont: ${insertError?.message || 'Ismeretlen adatbázis hiba'}`);
  }

  // Deactivate other custom presets for this company
  await supabase
    .from('chart_of_accounts_presets')
    .update({ is_active: false })
    .eq('company_id', companyId)
    .eq('type', 'custom')
    .neq('id', createdPreset.id);

  return createdPreset.id;
}

/**
 * Imports a fully parsed RLB 26.6 Könyvvizsgálói Feladás XML document
 */
export async function importRlbAuditXml({
  companyId,
  userId,
  fileName,
  storagePath,
  xmlResult,
  presetMode,
  selectedPresetId,
  dryRun = false,
  onProgress,
}: ImportRlbXmlParams): Promise<RlbImportResult> {
  try {
    onProgress?.({
      stage: 'preset',
      current: 0,
      total: 1,
      message: 'Számlatükör sablon egyeztetése...',
    });

    const companyName = xmlResult.meta.companyName || 'Cég';
    const suggestedPresetName = `${companyName} - RLB Számlatükör`;
    const presetId = await resolveOrCreatePreset(companyId, suggestedPresetName, presetMode, selectedPresetId);

    // 1. Prepare & upsert accounts into gl_accounts
    onProgress?.({
      stage: 'accounts',
      current: 0,
      total: xmlResult.accounts.length,
      message: `Főkönyvi számlák mentése (${xmlResult.accounts.length} db)...`,
    });

    // Deduplicate by gl_number to satisfy unique constraint (preset_id, gl_number)
    const seenGlNumbers = new Set<string>();
    const accountRows: Array<{
      preset_id: string;
      gl_number: string;
      short_name: string;
      description: string | null;
      company_id: string;
      is_multicurrency: boolean;
    }> = [];

    xmlResult.accounts.forEach(a => {
      const cleanNum = a.code.trim();
      if (!cleanNum || seenGlNumbers.has(cleanNum)) return;
      seenGlNumbers.add(cleanNum);

      accountRows.push({
        preset_id: presetId,
        gl_number: cleanNum,
        short_name: (a.name || cleanNum).trim(),
        description: null,
        company_id: companyId,
        is_multicurrency: false,
      });
    });

    // Ensure 491 (Nyitó mérleg) and 492 (Záró mérleg) exist
    if (!seenGlNumbers.has('491')) {
      accountRows.push({
        preset_id: presetId,
        gl_number: '491',
        short_name: 'Nyitó mérleg számla',
        description: null,
        company_id: companyId,
        is_multicurrency: false,
      });
    }
    if (!seenGlNumbers.has('492')) {
      accountRows.push({
        preset_id: presetId,
        gl_number: '492',
        short_name: 'Záró mérleg számla',
        description: null,
        company_id: companyId,
        is_multicurrency: false,
      });
    }

    const ACC_CHUNK_SIZE = 500;
    for (let i = 0; i < accountRows.length; i += ACC_CHUNK_SIZE) {
      const chunk = accountRows.slice(i, i + ACC_CHUNK_SIZE);
      const { error: accError } = await supabase
        .from('gl_accounts')
        .upsert(chunk, { onConflict: 'preset_id,gl_number' });

      if (accError) {
        reportError({
          type: 'db_query',
          component: 'rlbImportService',
          action: 'upsertAccounts',
          message: `Főkönyvi számlák mentési hibája: ${accError.message}`,
          error: accError,
        });
        throw new Error(`Hiba a főkönyvi számlák mentésekor: ${accError.message}`);
      }

      onProgress?.({
        stage: 'accounts',
        current: Math.min(i + ACC_CHUNK_SIZE, accountRows.length),
        total: accountRows.length,
        message: `Főkönyvi számlák mentése (${Math.min(i + ACC_CHUNK_SIZE, accountRows.length)} / ${accountRows.length})...`,
      });
    }

    // 2. Create gl_audit_imports record
    onProgress?.({
      stage: 'import_record',
      current: 0,
      total: 1,
      message: 'Importnapló bejegyzés létrehozása...',
    });

    const nowYear = new Date().getFullYear();
    const periodStart = xmlResult.meta.periodStart || `${nowYear}-01-01`;
    const periodEnd = xmlResult.meta.periodEnd || `${nowYear}-12-31`;

    const { data: importRecord, error: importError } = await supabase
      .from('gl_audit_imports')
      .insert({
        company_id: companyId,
        file_name: fileName,
        storage_path: storagePath || null,
        period_start: periodStart,
        period_end: periodEnd,
        source_program: xmlResult.meta.sourceProgram || 'RLB',
        source_version: xmlResult.meta.sourceVersion || '26.6',
        currency: xmlResult.meta.currency || 'HUF',
        account_count: accountRows.length,
        partner_count: xmlResult.partners.length,
        voucher_count: xmlResult.meta.voucherCount,
        entry_count: xmlResult.entries.length,
        preset_id: presetId,
        processing_status: 'completed',
        dry_run: dryRun,
        imported_by: userId || null,
      })
      .select('id')
      .single();

    if (importError || !importRecord) {
      reportError({
        type: 'db_query',
        component: 'rlbImportService',
        action: 'createImportRecord',
        message: `Hiba az import rekord létrehozásakor: ${importError?.message}`,
        error: importError,
      });
      throw new Error(`Import rekord létrehozása sikertelen: ${importError?.message || 'Ismeretlen adatbázis hiba'}`);
    }

    const importId = importRecord.id;

    // In dry-run mode, we do not populate child tables (audit accounts, partners, journal entries)
    if (dryRun) {
      onProgress?.({
        stage: 'completed',
        current: 1,
        total: 1,
        message: 'Próbafuttatás sikeresen befejeződött.',
      });

      return {
        success: true,
        importId,
        presetId,
        accountsImported: accountRows.length,
        partnersImported: xmlResult.partners.length,
        entriesImported: xmlResult.entries.length,
        vouchersImported: xmlResult.meta.voucherCount,
        dryRun: true,
      };
    }

    // 3. Save gl_audit_accounts
    if (xmlResult.accounts.length > 0) {
      const auditAccRows = xmlResult.accounts.map(a => ({
        import_id: importId,
        company_id: companyId,
        account_code: a.code,
        account_name: (a.name || a.code).trim(),
      }));

      for (let i = 0; i < auditAccRows.length; i += ACC_CHUNK_SIZE) {
        const chunk = auditAccRows.slice(i, i + ACC_CHUNK_SIZE);
        const { error: auditAccError } = await supabase.from('gl_audit_accounts').insert(chunk);
        if (auditAccError) {
          reportError({
            type: 'db_query',
            component: 'rlbImportService',
            action: 'insertAuditAccounts',
            message: `Hiba az audit számlák mentésekor: ${auditAccError.message}`,
            error: auditAccError,
          });
          throw new Error(`Hiba az audit számlák mentésekor: ${auditAccError.message}`);
        }
      }
    }

    // 4. Save gl_audit_partners
    if (xmlResult.partners.length > 0) {
      onProgress?.({
        stage: 'partners',
        current: 0,
        total: xmlResult.partners.length,
        message: `Partnertörzs mentése (${xmlResult.partners.length} db)...`,
      });

      const partnerRows = xmlResult.partners.map(p => ({
        import_id: importId,
        company_id: companyId,
        partner_code: p.code,
        partner_name: (p.name || p.code).trim(),
        tax_number: p.taxNumber || null,
        eu_tax_number: p.euTaxNumber || null,
      }));

      for (let i = 0; i < partnerRows.length; i += ACC_CHUNK_SIZE) {
        const chunk = partnerRows.slice(i, i + ACC_CHUNK_SIZE);
        const { error: partnerError } = await supabase.from('gl_audit_partners').insert(chunk);
        if (partnerError) {
          reportError({
            type: 'db_query',
            component: 'rlbImportService',
            action: 'insertAuditPartners',
            message: `Hiba a partnerek mentésekor: ${partnerError.message}`,
            error: partnerError,
          });
          throw new Error(`Hiba a partnerek mentésekor: ${partnerError.message}`);
        }
      }
    }

    // 5. Save gl_journal_entries in chunks of 250
    if (xmlResult.entries.length > 0) {
      const ENTRY_CHUNK_SIZE = 250;
      const entryRows = xmlResult.entries.map((e, idx) => ({
        import_id: importId,
        company_id: companyId,
        voucher_id: e.bizId || null,
        voucher_number: e.voucherNumber || null,
        voucher_date: e.voucherDate || null,
        service_date: e.serviceDate || null,
        payment_due_date: e.paymentDueDate || null,
        entry_index: e.entryIndex || (idx + 1),
        description: e.description || null,
        debit_account: e.debitAccount,
        credit_account: e.creditAccount,
        amount: e.amount,
        foreign_amount: e.foreignAmount || null,
        foreign_currency: e.foreignCurrency || null,
        exchange_rate: e.exchangeRate || null,
        vat_base: e.vatBase || null,
        vat_rate: e.vatRate || null,
        partner_code: e.partnerCode || null,
        partner_name: e.partnerName || null,
        cost_center: e.costCenter || null,
        work_number: e.workNumber || null,
      }));

      for (let i = 0; i < entryRows.length; i += ENTRY_CHUNK_SIZE) {
        const chunk = entryRows.slice(i, i + ENTRY_CHUNK_SIZE);
        const { error: entryError } = await supabase.from('gl_journal_entries').insert(chunk);
        if (entryError) {
          reportError({
            type: 'db_query',
            component: 'rlbImportService',
            action: 'insertJournalEntries',
            message: `Hiba a naplósorok mentésekor: ${entryError.message}`,
            error: entryError,
          });
          throw new Error(`Hiba a naplósorok mentésekor: ${entryError.message}`);
        }

        const currentCount = Math.min(i + ENTRY_CHUNK_SIZE, entryRows.length);
        onProgress?.({
          stage: 'entries',
          current: currentCount,
          total: entryRows.length,
          message: `Naplósorok mentése (${currentCount} / ${entryRows.length})...`,
        });
      }
    }

    onProgress?.({
      stage: 'completed',
      current: xmlResult.entries.length,
      total: xmlResult.entries.length,
      message: 'RLB könyvelési adatok sikeresen importálva!',
    });

    return {
      success: true,
      importId,
      presetId,
      accountsImported: accountRows.length,
      partnersImported: xmlResult.partners.length,
      entriesImported: xmlResult.entries.length,
      vouchersImported: xmlResult.meta.voucherCount,
      dryRun: false,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Ismeretlen hiba történt az RLB importálás során.';
    reportError({
      type: 'upload',
      component: 'rlbImportService',
      action: 'importRlbAuditXml',
      message: errorMsg,
      error: err,
    });
    return {
      success: false,
      presetId: '',
      accountsImported: 0,
      partnersImported: 0,
      entriesImported: 0,
      vouchersImported: 0,
      dryRun,
      error: errorMsg,
    };
  }
}

/**
 * Imports chart of accounts from an RLB Főkönyvi Kivonat CSV file
 */
export async function importRlbCsvLedger({
  companyId,
  fileName,
  csvResult,
  presetMode,
  selectedPresetId,
  onProgress,
}: ImportRlbCsvParams): Promise<RlbImportResult> {
  try {
    onProgress?.({
      stage: 'preset',
      current: 0,
      total: 1,
      message: 'Számlatükör sablon létrehozása / egyeztetése...',
    });

    const companyName = csvResult.companyName || 'Cég';
    const suggestedPresetName = `${companyName} - RLB Számlatükör`;
    const presetId = await resolveOrCreatePreset(companyId, suggestedPresetName, presetMode, selectedPresetId);

    onProgress?.({
      stage: 'accounts',
      current: 0,
      total: csvResult.accounts.length,
      message: `Főkönyvi számlák mentése (${csvResult.accounts.length} db)...`,
    });

    const seenGlNumbers = new Set<string>();
    const accountRows: Array<{
      preset_id: string;
      gl_number: string;
      short_name: string;
      description: string | null;
      company_id: string;
      is_multicurrency: boolean;
    }> = [];

    csvResult.accounts.forEach(a => {
      const cleanNum = a.glNumber.trim();
      if (!cleanNum || seenGlNumbers.has(cleanNum)) return;
      seenGlNumbers.add(cleanNum);

      accountRows.push({
        preset_id: presetId,
        gl_number: cleanNum,
        short_name: (a.accountName || cleanNum).trim(),
        description: a.isGroup ? 'Összesítő számla' : null,
        company_id: companyId,
        is_multicurrency: !!a.foreignCurrency,
      });
    });

    // Ensure 491 and 492
    if (!seenGlNumbers.has('491')) {
      accountRows.push({
        preset_id: presetId,
        gl_number: '491',
        short_name: 'Nyitó mérleg számla',
        description: null,
        company_id: companyId,
        is_multicurrency: false,
      });
    }
    if (!seenGlNumbers.has('492')) {
      accountRows.push({
        preset_id: presetId,
        gl_number: '492',
        short_name: 'Záró mérleg számla',
        description: null,
        company_id: companyId,
        is_multicurrency: false,
      });
    }

    const ACC_CHUNK_SIZE = 500;
    for (let i = 0; i < accountRows.length; i += ACC_CHUNK_SIZE) {
      const chunk = accountRows.slice(i, i + ACC_CHUNK_SIZE);
      const { error: accError } = await supabase
        .from('gl_accounts')
        .upsert(chunk, { onConflict: 'preset_id,gl_number' });

      if (accError) {
        throw new Error(`Hiba a főkönyvi számlák mentésekor: ${accError.message}`);
      }

      onProgress?.({
        stage: 'accounts',
        current: Math.min(i + ACC_CHUNK_SIZE, accountRows.length),
        total: accountRows.length,
        message: `Főkönyvi számlák mentése (${Math.min(i + ACC_CHUNK_SIZE, accountRows.length)} / ${accountRows.length})...`,
      });
    }

    onProgress?.({
      stage: 'completed',
      current: accountRows.length,
      total: accountRows.length,
      message: 'Főkönyvi számlatükör sikeresen importálva!',
    });

    return {
      success: true,
      presetId,
      accountsImported: accountRows.length,
      partnersImported: 0,
      entriesImported: 0,
      vouchersImported: 0,
      dryRun: false,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Hiba történt a főkönyvi kivonat importálásakor.';
    reportError({
      type: 'upload',
      component: 'rlbImportService',
      action: 'importRlbCsvLedger',
      message: errorMsg,
      error: err,
    });
    return {
      success: false,
      presetId: '',
      accountsImported: 0,
      partnersImported: 0,
      entriesImported: 0,
      vouchersImported: 0,
      dryRun: false,
      error: errorMsg,
    };
  }
}
