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

// 1. Update NavDeadlinesPage.tsx to support hideHeader prop
replaceInFile(
  'src/pages/Accounty/NavDeadlinesPage.tsx',
  `export default function NavDeadlinesPage() {`,
  `export default function NavDeadlinesPage({ hideHeader }: { hideHeader?: boolean }) {`
);

replaceInFile(
  'src/pages/Accounty/NavDeadlinesPage.tsx',
  `  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg shadow-red-500/25">
          <Clock className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">NAV határidők</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Bejelentési, bevallási és befizetési naptár</p>
        </div>
        <div className="ml-auto">
          <ExportButton
            filename={\`nav_hataridok_\${new Date().getFullYear()}\`}
            headers={['Dátum', 'Határidő', 'Típus', 'Leírás', 'Státusz']}
            getRows={() => filtered.map(d => [d.date, d.title, TYPE_CONFIG[d.type]?.label || '', d.description, d.status === 'completed' ? 'Teljesítve' : d.status === 'due_today' ? 'Ma esedékes' : d.status === 'overdue' ? 'Lejárt' : 'Közelgő'])}
            size="sm"
          />
        </div>
      </div>`,
  `  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg shadow-red-500/25">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">NAV határidők</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Bejelentési, bevallási és befizetési naptár</p>
          </div>
          <div className="ml-auto">
            <ExportButton
              filename={\`nav_hataridok_\${new Date().getFullYear()}\`}
              headers={['Dátum', 'Határidő', 'Típus', 'Leírás', 'Státusz']}
              getRows={() => filtered.map(d => [d.date, d.title, TYPE_CONFIG[d.type]?.label || '', d.description, d.status === 'completed' ? 'Teljesítve' : d.status === 'due_today' ? 'Ma esedékes' : d.status === 'overdue' ? 'Lejárt' : 'Közelgő'])}
              size="sm"
            />
          </div>
        </div>
      )}
      {hideHeader && (
        <div className="flex justify-end -mb-2">
          <ExportButton
            filename={\`nav_hataridok_\${new Date().getFullYear()}\`}
            headers={['Dátum', 'Határidő', 'Típus', 'Leírás', 'Státusz']}
            getRows={() => filtered.map(d => [d.date, d.title, TYPE_CONFIG[d.type]?.label || '', d.description, d.status === 'completed' ? 'Teljesítve' : d.status === 'due_today' ? 'Ma esedékes' : d.status === 'overdue' ? 'Lejárt' : 'Közelgő'])}
            size="sm"
          />
        </div>
      )}`
);

// 2. Update TaxCalendarPage.tsx to include NavDeadlinesPage as a tab
replaceInFile(
  'src/pages/Accounty/TaxCalendarPage.tsx',
  `import { useAccountyRole } from './AccountyRoleContext';`,
  `import { useAccountyRole } from './AccountyRoleContext';
import NavDeadlinesPage from './NavDeadlinesPage';`
);

replaceInFile(
  'src/pages/Accounty/TaxCalendarPage.tsx',
  `export default function TaxCalendarPage() {
  const { isAdmin } = useAccountyRole();`,
  `export default function TaxCalendarPage() {
  const { isAdmin, isSenior } = useAccountyRole();
  const isAuthorizedForNavDeadlines = isAdmin || isSenior;
  const [activeTab, setActiveTab] = useState<'calendar' | 'deadlines'>('calendar');`
);

replaceInFile(
  'src/pages/Accounty/TaxCalendarPage.tsx',
  `  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Header section */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Adó naptár</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Ügyfelek adózási és bérszámfejtési határidői</p>
        </div>
      </div>`,
  `  if (activeTab === 'deadlines') {
    return (
      <div className="w-full space-y-8 animate-in fade-in duration-500 pb-20">
        {/* Header section with tabs */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Naptár & Határidők</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Könyvelési naptár és hivatalos NAV határidők</p>
          </div>
          
          {/* Tab Selector */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab('calendar')}
              className={cn(
                "px-4 py-2 text-sm font-semibold border-b-2 transition-all -mb-[2px]",
                activeTab === 'calendar'
                  ? "border-primary text-slate-900 dark:text-slate-100 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              Adónaptár
            </button>
            {isAuthorizedForNavDeadlines && (
              <button
                onClick={() => setActiveTab('deadlines')}
                className={cn(
                  "px-4 py-2 text-sm font-semibold border-b-2 transition-all -mb-[2px]",
                  activeTab === 'deadlines'
                    ? "border-primary text-slate-900 dark:text-slate-100 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                )}
              >
                Hivatalos NAV határidők
              </button>
            )}
          </div>
        </div>

        <NavDeadlinesPage hideHeader={true} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* Header section with tabs */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Naptár & Határidők</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Könyvelési naptár és hivatalos NAV határidők</p>
        </div>
        
        {/* Tab Selector */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('calendar')}
            className={cn(
              "px-4 py-2 text-sm font-semibold border-b-2 transition-all -mb-[2px]",
              activeTab === 'calendar'
                ? "border-primary text-slate-900 dark:text-slate-100 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            Adónaptár
          </button>
          {isAuthorizedForNavDeadlines && (
            <button
              onClick={() => setActiveTab('deadlines')}
              className={cn(
                "px-4 py-2 text-sm font-semibold border-b-2 transition-all -mb-[2px]",
                activeTab === 'deadlines'
                  ? "border-primary text-slate-900 dark:text-slate-100 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              )}
            >
              Hivatalos NAV határidők
            </button>
          )}
        </div>
      </div>`
);
