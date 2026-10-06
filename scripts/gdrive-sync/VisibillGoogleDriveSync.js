/**
 * ============================================================================
 * VISIBILL GOOGLE DRIVE INVOICE SYNC (GOOGLE APPS SCRIPT)
 * ============================================================================
 * 
 * Ez a script a kijelölt Google Drive mappából automatikusan összegyűjti a
 * számlaképeket (PDF, JPG, PNG, WEBP), felküldi őket a Visibill Customer REST API-ra,
 * és sikeres feldolgozás után átmozgatja őket a "Feldolgozva" mappába.
 * 
 * JELLEMZŐK:
 *  - 100% felhős, szerver nélküli működés a Google infrastruktúráján.
 *  - Többcéges (Multi-Tenancy) támogatás cégenkénti almappákkal (adószám vagy cégnév alapján).
 *  - Automatikus idempotencia és duplikáció-védelem (Idempotency-Key + átmozgatás).
 *  - Egykattintásos időzítő telepítés (5 vagy 10 percenkénti automatikus futás).
 * 
 * TELEPÍTÉS:
 *  1. Nyisd meg a Google Drive-ot és hozz létre egy gyökérmappát (pl. "Visibill Számlák").
 *  2. Nyisd meg a https://script.google.com/ felületet és hozz létre egy "Új projektet".
 *  3. Másold be ezt a teljes kódot a szerkesztőbe a meglévő tartalom helyére.
 *  4. Töltsd ki a CONFIG szekcióban a saját API_KEY-t és a ROOT_FOLDER_ID-t.
 *  5. Futtasd a `testVisibillConnection` függvényt a kapcsolat ellenőrzéséhez!
 *  6. Futtasd a `installAutoTrigger` függvényt a háttérbeli automatizáció indításához!
 * ============================================================================
 */

// ─── KONFIGURÁCIÓ ─────────────────────────────────────────────────────────────
const CONFIG = {
  // A Visibill Customer REST API végpontja
  API_BASE_URL: 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/customer-api',

  // A Visibill felületen generált API kulcs (Settings > Biztonság > API Kulcsok: 'read_write' scope)
  API_KEY: 'vb_b8ebeeff3127b50d2152299ce176d2127394d7d5',

  // A Google Drive gyökérmappa azonosítója (A mappa böngészős URL-jéből a "/folders/..." utáni karaktersorozat)
  // Példa URL: https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ -> ROOT_FOLDER_ID: '1aBcDeFgHiJkLmNoPqRsTuVwXyZ'
  ROOT_FOLDER_ID: 'IDE_ILD_A_GOOGLE_DRIVE_GYOKERMAPPA_ID-T',

  // Almappák elnevezése a cégmappákon belül
  INBOX_FOLDER_NAME: 'Számlák',         // Ide töltik fel a userek a számlákat (alias: 'szamlak', 'Bejövő', 'Inbox')
  PROCESSED_FOLDER_NAME: 'Feldolgozva', // Ide mozgatja a sikereseket (alias: 'Processed')
  FAILED_FOLDER_NAME: 'Hibás',         // Ide mozgatja az elutasított fájlokat (alias: 'Failed')

  // Támogatott számla kiterjesztések
  ALLOWED_EXTENSIONS: ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'],

  // Egy futás alkalmával feldolgozandó maximális számlaszám (Google 6 perces futási korlát védelme)
  MAX_FILES_PER_RUN: 30,

  // Havonkénti almappák a Feldolgozva alatt (pl. Feldolgozva/2026-10/)
  ORGANIZE_BY_MONTH: true,
};

// ─── FŐ SZINKRONIZÁLÓ FÜGGVÉNY ────────────────────────────────────────────────
/**
 * Fő szinkronizációs folyamat. Időzítőhöz (Trigger) vagy manuális indításhoz.
 */
