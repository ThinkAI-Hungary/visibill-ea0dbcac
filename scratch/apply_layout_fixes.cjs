const fs = require('fs');

const appPath = 'src/App.tsx';
let content = fs.readFileSync(appPath, 'utf8');

const targetStr = '{/* Client scoped routes */}';
const replacement = `/* Legacy redirects & fallbacks */
                       <Route path="client/:id/ev" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/ev/*" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/tao" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/tao/*" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/payroll" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/payroll/*" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/invoices" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/invoices/*" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/missing-invoices" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/missing-invoices/*" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/reports" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/reports/*" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/settings" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/settings/*" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/overview" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/overview/*" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/profile" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/profile/*" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/accounting" element={<AccountyLegacyClientRedirect />} />
                       <Route path="client/:id/accounting/*" element={<AccountyLegacyClientRedirect />} />

                       {/* Client scoped routes *\/}`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacement);
  fs.writeFileSync(appPath, content, 'utf8');
  console.log('Successfully injected explicit redirect routes into App.tsx');
} else {
  console.error('ERROR: Target string not found in App.tsx');
}
