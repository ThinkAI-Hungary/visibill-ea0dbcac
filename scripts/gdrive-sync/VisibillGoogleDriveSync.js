/**
 * ============================================================================
 * VISIBILL & THINKERMAN GOOGLE DRIVE INVOICE SYNC (GOOGLE APPS SCRIPT)
 * ============================================================================
 * 
 * Ez a script a kijelölt Google Drive gyökérmappából ("Visibill") automatikusan
 * összegyűjti a számlaképeket (PDF, JPG, PNG, WEBP), felküldi őket a megfelelő
 * Visibill vagy Thinkerman REST API-ra, majd sikeres feldolgozás után átmozgatja
 * őket havi bontásban a "Feldolgozva" mappába.
 * 
 * ARCHITEKTÚRA & MAPPASTRUKTÚRA:
 *  - Visibill (Google Drive Gyökérmappa)
 *    ├── <Adószám vagy Cégnév>/        -> Visibill PROD adatbázisba megy
 *    │   ├── Számlák/ (vagy nyersen)
 *    │   ├── Feldolgozva/ÉÉÉÉ-HH/
 *    │   └── Hibás/
 *    └── Thinkerman/                   -> Thinkerman dedikált projektbe megy
 *        ├── 24383691-2-06 (Medixwell)/
 *        ├── 14921029-2-06 (Pmex)/
 *        └── ...
 * 
 * JELLEMZŐK:
 *  - 100% felhős, szerver nélküli működés a Google infrastruktúráján.
 *  - Automatikus projekt-irányítás (Visibill PROD vs. Thinkerman).
 *  - Többcéges (Multi-Tenancy) adószám és cégnév alapú intelligens párosítás.
 *  - Automatikus idempotencia és duplikáció-védelem (Idempotency-Key + átmozgatás).
 *  - Egykattintásos időzítő telepítés (5 percenkénti automatikus futás).
 * ============================================================================
 */

// ─── KONFIGURÁCIÓ ─────────────────────────────────────────────────────────────
const CONFIG = {
  // A Google Drive gyökérmappa azonosítója (A "Visibill" mappa ID-ja a címsorból)
  ROOT_FOLDER_ID: '1KB2czRlRVsay4dJELvbudxMZN7xoH7PK',

  // Projektek és API végpontjaik
  PROJECTS: {
    // Alapértelmezett: Visibill PROD (a gyökérben lévő cégmappákhoz)
    PROD: {
      NAME: 'Visibill PROD',
      API_BASE_URL: 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/customer-api',
      API_KEY: 'vb_b8ebeeff3127b50d2152299ce176d2127394d7d5',
    },
    // Thinkerman projekt (a gyökéren belüli "Thinkerman" nevű mappához)
    THINKERMAN: {
      NAME: 'Thinkerman',
      API_BASE_URL: 'https://zgnukiocrnfnlwkbcssi.supabase.co/functions/v1/customer-api',
      API_KEY: 'vb_bbf9b3863171c3a87cdeb6cfd0c85158f5865562',
      FOLDER_NAME: 'Thinkerman', // Mappa neve a gyökérben (kis/nagybetű független)
    },
  },

  // Almappák elnevezése a cégmappákon belül
  INBOX_FOLDER_NAME: 'Számlák',         // Ide tölthetők fel a számlák (alias: 'szamlak', 'Bejövő', 'Inbox')
  PROCESSED_FOLDER_NAME: 'Feldolgozva', // Ide mozgatja a sikereseket (alias: 'Processed')
  FAILED_FOLDER_NAME: 'Hibás',         // Ide mozgatja az elutasított fájlokat (alias: 'Failed')

  // Támogatott számla kiterjesztések
  ALLOWED_EXTENSIONS: ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'],

  // Egy futás alkalmával feldolgozandó maximális számlaszám (Google 6 perces futási korlát védelme)
  MAX_FILES_PER_RUN: 40,

  // Havonkénti almappák a Feldolgozva alatt (pl. Feldolgozva/2026-10/)
  ORGANIZE_BY_MONTH: true,
};