function syncGoogleDriveToVisibill() {
  Logger.log('=== [Visibill Sync] Szinkronizáció indítása ===');

  if (CONFIG.API_KEY.includes('IDE_ILD') || CONFIG.ROOT_FOLDER_ID.includes('IDE_ILD')) {
    throw new Error('Kérlek töltsd ki a CONFIG szekcióban az API_KEY és ROOT_FOLDER_ID értékeket a futtatás előtt!');
  }

  // 1. Cégek lekérése a Visibillből az automatikus feloldáshoz
  const companyCatalog = fetchAccessibleCompanies();
  if (!companyCatalog || companyCatalog.length === 0) {
    Logger.log('❌ Nem található elérhető cég ehhez az API kulcshoz.');
    return;
  }
  Logger.log(`✅ ${companyCatalog.length} elérhető cég betöltve a Visibillből.`);

  // 2. Gyökérmappa elérése
  let rootFolder;
  try {
    rootFolder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  } catch (e) {
    throw new Error(`Nem sikerült megnyitni a gyökérmappát (ID: ${CONFIG.ROOT_FOLDER_ID}): ${e.message}`);
  }

  let totalProcessed = 0;
  let totalErrors = 0;

  // 3. Cégmappák bejárása
  const subFolders = rootFolder.getFolders();
  let folderCount = 0;

  while (subFolders.hasNext() && totalProcessed < CONFIG.MAX_FILES_PER_RUN) {
    const companyFolder = subFolders.next();
    const folderName = companyFolder.getName();
    folderCount++;

    // Cég azonosítása a mappa nevéből (Adószám, Cégnév vagy UUID alapján)
    const matchedCompany = resolveCompanyFromFolderName(folderName, companyCatalog);
    if (!matchedCompany) {
      Logger.log(`⚠️ Kihagyva: "${folderName}" mappához nem található megfelelő cég a Visibill fiókban.`);
      continue;
    }

    Logger.log(`📁 Feldolgozás alatt: "${folderName}" -> Cég: ${matchedCompany.name} (Adószám: ${matchedCompany.tax_number || 'N/A'}, ID: ${matchedCompany.id})`);

    // Almappák (Bejövő, Feldolgozva, Hibás) feloldása
    const folders = ensureCompanyFolders(companyFolder);

    // Számlák beolvasása (elsődlegesen a Számlák almappából, másodlagosan közvetlenül a cégmappából)
    const scanTargets = [
      { sourceFolder: folders.inbox, label: 'Számlák mappa' },
      { sourceFolder: companyFolder, label: 'Cégmappa gyökér' },
    ];

    for (const target of scanTargets) {
      const files = target.sourceFolder.getFiles();
      while (files.hasNext() && totalProcessed < CONFIG.MAX_FILES_PER_RUN) {
        const file = files.next();
        const fileName = file.getName();

        if (!isSupportedFile(fileName)) {
          Logger.log(`  ℹ️ Nem támogatott fájl kihagyva: ${fileName}`);
          continue;
        }

        Logger.log(`  🚀 Számla feltöltése (${target.label}): ${fileName} (${Math.round(file.getSize() / 1024)} KB)...`);
        const uploadSuccess = uploadInvoiceToVisibill(file, matchedCompany.id);

        if (uploadSuccess) {
          // Sikeres feltöltés -> Átmozgatás a Feldolgozva mappába
          const targetFolder = getTargetProcessedFolder(folders.processed);
          moveFile(file, target.sourceFolder, targetFolder);
          totalProcessed++;
          Logger.log(`  ✅ Sikeres! Átmozgatva: ${fileName} -> ${targetFolder.getName()}/`);
        } else {
          // Hiba esetén -> Átmozgatás a Hibás mappába
          moveFile(file, target.sourceFolder, folders.failed);
          totalErrors++;
          Logger.log(`  ❌ Hiba történt! Átmozgatva a Hibás mappába: ${fileName}`);
        }
      }
    }
  }

  Logger.log(`=== [Visibill Sync] Kész! Feldolgozva: ${totalProcessed} db, Hibás: ${totalErrors} db ===`);
}

// ─── VISIBILL API HÍVÁSOK ─────────────────────────────────────────────────────

/**
 * Lekérdezi az API kulcshoz tartozó elérhető cégeket.
 */
