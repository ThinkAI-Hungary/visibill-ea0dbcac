/**
 * ============================================================================
 * THINKERMAN - GOOGLE DRIVE SZÁMLAFELDOLGOZÓ AUTOMATIZÁCIÓ (GOOGLE APPS SCRIPT)
 * ============================================================================
 * 
 * Ez a script a kijelölt 'számlák' Google Drive mappából automatikusan:
 *  1. Beolvassa a bedobott számlákat (PDF, JPG, PNG, WEBP).
 *  2. Beküldi őket a Thinkerman Supabase Customer API-ba (ahol a trigger azonnal
 *     beemeli a PGMQ-ba, és a Thinkerman Worker elkezdi az OCR-t és a feldolgozást).
 *  3. A worker a számlán szereplő adószám/név alapján automatikusan a megfelelő
 *     Thinkerman céghez (Medixwell, Pmex, Háttér, Quad-Invest, ThinkAi) szortírozza a bizonylatot!
 *  4. Sikeres beküldés után a script a fájlt AZONNAL ÁTHELYEZI a 'feldolgozott' mappába.
 * 
 * TELEPÍTÉS:
 *  1. Nyisd meg a https://script.google.com oldalt (azzal a Google fiókkal, ahol a Drive mappa van).
 *  2. Kattints az 'Új projekt' (New Project) gombra.
 *  3. Másold be ezt a teljes kódot a szerkesztőbe.
 *  4. Írd be a SZAMLAK_FOLDER_ID értékét a böngésző címsorából.
 *  5. Kattints a Mentés gombra (Ctrl+S), majd válaszd ki fent az 'installAutoTrigger'
 *     függvényt és nyomj a 'Futtatás' (Run) gombra.
 * ============================================================================
 */

// ⚙️ KONFIGURÁCIÓ ⚙️
const CONFIG = {
  // A 'számlák' Google Drive mappa azonosítója (A böngésző címsorából: .../folders/<EZ_A_MAPPA_ID>)
  SZAMLAK_FOLDER_ID: 'IDE_MASOLD_A_SZAMLAK_MAPPA_IDT',

  // A feldolgozott számlák almappájának neve (pontosan a meglévő mappa neve)
  PROCESSED_FOLDER_NAME: 'feldolgozott',

  // Hiba esetén ide kerülhetnek az elutasított fájlok
  FAILED_FOLDER_NAME: 'hibás',

  // Thinkerman Supabase Customer API végpont és Master API kulcs
  API_BASE_URL: 'https://zgnukiocrnfnlwkbcssi.supabase.co/functions/v1/customer-api',
  API_KEY: 'vb_bbf9b3863171c3a87cdeb6cfd0c85158f5865562',

  // Kezdő fogadó cég (a worker adószám alapján automatikusan átirányítja a valós céghez!)
  DEFAULT_COMPANY_ID: 'be487956-0890-4779-ace1-ec478c9bc46f', // Medixwell Kft.

  // Támogatott számla kiterjesztések
  ALLOWED_EXTENSIONS: ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'],

  // Egy futás alatt feldolgozandó maximális számlaszám (Google 6 perces futási korlát védelme)
  MAX_FILES_PER_RUN: 40,
};

// 🚀 FŐ SZINKRONIZÁLÓ FÜGGVÉNY 🚀
function syncThinkermanInvoices() {
  Logger.log('=== [Thinkerman Drive Sync] Szinkronizáció indítása ===');

  if (!CONFIG.SZAMLAK_FOLDER_ID || CONFIG.SZAMLAK_FOLDER_ID === 'IDE_MASOLD_A_SZAMLAK_MAPPA_IDT') {
    throw new Error("Kérlek, add meg a CONFIG.SZAMLAK_FOLDER_ID értékét a script elején!");
  }

  let szamlakFolder;
  try {
    szamlakFolder = DriveApp.getFolderById(CONFIG.SZAMLAK_FOLDER_ID);
  } catch (e) {
    throw new Error(`Nem sikerült megnyitni a 'számlák' mappát (ID: ${CONFIG.SZAMLAK_FOLDER_ID}): ${e.message}`);
  }

  // 1. Biztosítjuk a 'feldolgozott' almappa létezését
  const processedFolder = getOrCreateSubFolder(szamlakFolder, CONFIG.PROCESSED_FOLDER_NAME);

  // 2. Bejárjuk a 'számlák' mappa közvetlen fájljait (az almappákat a getFiles() automatikusan kihagyja)
  const files = szamlakFolder.getFiles();
  let processedCount = 0;
  let errorCount = 0;

  while (files.hasNext() && processedCount < CONFIG.MAX_FILES_PER_RUN) {
    const file = files.next();
    const fileName = file.getName();

    if (!isSupportedFile(fileName)) {
      Logger.log(`  ⏭️ Nem támogatott fájltípus átugorva: ${fileName}`);
      continue;
    }

    Logger.log(`\n📄 Számla feldolgozása: "${fileName}" (${Math.round(file.getSize() / 1024)} KB)...`);

    try {
      const success = uploadInvoiceToThinkerman(file);
      if (success) {
        // Áthelyezés a 'feldolgozott' mappába
        moveFile(file, szamlakFolder, processedFolder);
        Logger.log(`  ✅ Sikeres beküldés PGMQ-ba és áthelyezve: ${CONFIG.PROCESSED_FOLDER_NAME}/${fileName}`);
        processedCount++;
      } else {
        Logger.log(`  ❌ API hiba a beküldéskor: ${fileName}`);
        errorCount++;
      }
    } catch (fileErr) {
      Logger.log(`  💥 Váratlan hiba: ${fileErr.message}`);
      errorCount++;
    }
  }

  Logger.log(`\n=== [Thinkerman Drive Sync] Kész! Beküldve: ${processedCount} db, Hibás: ${errorCount} db ===`);
}