// ─── FŐ SZINKRONIZÁLÓ FÜGGVÉNY ────────────────────────────────────────────────
/**
 * Fő szinkronizációs folyamat. Időzítőhöz (Trigger) vagy manuális indításhoz.
 */
function syncGoogleDriveToVisibill() {
  Logger.log('=== [Visibill & Thinkerman Sync] Szinkronizáció indítása ===');

  let rootFolder;
  try {
    rootFolder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  } catch (e) {
    throw new Error(`Nem sikerült megnyitni a gyökérmappát (ID: ${CONFIG.ROOT_FOLDER_ID}): ${e.message}`);
  }

  // 1. Cégkatalógusok előzetes betöltése
  const prodCatalog = fetchAccessibleCompanies(CONFIG.PROJECTS.PROD);
  Logger.log(`✅ [PROD] ${prodCatalog.length} elérhető cég betöltve a Visibillből.`);

  let thinkermanCatalog = [];
  if (CONFIG.PROJECTS.THINKERMAN && CONFIG.PROJECTS.THINKERMAN.API_KEY) {
    thinkermanCatalog = fetchAccessibleCompanies(CONFIG.PROJECTS.THINKERMAN);
    Logger.log(`✅ [THINKERMAN] ${thinkermanCatalog.length} elérhető cég betöltve.`);
  }

  let totalProcessed = 0;
  let totalErrors = 0;

  // 2. Gyökérmappa bejárása
  const subFolders = rootFolder.getFolders();
  while (subFolders.hasNext() && totalProcessed < CONFIG.MAX_FILES_PER_RUN) {
    const folder = subFolders.next();
    const folderName = folder.getName().trim();

    // Megnézzük, hogy ez a dedikált Thinkerman gyűjtőmappa-e
    const isThinkermanContainer = CONFIG.PROJECTS.THINKERMAN &&
      CONFIG.PROJECTS.THINKERMAN.FOLDER_NAME &&
      folderName.toLowerCase() === CONFIG.PROJECTS.THINKERMAN.FOLDER_NAME.toLowerCase();

    if (isThinkermanContainer) {
      Logger.log(`\n🏢 === THINKERMAN Projektmappa feldolgozása ("${folderName}") ===`);
      const thinkSubFolders = folder.getFolders();
      while (thinkSubFolders.hasNext() && totalProcessed < CONFIG.MAX_FILES_PER_RUN) {
        const companyFolder = thinkSubFolders.next();
        const res = processSingleCompanyFolder(companyFolder, thinkermanCatalog, CONFIG.PROJECTS.THINKERMAN);
        totalProcessed += res.processed;
        totalErrors += res.errors;
      }
    } else {
      // Normál Visibill PROD cégmappa
      const res = processSingleCompanyFolder(folder, prodCatalog, CONFIG.PROJECTS.PROD);
      totalProcessed += res.processed;
      totalErrors += res.errors;
    }
  }

  Logger.log(`\n=== [Visibill & Thinkerman Sync] Kész! Összesen feldolgozva: ${totalProcessed} db, Hibás: ${totalErrors} db ===`);
}

/**
 * Egyetlen cégmappa feldolgozása (támogatja a nyers gyökérbe húzott és a Számlák almappás fájlokat is).
 */
