import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import { IdleWarningModal } from "@/components/IdleWarningModal";
import { useAuth } from "@/contexts/AuthContext";

export function ProtectedPage({ children }: { children: React.ReactNode }) {
  const { signOut, sessionGuard } = useAuth();

  return (
    <ProtectedRoute>
      {children}
      <IdleWarningModal
        open={sessionGuard.showWarning}
        secondsLeft={sessionGuard.secondsLeft}
        onStay={sessionGuard.stayActive}
        onLogout={() => signOut()}
      />
    </ProtectedRoute>
  );
}

/** Removes the static HTML loader when a non-protected route mounts */
export function RemoveInitialLoader() {
  useEffect(() => {
    const loader = document.getElementById('initial-loader');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => loader.remove(), 220);
    }
  }, []);
  return null;
}

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Reset scroll of main content containers ONLY — NOT the sidebar nav.
    // AppSidebar's scrollable SidebarGroup has [data-sidebar-nav] which is excluded here.
    // Without this, the sidebar would jump to top every time the user clicks a menu item
    // that was scrolled into view on small-resolution screens.
    const scrollContainers = document.querySelectorAll("main, .overflow-y-auto, .overflow-auto");
    scrollContainers.forEach((el) => {
      // Skip sidebar navigation containers (marked with data-sidebar-nav)
      if (
        el.hasAttribute('data-sidebar-nav') ||
        el.closest('[data-sidebar-nav]')
      ) {
        return;
      }
      if (
        el.tagName === 'MAIN' ||
        el.classList.contains('p-6') ||
        el.classList.contains('p-8') ||
        el.classList.contains('flex-1')
      ) {
        (el as HTMLElement).scrollTop = 0;
      }
    });
  }, [pathname]);

  return null;
}
