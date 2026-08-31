import "./app/bootstrap";
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./app/queryClient";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { CompanyProvider } from "./contexts/CompanyContext";
import { DateRangeProvider } from "./contexts/DateRangeContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
import { OfflineBanner } from "./components/OfflineBanner";
import { SupportModeBanner } from "./components/SupportModeBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingSpinner } from "./components/ui/loading-spinner";
import { ProtectedLayout } from "./components/ProtectedLayout";
import { ScopedLayout } from "./components/ScopedLayout";
import { ScrollToTop } from "./routes/shellComponents";
import { PasswordRecoveryRedirect } from "./routes/redirects";
import { renderAuthRoutes } from "./routes/authRoutes";
import { renderAccountyRoutes } from "./routes/accountyRoutes";
import { renderEaisybillScopedRoutes, renderEaisybillLegacyAndFallbackRoutes } from "./routes/eaisybillRoutes";
import { renderShipmentScopedRoutes, renderShipmentLegacyRoutes } from "./routes/shipmentRoutes";

const NotFound = lazy(() => import("./pages/NotFound"));

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <CompanyProvider>
          <DateRangeProvider>
            <TooltipProvider>
              <Toaster />
              <OfflineBanner />
              <SupportModeBanner />
              <ErrorBoundary>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <ScrollToTop />
                  <PasswordRecoveryRedirect />
                  <Routes>
                    {/* Standalone auth and management routes */}
                    {renderAuthRoutes()}

                    {/* Accounty / eaisybooks standalone application layout */}
                    {renderAccountyRoutes()}

                    {/* Protected routes with persistent eaisybill sidebar */}
                    <Route element={<ProtectedLayout />}>
                      {/* Scoped application routes: /:companyId/:dateRange/* */}
                      <Route path="/:companyId/:dateRange" element={<ScopedLayout />}>
                        {renderEaisybillScopedRoutes()}
                        {renderShipmentScopedRoutes()}
                      </Route>

                      {/* Legacy flat path redirects and unscoped fallbacks */}
                      {renderEaisybillLegacyAndFallbackRoutes()}
                      {renderShipmentLegacyRoutes()}
                    </Route>

                    {/* Catch-all 404 handler */}
                    <Route
                      path="*"
                      element={
                        <Suspense fallback={<LoadingSpinner message="Betöltés..." />}>
                          <NotFound />
                        </Suspense>
                      }
                    />
                  </Routes>
                </BrowserRouter>
              </ErrorBoundary>
            </TooltipProvider>
          </DateRangeProvider>
        </CompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
