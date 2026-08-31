import { describe, it, expect, beforeEach } from "vitest";
import { extractErrorInfo, initAuthHashHandler } from "../bootstrap";

describe("Bootstrap & Error Parsing", () => {
  it("extracts details from standard Error objects", () => {
    const err = new Error("Network timeout");
    (err as any).code = "ETIMEDOUT";
    (err as any).status = 504;

    const info = extractErrorInfo(err);
    expect(info.message).toBe("Network timeout");
    expect(info.details.code).toBe("ETIMEDOUT");
    expect(info.details.status).toBe(504);
  });

  it("extracts details from Supabase PostgrestError objects", () => {
    const postgrestErr = {
      message: "Row level security violation",
      code: "42501",
      details: "User lacks permission",
      hint: "Check RLS policy",
    };

    const info = extractErrorInfo(postgrestErr);
    expect(info.message).toBe("Row level security violation");
    expect(info.details.code).toBe("42501");
    expect(info.details.hint).toBe("Check RLS policy");
  });

  it("handles string errors gracefully", () => {
    const info = extractErrorInfo("Unexpected string error");
    expect(info.message).toBe("Unexpected string error");
    expect(info.details).toEqual({});
  });

  describe("initAuthHashHandler", () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    it("captures recovery token on /reset-password into sessionStorage", () => {
      // Mock location
      Object.defineProperty(window, "location", {
        writable: true,
        value: {
          pathname: "/reset-password",
          hash: "#type=recovery&access_token=test_token",
          search: "",
          replace: () => {},
        },
      });

      initAuthHashHandler();
      expect(sessionStorage.getItem("visibill_reset_pw_state")).toBe("recovery");
    });

    it("captures expired token on /reset-password into sessionStorage", () => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: {
          pathname: "/reset-password",
          hash: "#error=access_denied&error_code=otp_expired",
          search: "",
          replace: () => {},
        },
      });

      initAuthHashHandler();
      expect(sessionStorage.getItem("visibill_reset_pw_state")).toBe("expired");
    });
  });
});
