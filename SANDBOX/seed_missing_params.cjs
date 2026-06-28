const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read env.local or env manually
const loadEnv = () => {
  const envLocalPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf-8');
    content.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
};

loadEnv();

const SUPABASE_URL = 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) {
  console.error("No SUPABASE_SERVICE_KEY found in env!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const missingParams = [
  {
    param_key: 'szocho_plafon',
    tax_year: 2025,
    param_value: 6403200,
    description: 'Szocho-plafon (minimálbér 24× = 266800 × 24 = 6.403.200 Ft)',
    legal_reference: 'Szocho tv. 2. § (4)'
  },
  {
    param_key: 'szocho_plafon',
    tax_year: 2026,
    param_value: 7747200,
    description: 'Szocho-plafon (minimálbér 24× = 322800 × 24 = 7.747.200 Ft)',
    legal_reference: 'Szocho tv. 2. § (4)'
  },
  {
    param_key: 'minimalber_eves',
    tax_year: 2025,
    param_value: 3201600,
    description: 'Éves minimálbér (266800 × 12 = 3.201.600 Ft)',
    legal_reference: '2024. évi kormányrendelet'
  },
  {
    param_key: 'minimalber_eves',
    tax_year: 2026,
    param_value: 3873600,
    description: 'Éves minimálbér (322800 × 12 = 3.873.600 Ft)',
    legal_reference: '426/2025. (XII. 23.) Korm. rendelet'
  },
  {
    param_key: 'garantalt_berminimum_eves',
    tax_year: 2025,
    param_value: 3912000,
    description: 'Éves garantált bérminimum (326000 × 12 = 3.912.000 Ft)',
    legal_reference: '2024. évi kormányrendelet'
  },
  {
    param_key: 'garantalt_berminimum_eves',
    tax_year: 2026,
    param_value: 4478400,
    description: 'Éves garantált bérminimum (373200 × 12 = 4.478.400 Ft)',
    legal_reference: '426/2025. (XII. 23.) Korm. rendelet'
  }
];

async function seed() {
  console.log("Starting seeding of missing tax parameters...");
  for (const param of missingParams) {
    const { data, error } = await supabase
      .from('accounty_global_tax_params')
      .upsert(param, { onConflict: 'param_key,tax_year' });

    if (error) {
      console.error(`Error inserting ${param.param_key} (${param.tax_year}):`, error);
    } else {
      console.log(`Successfully upserted ${param.param_key} (${param.tax_year})`);
    }
  }
  console.log("Seeding finished.");
}

seed();
