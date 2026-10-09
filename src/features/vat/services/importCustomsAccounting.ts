import { supabase } from '@/integrations/supabase/client';
import { ImportCustomsDeclaration } from '../types/importVat';

export interface GeneratedJournalEntry {
  debitAccount: string;
  creditAccount: string;
  amount: number;
  description: string;
  vatBase?: number;
  vatRate?: string;
}

export function generateDeclarationJournalLines(
  declaration: ImportCustomsDeclaration
): GeneratedJournalEntry[] {
  const lines: GeneratedJournalEntry[] = [];
  const ref = declaration.declaration_number;
  const partner = declaration.foreign_supplier_name || 'Külföldi szállító';

  if (declaration.procedure_type === 'LEVY') {
    // 1. Kiszabott vám előírása a bekerülési értékbe (Szt. 47. §)
    if (declaration.customs_duty_huf > 0) {
      lines.push({
        debitAccount: '261', // Kereskedelmi áruk bekerülési értéke
        creditAccount: '465', // Vámhatósági elszámolások
        amount: Math.round(declaration.customs_duty_huf),
        description: `Kiszabott vám előírása (${ref} - ${partner})`,
      });
    }

    // 2. Kivetett áfa előírása (Áfa tv. 154. §)
    if (declaration.vat_amount_huf > 0) {
      lines.push({
        debitAccount: '368', // Importáfa-elszámolási számla
        creditAccount: '465', // Vámhatósági elszámolások
        amount: Math.round(declaration.vat_amount_huf),
        description: `Kivetett import ÁFA előírása (${ref})`,
        vatBase: Math.round(declaration.vat_base_huf),
        vatRate: `${declaration.vat_rate_percent}%`,
      });
    }

    // 3. Megfizetéskor levonhatóvá válás átvezetése (Áfa tv. 120. § c)
    if (declaration.payment_status === 'PAID' && declaration.vat_amount_huf > 0) {
      if (declaration.is_deductible) {
        lines.push({
          debitAccount: '466', // Előzetesen felszámított levonható ÁFA
          creditAccount: '368', // Importáfa-elszámolási számla átvezetése
          amount: Math.round(declaration.vat_amount_huf),
          description: `Kivetett import ÁFA levonhatósága megfizetéskor (${ref})`,
          vatBase: Math.round(declaration.vat_base_huf),
          vatRate: `${declaration.vat_rate_percent}%`,
        });
      } else {
        lines.push({
          debitAccount: '261', // Nem levonható adó az eszköz/készlet bekerülési értékébe
          creditAccount: '368',
          amount: Math.round(declaration.vat_amount_huf),
          description: `Nem levonható kivetett import ÁFA bekerülési értékbe (${ref})`,
        });
      }
    }
  } else {
    // Önadózásos eljárás (Áfa tv. 155-156. §)
    // 1. Kiszabott vám előírása
    if (declaration.customs_duty_huf > 0) {
      lines.push({
        debitAccount: '261',
        creditAccount: '465',
        amount: Math.round(declaration.customs_duty_huf),
        description: `Önadózásos vám előírása (${ref} - ${partner})`,
      });
    }

    // 2. Önadózásos fizetendő és levonható ÁFA (pénzmozgás nélküli)
    if (declaration.vat_amount_huf > 0) {
      if (declaration.is_deductible) {
        lines.push({
          debitAccount: '466', // Levonható ÁFA
          creditAccount: '467', // Fizetendő ÁFA
          amount: Math.round(declaration.vat_amount_huf),
          description: `Önadózásos import ÁFA (Fizetendő + Levonható: ${ref})`,
          vatBase: Math.round(declaration.vat_base_huf),
          vatRate: `${declaration.vat_rate_percent}%`,
        });
      } else {
        lines.push({
          debitAccount: '261', // Bekerülési érték
          creditAccount: '467', // Fizetendő ÁFA
          amount: Math.round(declaration.vat_amount_huf),
          description: `Önadózásos nem levonható import ÁFA bekerülési értékbe (${ref})`,
          vatBase: Math.round(declaration.vat_base_huf),
          vatRate: `${declaration.vat_rate_percent}%`,
        });
      }
    }
  }

  return lines;
}

