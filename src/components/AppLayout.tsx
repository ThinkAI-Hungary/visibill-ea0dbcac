import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { GlobalDatePicker } from "@/components/GlobalDatePicker";

interface AppLayoutProps {
  children?: React.ReactNode;
}

function ContentLoader() {
  return <ContentSkeleton />;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider className="h-screen w-full overflow-hidden flex !min-h-0 print:h-auto print:overflow-visible">
      <AppSidebar />
      
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background print:h-auto print:overflow-visible">
        {/* Global Date Picker Header */}
        <div className="print:hidden">
          <GlobalDatePicker />
        </div>
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background p-6 print:p-0 print:overflow-visible">
          <Suspense fallback={<ContentLoader />}>
            {children || <Outlet />}
          </Suspense>
        </main>
      </div>
    </SidebarProvider>
  );
}