// 🌐 THINKERMAN API HÍVÁS 🌐
function uploadInvoiceToThinkerman(file) {
  const url = `${CONFIG.API_BASE_URL}/v1/invoices/upload`;
  const fileBytes = file.getBlob().getBytes();
  const fileBase64 = Utilities.base64Encode(fileBytes);

  const payload = {
    company_id: CONFIG.DEFAULT_COMPANY_ID,
    file_name: file.getName(),
    file_base64: fileBase64,
    direction: 'INBOUND',
    source: 'google_drive',
  };

  const idempotencyKey = `gdrive_${file.getId()}_${file.getLastUpdated().getTime()}`;

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${CONFIG.API_KEY}`,
      'Idempotency-Key': idempotencyKey,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const resText = response.getContentText();

    let resJson = {};
    try {
      resJson = JSON.parse(resText);
    } catch (_) {}

    if ((statusCode === 200 || statusCode === 201) && resJson.success) {
      return true;
    }

    Logger.log(`  ⚠️ API Hiba (HTTP ${statusCode}): ${resText}`);
    return false;
  } catch (err) {
    Logger.log(`  ⚠️ Hálózati hiba a feltöltés során: ${err.message}`);
    return false;
  }
}

// 📁 SEGÉDFÜGGVÉNYEK 📁
function getOrCreateSubFolder(parentFolder, folderName) {
  const subFolders = parentFolder.getFolders();
  while (subFolders.hasNext()) {
    const sub = subFolders.next();
    if (sub.getName().trim().toLowerCase() === folderName.trim().toLowerCase()) {
      return sub;
    }
  }
  return parentFolder.createFolder(folderName);
}

function moveFile(file, sourceFolder, targetFolder) {
  try {
    if (typeof file.moveTo === 'function') {
      file.moveTo(targetFolder);
      return;
    }
  } catch (err) {
    Logger.log(`  ⚠️ moveTo nem elérhető (${err.message}), másolásos áthelyezés...`);
  }

  try {
    file.makeCopy(file.getName(), targetFolder);
    try {
      file.setTrashed(true);
    } catch (_) {
      try {
        sourceFolder.removeFile(file);
      } catch (__) {}
    }
  } catch (copyErr) {
    throw new Error(`Nem sikerült áthelyezni a fájlt: ${copyErr.message}`);
  }
}

function isSupportedFile(fileName) {
  if (!fileName || fileName.startsWith('.')) return false;
  const lower = fileName.toLowerCase();
  return CONFIG.ALLOWED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

// ⏱️ AUTOMATIKUS IDŐZÍTŐ ÉS TESZT ⏱️
/**
 * Egyszeri tesztfuttatás részletes naplózással.
 */
function testSync() {
  Logger.log('=== [Thinkerman Drive Sync - Tesztfuttatás] ===');
  syncThinkermanInvoices();
}

/**
 * 5 percenkénti automatikus időzítő bekapcsolása.
 */
function installAutoTrigger() {
  uninstallAutoTrigger();

  ScriptApp.newTrigger('syncThinkermanInvoices')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('✅ Automatikus időzítő sikeresen beállítva! A script 5 percenként automatikusan lefut a Google felhőjében.');
}

/**
 * Időzítő eltávolítása.
 */
function uninstallAutoTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let count = 0;
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'syncThinkermanInvoices') {
      ScriptApp.deleteTrigger(trigger);
      count++;
    }
  }
  Logger.log(`ℹ️ ${count} db korábbi időzítő eltávolítva.`);
}
