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
 * The sidebar (shell) lives OUTSIDE the keyed boundary so it never
 * remounts on company switch. The Outlet (content) lives INSIDE a
 * keyed Suspense boundary, so when companyId changes the entire
 * content subtree unmounts + remounts atomically — no half-old/half-new
 * render.
 */
export function AppLayout({ children }: AppLayoutProps) {
  const { isEmployee } = useUserRole();

  return (
    <SidebarProvider className="h-screen w-full overflow-hidden flex !min-h-0 print:h-auto print:overflow-visible">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background print:h-auto print:overflow-visible">
        {!isEmployee && (
          <div className="print:hidden">
            <GlobalDatePicker />
          </div>
        )}
        <main className="flex-1 overflow-y-auto bg-background p-6 print:p-0 print:overflow-visible">
          <Suspense fallback={<ContentSkeleton />}>
            {children || <Outlet />}
          </Suspense>
        </main>
      </div>
    </SidebarProvider>
  );
}
