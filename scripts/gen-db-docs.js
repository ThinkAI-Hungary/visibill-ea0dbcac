/**
 * Database Schema Documentation Generator
 * Reads raw schema data from JSON files and generates markdown docs.
 * Expects input JSON files in the .temp-db-metadata/ directory.
 */
const fs = require('fs');
const path = require('path');

// ─── Data files (Relative to project root) ───
const METADATA_DIR = path.join(__dirname, '..', '.temp-db-metadata');
const COLUMNS_FILE = path.join(METADATA_DIR, 'columns.json');
const CONSTRAINTS_FILE = path.join(METADATA_DIR, 'constraints.json');
const INDEXES_FILE = path.join(METADATA_DIR, 'indexes.json');
const COMMENTS_FILE = path.join(METADATA_DIR, 'comments.json');
const TABLES_FILE = path.join(METADATA_DIR, 'tables.json');
const ACCURATE_FK_FILE = path.join(METADATA_DIR, 'accurate_fks.json');

const OUT_DIR = path.join(__dirname, '..', 'docs', 'architecture', 'database');

// ─── Parse helpers ───
function extractJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Warning: File not found: ${filePath}. Using empty array.`);
      return [];
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(raw);
    if (Array.isArray(obj)) return obj;
    if (obj.tables) return obj.tables;
    if (obj.result) {
      const m = obj.result.match(/\[[\s\S]*\]/);
      if (m) return JSON.parse(m[0]);
    }
    return [];
  } catch (e) {
    console.error(`❌ Error parsing ${filePath}:`, e.message);
    return [];
  }
}

// ─── Load data ───
console.log('Loading database metadata...');
if (!fs.existsSync(METADATA_DIR)) {
  console.error(`❌ Error: Metadata directory not found: ${METADATA_DIR}`);
  console.log('Please populate .temp-db-metadata/ files before running.');
  process.exit(1);
}

const columns = extractJson(COLUMNS_FILE);
const constraints = extractJson(CONSTRAINTS_FILE);
const accurateFKs = extractJson(ACCURATE_FK_FILE);
const indexes = extractJson(INDEXES_FILE);
const comments = extractJson(COMMENTS_FILE);
const tablesRaw = extractJson(TABLES_FILE);

console.log(`Loaded: ${columns.length} columns, ${constraints.length} constraints, ${accurateFKs.length} accurate FKs, ${indexes.length} indexes, ${comments.length} comments, ${tablesRaw.length} tables`);

// ─── Build lookup maps ───
const tableInfo = new Map();
tablesRaw.forEach(t => {
  const name = t.name ? t.name.replace('public.', '') : t.tablename;
  if (name) {
    tableInfo.set(name, { rows: t.rows, rls: t.rls_enabled, comment: t.comment || null });
  }
});

const commentMap = new Map();
comments.forEach(c => {
  if (c.table_name) commentMap.set(c.table_name, c.comment);
});

// Group columns by table
const columnsByTable = new Map();
columns.forEach(c => {
  if (c.table_name) {
    if (!columnsByTable.has(c.table_name)) columnsByTable.set(c.table_name, []);
    columnsByTable.get(c.table_name).push(c);
  }
});

// Group constraints by table (OLD - keep for UNIQUE/PK info)
const constraintsByTable = new Map();
constraints.forEach(c => {
  if (c.table_name) {
    if (!constraintsByTable.has(c.table_name)) constraintsByTable.set(c.table_name, []);
    constraintsByTable.get(c.table_name).push(c);
  }
});

// Group ACCURATE FKs by table (from pg_constraint - resolves auth.users correctly)
const accurateFKsByTable = new Map();
accurateFKs.forEach(fk => {
  if (fk.table_name) {
    if (!accurateFKsByTable.has(fk.table_name)) accurateFKsByTable.set(fk.table_name, []);
    accurateFKsByTable.get(fk.table_name).push(fk);
  }
});

// Group indexes by table
const indexesByTable = new Map();
indexes.forEach(i => {
  const tname = i.tablename || i.table_name;
  if (tname) {
    if (!indexesByTable.has(tname)) indexesByTable.set(tname, []);
    indexesByTable.get(tname).push(i);
  }
});

// ─── Table grouping ───
const GROUPS = [
  {
    id: '01-auth-users',
    title: '🔐 Auth & Felhasználók',
    desc: 'Felhasználói profilok, előfizetések, beállítások, NAV credentials.',
    tables: ['profiles', 'user_subscriptions', 'user_email_preferences', 'user_nav_credentials', 'settings', 'nylas_tokens']
  },
  {
    id: '02-companies',
    title: '🏢 Cégek & Tagság',
    desc: 'Cégek, tagságok, beállítások, telephely.',
    tables: ['companies', 'company_members', 'company_settings', 'company_locations', 'company_fx_settings']
  },
  {
    id: '03-permissions',
    title: '🔑 Jogosultságok & Hozzáférés',
    desc: 'Modul-szintű jogosultságok (eaisybill + eaisyBooks) és unified access cache.',
    tables: ['eaisybill_module_permissions', 'accounty_module_permissions', 'user_company_access_cache']
  },
  {
    id: '04-invoices',
    title: '📄 Számlák',
    desc: 'Számlafeldolgozás, feltöltések, tételmutató, backup táblák.',
    tables: ['invoices', 'invoice_items', 'invoice_uploads', 'sima_szamla_backup', 'vegszamla_backup', 'proforma_backup', 'egyszerusitett_szamla_backup']
  },
  {
    id: '05-nav',
    title: '🏛️ NAV Integráció',
    desc: 'NAV Online Számla rendszer — bejövő/kimenő számlák, szinkron logok.',
    tables: ['nav_invoices', 'nav_invoice_items', 'nav_sync_logs']
  },
  {
    id: '06-transactions-bank',
    title: '💳 Tranzakciók & Bank',
    desc: 'Banki tranzakciók, számla-tranzakció párosítás, bankkivonatok, SZÉP kártya.',
    tables: ['transactions', 'transaction_uploads', 'transaction_invoice_matches', 'match_transaction_overrides_log', 'bank_statements', 'bank_transactions', 'bank_statement_uploads', 'szep_card_transactions']
  },
  {
    id: '07-general-ledger',
    title: '📊 Főkönyv (General Ledger)',
    desc: 'Főkönyvi számlák, naplókönyvelés, GL import/audit, ÁFA kódok.',
    tables: ['gl_accounts', 'gl_journal_entries', 'gl_overrides_log', 'gl_upload_notifications', 'gl_audit_imports', 'gl_audit_accounts', 'gl_audit_partners', 'chart_of_accounts_presets', 'vat_codes']
  },
  {
    id: '08-salary-hr',
    title: '💰 Bér & Munkaidő',
    desc: 'Bérszámfejtés, bérfájlok, munkaidő-nyilvántartás, dolgozói díjszabások.',
    tables: ['salary', 'salary_files', 'time_entries', 'employee_rates', 'leave_requests']
  },
  {
    id: '09-petty-cash',
    title: '🏦 Házipénztár',
    desc: 'Házipénztár pénztárgépek, nyitó egyenlegek, tételek, szabályok.',
    tables: ['petty_cash_registers', 'petty_cash_opening_balances', 'petty_cash_entries', 'petty_cash_routing_rules', 'hp_settings']
  },
  {
    id: '10-assets',
    title: '📦 Tárgyi Eszközök',
    desc: 'Tárgyi eszközök nyilvántartása, értékcsökkenési események, TAO sablonok.',
    tables: ['fixed_assets', 'asset_events', 'tao_depreciation_templates']
  },
  {
    id: '11-shipping',
    title: '🚚 Szállítmányozás',
    desc: 'Fuvar import, fuvarokmányok, számla-párosítás.',
    tables: ['shipments', 'shipment_import_batches', 'transport_documents', 'shipment_matches']
  },
  {
    id: '12-annual-reports',
    title: '📋 Éves Beszámoló & ÁFA',
    desc: 'Éves zárlat, mérleg/eredménykimutatás struktúra, ÁFA bevallások.',
    tables: ['annual_reports', 'annual_report_notes_templates', 'bs_structure', 'bs_mapping', 'bs_prior_year', 'pnl_structure', 'pnl_mapping', 'vat_returns', 'vat_return_lines', 'vat_return_m_lines', 'vat_form_rows']
  },
  {
    id: '13-eaisybooks-core',
    title: '📘 eaisyBooks — Alap',
    desc: 'Könyvelő-ügyfél hozzárendelések, adóprofil, határidők, hiányzó dokumentumok, portál tokenek, kommunikáció.',
    tables: ['accounty_assignments', 'accounty_tax_profiles', 'accounty_deadlines', 'accounty_missing_items', 'accounty_communication_preferences', 'accounty_portal_tokens', 'accounty_audit_log', 'accounty_messages', 'accounty_uploads', 'accounty_documents', 'accounty_templates', 'accounty_template_versions', 'accounty_gdpr_requests']
  },
  {
    id: '14-eaisybooks-payroll',
    title: '📘 eaisyBooks — Bérszámfejtés',
    desc: 'Foglalkoztatottak, jogviszonyok, bérszámfejtési ciklusok, bérelemek, nyilatkozatok, cafeteria, letiltások.',
    tables: ['accounty_employees', 'accounty_employments', 'accounty_employee_jobs', 'accounty_job_modifications', 'accounty_payroll_cycles', 'accounty_payroll_items', 'accounty_payroll_calculations', 'accounty_declarations', 'accounty_cafeteria', 'accounty_garnishments', 'accounty_timesheets', 'accounty_leaves', 'accounty_job_codes']
  },
  {
    id: '15-eaisybooks-tax-legal',
    title: '📘 eaisyBooks — Adó & Jogi',
    desc: 'NAV bevallások, TAO kalkuláció, adóparaméterek, jogszabályfigyelő, cégkapu, NAV meghatalmazás.',
    tables: ['accounty_filings', 'accounty_tao_yearly', 'accounty_tax_parameters', 'accounty_tax_params_global', 'accounty_global_tax_params', 'accounty_legal_updates', 'accounty_cegkapu_settings', 'accounty_nav_representations', 'accounty_retention_rules', 'accounty_data_contracts']
  },
  {
    id: '16-eaisybooks-org',
    title: '📘 eaisyBooks — Szervezet',
    desc: 'Telephelyek, részlegek, költséghelyek, iroda beállítások, éves feladatok.',
    tables: ['accounty_sites', 'accounty_departments', 'accounty_cost_centers', 'accounty_office_settings', 'accounty_year_end_tasks', 'accounty_transfers']
  },
  {
    id: '17-eaisybooks-ev',
    title: '📘 eaisyBooks — EV (Egyéni Vállalkozó)',
    desc: '⚠️ **Planned/Empty** — EV ügyfelek speciális nyilvántartásai. Jelenleg 0 sorral, fejlesztés alatt.',
    tables: ['accounty_ev_client_settings', 'accounty_ev_lifecycle_events', 'accounty_ev_records_receivables', 'accounty_ev_records_payables', 'accounty_ev_records_fixed_assets', 'accounty_ev_records_investments', 'accounty_ev_records_securities', 'accounty_ev_records_wages', 'accounty_ev_records_vehicle_log', 'accounty_ev_records_consignment', 'accounty_ev_records_other_claims', 'accounty_ev_records_scrapping', 'accounty_ev_records_inventory', 'accounty_ev_records_subcontractors', 'accounty_ev_records_strict_forms', 'accounty_ev_contribution_calc', 'accounty_ev_hipa_calc', 'accounty_ev_tax_returns', 'accounty_ev_audit_log', 'accounty_penztarkonyv_tetel', 'accounty_penztarkonyv_period_close']
  },
  {
    id: '18-eaisybooks-ai',
    title: '📘 eaisyBooks — AI Chat',
    desc: 'AI asszisztens chat sessionök és üzenetek.',
    tables: ['accounty_ai_chat_sessions', 'accounty_ai_chat_messages']
  },
  {
    id: '19-platform-ops',
    title: '🛠️ Platform & Üzemeltetés',
    desc: 'Hibalogok, audit trail, LLM költségek, API kulcsok, email aliasok, devizaárfolyamok, visszajelzések.',
    tables: ['app_error_logs', 'audit_logs', 'llm_koltsegek', 'feedback', 'daily_exchange_rates', 'api_keys', 'email_aliases', 'outgoing_emails', 'dunning_sends']
  },
  {
    id: '20-tickets',
    title: '🎫 Hibajegy Rendszer',
    desc: 'Ügyfélszolgálati hibajegy kommentek, olvasottsági állapot, események.',
    tables: ['ticket_comments', 'ticket_reads', 'ticket_events']
  },
  {
    id: '21-master-data',
    title: '🏷️ Törzsadatok',
    desc: 'Kategóriák, projektek, partnertörzs, futár riportok.',
    tables: ['categories', 'projects', 'partners', 'report_uploads', 'courier_reports', 'tax', 'reverse_charge_entries']
  },
];

// ─── Generate table markdown ───
function genTable(tableName) {
  const cols = columnsByTable.get(tableName) || [];
  const idxs = indexesByTable.get(tableName) || [];
  const info = tableInfo.get(tableName) || {};
  const comment = commentMap.get(tableName) || info.comment || null;

  let md = `### \`${tableName}\`\n\n`;
  if (comment) md += `> ${comment}\n\n`;

  // Stats line
  const parts = [];
  parts.push(`**RLS:** ${info.rls ? '✅' : '❌'}`);
  parts.push(`**Sorok:** ~${info.rows ?? '?'}`);
  md += parts.join(' | ') + '\n\n';

  // Columns table
  if (cols.length > 0) {
    md += '| Oszlop | Típus | Null | Default |\n';
    md += '|--------|-------|------|---------|\n';
    for (const c of cols) {
      const dtype = c.character_maximum_length
        ? `${c.data_type}(${c.character_maximum_length})`
        : c.data_type;
      const nullable = c.is_nullable === 'YES' ? '✓' : '—';
      const def = c.column_default
        ? `\`${c.column_default.replace(/'/g, "'").substring(0, 40)}\``
        : '';
      md += `| ${c.column_name} | ${dtype} | ${nullable} | ${def} |\n`;
    }
    md += '\n';
  }

  // FK constraints (using pg_constraint data)
  const fks = accurateFKsByTable.get(tableName) || [];
  if (fks.length > 0) {
    md += '**FK:** ';
    md += fks.map(f => `\`${f.column_name}\` → \`${f.foreign_table}.${f.foreign_column}\``).join(', ');
    md += '\n\n';
  }

  // Indexes (skip PK)
  const nonPkIdx = idxs.filter(i => i.indexname && !i.indexname.endsWith('_pkey'));
  if (nonPkIdx.length > 0) {
    md += '**Indexek:** ';
    md += nonPkIdx.map(i => `\`${i.indexname}\``).join(', ');
    md += '\n\n';
  }

  md += '---\n\n';
  return md;
}

