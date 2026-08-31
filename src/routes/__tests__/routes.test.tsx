import React from "react";
import { describe, it, expect } from "vitest";
import { renderAuthRoutes } from "../authRoutes";
import { renderEaisybillScopedRoutes, renderEaisybillLegacyAndFallbackRoutes } from "../eaisybillRoutes";
import { renderAccountyRoutes } from "../accountyRoutes";
import { renderShipmentScopedRoutes, renderShipmentLegacyRoutes } from "../shipmentRoutes";

describe("Route Manifests Verification", () => {
  it("renders auth routes manifest fragment", () => {
    const fragment = renderAuthRoutes();
    expect(React.isValidElement(fragment)).toBe(true);
  });

  it("renders eaisybill scoped routes manifest fragment", () => {
    const fragment = renderEaisybillScopedRoutes();
    expect(React.isValidElement(fragment)).toBe(true);
  });

  it("renders eaisybill legacy and fallback routes manifest fragment", () => {
    const fragment = renderEaisybillLegacyAndFallbackRoutes();
    expect(React.isValidElement(fragment)).toBe(true);
  });

  it("renders accounty routes manifest fragment", () => {
    const fragment = renderAccountyRoutes();
    expect(React.isValidElement(fragment)).toBe(true);
  });

  it("renders shipment scoped routes manifest fragment", () => {
    const fragment = renderShipmentScopedRoutes();
    expect(React.isValidElement(fragment)).toBe(true);
  });

  it("renders shipment legacy routes manifest fragment", () => {
    const fragment = renderShipmentLegacyRoutes();
    expect(React.isValidElement(fragment)).toBe(true);
  });
});
