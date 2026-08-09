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

// 1. Collapsed mode cleanups
replaceInFile(
  'src/components/accounty/layout/AccountySidebar.tsx',
  `              {[
                { path: '/accounty', name: 'Portfólió', icon: Briefcase },
                { path: '/accounty/missing-invoices', name: 'Hiányzó számlák', icon: FileWarning, badge: kpis?.missingItems },
                { path: '/accounty/tax-calendar', name: 'Adó naptár', icon: Calendar },
                { path: '/accounty?tab=payroll', name: 'Bérszámfejtés', icon: Calculator },
                { path: '/accounty?tab=tao', name: 'TAO / KIVA', icon: Landmark },
                { path: '/accounty?tab=ev', name: 'EV / Szervezetek', icon: Coins },
                { path: '/accounty/reports', name: 'Riportok', icon: BarChart2 },
                { path: '/accounty/approval-queue', name: 'Jóváhagyó rendszer', icon: MailCheck },
                { path: '/accounty/alerts', name: 'Riasztások', icon: AlertTriangle },
                { path: '/accounty/nav-deadlines', name: 'NAV határidők', icon: Clock },
                { path: '/accounty/onboarding', name: 'Onboarding', icon: Rocket },
                { type: 'divider' as const },`,
  `              {[
                { path: '/accounty', name: 'Portfólió', icon: Briefcase },
                { path: '/accounty/missing-invoices', name: 'Hiányzó számlák', icon: FileWarning, badge: kpis?.missingItems },
                { path: '/accounty/tax-calendar', name: 'Naptár & Határidők', icon: Calendar },
                { path: '/accounty/reports', name: 'Riportok', icon: BarChart2 },
                { path: '/accounty/approval-queue', name: 'Jóváhagyó rendszer', icon: MailCheck },
                { path: '/accounty/alerts', name: 'Riasztások', icon: AlertTriangle },
                { path: '/accounty/onboarding', name: 'Onboarding', icon: Rocket },
                { type: 'divider' as const },`
);

// 2. Expanded mode cleanups
replaceInFile(
  'src/components/accounty/layout/AccountySidebar.tsx',
  `              const allPortfolioItems = [
                { to: '/accounty', icon: Briefcase, label: 'Portfólió', exact: true },
                { to: '/accounty/missing-invoices', icon: FileWarning, label: 'Hiányzó számlák', badge: kpis?.missingItems },
                { to: '/accounty/tax-calendar', icon: Calendar, label: 'Adó naptár' },
                { to: '/accounty?tab=payroll', icon: Calculator, label: 'Bérszámfejtés' },
                { to: '/accounty?tab=tao', icon: Landmark, label: 'TAO / KIVA' },
                { to: '/accounty?tab=ev', icon: Coins, label: 'EV / Szervezetek' },
                { to: '/accounty/reports', icon: BarChart2, label: 'Riportok' },
                { to: '/accounty/approval-queue', icon: MailCheck, label: 'Jóváhagyó rendszer' },
                { to: '/accounty/alerts', icon: AlertTriangle, label: 'Riasztások' },
                { to: '/accounty/nav-deadlines', icon: Clock, label: 'NAV határidők' },
                { to: '/accounty/onboarding', icon: Rocket, label: 'Onboarding' },
              ];`,
  `              const allPortfolioItems = [
                { to: '/accounty', icon: Briefcase, label: 'Portfólió', exact: true },
                { to: '/accounty/missing-invoices', icon: FileWarning, label: 'Hiányzó számlák', badge: kpis?.missingItems },
                { to: '/accounty/tax-calendar', icon: Calendar, label: 'Naptár & Határidők' },
                { to: '/accounty/reports', icon: BarChart2, label: 'Riportok' },
                { to: '/accounty/approval-queue', icon: MailCheck, label: 'Jóváhagyó rendszer' },
                { to: '/accounty/alerts', icon: AlertTriangle, label: 'Riasztások' },
                { to: '/accounty/onboarding', icon: Rocket, label: 'Onboarding' },
              ];`
);
