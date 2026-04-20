import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Suspense, memo } from "react";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { GlobalDatePicker } from "@/components/GlobalDatePicker";
import { useUserRole } from "@/hooks/useUserRole";

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
    <div className="print:hidden">
      <GlobalDatePicker />
    </div>
  );
});

/**
 * ContentArea — memoized content shell.
 * Holds the Suspense boundary for lazy route chunks. Independent from TopBar.
 */
const ContentArea = memo(function ContentArea({ children }: { children?: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-y-auto bg-background p-6 print:p-0 print:overflow-visible">
      <Suspense fallback={<ContentSkeleton />}>
        {children || <Outlet />}
      </Suspense>
    </main>
  );
});

/**
 * AppLayout — The Stable Shell.
 *
 * The sidebar (shell) lives OUTSIDE the keyed boundary so it never
 * remounts on company switch. TopBar and ContentArea are memoized
 * separately so role-cache or navigation re-renders don't ripple
 * across the entire shell.
 */
export function AppLayout({ children }: AppLayoutProps) {
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