function fetchAccessibleCompanies() {
  const url = `${CONFIG.API_BASE_URL}/v1/companies`;
  const options = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${CONFIG.API_KEY}`,
      'Accept': 'application/json',
    },
    muteHttpExceptions: true,
  };

  try {
    const res = UrlFetchApp.fetch(url, options);
    const statusCode = res.getResponseCode();
    const body = JSON.parse(res.getContentText());

    if (statusCode !== 200 || !body.success) {
      Logger.log(`Hiba a cégek lekérdezésekor (HTTP ${statusCode}): ${JSON.stringify(body)}`);
      return [];
    }

    return body.data?.companies || [];
  } catch (err) {
    Logger.log(`Hálózati hiba a cégek lekérdezésekor: ${err.message}`);
    return [];
  }
}

/**
 * Számla PDF vagy képfájl feltöltése a Visibill Customer REST API-ra Base64 formátumban.
 */
function uploadInvoiceToVisibill(file, companyId) {
  const url = `${CONFIG.API_BASE_URL}/v1/invoices/upload`;
  const fileName = file.getName();
  const fileBlob = file.getBlob();
  const base64Content = Utilities.base64Encode(fileBlob.getBytes());

  // Idempotency-Key generálása a duplikáció elkerülésére (Drive fájl ID + utolsó módosítás ideje)
  const idempotencyKey = `gdrive_${file.getId()}_${file.getLastUpdated().getTime()}`;

  const payload = {
    company_id: companyId,
    file_name: fileName,
    file_base64: base64Content,
    direction: 'INBOUND',
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${CONFIG.API_KEY}`,
      'Idempotency-Key': idempotencyKey,
      'Accept': 'application/json',
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
    } catch (_) { }

    if (statusCode === 200 && resJson.success) {
      return true;
    }

    Logger.log(`  ❌ API hiba (HTTP ${statusCode}): ${resText}`);
    return false;
  } catch (err) {
    Logger.log(`  ❌ Hálózati hiba a feltöltés során: ${err.message}`);
    return false;
  }
}

// ─── CÉGAZONOSÍTÁS ÉS MAPPAKEZELŐ SEGÉDFÜGGVÉNYEK ──────────────────────────────

/**
 * A mappa nevéből automatikusan feloldja a megfelelő Visibill céget.
 * Támogatja:
 *  - Adószám törzsszám (első 8 jegy) egyezést: pl. "12345678" vagy "12345678-1-42"
 *  - Cégnév részleges vagy pontos egyezést (kis-nagybetű független)
 *  - Cég UUID egyezést
 */
function resolveCompanyFromFolderName(folderName, companies) {
  const cleanName = folderName.trim().toLowerCase();

  // 1. Keresés UUID alapján
  for (const c of companies) {
    if (c.id && cleanName.includes(c.id.toLowerCase())) {
      return c;
    }
  }

  // 2. Keresés adószám (8 jegyű törzsszám) alapján
  const digitsInFolder = folderName.replace(/\D/g, '');
  for (const c of companies) {
    if (c.tax_number) {
      const cTaxDigits = c.tax_number.replace(/\D/g, '');
      const cTaxPrefix = cTaxDigits.substring(0, 8);
      if (cTaxPrefix && digitsInFolder.includes(cTaxPrefix)) {
        return c;
      }
    }
  }

  // 3. Keresés cégnév alapján
  for (const c of companies) {
    if (c.name) {
      const cNameClean = c.name.trim().toLowerCase();
      if (cleanName.includes(cNameClean) || cNameClean.includes(cleanName)) {
        return c;
      }
    }
  }

  return null;
}

/**
 * Biztosítja a Bejövő, Feldolgozva és Hibás mappák létezését a cégmappán belül.
 */
function ensureCompanyFolders(companyFolder) {
  return {
    inbox: getOrCreateSubfolder(companyFolder, CONFIG.INBOX_FOLDER_NAME, ['szamlak', 'Bejövő', 'Inbox', 'bejoevo']),
    processed: getOrCreateSubfolder(companyFolder, CONFIG.PROCESSED_FOLDER_NAME, ['Processed', 'kesz', 'feldolgozott']),
    failed: getOrCreateSubfolder(companyFolder, CONFIG.FAILED_FOLDER_NAME, ['Failed', 'hibas']),
  };
}

/**
 * Almappa felkeresése alias-okkal vagy automatikus létrehozása.
 */
function getOrCreateSubfolder(parentFolder, primaryName, aliases) {
  const folders = parentFolder.getFolders();
  const searchNames = [primaryName.toLowerCase(), ...(aliases || []).map(a => a.toLowerCase())];

  while (folders.hasNext()) {
    const f = folders.next();
    if (searchNames.includes(f.getName().toLowerCase())) {
      return f;
    }
  }
  return parentFolder.createFolder(primaryName);
}

/**
 * Ha havi bontás van beállítva, létrehozza a Feldolgozva/ÉÉÉÉ-HH almappát.
 */
