import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CompanyProvider } from "./contexts/CompanyContext";
import { AppLayout } from "./components/AppLayout";
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
import NavTesting from "./pages/NavTesting";
import ExchangeRates from "./pages/ExchangeRates";
import SalariesPage from "./pages/SalariesPage";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
          <SubscriptionProvider>
            <TooltipProvider>
              <Toaster />
              
              <BrowserRouter>
                <Routes>
                  {/* Auth route without layout */}
                  <Route path="/auth" element={<Auth />} />
                  
                  {/* All routes with AppLayout - layout renders once */}
                  <Route element={<AppLayout />}>
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
                    <Route path="/pricing" element={
                      <ProtectedPage>
                        <Pricing />
                      </ProtectedPage>
                    } />
                    <Route path="/nav-testing" element={
                      <ProtectedPage>
                        <NavTesting />
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
        </CompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
