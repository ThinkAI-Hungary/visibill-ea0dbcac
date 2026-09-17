import { createRoot } from "react-dom/client";
import "./lib/i18n.ts";
import App from "./App.tsx";
import "./index.css";
import { reportError } from "./lib/errorReporter.ts";

// ── Filter benign browser extensions & system noise ──
function isExternalNoise(msg: string, err?: any): boolean {
  const lowerMsg = (msg || '').toLowerCase();
  const stack = typeof err?.stack === 'string' ? err.stack : '';
  const lowerStack = stack.toLowerCase();

  if (
    lowerMsg.includes('reportallchanges') || 
    (lowerMsg.includes('starttime') && lowerMsg.includes('undefined')) ||
    lowerMsg.includes('dev-sw') ||
    lowerMsg.includes('serviceworker') ||
    lowerMsg.includes('service worker')
  ) {
    return true;
  }

  // Browser extensions & injected scripts (e.g. window.__go, chrome-extension://)
  if (
    lowerStack.includes('chrome-extension://') ||
    lowerStack.includes('moz-extension://') ||
    lowerStack.includes('safari-extension://') ||
    lowerStack.includes('window.__go') ||
    lowerMsg.includes('window.__go')
  ) {
    return true;
  }

  // Anonymous scripts not part of our application assets
  if (
    stack.includes('<anonymous>') &&
    !stack.includes('/src/') &&
    !stack.includes('/assets/') &&
    !stack.includes('localhost') &&
    !stack.includes('eaisybill') &&
    (lowerMsg.includes('slice') || lowerStack.includes('__go'))
  ) {
    return true;
  }

  return false;
}

// ── Global error catchers → app_error_logs ──
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || '');
  if (isExternalNoise(msg, event.reason)) {
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
  if (isExternalNoise(msg, event.error)) {
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
