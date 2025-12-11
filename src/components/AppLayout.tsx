import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { Suspense } from "react";

interface AppLayoutProps {
  children?: React.ReactNode;
}

function ContentLoader() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="mt-2 text-muted-foreground">Betöltés...</p>
      </div>
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider className="h-screen w-full overflow-hidden flex !min-h-0">
      <AppSidebar />
      
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <Suspense fallback={<ContentLoader />}>
            {children || <Outlet />}
          </Suspense>
        </main>
      </div>
    </SidebarProvider>
  );
}