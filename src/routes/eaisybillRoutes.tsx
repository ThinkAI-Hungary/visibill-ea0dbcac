import React, { lazy } from "react";
import { Route } from "react-router-dom";
import { ProtectedPage } from "./shellComponents";
import { LegacyRedirect, RootRedirect } from "./redirects";

// Lazy-loaded pages
const Index = lazy(() => import("@/pages/Index"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const InvoicesPage = lazy(() => import("@/pages/InvoicesPage"));
const ManualUpload = lazy(() => import("@/pages/ManualUpload"));
const Integrations = lazy(() => import("@/pages/Integrations"));
const Settings = lazy(() => import("@/pages/Settings"));
const Projects = lazy(() => import("@/pages/Projects"));
const PartnersPage = lazy(() => import("@/pages/PartnersPage"));
const TransactionsPage = lazy(() => import("@/pages/TransactionsPage"));
const GeneralLedgerPage = lazy(() => import("@/pages/GeneralLedgerPage"));
const ProfitAndLoss = lazy(() => import("@/pages/ProfitAndLoss"));
const BalanceSheet = lazy(() => import("@/pages/BalanceSheet"));
const AnnualReportPage = lazy(() => import("@/pages/AnnualReportPage"));
const VatReturnPage = lazy(() => import("@/pages/VatReturnPage"));
const JournalsPage = lazy(() => import("@/pages/JournalsPage"));
const KintlevoPage = lazy(() => import("@/pages/KintlevoPage"));
const PettyCashPage = lazy(() => import("@/pages/PettyCashPage"));
const FixedAssetsPage = lazy(() => import("@/pages/FixedAssetsPage"));
const NotesPage = lazy(() => import("@/pages/NotesPage"));
const ExchangeRates = lazy(() => import("@/pages/ExchangeRates"));
const SalariesPage = lazy(() => import("@/pages/SalariesPage"));
const WorkingTimePage = lazy(() => import("@/pages/WorkingTimePage"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const TicketsPage = lazy(() => import("@/pages/TicketsPage"));
const TransfersPage = lazy(() => import("@/pages/TransfersPage"));

/**
 * Returns the scoped child route elements for eaisybill
 * (to be placed inside `/:companyId/:dateRange` ScopedLayout).
 */
export function renderEaisybillScopedRoutes() {
  return (
    <>
      <Route index element={<ProtectedPage><Index /></ProtectedPage>} />
      <Route path="categories" element={<ProtectedPage><Onboarding /></ProtectedPage>} />
      <Route path="invoices/:tab?" element={<ProtectedPage><InvoicesPage /></ProtectedPage>} />
      <Route path="transfers" element={<ProtectedPage><TransfersPage /></ProtectedPage>} />
      <Route path="upload/:tab?" element={<ProtectedPage><ManualUpload /></ProtectedPage>} />
      <Route path="tickets/:ticketId?" element={<ProtectedPage><TicketsPage /></ProtectedPage>} />
      <Route path="integrations" element={<ProtectedPage><Integrations /></ProtectedPage>} />
      <Route path="settings/:tab?" element={<ProtectedPage><Settings /></ProtectedPage>} />
      <Route path="projects" element={<ProtectedPage><Projects /></ProtectedPage>} />
      <Route path="partners" element={<ProtectedPage><PartnersPage /></ProtectedPage>} />
      <Route path="transactions/:tab?" element={<ProtectedPage><TransactionsPage /></ProtectedPage>} />
      <Route path="general-ledger/:tab?" element={<ProtectedPage><GeneralLedgerPage /></ProtectedPage>} />
      <Route path="profit-and-loss/:tab?" element={<ProtectedPage><ProfitAndLoss /></ProtectedPage>} />
      <Route path="balance-sheet/:tab?" element={<ProtectedPage><BalanceSheet /></ProtectedPage>} />
      <Route path="annual-report" element={<ProtectedPage><AnnualReportPage /></ProtectedPage>} />
      <Route path="annual-reports" element={<ProtectedPage><AnnualReportPage /></ProtectedPage>} />
      <Route path="vat-return/:tab?" element={<ProtectedPage><VatReturnPage /></ProtectedPage>} />
      <Route path="vat-returns/:tab?" element={<ProtectedPage><VatReturnPage /></ProtectedPage>} />
      <Route path="journals" element={<ProtectedPage><JournalsPage /></ProtectedPage>} />
      <Route path="kintlevo/:tab?" element={<ProtectedPage><KintlevoPage /></ProtectedPage>} />
      <Route path="petty-cash/:tab?" element={<ProtectedPage><PettyCashPage /></ProtectedPage>} />
      <Route path="teny/:tab?" element={<ProtectedPage><FixedAssetsPage /></ProtectedPage>} />
      <Route path="fixed-assets/:tab?" element={<ProtectedPage><FixedAssetsPage /></ProtectedPage>} />
      <Route path="notes" element={<ProtectedPage><NotesPage /></ProtectedPage>} />

      <Route path="exchange-rates" element={<ProtectedPage><ExchangeRates /></ProtectedPage>} />
      <Route path="salaries/:tab?" element={<ProtectedPage><SalariesPage /></ProtectedPage>} />
      <Route path="working-time/:tab?" element={<ProtectedPage><WorkingTimePage /></ProtectedPage>} />
      <Route path="analytics/:tab?" element={<ProtectedPage><Analytics /></ProtectedPage>} />
    </>
  );
}

/**
 * Returns the fallback and legacy redirect routes for eaisybill
 * (to be placed inside ProtectedLayout).
 */
export function renderEaisybillLegacyAndFallbackRoutes() {
  return (
    <>
      {/* Categories — unscoped fallback (ProtectedRoute redirect for new users) */}
      <Route
        path="/categories"
        element={<ProtectedPage><Onboarding /></ProtectedPage>}
      />

      {/* Standalone tickets route — context-free, directly linkable */}
      <Route
        path="/tickets/:ticketId?"
        element={<ProtectedPage><TicketsPage /></ProtectedPage>}
      />

      {/* ═══ Legacy Redirects — old flat paths → scoped ═══ */}
      <Route path="/invoices" element={<LegacyRedirect page="invoices" />} />
      <Route path="/transfers" element={<LegacyRedirect page="transfers" />} />
      <Route path="/upload" element={<LegacyRedirect page="upload" />} />
      <Route path="/notes" element={<LegacyRedirect page="notes" />} />
      <Route path="/integrations" element={<LegacyRedirect page="integrations" />} />
      <Route path="/settings" element={<LegacyRedirect page="settings" />} />
      <Route path="/projects" element={<LegacyRedirect page="projects" />} />
      <Route path="/partners" element={<LegacyRedirect page="partners" />} />
      <Route path="/transactions" element={<LegacyRedirect page="transactions" />} />
      <Route path="/general-ledger" element={<LegacyRedirect page="general-ledger" />} />
      <Route path="/profit-and-loss" element={<LegacyRedirect page="profit-and-loss" />} />
      <Route path="/balance-sheet" element={<LegacyRedirect page="balance-sheet" />} />
      <Route path="/annual-report" element={<LegacyRedirect page="annual-report" />} />
      <Route path="/annual-reports" element={<LegacyRedirect page="annual-report" />} />
      <Route path="/vat-return" element={<LegacyRedirect page="vat-return" />} />
      <Route path="/vat-returns" element={<LegacyRedirect page="vat-return" />} />
      <Route path="/journals" element={<LegacyRedirect page="journals" />} />
      <Route path="/kintlevo" element={<LegacyRedirect page="kintlevo" />} />
      <Route path="/petty-cash" element={<LegacyRedirect page="petty-cash" />} />
      <Route path="/teny" element={<LegacyRedirect page="teny" />} />
      <Route path="/fixed-assets" element={<LegacyRedirect page="teny" />} />

      <Route path="/exchange-rates" element={<LegacyRedirect page="exchange-rates" />} />
      <Route path="/salaries" element={<LegacyRedirect page="salaries" />} />
      <Route path="/working-time" element={<LegacyRedirect page="working-time" />} />
      <Route path="/analytics" element={<LegacyRedirect page="analytics" />} />
      <Route path="/tickets" element={<LegacyRedirect page="tickets" />} />
      <Route path="/onboarding" element={<LegacyRedirect page="categories" />} />

      {/* Root → scoped dashboard */}
      <Route path="/" element={<RootRedirect />} />
    </>
  );
}
