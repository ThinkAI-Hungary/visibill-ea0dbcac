const fs = require('fs');

function replaceInFile(filePath, target, replacement) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/\r\n/g, '\n');
  target = target.replace(/\r\n/g, '\n');
  replacement = replacement.replace(/\r\n/g, '\n');

  if (!content.includes(target)) {
    console.error(`ERROR: Target not found in ${filePath}`);
    return false;
  }
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully updated: ${filePath}`);
  return true;
}

// 1. RepresentationPage.tsx restructure header
replaceInFile(
  'src/pages/Accounty/RepresentationPage.tsx',
  `      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link 
            to={\`/accounty/\${companyId}/\${dateRange}/settings\`}
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm shrink-0"
            title="Vissza a beállításokhoz"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">NAV-meghatalmazás kezelés</h1>
            <p className="text-sm text-slate-500">UJEGYKE — Állandó meghatalmazások nyilvántartása</p>
          </div>
        </div>`,
  `      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link 
            to={\`/accounty/\${companyId}/\${dateRange}/settings\`}
            className="flex items-center justify-center w-8 h-8 mt-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm shrink-0"
            title="Vissza a beállításokhoz"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {clientLoading ? (
                <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              ) : (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{client?.name || 'Ügyfél'}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">NAV-meghatalmazás kezelés</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">UJEGYKE — Állandó meghatalmazások nyilvántartása</p>
          </div>
        </div>`
);

// 2. DataRetentionPage.tsx restructure header
replaceInFile(
  'src/pages/Accounty/DataRetentionPage.tsx',
  `      {/* Header */}
      <div className="flex items-center gap-3">
        <Link 
          to={\`/accounty/\${companyId}/\${dateRange}/settings\`}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm shrink-0"
          title="Vissza a beállításokhoz"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg shadow-red-500/25">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Iratkezelés és GDPR</h1>
          <p className="text-sm text-slate-500">Megőrzési szabályzat, adatfeldolgozói szerződések, érintetti kérelmek</p>
        </div>
      </div>`,
  `      {/* Header */}
      <div className="flex items-start gap-4">
        <Link 
          to={\`/accounty/\${companyId}/\${dateRange}/settings\`}
          className="flex items-center justify-center w-8 h-8 mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm shrink-0"
          title="Vissza a beállításokhoz"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </Link>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            {clientLoading ? (
              <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            ) : (
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{client?.name || 'Ügyfél'}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Iratkezelés és GDPR</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-normal">Megőrzési szabályzat, adatfeldolgozói szerződések, érintetti kérelmek</p>
        </div>
      </div>`
);
