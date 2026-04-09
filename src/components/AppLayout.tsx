import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { GlobalDatePicker } from "@/components/GlobalDatePicker";
import { useUserRole } from "@/hooks/useUserRole";

interface AppLayoutProps {
  children?: React.ReactNode;
}

/**
 * AppLayout — The Stable Shell.
 *
 * Only mounts after useAppReady() returns true (via ProtectedLayout).
 * By the time this renders, auth + company + role are ALL resolved.
 * No loading logic needed here — everything renders in final state.
 */
export function AppLayout({ children }: AppLayoutProps) {
  const { isEmployee } = useUserRole();

  return (
    <SidebarProvider className="h-screen w-full overflow-hidden flex !min-h-0 print:h-auto print:overflow-visible">
      <AppSidebar />
      
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background print:h-auto print:overflow-visible">
        {/* Global Date Picker — hidden for employees */}
        {!isEmployee && (
          <div className="print:hidden">
            <GlobalDatePicker />
          </div>
        )}
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background p-6 print:p-0 print:overflow-visible">
          <Suspense fallback={<ContentSkeleton />}>
            {children || <Outlet />}
          </Suspense>
        </main>
      </div>
    </SidebarProvider>
  );
}
