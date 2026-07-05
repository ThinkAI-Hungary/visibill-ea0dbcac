import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Suspense, memo, useEffect } from "react";
import { GlobalDatePicker } from "@/components/GlobalDatePicker";
import { useUserRole } from "@/hooks/useUserRole";
import { usePdfExportNotifications } from "@/hooks/usePdfExportNotifications";

interface AppLayoutProps {
  children?: React.ReactNode;
}

/**
 * TopBar — memoized, role-aware navbar slot.
 * Isolated so role / query-cache changes never re-render the shell.
 */
const TopBar = memo(function TopBar() {
  const { isEmployee } = useUserRole();
  if (isEmployee) return null;
  return (
    <div className="print:hidden border-b border-border">
      <GlobalDatePicker />
    </div>
  );
});

/**
 * Stable Suspense fallback — keeps the <main> region's height intact
 * during lazy chunk fetches so users never see a blank flash.
 */
const StableFallback = () => <div className="h-full w-full" aria-busy="true" />;

/**
 * ContentArea — memoized content shell.
 * Holds the Suspense boundary for lazy route chunks. Independent from TopBar.
 */
const ContentArea = memo(function ContentArea({ children }: { children?: React.ReactNode }) {
  return (
    <main 
      className="flex-1 overflow-y-auto bg-background p-6 print:p-0 print:overflow-visible"
      style={{ scrollbarGutter: 'stable' }}
    >
      <Suspense fallback={<StableFallback />}>
        {children || <Outlet />}
      </Suspense>
    </main>
  );
});

/**
 * Background prefetch of the most frequently used route chunks.
 * Fires once after mount during browser idle time so first navigation
 * to these pages skips the network/parse cost entirely.
 */
function useIdleRoutePrefetch() {
  useEffect(() => {
    const idle = (cb: () => void) => {
      if (typeof window === "undefined") return;
      const w = window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      };
      if (w.requestIdleCallback) {
        w.requestIdleCallback(cb, { timeout: 2000 });
      } else {
        setTimeout(cb, 1500);
      }
    };

    idle(() => {
      // Highest-traffic pages — fetch in background, ignore failures.
      void import("@/pages/Index");
      void import("@/pages/InvoicesPage");
      void import("@/pages/TransactionsPage");
      void import("@/pages/SalariesPage");
      void import("@/pages/PartnersPage");
      void import("@/pages/GeneralLedgerPage");
    });
  }, []);
}

/**
 * AppLayout — The Stable Shell.
 *
 * The sidebar (shell) lives OUTSIDE the keyed boundary so it never
 * remounts on company switch. TopBar and ContentArea are memoized
 * separately so role-cache or navigation re-renders don't ripple
 * across the entire shell.
 */
export function AppLayout({ children }: AppLayoutProps) {
  useIdleRoutePrefetch();
  usePdfExportNotifications();

  return (
    <SidebarProvider className="h-screen w-full overflow-hidden flex !min-h-0 print:h-auto print:overflow-visible">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background print:h-auto print:overflow-visible">
        <TopBar />
        <ContentArea>{children}</ContentArea>
      </div>
    </SidebarProvider>
  );
}