function processSingleCompanyFolder(companyFolder, companyCatalog, projectConfig) {
  const folderName = companyFolder.getName();
  const matchedCompany = resolveCompanyFromFolderName(folderName, companyCatalog);
  if (!matchedCompany) {
    Logger.log(`⚠️ Kihagyva [${projectConfig.NAME}]: "${folderName}" mappához nem található megfelelő cég.`);
    return { processed: 0, errors: 0 };
  }

  Logger.log(`📁 Feldolgozás alatt [${projectConfig.NAME}]: "${folderName}" -> Cég: ${matchedCompany.name} (Adószám: ${matchedCompany.tax_number || 'N/A'})`);

  const folders = ensureCompanyFolders(companyFolder);
  const scanTargets = [
    { sourceFolder: folders.inbox, label: 'Számlák mappa' },
    { sourceFolder: companyFolder, label: 'Cégmappa gyökér' },
  ];

  let processed = 0;
  let errors = 0;

  for (const target of scanTargets) {
    const files = target.sourceFolder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();

      if (!isSupportedFile(fileName)) {
        continue;
      }

      Logger.log(`  🚀 Számla feltöltése (${target.label}) -> [${projectConfig.NAME}]: ${fileName} (${Math.round(file.getSize() / 1024)} KB)...`);
      const uploadSuccess = uploadInvoiceToVisibill(file, matchedCompany.id, projectConfig);

      if (uploadSuccess) {
        try {
          const targetFolder = getTargetProcessedFolder(folders.processed);
          moveFile(file, target.sourceFolder, targetFolder);
          Logger.log(`  ✅ Sikeres! Átmozgatva: ${fileName} -> ${targetFolder.getName()}/`);
        } catch (moveErr) {
          Logger.log(`  ⚠️ Számla sikeresen feltöltve, de a Drive átmozgatás nem sikerült (${moveErr.message}).`);
        }
        processed++;
      } else {
        try {
          moveFile(file, target.sourceFolder, folders.failed);
          Logger.log(`  ❌ Hiba történt! Átmozgatva a Hibás mappába: ${fileName}`);
        } catch (moveErr) {
          Logger.log(`  ⚠️ Feltöltési hiba és a Drive átmozgatás sem sikerült: ${moveErr.message}`);
        }
        errors++;
      }
    }
  }

  return { processed, errors };
}

// ─── VISIBILL / THINKERMAN API HÍVÁSOK ────────────────────────────────────────

/**
 * Lekérdezi az adott projekthez tartozó elérhető cégeket.
 */
