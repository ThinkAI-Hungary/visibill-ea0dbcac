import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CompanyProvider } from "./contexts/CompanyContext";
import { DateRangeProvider } from "./contexts/DateRangeContext";
import { ProtectedLayout } from "./components/ProtectedLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthGuard from "./components/AuthGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import ManualUpload from "./pages/ManualUpload";
import InvoicesPage from "./pages/InvoicesPage";
import Integrations from "./pages/Integrations";
import Settings from "./pages/Settings";
import Projects from "./pages/Projects";
import Pricing from "./pages/Pricing";

import ExchangeRates from "./pages/ExchangeRates";
import SalariesPage from "./pages/SalariesPage";
import Analytics from "./pages/Analytics";
import PartnersPage from "./pages/PartnersPage";
import TransactionsPage from "./pages/TransactionsPage";
import PettyCashPage from "./pages/PettyCashPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 perc — adat "friss"-nek számít, nem fetchel újra
      gcTime: 10 * 60 * 1000,         // 10 perc — cache megőrzés
      refetchOnWindowFocus: false,     // Ne fetcheljen ablak-fókuszra
      retry: 1,                        // Max 1 retry hiba esetén
    },
  },
});

// Wrapper component that combines ProtectedRoute with page content
function ProtectedPage({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

// Wrapper for AuthGuard pages
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
                <Toaster />
                
                <BrowserRouter>
                  <Routes>
                    {/* Auth route without layout */}
                    <Route path="/auth" element={<Auth />} />
                    
                    {/* All protected routes with ProtectedLayout - auth check before layout renders */}
                    <Route element={<ProtectedLayout />}>
                      <Route path="/onboarding" element={
                        <AuthGuardPage>
                          <Onboarding />
                        </AuthGuardPage>
                      } />
                      <Route path="/upload" element={
                        <ProtectedPage>
                          <ManualUpload />
                        </ProtectedPage>
                      } />
                      <Route path="/invoices" element={
                        <ProtectedPage>
                          <InvoicesPage />
                        </ProtectedPage>
                      } />
                      <Route path="/integrations" element={
                        <ProtectedPage>
                          <Integrations />
                        </ProtectedPage>
                      } />
                      <Route path="/settings" element={
                        <ProtectedPage>
                          <Settings />
                        </ProtectedPage>
                      } />
                      <Route path="/projects" element={
                        <ProtectedPage>
                          <Projects />
                        </ProtectedPage>
                      } />
                      <Route path="/partners" element={
                        <ProtectedPage>
                          <PartnersPage />
                        </ProtectedPage>
                      } />
                      <Route path="/transactions" element={
                        <ProtectedPage>
                          <TransactionsPage />
                        </ProtectedPage>
                      } />
                      <Route path="/pricing" element={
                        <ProtectedPage>
                          <Pricing />
                        </ProtectedPage>
                      } />
                      <Route path="/exchange-rates" element={
                        <ProtectedPage>
                          <ExchangeRates />
                        </ProtectedPage>
                      } />
                      <Route path="/salaries" element={
                        <ProtectedPage>
                          <SalariesPage />
                        </ProtectedPage>
                      } />
                      <Route path="/petty-cash" element={
                        <ProtectedPage>
                          <PettyCashPage />
                        </ProtectedPage>
                      } />
                      <Route path="/analytics" element={
                        <ProtectedPage>
                          <Analytics />
                        </ProtectedPage>
                      } />
                      <Route path="/" element={
                        <ProtectedPage>
                          <Index />
                        </ProtectedPage>
                      } />
                    </Route>
                    
                    <Route path="*" element={<NotFound />} />
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
