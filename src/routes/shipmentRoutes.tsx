import React, { lazy } from "react";
import { Route } from "react-router-dom";
import { ProtectedPage } from "./shellComponents";
import { LegacyRedirect } from "./redirects";

const ShipmentImportPage = lazy(() => import("@/pages/ShipmentImportPage"));
const ShipmentMatchingDashboard = lazy(() => import("@/pages/ShipmentMatchingDashboard"));
const EscalationListPage = lazy(() => import("@/pages/EscalationListPage"));

/**
 * Scoped shipment routes to be placed inside `/:companyId/:dateRange` ScopedLayout.
 */
export function renderShipmentScopedRoutes() {
  return (
    <>
      <Route path="shipments" element={<ProtectedPage><ShipmentMatchingDashboard /></ProtectedPage>} />
      <Route path="shipments/import" element={<ProtectedPage><ShipmentImportPage /></ProtectedPage>} />
      <Route path="shipments/escalated" element={<ProtectedPage><EscalationListPage /></ProtectedPage>} />
    </>
  );
}

/**
 * Legacy shipment redirects to be placed inside ProtectedLayout.
 */
export function renderShipmentLegacyRoutes() {
  return (
    <>
      <Route path="/shipments" element={<LegacyRedirect page="shipments" />} />
      <Route path="/shipments/import" element={<LegacyRedirect page="shipments/import" />} />
      <Route path="/shipments/escalated" element={<LegacyRedirect page="shipments/escalated" />} />
      {/* Legacy matching routes → redirect to consolidated /shipments */}
      <Route path="/shipment-matching" element={<LegacyRedirect page="shipments" />} />
      <Route path="/shipment-matching/escalated" element={<LegacyRedirect page="shipments/escalated" />} />
    </>
  );
}