// ─── Generate group file ───
function genGroupFile(group) {
  let md = `# ${group.title}\n\n`;
  md += `> ${group.desc}\n\n`;
  md += `**Táblák ebben a csoportban:** ${group.tables.length}\n\n`;
  md += '---\n\n';

  for (const t of group.tables) {
    if (columnsByTable.has(t)) {
      md += genTable(t);
    } else {
      md += `### \`${t}\` — ⚠️ Nincs az adatbázisban\n\n---\n\n`;
    }
  }
  return md;
}

// ─── Generate overview ───
function genOverview() {
  let md = `# eaisybill-prod — Adatbázis Séma Áttekintés\n\n`;
  md += `**Összesen:** ~${tablesRaw.length} tábla | **RLS:** mind engedélyezve | **Supabase PostgreSQL**\n\n`;
  md += `Ez a dokumentáció az eaisybill-prod Supabase projekt teljes adatbázis sémáját tartalmazza. Célja, hogy bármely AI agent azonnal megértse a táblastruktúrát, kapcsolatokat és felhasználási kontextust.\n\n`;
  md += '---\n\n';
  md += '## Tartalomjegyzék\n\n';

  for (const g of GROUPS) {
    const rowTotal = g.tables.reduce((sum, t) => sum + ((tableInfo.get(t) || {}).rows || 0), 0);
    md += `- [${g.title}](./database/${g.id}.md) — ${g.tables.length} tábla, ~${rowTotal} sor\n`;
  }
  md += '\n---\n\n';

  md += '## Összes Tábla (ABC rendben)\n\n';
  md += '| Tábla | Csoport | Sorok | Leírás |\n';
  md += '|-------|---------|-------|--------|\n';

  // Build table→group mapping
  const tableGroup = new Map();
  GROUPS.forEach(g => g.tables.forEach(t => tableGroup.set(t, g.title)));

  const allTableNames = [...columnsByTable.keys()].sort();
  for (const t of allTableNames) {
    const info2 = tableInfo.get(t) || {};
    const comment2 = commentMap.get(t) || info2.comment || '';
    const grp = tableGroup.get(t) || '❓ Uncategorized';
    const shortComment = comment2.length > 80 ? comment2.substring(0, 77) + '...' : comment2;
    md += `| \`${t}\` | ${grp} | ${info2.rows ?? '?'} | ${shortComment} |\n`;
  }

  md += '\n---\n\n';
  md += '## Kapcsolódó Dokumentáció\n\n';
  md += '- [A-019: Management Dashboard](./decisions/A-019-management-dashboard.md) — Adatforrás referencia\n';
  md += '- [A-003: Multi-tenancy RLS](./decisions/A-003-multi-tenancy-rls.md) — RLS policy-k\n';
  md += '- [A-016: PostgreSQL Query Strategy](./decisions/A-016-postgresql-query-strategy.md) — RPC function-ök\n';

  return md;
}

// ─── Write files ───
fs.mkdirSync(OUT_DIR, { recursive: true });

// Write overview
const overviewPath = path.join(OUT_DIR, '..', 'database-schema.md');
fs.writeFileSync(overviewPath, genOverview(), 'utf8');
console.log(`✅ Overview: ${overviewPath}`);

// Write group files
for (const g of GROUPS) {
  const filePath = path.join(OUT_DIR, `${g.id}.md`);
  fs.writeFileSync(filePath, genGroupFile(g), 'utf8');
  console.log(`✅ Group: ${filePath}`);
}

// Check uncategorized
const allCategorized = new Set();
GROUPS.forEach(g => g.tables.forEach(t => allCategorized.add(t)));
const uncategorized = [...columnsByTable.keys()].filter(t => !allCategorized.has(t));
if (uncategorized.length > 0) {
  console.log(`\n⚠️  Uncategorized tables: ${uncategorized.join(', ')}`);
}

console.log(`\n🎉 Done! ${GROUPS.length} group files + 1 overview`);
