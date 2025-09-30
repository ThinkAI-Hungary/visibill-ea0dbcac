import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Zap, Shield, Clock } from 'lucide-react';
import NylasEmailConnect from '@/components/NylasEmailConnect';

const Integrations = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrációk</h1>
          <p className="text-muted-foreground">
            Csatlakoztasd szolgáltatásaidat a számla automatizáláshoz
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Automatizáció
        </Badge>
      </div>

      <div className="grid gap-6">
        {/* Email Integration Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Email Integráció</CardTitle>
                <CardDescription>
                  Automatikus számla feldolgozás közvetlenül az email fiókodból
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Shield className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-sm">Biztonságos</p>
                  <p className="text-xs text-muted-foreground">OAuth2 hitelesítés</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Clock className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">Valós idejű</p>
                  <p className="text-xs text-muted-foreground">Azonnali szinkronizálás</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Zap className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium text-sm">Automatikus</p>
                  <p className="text-xs text-muted-foreground">Kézi munka nélkül</p>
                </div>
              </div>
            </div>

            <NylasEmailConnect />
          </CardContent>
        </Card>

        {/* Future Integrations Preview */}
        <Card className="opacity-60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Zap className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-xl text-muted-foreground">További Integrációk</CardTitle>
                  <CardDescription>
                    Hamarosan elérhető további szolgáltatások
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline">Hamarosan</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg bg-muted/20">
                <h4 className="font-medium text-muted-foreground">Accounting Software</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Közvetlen integráció számlázó rendszerekkel
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-muted/20">
                <h4 className="font-medium text-muted-foreground">Cloud Storage</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Automatikus mentés felhő szolgáltatásokba
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-muted/20">
                <h4 className="font-medium text-muted-foreground">API Access</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Programmatic hozzáférés fejlesztőknek
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-muted/20">
                <h4 className="font-medium text-muted-foreground">Reporting Tools</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Integráció reporting és analytics eszközökkel
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Integrations;