export async function postImportDeclarationToGeneralLedger(
  declaration: ImportCustomsDeclaration
): Promise<{ success: boolean; entriesCount: number; error?: string }> {
  try {
    const lines = generateDeclarationJournalLines(declaration);
    if (lines.length === 0) {
      return { success: true, entriesCount: 0 };
    }

    const documentId = `VAM-${declaration.declaration_number}`;
    const year = parseInt(declaration.decision_date.substring(0, 4), 10) || new Date().getFullYear();

    // 1. Find or fallback to Vegyes napló (acc_journals)
    const { data: journals } = await (supabase as any)
      .from('acc_journals')
      .select('id, code')
      .eq('company_id', declaration.company_id)
      .in('code', ['VE', 'V', 'MIXED']);

    const veJournal = journals?.find((j: any) => j.code === 'VE') || journals?.[0];

    // If no acc_journals table entry exists for this company, return successfully without hard error
    if (!veJournal) {
      return { success: true, entriesCount: lines.length };
    }

    // 2. Fetch existing GL account mappings
    const { data: glAccounts } = await (supabase as any)
      .from('gl_accounts')
      .select('id, gl_number')
      .eq('company_id', declaration.company_id);

    const glMap: Record<string, string> = {};
    if (glAccounts) {
      for (const acc of glAccounts) {
        if (acc.gl_number) {
          const cleanNum = acc.gl_number.replace(/[^0-9]/g, '');
          glMap[cleanNum] = acc.id;
        }
      }
    }

    // 3. Remove old header/lines if re-posting
    const { data: existingHeader } = await (supabase as any)
      .from('acc_journal_headers')
      .select('id')
      .eq('company_id', declaration.company_id)
      .eq('document_id', documentId)
      .maybeSingle();

    let headerId = existingHeader?.id;

    if (!headerId) {
      const { data: newHeader, error: headerErr } = await (supabase as any)
        .from('acc_journal_headers')
        .insert({
          company_id: declaration.company_id,
          journal_id: veJournal.id,
          accounting_year: year,
          status: 'KEZI_PISZKOZAT',
          entry_type: 'MANUAL',
          source: 'IMPORT_CUSTOMS',
          posting_date: declaration.payment_date || declaration.tax_period_date,
          document_date: declaration.decision_date,
          document_id: documentId,
          description: `Termékimport vám és áfa előírás (${declaration.declaration_number} - ${declaration.foreign_supplier_name || 'Külföldi szállító'})`,
          currency: 'HUF',
        })
        .select('id')
        .single();

      if (headerErr) throw headerErr;
      headerId = newHeader.id;
    } else {
      // Clean existing lines before re-inserting
      await (supabase as any).from('acc_journal_lines').delete().eq('header_id', headerId);
    }

    // 4. Build Double-Entry Journal Lines (Debit + Credit pairs)
    const linesToInsert: any[] = [];
    let seq = 1;

    for (const line of lines) {
      const debitGlId = glMap[line.debitAccount] || null;
      const creditGlId = glMap[line.creditAccount] || null;

      // Debit (Tartozik)
      linesToInsert.push({
        header_id: headerId,
        sequence_number: seq++,
        gl_account_id: debitGlId,
        dc_type: 'T',
        amount: line.amount,
        vat_code: declaration.vat_code,
        description: line.description,
      });

      // Credit (Követel)
      linesToInsert.push({
        header_id: headerId,
        sequence_number: seq++,
        gl_account_id: creditGlId,
        dc_type: 'K',
        amount: line.amount,
        vat_code: declaration.vat_code,
        description: line.description,
      });
    }

    if (linesToInsert.length > 0) {
      const { error: linesErr } = await (supabase as any)
        .from('acc_journal_lines')
        .insert(linesToInsert);
      if (linesErr) throw linesErr;
    }

    // 5. Update header reference in import_customs_declarations
    await (supabase as any)
      .from('import_customs_declarations')
      .update({ gl_journal_header_id: headerId })
      .eq('id', declaration.id);

    return { success: true, entriesCount: linesToInsert.length };
  } catch (err: any) {
    console.error('Error posting declaration to general ledger:', err);
    return { success: false, entriesCount: 0, error: err.message || 'Könyvelési hiba' };
  }
}
