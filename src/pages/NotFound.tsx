import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { reportError } from '@/lib/errorReporter';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    reportError({ type: 'db_query', component: 'NotFound', action: 'error', message: '404 Error: User attempted to access non-existent route:', error: location.pathname });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-4">
      <div className="text-center max-w-md space-y-4">
        <h1 className="text-6xl font-extrabold tracking-tight text-primary">404</h1>
        <h2 className="text-2xl font-semibold">Az oldal nem található</h2>
        <p className="text-sm text-muted-foreground">
          A keresett oldal nem létezik, vagy nincs jogosultsága a megtekintéséhez.
        </p>
        <div className="pt-2">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Vissza a kezdőlapra
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
