import { Suspense, lazy } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CompanyProvider } from "./contexts/CompanyContext";
import { DateRangeProvider } from "./contexts/DateRangeContext";
import { ProtectedLayout } from "./components/ProtectedLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthGuard from "./components/AuthGuard";
import { LoadingSpinner } from "./components/ui/loading-spinner";
import { IdleWarningModal } from "./components/IdleWarningModal";
import { Toaster as SonnerToaster } from "./components/ui/sonner";
import { LiveNotificationProvider } from "./components/LiveNotificationProvider";

// Route-level code splitting – each page loads as a separate chunk
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const ManualUpload = lazy(() => import("./pages/ManualUpload"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Settings = lazy(() => import("./pages/Settings"));
const Projects = lazy(() => import("./pages/Projects"));
const Pricing = lazy(() => import("./pages/Pricing"));
const ExchangeRates = lazy(() => import("./pages/ExchangeRates"));
const SalariesPage = lazy(() => import("./pages/SalariesPage"));
const Analytics = lazy(() => import("./pages/Analytics"));
const PartnersPage = lazy(() => import("./pages/PartnersPage"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const KintlevoPage = lazy(() => import("./pages/KintlevoPage"));
const PettyCashPage = lazy(() => import("./pages/PettyCashPage"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min — stable data won't refetch on every mount
      gcTime: 10 * 60 * 1000,   // 10 min garbage collection
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedPage({ children }: { children: React.ReactNode }) {
  const { signOut, sessionGuard } = useAuth();

  return (
    <ProtectedRoute>
      {children}
      <IdleWarningModal
        open={sessionGuard.showWarning}
        secondsLeft={sessionGuard.secondsLeft}
        onStay={sessionGuard.stayActive}
        onLogout={() => signOut()}
      />
    </ProtectedRoute>
  );
}

function AuthGuardPage({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <CompanyProvider>
          <DateRangeProvider>
            <SubscriptionProvider>
              <TooltipProvider>

                <SonnerToaster />
                <LiveNotificationProvider />
                <BrowserRouter>
                    <Routes>
                    {/* Auth routes – no sidebar, own Suspense for lazy chunks */}
                    <Route path="/auth" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><Auth /></Suspense>} />
                    <Route path="/reset-password" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><ResetPassword /></Suspense>} />

                    {/* All protected routes with ProtectedLayout (sidebar is persistent).
                         AppLayout has its own <Suspense> around just the content area,
                         so lazy pages only replace the content — the sidebar stays mounted. */}
                    <Route element={<ProtectedLayout />}>
                      <Route path="/onboarding" element={
                        <AuthGuardPage><Onboarding /></AuthGuardPage>
                      } />
                      <Route path="/upload" element={
                        <ProtectedPage><ManualUpload /></ProtectedPage>
                      } />
                      <Route path="/invoices" element={
                        <ProtectedPage><InvoicesPage /></ProtectedPage>
                      } />
                      <Route path="/integrations" element={
                        <ProtectedPage><Integrations /></ProtectedPage>
                      } />
                      <Route path="/settings" element={
                        <ProtectedPage><Settings /></ProtectedPage>
                      } />
                      <Route path="/projects" element={
                        <ProtectedPage><Projects /></ProtectedPage>
                      } />
                      <Route path="/partners" element={
                        <ProtectedPage><PartnersPage /></ProtectedPage>
                      } />
                      <Route path="/transactions" element={
                        <ProtectedPage><TransactionsPage /></ProtectedPage>
                      } />
                      <Route path="/kintlevo" element={
                        <ProtectedPage><KintlevoPage /></ProtectedPage>
                      } />
                      <Route path="/petty-cash" element={
                        <ProtectedPage><PettyCashPage /></ProtectedPage>
                      } />
                      <Route path="/pricing" element={
                        <ProtectedPage><Pricing /></ProtectedPage>
                      } />
                      <Route path="/exchange-rates" element={
                        <ProtectedPage><ExchangeRates /></ProtectedPage>
                      } />
                      <Route path="/salaries" element={
                        <ProtectedPage><SalariesPage /></ProtectedPage>
                      } />
                      <Route path="/analytics" element={
                        <ProtectedPage><Analytics /></ProtectedPage>
                      } />
                      <Route path="/" element={
                        <ProtectedPage><Index /></ProtectedPage>
                      } />
                    </Route>

                    <Route path="*" element={<Suspense fallback={<LoadingSpinner message="Betöltés..." />}><NotFound /></Suspense>} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </SubscriptionProvider>
          </DateRangeProvider>
        </CompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
