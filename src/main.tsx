import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { reportError } from "./lib/errorReporter.ts";

// ── Global error catchers → app_error_logs ──
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || '');
  if (msg.toLowerCase().includes('reportallchanges') || (msg.toLowerCase().includes('starttime') && msg.toLowerCase().includes('undefined'))) {
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
  if (msg.toLowerCase().includes('reportallchanges') || (msg.toLowerCase().includes('starttime') && msg.toLowerCase().includes('undefined'))) {
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
