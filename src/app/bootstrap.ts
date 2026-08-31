// ─── Synchronous email_change hash redirect ───────────────────────────────────
// Must run before React renders anything. If Supabase lands us on the root URL
// with type=email_change in the hash (from an email confirmation link), we
// immediately hard-redirect to /auth/callback so the user sees the confirmation
// screen — even if they already have an active session.
export function initAuthHashHandler(): void {
  if (typeof window === 'undefined') return;

  const hash = window.location.hash;
  const PENDING_KEY = 'visibill_pending_callback_type';

  // ── /reset-password: capture hash synchronously BEFORE Supabase clears it ──
  // Supabase SDK calls history.replaceState() during init, wiping the hash before
  // React renders. ResetPassword.tsx must read from sessionStorage instead.
  if (window.location.pathname === '/reset-password') {
    if (hash) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const type = params.get('type');
      const errCode = params.get('error_code');
      const errVal = params.get('error');
      if (type === 'recovery') {
        // Valid recovery token — mark so ResetPassword knows to show the form
        sessionStorage.setItem('visibill_reset_pw_state', 'recovery');
      } else if (errCode === 'otp_expired' || (errVal === 'access_denied' && errCode)) {
        // Expired or already-used reset link
        sessionStorage.setItem('visibill_reset_pw_state', 'expired');
      }
    }
    return; // Never redirect away from /reset-password
  }

  // If already at /auth/callback: capture the TYPE synchronously into sessionStorage
  // BEFORE Supabase's async init clears the URL. Two formats to handle:
  //   1. Hash fragment:  /auth/callback#type=email_change&access_token=...  (implicit flow)
  //   2. Query params:   /auth/callback?type=email_change&token_hash=...    (newer Supabase format)
  if (window.location.pathname === '/auth/callback') {
    if (!sessionStorage.getItem(PENDING_KEY)) {
      // First check query params (token_hash format)
      const qp = new URLSearchParams(window.location.search);
      const qpType = qp.get('type');
      const qpErrCode = qp.get('error_code');
      if (qpType === 'email_change') {
        sessionStorage.setItem(PENDING_KEY, 'email_change');
      } else if (qpErrCode === 'otp_expired' || qp.get('error') === 'access_denied') {
        sessionStorage.setItem(PENDING_KEY, 'otp_expired');
      } else if (hash) {
        // Fallback: hash fragment format
        const hp = new URLSearchParams(hash.replace('#', ''));
        const hpType = hp.get('type');
        const hpErrCode = hp.get('error_code');
        if (hpType === 'email_change') {
          sessionStorage.setItem(PENDING_KEY, 'email_change');
        } else if (hpErrCode === 'otp_expired') {
          sessionStorage.setItem(PENDING_KEY, 'otp_expired');
        }
      }
    }
    return;
  }

  if (!hash) return;
  const params = new URLSearchParams(hash.replace('#', ''));

  // Successful email change confirmation
  if (params.get('type') === 'email_change') {
    sessionStorage.setItem(PENDING_KEY, 'email_change');
    window.location.replace('/auth/callback' + hash);
    return;
  }

  // Already-used token: otp_expired error on root URL = email_change
  // (password reset otp_expired lands on /reset-password, not here)
  if (params.get('error') === 'access_denied' && params.get('error_code') === 'otp_expired') {
    sessionStorage.setItem(PENDING_KEY, 'otp_expired');
    window.location.replace('/auth/callback' + hash);
    return;
  }
}

// Automatically execute on module load
initAuthHashHandler();

/** Extract a human-readable message + structured details from any thrown value. */
export function extractErrorInfo(error: unknown): { message: string; details: Record<string, unknown> } {
  if (error instanceof Error) {
    // Standard JS Error — may also have Supabase-style extra fields
    const extra = error as unknown as Record<string, unknown>;
    return {
      message: error.message,
      details: {
        ...(extra['code'] != null && { code: extra['code'] }),
        ...(extra['details'] != null && { details: extra['details'] }),
        ...(extra['hint'] != null && { hint: extra['hint'] }),
        ...(extra['status'] != null && { status: extra['status'] }),
      },
    };
  }
  if (typeof error === 'object' && error !== null) {
    // Plain object (e.g. Supabase PostgrestError: { message, code, details, hint })
    const obj = error as Record<string, unknown>;
    let msg = '';
    if (typeof obj['message'] === 'string') {
      msg = obj['message'];
    } else if (typeof obj['message'] === 'object' && obj['message'] !== null && typeof (obj['message'] as Record<string, unknown>)['message'] === 'string') {
      msg = (obj['message'] as Record<string, unknown>)['message'] as string;
    } else if (typeof obj['error'] === 'string') {
      msg = obj['error'];
    } else if (typeof obj['error'] === 'object' && obj['error'] !== null && typeof (obj['error'] as Record<string, unknown>)['message'] === 'string') {
      msg = (obj['error'] as Record<string, unknown>)['message'] as string;
    } else {
      try {
        msg = JSON.stringify(obj);
      } catch {
        msg = String(error);
      }
    }
    return {
      message: msg,
      details: {
        ...(obj['code'] != null && { code: obj['code'] }),
        ...(obj['details'] != null && { details: obj['details'] }),
        ...(obj['hint'] != null && { hint: obj['hint'] }),
        ...(obj['status'] != null && { status: obj['status'] }),
        raw: obj,
      },
    };
  }
  return { message: String(error), details: {} };
}
