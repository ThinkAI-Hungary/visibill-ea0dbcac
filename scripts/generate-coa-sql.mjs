import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import crypto from 'crypto';

// Get file path from command line arguments
const inputFile = process.argv[2];

if (!inputFile) {
  console.error("Hiba: Kérlek add meg az Excel vagy CSV fájl elérési útját!");
  console.log("Használat: node scripts/generate-coa-sql.mjs <fájl.xlsx>");
  process.exit(1);
}

try {
  console.log(`Beolvasás: ${inputFile}...`);
  // Read the file manually to avoid ESM readFile issues
  const fileData = fs.readFileSync(inputFile);
  const workbook = XLSX.read(fileData, { type: 'buffer' });
  const firstSheet = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheet];
  
  // Convert to JSON
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  
  if (rows.length === 0) {
    throw new Error("A fájl üres vagy nem olvasható a tartalma.");
  }

  // Generate UUID for the preset
  const presetId = crypto.randomUUID();
  const presetName = "Beépített Rendszerszintű Számlatükör";

  let sqlStatements = [];
  
  sqlStatements.push(`-- Generált Rendszerszintű Számlatükör SQL Seed\n`);
  sqlStatements.push(`-- Futtatás dátuma: ${new Date().toISOString()}\n\n`);

  sqlStatements.push(`-- 1. Sablon létrehozása`);
  sqlStatements.push(`INSERT INTO chart_of_accounts_presets (id, type, name, is_active) `);
  sqlStatements.push(`VALUES ('${presetId}', 'generic', '${presetName}', false);\n`);

  sqlStatements.push(`-- 2. Tételek beszúrása (${rows.length} db)`);

  const escapeSql = (str) => {
    if (str === null || str === undefined || str === '') return 'NULL';
    return `'${String(str).replace(/'/g, "''")}'`;
  };

  const seenGlNumbers = new Set();
  let duplicateCount = 0;

  rows.forEach((row, index) => {
    const rowValues = Object.values(row);
    
    // Guess columns just like frontend
    const glNumberRaw = row['Account Number'] || row['Számlaszám'] || row['Fők.szám'] || row['Főkönyvi szám'] || row['gl_number'] || rowValues[0] || '';
    const shortNameRaw = row['Name'] || row['Név'] || row['Megnevezés'] || row['Számlanév'] || row['short_name'] || rowValues[1] || '';
    const descriptionRaw = row['Description'] || row['Leírás'] || row['description'] || rowValues[2] || '';

    const glNumber = String(glNumberRaw).trim();
    const shortName = String(shortNameRaw).trim();
    const description = descriptionRaw ? String(descriptionRaw).trim() : null;

    if (!glNumber) return; // skip empty

    if (seenGlNumbers.has(glNumber)) {
      console.warn(`⚠️ Figyelmeztetés: Duplikált főkönyvi szám kihagyva a generálásnál: ${glNumber}`);
      duplicateCount++;
      return;
    }
    seenGlNumbers.add(glNumber);

    const statement = `INSERT INTO gl_accounts (preset_id, gl_number, short_name, description) VALUES ('${presetId}', ${escapeSql(glNumber)}, ${escapeSql(shortName)}, ${escapeSql(description)}) ON CONFLICT (preset_id, gl_number) DO NOTHING;`;
    sqlStatements.push(statement);
  });

  const outputFilename = 'generic-coa-seed.sql';
  const outputPath = path.join(process.cwd(), outputFilename);

  fs.writeFileSync(outputPath, sqlStatements.join('\n'));
  
  console.log(`\nSikeres generálás! 🎉`);
  if (duplicateCount > 0) {
    console.log(`${duplicateCount} db duplikátumot automatikusan kiszűrt a script!`);
  }
  console.log(`A kimeneti fájl mentve ide: ${outputPath}`);
  console.log(`Ezt a fájlt futtasd le a Supabase SQL Editorjában.`);

} catch (error) {
  console.error("Hiba történt a feldolgozás során:", error.message);
}
