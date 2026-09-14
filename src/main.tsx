import { createRoot } from "react-dom/client";
import "./lib/i18n.ts";
import App from "./App.tsx";
import "./index.css";
import { reportError } from "./lib/errorReporter.ts";

// ── Global error catchers → app_error_logs ──
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || '');
  const lower = msg.toLowerCase();
  if (
    lower.includes('reportallchanges') || 
    (lower.includes('starttime') && lower.includes('undefined')) ||
    lower.includes('dev-sw') ||
    lower.includes('serviceworker') ||
    lower.includes('service worker')
  ) {
    return;
  }
  reportError({
    type: 'unhandled',
    component: 'global',
    action: 'unhandled_rejection',
    message: msg,
    error: event.reason,
  });
});

window.addEventListener('error', (event) => {
  const msg = event.message || '';
  const lower = msg.toLowerCase();
  if (
    lower.includes('reportallchanges') || 
    (lower.includes('starttime') && lower.includes('undefined')) ||
    lower.includes('dev-sw') ||
    lower.includes('serviceworker') ||
    lower.includes('service worker')
  ) {
    return;
  }
  reportError({
    type: 'unhandled',
    component: 'global',
    action: 'uncaught_error',
    message: msg || 'Unknown error',
    error: event.error,
  });
});

import { ErrorBoundary } from "./components/ErrorBoundary.tsx";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// NOTE: The initial-loader is now removed by ProtectedLayout
// after auth state is resolved, NOT here.
// This prevents the flash between the HTML loader and React render.
