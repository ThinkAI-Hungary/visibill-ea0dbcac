#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Read environment
const envPath = path.join(projectRoot, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ [VAT GUARD] .env.local not found at:', envPath);
  process.exit(1);
}

const env = fs.readFileSync(envPath, 'utf8');
const urlMatch = env.match(/SUPABASE_URL="([^"]+)"/);
const keyMatch = env.match(/SUPABASE_SERVICE_KEY="([^"]+)"/);

if (!urlMatch || !keyMatch) {
  console.error('❌ [VAT GUARD] SUPABASE_URL or SUPABASE_SERVICE_KEY missing in .env.local');
  process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

// CLI arguments
const args = process.argv.slice(2);
const command = args[0] || 'verify'; // 'verify' or 'save'
const targetCompanyId = args[1] || 'acc22ca9-e9ff-4f9f-9495-ca7612b2e5e2'; // Taxology Kft.
const targetYear = parseInt(args[2] || '2026', 10);
const targetMonth = parseInt(args[3] || '7', 10);
const targetFreq = 'H';
const targetScope = 'all';

const baselineFile = path.join(projectRoot, 'tests', 'fixtures', 'vat_snapshot_taxology_2026_07.json');

async function fetchCalculationData() {
  console.log(`📡 [VAT GUARD] Calling calculate_vat_return(company=${targetCompanyId}, ${targetYear}-${targetMonth}, freq=${targetFreq}, scope=${targetScope})...`);
  
  const rpcRes = await supabase.rpc('calculate_vat_return', {
    p_company_id: targetCompanyId,
    p_year: targetYear,
    p_month: targetMonth,
    p_frequency: targetFreq,
    p_scope: targetScope
  });

  if (rpcRes.error) {
    throw new Error(`RPC calculate_vat_return failed: ${rpcRes.error.message} (${rpcRes.error.code})`);
  }

  const vatReturnId = rpcRes.data?.vat_return_id;
  if (!vatReturnId) {
    throw new Error('RPC returned without a vat_return_id');
  }

  const { data: vr, error: vrErr } = await supabase
    .from('vat_returns')
    .select('*')
    .eq('id', vatReturnId)
    .single();

  if (vrErr) throw vrErr;

  const { data: lines, error: linesErr } = await supabase
    .from('vat_return_lines')
    .select('row_number, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded')
    .eq('vat_return_id', vatReturnId)
    .order('row_number');

  if (linesErr) throw linesErr;

  const { data: mLines, error: mLinesErr } = await supabase
    .from('vat_return_m_lines')
    .select('partner_tax_number, partner_name, invoice_count, base_amount, tax_amount, base_amount_rounded, tax_amount_rounded')
    .eq('vat_return_id', vatReturnId)
    .order('base_amount_rounded', { ascending: false });

  if (mLinesErr) throw mLinesErr;

  return {
    metadata: {
      company_id: targetCompanyId,
      company_name: 'Taxology Kft.',
      period_year: targetYear,
      period_month: targetMonth,
      frequency: targetFreq,
      scope: targetScope,
      generated_at: new Date().toISOString(),
      vat_return_id: vatReturnId
    },
    header: {
      total_payable_tax: Number(vr.total_payable_tax),
      total_deductible_tax: Number(vr.total_deductible_tax),
      net_balance: Number(rpcRes.data.net_balance)
    },
    lines: (lines || []).map(l => ({
      row_number: String(l.row_number),
      base_amount: Number(l.base_amount),
      tax_amount: Number(l.tax_amount),
      base_amount_rounded: Number(l.base_amount_rounded),
      tax_amount_rounded: Number(l.tax_amount_rounded)
    })),
    m_lines_count: (mLines || []).length,
    m_lines: (mLines || []).map(m => ({
      partner_tax_number: m.partner_tax_number,
      partner_name: m.partner_name,
      invoice_count: Number(m.invoice_count),
      base_amount: Number(m.base_amount),
      tax_amount: Number(m.tax_amount),
      base_amount_rounded: Number(m.base_amount_rounded),
      tax_amount_rounded: Number(m.tax_amount_rounded)
    }))
  };
}

async function run() {
  if (command === 'save') {
    console.log('💾 [VAT GUARD] Mentési mód: Új ÁFA baseline rögzítése...');
    const current = await fetchCalculationData();
    const dir = path.dirname(baselineFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(baselineFile, JSON.stringify(current, null, 2), 'utf8');
    console.log(`✅ [VAT GUARD] Új baseline sikeresen elmentve: ${baselineFile}`);
    console.log(`   Fizetendő: ${current.header.total_payable_tax} Ft | Levonható: ${current.header.total_deductible_tax} Ft | Egyenleg: ${current.header.net_balance} Ft`);
    return;
  }

  if (command === 'verify') {
    console.log('🔍 [VAT GUARD] Ellenőrzési mód: Kalkuláció összehasonlítása a baseline-nal...');
    
    if (!fs.existsSync(baselineFile)) {
      console.error(`❌ [VAT GUARD] Baseline fájl nem található: ${baselineFile}`);
      console.error('Futtasd először a mentést: node scripts/vat-snapshot-guard.mjs save');
      process.exit(1);
    }

    const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
    const current = await fetchCalculationData();

    const diffs = [];

    // 1. Compare header totals
    if (Math.abs(current.header.total_payable_tax - baseline.header.total_payable_tax) > 0.5) {
      diffs.push({
        type: 'HEADER',
        item: 'total_payable_tax (Összes fizetendő áfa)',
        expected: `${baseline.header.total_payable_tax.toLocaleString('hu-HU')} Ft`,
        actual: `${current.header.total_payable_tax.toLocaleString('hu-HU')} Ft`
      });
    }

    if (Math.abs(current.header.total_deductible_tax - baseline.header.total_deductible_tax) > 0.5) {
      diffs.push({
        type: 'HEADER',
        item: 'total_deductible_tax (Összes levonható áfa)',
        expected: `${baseline.header.total_deductible_tax.toLocaleString('hu-HU')} Ft`,
        actual: `${current.header.total_deductible_tax.toLocaleString('hu-HU')} Ft`
      });
    }

    if (Math.abs(current.header.net_balance - baseline.header.net_balance) > 0.5) {
      diffs.push({
        type: 'HEADER',
        item: 'net_balance (ÁFA egyenleg)',
        expected: `${baseline.header.net_balance.toLocaleString('hu-HU')} Ft`,
        actual: `${current.header.net_balance.toLocaleString('hu-HU')} Ft`
      });
    }

    // 2. Compare Form Lines (row numbers, base, tax)
    const baselineLineMap = new Map(baseline.lines.map(l => [l.row_number, l]));
    const currentLineMap = new Map(current.lines.map(l => [l.row_number, l]));

    // Check for missing or extra lines
    for (const [rowNum, bLine] of baselineLineMap.entries()) {
      const cLine = currentLineMap.get(rowNum);
      if (!cLine) {
        diffs.push({
          type: 'LINE_MISSING',
          item: `${rowNum}. sor hiányzik az új kalkulációból!`,
          expected: `Adóalap: ${bLine.base_amount_rounded} eFt, Áfa: ${bLine.tax_amount_rounded} eFt`,
          actual: 'HIÁNYZIK'
        });
      } else {
        if (bLine.base_amount_rounded !== cLine.base_amount_rounded) {
          diffs.push({
            type: 'LINE_BASE_DIFF',
            item: `${rowNum}. sor kerekített adóalap`,
            expected: `${bLine.base_amount_rounded} eFt (${bLine.base_amount.toLocaleString('hu-HU')} Ft)`,
            actual: `${cLine.base_amount_rounded} eFt (${cLine.base_amount.toLocaleString('hu-HU')} Ft)`
          });
        }
        if (bLine.tax_amount_rounded !== cLine.tax_amount_rounded) {
          diffs.push({
            type: 'LINE_TAX_DIFF',
            item: `${rowNum}. sor kerekített áfa összeg`,
            expected: `${bLine.tax_amount_rounded} eFt (${bLine.tax_amount.toLocaleString('hu-HU')} Ft)`,
            actual: `${cLine.tax_amount_rounded} eFt (${cLine.tax_amount.toLocaleString('hu-HU')} Ft)`
          });
        }
      }
    }

    for (const [rowNum, cLine] of currentLineMap.entries()) {
      if (!baselineLineMap.has(rowNum)) {
        diffs.push({
          type: 'LINE_UNEXPECTED',
          item: `Váratlan új ${rowNum}. sor jelent meg a kalkulációban!`,
          expected: 'NEM SZEREPELT',
          actual: `Adóalap: ${cLine.base_amount_rounded} eFt, Áfa: ${cLine.tax_amount_rounded} eFt`
        });
      }
    }

    // 3. Compare M-Lines count and partner tax numbers
    if (current.m_lines_count !== baseline.m_lines_count) {
      diffs.push({
        type: 'M_LINES_COUNT',
        item: 'M-lapok (belföldi összesítő jelentések) száma',
        expected: `${baseline.m_lines_count} partner`,
        actual: `${current.m_lines_count} partner`
      });
    }

    const baselineMMap = new Map(baseline.m_lines.map(m => [m.partner_tax_number, m]));
    const currentMMap = new Map(current.m_lines.map(m => [m.partner_tax_number, m]));

    for (const [taxNum, bM] of baselineMMap.entries()) {
      const cM = currentMMap.get(taxNum);
      if (!cM) {
        diffs.push({
          type: 'M_LINE_MISSING',
          item: `M-lap hiányzik partnernél: ${bM.partner_name} (${taxNum})`,
          expected: `Áfa: ${bM.tax_amount_rounded} eFt (${bM.invoice_count} db számla)`,
          actual: 'HIÁNYZIK'
        });
      } else {
        if (bM.tax_amount_rounded !== cM.tax_amount_rounded) {
          diffs.push({
            type: 'M_LINE_TAX_DIFF',
            item: `M-lap áfa eltérés: ${bM.partner_name} (${taxNum})`,
            expected: `${bM.tax_amount_rounded} eFt`,
            actual: `${cM.tax_amount_rounded} eFt`
          });
        }
        if (bM.invoice_count !== cM.invoice_count) {
          diffs.push({
            type: 'M_LINE_COUNT_DIFF',
            item: `M-lap számlaszám eltérés: ${bM.partner_name} (${taxNum})`,
            expected: `${bM.invoice_count} db számla`,
            actual: `${cM.invoice_count} db számla`
          });
        }
      }
    }

    // Report results
    if (diffs.length > 0) {
      console.error('\n' + '='.repeat(80));
      console.error('🚨 [VAT GUARD] ÁFA KALKULÁCIÓ REGRESSZIÓ DETEKTÁLVA! 🚨');
      console.error('='.repeat(80));
      console.error(`Cég: ${baseline.metadata.company_name} | Időszak: ${baseline.metadata.period_year}/${baseline.metadata.period_month} (${baseline.metadata.frequency})`);
      console.error(`Talált eltérések száma: ${diffs.length}\n`);

      console.table(diffs.map(d => ({
        'Típus': d.type,
        'Érintett Tétel': d.item,
        'Várt (Baseline)': d.expected,
        'Kapott (Most)': d.actual
      })));

      console.error('\n❌ KÖTELEZŐ TEENDŐ:');
      console.error('1. Ellenőrizd a legutóbbi ÁFA módosításokat (RPC szűrések, kerekítések, levonási szabályok)!');
      console.error('2. Ha a kalkuláció szándékosan változott (pl. jogszabályi javítás miatt), frissítsd a baseline-t:');
      console.error('   npm run vat:snapshot\n');
      process.exit(1);
    } else {
      console.log('\n' + '='.repeat(80));
      console.log('✅ [VAT GUARD] ÁFA BEVALLÁS ÉP ÉS SÉRÜLÉSMENTES (100% EGYEZÉS)');
      console.log('='.repeat(80));
      console.log(`Cég: ${baseline.metadata.company_name} | Időszak: ${baseline.metadata.period_year}/${baseline.metadata.period_month}`);
      console.log(`- Összes fizetendő áfa:   ${current.header.total_payable_tax.toLocaleString('hu-HU')} Ft (OK)`);
      console.log(`- Összes levonható áfa:   ${current.header.total_deductible_tax.toLocaleString('hu-HU')} Ft (OK)`);
      console.log(`- Nettó különbözet:       ${current.header.net_balance.toLocaleString('hu-HU')} Ft (OK)`);
      console.log(`- Főlap sorok száma:      ${current.lines.length} sor (mind egyezik)`);
      console.log(`- M-lap partnerek száma:  ${current.m_lines_count} partner (mind egyezik)\n`);
      process.exit(0);
    }
  }

  console.error(`Ismeretlen parancs: ${command}. Használat: node scripts/vat-snapshot-guard.mjs [verify|save]`);
  process.exit(1);
}

run().catch(err => {
  console.error('❌ [VAT GUARD] Váratlan hiba:', err);
  process.exit(1);
});
