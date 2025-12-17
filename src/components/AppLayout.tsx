import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Suspense } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface AppLayoutProps {
  children?: React.ReactNode;
}

function ContentLoader() {
  return <LoadingSpinner />;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider className="h-screen w-full overflow-hidden flex !min-h-0">
      <AppSidebar />
      
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <Suspense fallback={<ContentLoader />}>
            {children || <Outlet />}
          </Suspense>
        </main>
      </div>
    </SidebarProvider>
  );
}