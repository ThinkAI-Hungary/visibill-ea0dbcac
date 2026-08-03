const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/Accounty/AdminTaxParametersPage.tsx',
  'src/pages/Accounty/ClientMissingInvoicesReportPage.tsx',
  'src/pages/Accounty/ClientPortalPage.tsx',
  'src/pages/Accounty/CompanyStructurePage.tsx',
  'src/pages/Accounty/DataRetentionPage.tsx',
  'src/pages/Accounty/employee-details/EmployeeCafeteriaTab.tsx',
  'src/pages/Accounty/employee-details/EmployeeGarnishmentsTab.tsx',
  'src/pages/Accounty/employee-details/EmployeeLeaveTab.tsx',
  'src/pages/Accounty/employee-details/SalaryHistoryTab.tsx',
  'src/pages/Accounty/EmployeeImportPage.tsx',
  'src/pages/Accounty/EmployeeWizardPage.tsx',
  'src/pages/Accounty/Ev/CashbookLedgerView.tsx',
  'src/pages/Accounty/Ev/EvDepreciationPage.tsx',
  'src/pages/Accounty/Ev/EvFormsOverviewPage.tsx',
  'src/pages/Accounty/Ev/EvIncomeReportPage.tsx',
  'src/pages/Accounty/Ev/EvVatPage.tsx',
  'src/pages/Accounty/Ev/OrgCivilPage.tsx',
  'src/pages/Accounty/Ev/OrgCondominiumPage.tsx',
  'src/pages/Accounty/Ev/OrgSimplifiedReportPage.tsx',
  'src/pages/Accounty/filings/Filing2608Page.tsx',
  'src/pages/Accounty/filings/FilingWorkflowPage.tsx',
  'src/pages/Accounty/missing-invoices/HistoryView.tsx',
  'src/pages/Accounty/PayrollDashboardPage.tsx',
  'src/pages/Accounty/PayrollReportsPage.tsx',
  'src/pages/Accounty/PermissionMatrixPage.tsx',
  'src/pages/Accounty/reports/CustomReportBuilderPage.tsx',
  'src/pages/Accounty/ReportsPage.tsx',
  'src/pages/Accounty/Tao/TaoTaxpayerTypesPage.tsx',
  'src/pages/Accounty/Tao/wizard-steps/TaoResultSteps.tsx'
];

files.forEach(f => {
  const filePath = path.resolve(__dirname, '..', f);
  if (!fs.existsSync(filePath)) {
    console.log(`File does not exist: ${f}`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`\n=== FILE: ${f} ===`);
  
  // Find lines containing <Table, <table, .map(, or table rendering
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('<Table') || line.includes('<table') || line.includes('.map(') || line.includes('components/ui/table')) {
      if (line.includes('import') && !line.includes('ui/table')) return;
      console.log(`  Line ${idx + 1}: ${line.trim()}`);
    }
  });
});
