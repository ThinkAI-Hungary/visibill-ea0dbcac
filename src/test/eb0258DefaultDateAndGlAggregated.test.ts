import { describe, it, expect } from "vitest";
import {
  EXCHANGE_RATE_BANKS,
  EXCHANGE_RATE_TYPES,
  DEFAULT_FX_BANK_CODE,
  DEFAULT_FX_RATE_TYPE,
  getExchangeRateBank,
  getExchangeRateTypeLabel
} from "../lib/banking/exchangeRateBanks";
import { DEFAULT_SETTINGS } from "../hooks/useCompanySettings";
import {
  AGGREGATED_EXPANDED_IDS,
  DEFAULT_EXPANDED_IDS
} from "../components/general-ledger/GeneralLedgerTable";

describe("EB-0258: Default Fulfillment Date, Aggregated GL View & FX Bank Catalog", () => {
  describe("Exchange Rate Banks Catalog (MOD-2)", () => {
    it("should provide comprehensive bank catalog with ~45 financial institutions", () => {
      expect(EXCHANGE_RATE_BANKS.length).toBeGreaterThanOrEqual(40);
      
      const codes = EXCHANGE_RATE_BANKS.map(b => b.code);
      // Essential banks requested in EB-0258 & 258.pdf
      expect(codes).toContain("MNB");
      expect(codes).toContain("146"); // MFB
      expect(codes).toContain("117"); // OTP
      expect(codes).toContain("104"); // K&H
      expect(codes).toContain("116"); // Erste
      expect(codes).toContain("120"); // Raiffeisen
      expect(codes).toContain("107"); // CIB
      expect(codes).toContain("511"); // MBH
      expect(codes).toContain("109"); // UniCredit
      expect(codes).toContain("122"); // Gránit
      expect(codes).toContain("162"); // MagNet
      expect(codes).toContain("BE1"); // Wise
      expect(codes).toContain("302"); // Revolut
      expect(codes).toContain("131"); // BNP Paribas
      expect(codes).toContain("108"); // Citibank
      expect(codes).toContain("137"); // ING Bank
    });

    it("should have correct defaults: MNB and mid (középárfolyam)", () => {
      expect(DEFAULT_FX_BANK_CODE).toBe("MNB");
      expect(DEFAULT_FX_RATE_TYPE).toBe("mid");
    });

    it("getExchangeRateBank should return bank definition by code or alias, or fallback to MNB", () => {
      const otp = getExchangeRateBank("OTP");
      expect(otp).toBeDefined();
      expect(otp.name).toContain("OTP");
      expect(otp.code).toBe("117");
      expect(otp.flag).toBe("🇭🇺");

      const mfb = getExchangeRateBank("MFB");
      expect(mfb).toBeDefined();
      expect(mfb.name).toContain("MFB");
      expect(mfb.code).toBe("146");

      const revolut = getExchangeRateBank("REVOLUT");
      expect(revolut).toBeDefined();
      expect(revolut.name).toContain("Revolut");

      const wise = getExchangeRateBank("WISE");
      expect(wise).toBeDefined();
      expect(wise.name).toContain("Wise");

      // Non-existent code should fallback to MNB
      const unknown = getExchangeRateBank("NON_EXISTING_BANK_XYZ");
      expect(unknown.code).toBe("MNB");
      expect(unknown.name).toContain("Magyar Nemzeti Bank");
    });

    it("should support all three exchange rate types with Hungarian labels", () => {
      expect(EXCHANGE_RATE_TYPES.length).toBe(3);
      const types = EXCHANGE_RATE_TYPES.map(t => t.value);
      expect(types).toEqual(["mid", "buy", "sell"]);

      expect(getExchangeRateTypeLabel("mid")).toContain("Középárfolyam");
      expect(getExchangeRateTypeLabel("buy")).toContain("Vételi");
      expect(getExchangeRateTypeLabel("sell")).toContain("Eladási");
    });
  });

  describe("Company Settings Defaults (MOD-1)", () => {
    it("should set default gl_date_basis to 'teljesites' (fulfillment date priority)", () => {
      expect(DEFAULT_SETTINGS.gl_date_basis).toBe("teljesites");
    });

    it("should set default gl_default_view_mode to 'osszevont' (aggregated view priority)", () => {
      expect(DEFAULT_SETTINGS.gl_default_view_mode).toBe("osszevont");
    });

    it("should set default fx bank and rate types to MNB and mid", () => {
      expect(DEFAULT_SETTINGS.fx_accounting_bank_code).toBe("MNB");
      expect(DEFAULT_SETTINGS.fx_accounting_rate_type).toBe("mid");
      expect(DEFAULT_SETTINGS.fx_revaluation_bank_code).toBe("MNB");
      expect(DEFAULT_SETTINGS.fx_revaluation_rate_type).toBe("mid");
    });
  });

  describe("General Ledger Aggregated View vs Detailed View (MOD-4)", () => {
    it("AGGREGATED_EXPANDED_IDS should only contain root account classes and UNCLASSIFIED", () => {
      const expectedRootClasses = ["1", "2", "3", "4", "5", "8", "9", "UNCLASSIFIED"];
      expectedRootClasses.forEach(rootClass => {
        expect(AGGREGATED_EXPANDED_IDS.has(rootClass)).toBe(true);
      });

      // Crucial: sub-accounts and detailed ledger accounts must NOT be expanded in aggregated mode
      expect(AGGREGATED_EXPANDED_IDS.has("31")).toBe(false);
      expect(AGGREGATED_EXPANDED_IDS.has("311")).toBe(false);
      expect(AGGREGATED_EXPANDED_IDS.has("45")).toBe(false);
      expect(AGGREGATED_EXPANDED_IDS.has("454")).toBe(false);
      expect(AGGREGATED_EXPANDED_IDS.has("46")).toBe(false);
      expect(AGGREGATED_EXPANDED_IDS.has("466")).toBe(false);
    });

    it("DEFAULT_EXPANDED_IDS should contain detailed subledger accounts for 'teteles' mode", () => {
      expect(DEFAULT_EXPANDED_IDS.has("31")).toBe(true);
      expect(DEFAULT_EXPANDED_IDS.has("311")).toBe(true);
      expect(DEFAULT_EXPANDED_IDS.has("45")).toBe(true);
      expect(DEFAULT_EXPANDED_IDS.has("454")).toBe(true);
      expect(DEFAULT_EXPANDED_IDS.has("46")).toBe(true);
      expect(DEFAULT_EXPANDED_IDS.has("466")).toBe(true);
    });

    it("selection of initial expanded IDs based on view mode", () => {
      const getInitialIds = (mode?: "osszevont" | "teteles") => {
        return (mode === "osszevont" ? AGGREGATED_EXPANDED_IDS : DEFAULT_EXPANDED_IDS);
      };

      const aggregated = getInitialIds("osszevont");
      expect(aggregated.has("311")).toBe(false);
      expect(aggregated.has("1")).toBe(true);

      const detailed = getInitialIds("teteles");
      expect(detailed.has("311")).toBe(true);
      expect(detailed.has("1")).toBe(true);
    });
  });
});
