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

// 1. ClientTaoMainPage.tsx restructure header
replaceInFile(
  'src/pages/Accounty/Tao/ClientTaoMainPage.tsx',
  `      {/* Header */}
      <div className="flex items-center gap-3">
        <Link 
          to={\`/accounty/\${companyId}/\${dateRange}/overview\`}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm shrink-0"
          title="Vissza az áttekintéshez"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </Link>
        <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25">
          <Landmark className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {clientLoading ? (
              <span className="h-7 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse inline-block" />
            ) : (
              client?.name || 'Ügyfél'
            )} — TAO
            </h1>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Belföldi Kft. (GFO 113)
            </span>
            {taxProfile?.isKiva ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                KIVA-alany
              </span>
            ) : taxProfile?.isKata ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                KATA-alany
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {taxProfile?.taxGroup === 'SZJA' ? 'SZJA-alany' :
                 taxProfile?.taxGroup === 'Külföldi' ? 'Külföldi vállalkozó' :
                 taxProfile?.taxGroup === 'Nonprofit' ? 'Nonprofit TAO' : 'Általános 6.§'}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{taxYear}. adóév</p>
        </div>
      </div>`,
  `      {/* Header */}
      <div className="flex items-start gap-4">
        <Link 
          to={\`/accounty/\${companyId}/\${dateRange}/overview\`}
          className="flex items-center justify-center w-8 h-8 mt-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm shrink-0"
          title="Vissza az áttekintéshez"
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Társasági adó (TAO)
            </h1>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Belföldi Kft. (GFO 113)
            </span>
            {taxProfile?.isKiva ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                KIVA-alany
              </span>
            ) : taxProfile?.isKata ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                KATA-alany
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {taxProfile?.taxGroup === 'SZJA' ? 'SZJA-alany' :
                 taxProfile?.taxGroup === 'Külföldi' ? 'Külföldi vállalkozó' :
                 taxProfile?.taxGroup === 'Nonprofit' ? 'Nonprofit TAO' : 'Általános 6.§'}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">{taxYear}. adóév</p>
        </div>
      </div>`
);

// 2. RepresentationPage.tsx restructure header
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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">NAV meghatalmazás</h1>
            <p className="text-sm text-slate-500">Irodai és egyéni képviselet, EGYKE/T180 státuszok</p>
          </div>
        </div>`,
  `      {/* Header */}
      <div className="flex items-start justify-between">
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
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">NAV meghatalmazás</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Irodai és egyéni képviselet, EGYKE/T180 státuszok</p>
          </div>
        </div>`
);

// 3. DataRetentionPage.tsx restructure header
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">GDPR & Iratkezelési beállítások</h1>
          <p className="text-sm text-slate-500">Adatmegőrzési szabályok, szerződések és adattörlési kérelmek</p>
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">GDPR & Iratkezelési beállítások</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-normal">Adatmegőrzési szabályok, szerződések és adattörlési kérelmek</p>
        </div>
      </div>`
);