function getTargetProcessedFolder(processedRoot) {
  if (!CONFIG.ORGANIZE_BY_MONTH) {
    return processedRoot;
  }
  const now = new Date();
  const yearMonth = Utilities.formatDate(now, Session.getScriptTimeZone() || 'GMT+1', 'yyyy-MM');
  return getOrCreateSubfolder(processedRoot, yearMonth);
}

/**
 * Fájl áthelyezése forrásmappából célmappába.
 */
function moveFile(file, fromFolder, toFolder) {
  toFolder.addFile(file);
  fromFolder.removeFile(file);
}

/**
 * Kiterjesztés ellenőrzése.
 */
function isSupportedFile(fileName) {
  const lower = fileName.toLowerCase();
  return CONFIG.ALLOWED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

// ─── ADMIN & TESZT ESZKÖZÖK (KÉZI INDÍTÁSHOZ) ─────────────────────────────────

/**
 * Kapcsolat és jogosultságok tesztelése a Script Editor konzolján.
 */
function testVisibillConnection() {
  Logger.log('--- [Teszt 1] Visibill API Kulcs és Cégek ellenőrzése ---');
  const companies = fetchAccessibleCompanies();

  if (companies.length === 0) {
    Logger.log('❌ Hiba: Nem sikerült cégeket elérni. Ellenőrizd a CONFIG.API_KEY értékét!');
    return;
  }

  Logger.log(`✅ Sikeres kapcsolat! ${companies.length} elérhető cég:`);
  companies.forEach((c, idx) => {
    Logger.log(`   ${idx + 1}. ${c.name} | Adószám: ${c.tax_number || 'N/A'} | ID: ${c.id}`);
  });

  Logger.log('\n--- [Teszt 2] Google Drive Gyökérmappa ellenőrzése ---');
  try {
    const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
    Logger.log(`✅ Gyökérmappa elérve: "${root.getName()}" (ID: ${root.getId()})`);

    const subfolders = root.getFolders();
    let count = 0;
    Logger.log('   Mappák a gyökérben:');
    while (subfolders.hasNext()) {
      const sf = subfolders.next();
      count++;
      const matched = resolveCompanyFromFolderName(sf.getName(), companies);
      const matchStatus = matched ? `-> CÉGHEZ RENDELVE: ${matched.name}` : '-> ⚠️ NEM ILLESZKEDIK EGYIK CÉGHEZ SEM';
      Logger.log(`   - "${sf.getName()}" ${matchStatus}`);
    }
    if (count === 0) {
      Logger.log('   (A gyökérmappa jelenleg üres. Hozz létre cégmappákat!)');
    }
  } catch (err) {
    Logger.log(`❌ Hiba a Drive mappa elérésekor: ${err.message}`);
    Logger.log('Kérlek ellenőrizd a CONFIG.ROOT_FOLDER_ID értékét!');
  }
}

/**
 * Automatikus időzítő (Trigger) telepítése 5 perces futási gyakorisággal.
 */
function installAutoTrigger() {
  uninstallAutoTrigger(); // Duplikátumok megelőzése

  ScriptApp.newTrigger('syncGoogleDriveToVisibill')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('✅ Automatikus időzítő sikeresen beállítva: A számlaszinkronizáció mostantól 5 percenként automatikusan lefut a háttérben!');
}

/**
 * Időzítő eltávolítása / leállítása.
 */
function uninstallAutoTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let count = 0;
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'syncGoogleDriveToVisibill') {
      ScriptApp.deleteTrigger(t);
      count++;
    }
  }
  Logger.log(`ℹ️ ${count} db korábbi időzítő eltávolítva.`);
}

/**
 * Google Sheet-hez csatolva automatikus menüt ad az eszköztárhoz.
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('Visibill Számlaszinkron')
      .addItem('🚀 Szinkronizálás futtatása most', 'syncGoogleDriveToVisibill')
      .addItem('🔍 Kapcsolat és Mappák tesztelése', 'testVisibillConnection')
      .addSeparator()
      .addItem('⏰ Automatikus időzítő bekapcsolása (5 perc)', 'installAutoTrigger')
      .addItem('⏹️ Időzítő kikapcsolása', 'uninstallAutoTrigger')
      .addToUi();
  } catch (_) {
    // Standalone script esetén nem dobunk hibát
  }
}