function fetchAccessibleCompanies(projectConfig) {
  const url = `${projectConfig.API_BASE_URL}/v1/companies`;
  const options = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${projectConfig.API_KEY}`,
      'Accept': 'application/json',
    },
    muteHttpExceptions: true,
  };

  try {
    const res = UrlFetchApp.fetch(url, options);
    const statusCode = res.getResponseCode();
    const body = JSON.parse(res.getContentText());

    if (statusCode !== 200 || !body.success) {
      Logger.log(`Hiba a cégek lekérdezésekor [${projectConfig.NAME}] (HTTP ${statusCode}): ${JSON.stringify(body)}`);
      return [];
    }

    return body.data?.companies || [];
  } catch (err) {
    Logger.log(`Hálózati hiba a cégek lekérdezésekor [${projectConfig.NAME}]: ${err.message}`);
    return [];
  }
}

/**
 * Számla feltöltése a kijelölt projekt Customer REST API-jára.
 */
function uploadInvoiceToVisibill(file, companyId, projectConfig) {
  const url = `${projectConfig.API_BASE_URL}/v1/invoices/upload`;
  const fileName = file.getName();
  const fileBlob = file.getBlob();
  const base64Content = Utilities.base64Encode(fileBlob.getBytes());

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
      'Authorization': `Bearer ${projectConfig.API_KEY}`,
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

    if ((statusCode === 200 || statusCode === 201) && resJson.success) {
      return true;
    }

    Logger.log(`  ❌ API hiba [${projectConfig.NAME}] (HTTP ${statusCode}): ${resText}`);
    return false;
  } catch (err) {
    Logger.log(`  ❌ Hálózati hiba a feltöltés során [${projectConfig.NAME}]: ${err.message}`);
    return false;
  }
}

// ─── CÉGAZONOSÍTÁS ÉS MAPPAKEZELŐ SEGÉDFÜGGVÉNYEK ──────────────────────────────

/**
 * A mappa nevéből automatikusan feloldja a megfelelő céget.
 */
function resolveCompanyFromFolderName(folderName, companies) {
  const cleanName = folderName.trim().toLowerCase();

  // 1. Adószám 8 jegyű törzsszám alapján
  const taxDigits = folderName.replace(/[^0-9]/g, '');
  if (taxDigits.length >= 8) {
    const prefix8 = taxDigits.slice(0, 8);
    const matchByTax = companies.find(c => {
      if (!c.tax_number) return false;
      const cTaxDigits = c.tax_number.replace(/[^0-9]/g, '');
      return cTaxDigits.startsWith(prefix8);
    });
    if (matchByTax) return matchByTax;
  }

  // 2. Pontos cégnév egyezés
  const exactNameMatch = companies.find(c => c.name && c.name.trim().toLowerCase() === cleanName);
  if (exactNameMatch) return exactNameMatch;

  // 3. Cégnév részleges tartalmazás
  const partialNameMatch = companies.find(c => {
    if (!c.name) return false;
    const cName = c.name.trim().toLowerCase();
    return cleanName.includes(cName) || cName.includes(cleanName);
  });
  if (partialNameMatch) return partialNameMatch;

  // 4. UUID egyezés
  const uuidMatch = companies.find(c => c.id && cleanName.includes(c.id.toLowerCase()));
  if (uuidMatch) return uuidMatch;

  return null;
}

/**
 * Biztosítja a cégmappán belüli almappák létezését.
 */
function ensureCompanyFolders(companyFolder) {
  let inbox = findSubFolder(companyFolder, [CONFIG.INBOX_FOLDER_NAME, 'szamlak', 'Bejövő', 'Inbox', 'inbox']);
  if (!inbox) {
    inbox = companyFolder.createFolder(CONFIG.INBOX_FOLDER_NAME);
  }

  let processed = findSubFolder(companyFolder, [CONFIG.PROCESSED_FOLDER_NAME, 'Processed', 'feldolgozva', 'processed']);
  if (!processed) {
    processed = companyFolder.createFolder(CONFIG.PROCESSED_FOLDER_NAME);
  }

  let failed = findSubFolder(companyFolder, [CONFIG.FAILED_FOLDER_NAME, 'Failed', 'hibas', 'hibás']);
  if (!failed) {
    failed = companyFolder.createFolder(CONFIG.FAILED_FOLDER_NAME);
  }

  return { inbox, processed, failed };
}

function findSubFolder(parentFolder, candidateNames) {
  const normalizedCandidates = candidateNames.map(n => n.toLowerCase().trim());
  const subFolders = parentFolder.getFolders();
  while (subFolders.hasNext()) {
    const sub = subFolders.next();
    if (normalizedCandidates.includes(sub.getName().toLowerCase().trim())) {
      return sub;
    }
  }
  return null;
}

function getTargetProcessedFolder(processedRoot) {
  if (!CONFIG.ORGANIZE_BY_MONTH) {
    return processedRoot;
  }

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const existing = findSubFolder(processedRoot, [yearMonth]);
  if (existing) {
    return existing;
  }

  return processedRoot.createFolder(yearMonth);
}

function moveFile(file, sourceFolder, targetFolder) {
  // 1. Modern Google Drive Apps Script: közvetlen moveTo (ajánlott és leggyorsabb)
  try {
    if (typeof file.moveTo === 'function') {
      file.moveTo(targetFolder);
      return;
    }
  } catch (err) {
    Logger.log(`  ⚠️ moveTo sikertelen (${err.message}), másolásos áthelyezés...`);
  }

  // 2. Másolat készítése a célmappában
  try {
    file.makeCopy(file.getName(), targetFolder);
    // Eredeti eltávolítása: ha a felhasználó a fájl tulajdonosa, kukába teszi
    try {
      file.setTrashed(true);
      return;
    } catch (_) {
      // Ha nem a tulajdonos (pl. kliens fiók töltötte fel a megosztott mappába),
      // megpróbáljuk eltávolítani a forrásmappából
      try {
        sourceFolder.removeFile(file);
        return;
      } catch (__) {
        Logger.log(`  ℹ️ Fájl átmásolva a célmappába (eredeti megmaradt a forrásban a Drive jogosultsági korlátok miatt).`);
        return;
      }
    }
  } catch (copyErr) {
    throw new Error(`Nem sikerült a fájlt átmozgatni vagy másolni: ${copyErr.message}`);
  }
}

function isSupportedFile(fileName) {
  if (!fileName || fileName.startsWith('.')) return false;
  const lower = fileName.toLowerCase();
  return CONFIG.ALLOWED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

// ─── KAPCSOLATTESZT ÉS IDŐZÍTŐ TELEPÍTŐ ────────────────────────────────────────

/**
 * Kapcsolatteszt: ellenőrzi mind a Visibill PROD, mind a Thinkerman API-t és a Drive mappát.
 */
function testVisibillConnection() {
  Logger.log('=== [Visibill & Thinkerman Kapcsolatteszt] ===');

  // 1. Visibill PROD teszt
  Logger.log(`\n1. Kapcsolódás: ${CONFIG.PROJECTS.PROD.NAME}...`);
  const prodCompanies = fetchAccessibleCompanies(CONFIG.PROJECTS.PROD);
  if (prodCompanies.length > 0) {
    Logger.log(`  ✅ [PROD] Kapcsolat sikeres! ${prodCompanies.length} cég elérhető a Visibillben.`);
  } else {
    Logger.log(`  ❌ [PROD] Nem sikerült lekérni a cégeket.`);
  }

  // 2. Thinkerman teszt
  if (CONFIG.PROJECTS.THINKERMAN && CONFIG.PROJECTS.THINKERMAN.API_KEY) {
    Logger.log(`\n2. Kapcsolódás: ${CONFIG.PROJECTS.THINKERMAN.NAME}...`);
    const thinkCompanies = fetchAccessibleCompanies(CONFIG.PROJECTS.THINKERMAN);
    if (thinkCompanies.length > 0) {
      const names = thinkCompanies.map(c => `${c.name} (${c.tax_number || 'N/A'})`).join(', ');
      Logger.log(`  ✅ [THINKERMAN] Kapcsolat sikeres! ${thinkCompanies.length} cég elérhető: ${names}`);
    } else {
      Logger.log(`  ❌ [THINKERMAN] Nem sikerült lekérni a Thinkerman cégeket.`);
    }
  }

  // 3. Google Drive Gyökérmappa teszt
  Logger.log('\n3. Google Drive gyökérmappa ellenőrzése...');
  try {
    const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
    Logger.log(`  ✅ Google Drive Gyökérmappa elérve: "${root.getName()}" (ID: ${root.getId()})`);

    let hasThinkerman = false;
    const subs = root.getFolders();
    while (subs.hasNext()) {
      if (subs.next().getName().toLowerCase() === 'thinkerman') {
        hasThinkerman = true;
        break;
      }
    }
    if (hasThinkerman) {
      Logger.log(`  📁 "Thinkerman" gyűjtőmappa észlelve a gyökérben!`);
    } else {
      Logger.log(`  ℹ️ "Thinkerman" gyűjtőmappa még nincs a Drive-on (csak hozz létre egy "Thinkerman" nevű mappát a Visibill gyökérben).`);
    }
  } catch (e) {
    Logger.log(`  ❌ Hiba a Drive mappa megnyitásakor: ${e.message}`);
  }

  Logger.log('\n=== [Kapcsolatteszt befejezve] ===');
}

/**
 * Automatikus időzítő létrehozása (5 percenként fut a háttérben).
 */
function installAutoTrigger() {
  uninstallAutoTrigger();

  ScriptApp.newTrigger('syncGoogleDriveToVisibill')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('✅ Automatikus időzítő sikeresen beállítva! A script 5 percenként lefut.');
}

/**
 * Meglévő időzítők törlése.
 */
function uninstallAutoTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let count = 0;
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'syncGoogleDriveToVisibill') {
      ScriptApp.deleteTrigger(trigger);
      count++;
    }
  }
  Logger.log(`ℹ️ ${count} db meglévő időzítő törölve.`);
}
