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

// 1. App.tsx legacy redirects fixes
replaceInFile(
  'src/App.tsx',
  `function AccountyLegacyClientRedirect() {
  const { id } = useParams<{ id: string }>();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const location = useLocation();
  const suffix = location.pathname.split(\`/client/\${id}\`)[1] || '';
  const page = suffix.startsWith('/') ? suffix.slice(1) : suffix;
  return <Navigate to={\`/accounty/\${id}/\${dateFromFormatted}_\${dateToFormatted}/\${page}\`} replace />;
}`,
  `function AccountyLegacyClientRedirect() {
  const params = useParams();
  const location = useLocation();
  const match = location.pathname.match(/\\/client\\/([^\\/]+)/);
  const resolvedId = match ? match[1] : (params.id || '');
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const suffix = location.pathname.split(new RegExp(\`/client/\${resolvedId}\`, 'i'))[1] || '';
  const page = suffix.startsWith('/') ? suffix.slice(1) : suffix;
  return <Navigate to={\`/accounty/\${resolvedId}/\${dateFromFormatted}_\${dateToFormatted}/\${page}\${location.search}\`} replace />;
}`
);

replaceInFile(
  'src/App.tsx',
  `function PayrollLegacyRedirect() {
  const { id } = useParams<{ id: string }>();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const location = useLocation();
  const suffix = location.pathname.split(\`/payroll/\${id}\`)[1] || '';
  const page = suffix.startsWith('/') ? suffix.slice(1) : suffix;
  return <Navigate to={\`/accounty/\${id}/\${dateFromFormatted}_\${dateToFormatted}/payroll/\${page}\`} replace />;
}`,
  `function PayrollLegacyRedirect() {
  const params = useParams();
  const location = useLocation();
  const match = location.pathname.match(/\\/payroll\\/([^\\/]+)/);
  const resolvedId = match ? match[1] : (params.id || '');
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const suffix = location.pathname.split(new RegExp(\`/payroll/\${resolvedId}\`, 'i'))[1] || '';
  const page = suffix.startsWith('/') ? suffix.slice(1) : suffix;
  return <Navigate to={\`/accounty/\${resolvedId}/\${dateFromFormatted}_\${dateToFormatted}/payroll/\${page}\${location.search}\`} replace />;
}`
);

replaceInFile(
  'src/App.tsx',
  `function MissingInvoicesLegacyRedirect() {
  const { id } = useParams<{ id: string }>();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  return <Navigate to={\`/accounty/\${id}/\${dateFromFormatted}_\${dateToFormatted}/missing-invoices\`} replace />;
}`,
  `function MissingInvoicesLegacyRedirect() {
  const params = useParams();
  const location = useLocation();
  const match = location.pathname.match(/\\/missing-invoices\\/([^\\/]+)/);
  const resolvedId = match ? match[1] : (params.id || '');
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  return <Navigate to={\`/accounty/\${resolvedId}/\${dateFromFormatted}_\${dateToFormatted}/missing-invoices\${location.search}\`} replace />;
}`
);

// 2. ClientEvMainPage.tsx links updates
let evContent = fs.readFileSync('src/pages/Accounty/Ev/ClientEvMainPage.tsx', 'utf8');
evContent = evContent.replace(/\/accounty\/client\/\${id}\/ev/g, '/accounty/${companyId}/${dateRange}/ev');
fs.writeFileSync('src/pages/Accounty/Ev/ClientEvMainPage.tsx', evContent, 'utf8');
console.log('Successfully updated EV links in ClientEvMainPage.tsx');
