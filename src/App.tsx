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
import NotFound from "./pages/NotFound";
import KintlevoPage from "./pages/KintlevoPage";

const queryClient = new QueryClient();

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
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
                <Toaster />
                <BrowserRouter>
                  <Routes>
                    {/* Auth route without layout */}
                    <Route path="/auth" element={<Auth />} />

                    {/* All protected routes with ProtectedLayout */}
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
