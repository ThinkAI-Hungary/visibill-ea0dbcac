import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Zap, Shield, AtSign, Info } from 'lucide-react';
import EmailAliasManager from '@/components/EmailAliasManager';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


const Integrations = () => {
  return (
    <TooltipProvider delayDuration={300}>
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
        {/* Email Alias Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <AtSign className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">Email Alias-ok</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Hozz létre dedikált email címeket minden céghez. Add meg ezeket a címeket a számlázóknak, és a számlák automatikusan feldolgozásra kerülnek.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardDescription>
                  Egyedi email címek cégekhez a számlák automatikus fogadásához
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Mail className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">Dedikált címek</p>
                  <p className="text-xs text-muted-foreground">Cégenkénti elkülönítés</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Zap className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="font-medium text-sm">Automatikus</p>
                  <p className="text-xs text-muted-foreground">Azonnali feldolgozás</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Shield className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-sm">Biztonságos</p>
                  <p className="text-xs text-muted-foreground">Ellenőrzött forrás</p>
                </div>
              </div>
            </div>

            <EmailAliasManager />
          </CardContent>
        </Card>

        {/* NAV Integration */}
        <Card>
          <CardContent className="p-6">
              <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">NAV Online Számla</h3>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Csatlakoztasd a NAV Online Számla rendszert a kimenő számlák automatikus szinkronizálásához. Technikai felhasználó adatai szükségesek.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-muted-foreground">
                    Magyar NAV online számla rendszer integráció
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      Biztonságos
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Zap className="w-3 h-3 mr-1" />
                      Automatikus
                    </Badge>
                  </div>
                </div>
              </div>
              <Button asChild>
                <a href="/nav-testing">Beállítás</a>
              </Button>
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-medium mb-2">Jellemzők:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Számlák automatikus szinkronizálása</li>
                <li>• Valós idejű státusz frissítések</li>
                <li>• Titkosított hitelesítő adatok tárolása</li>
                <li>• Teszt és éles környezet támogatás</li>
              </ul>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
    </TooltipProvider>
  );
};

export default Integrations;