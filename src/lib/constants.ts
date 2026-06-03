/**
 * Centralized storage key constants.
 * Every localStorage/cookie key used in the app should be defined here.
 */
export const STORAGE_KEYS = {
  // ── Security-sensitive (DELETED on sign-out) ──
  SELECTED_COMPANY_ID: 'selectedCompanyId',
  AUTH_TOKEN: 'sb-vxxgvdlqvvchtlmqnrqf-auth-token',
  AUTH_TOKEN_LEGACY: 'supabase.auth.token',

  // ── UX preferences (KEPT on sign-out) ──
  THEME: 'visibill_theme',
  DATE_RANGE: 'visibill_date_range',
  DASHBOARD_SHOW_BRUTTO: 'visibill_dashboard_show_brutto',
  DASHBOARD_CHART_LINES: 'visibill_dashboard_chart_lines',
  LAST_ACTIVE: 'visibill_last_active',

  // Sidebar
  SIDEBAR_STATE: 'sidebar:state',
} as const;

/**
 * Keys to DELETE on sign-out (security-sensitive / company-scoped data).
 */
export const SIGNOUT_DELETE_KEYS: string[] = [
  STORAGE_KEYS.AUTH_TOKEN,
  STORAGE_KEYS.AUTH_TOKEN_LEGACY,
  STORAGE_KEYS.SELECTED_COMPANY_ID,
];

/**
 * Keys to KEEP on sign-out (UX preferences that are user-comfort related).
 * Listed here for documentation; the signOut logic deletes only SIGNOUT_DELETE_KEYS.
 */
export const SIGNOUT_KEEP_KEYS: string[] = [
  STORAGE_KEYS.THEME,
  STORAGE_KEYS.DATE_RANGE,
  STORAGE_KEYS.DASHBOARD_SHOW_BRUTTO,
  STORAGE_KEYS.DASHBOARD_CHART_LINES,
  STORAGE_KEYS.SIDEBAR_STATE,
];

/**
 * Prefix for all eaisybill-specific keys (kept as 'visibill_' for backward compatibility).
 */
export const VISIBILL_PREFIX = 'visibill_';
