import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Zap, Shield, FileText, ExternalLink, Info, Link2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const BillingoIntegrationCard: React.FC = () => {
  return (
    <Card className="border-primary/10 hover:border-primary/20 transition-colors h-full flex flex-col justify-between">
      <div>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-blue-500/5 rounded-xl flex items-center justify-center border border-blue-500/20">
              <Link2 className="w-6 h-6 text-blue-500" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Billingo Link Letöltés</CardTitle>
                <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Aktív
                </Badge>
              </div>
              <CardDescription className="text-sm">
                Automatikus publikus tokenes PDF letöltés
              </CardDescription>
              {/* Feature Pills */}
              <div className="flex flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
                  <Zap className="h-3 w-3" />
                  Azonnali letöltés
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                  <Shield className="h-3 w-3" />
                  Bejelentkezés mentes
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <Alert className="bg-muted/40 border-muted">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
              A Billingo e-mail értesítőkben érkező letöltő linkekből (<code className="text-primary font-mono text-[11px]">app.billingo.hu/document-access/...</code>) a Visibill automatikusan kinyeri és elmenti az eredeti PDF számlaképet.
            </AlertDescription>
          </Alert>

          <div className="p-3.5 rounded-lg bg-muted/20 border border-border/50 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Kulcs beállítás:</span>
              <span className="text-emerald-500 font-medium flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Nem szükséges
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              A Billingo biztonsági tokenjei nyilvános megtekintést tesznek lehetővé, így külön API kulcs rögzítése nélkül működik.
            </p>
          </div>
        </CardContent>
      </div>

      <div className="p-4 pt-0 text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/40 mt-4">
        <span>Támogatott formátum: Billingo e-mail értesítők</span>
        <a
          href="https://www.billingo.hu"
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-1"
        >
          Billingo.hu <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </Card>
  );
};

export default BillingoIntegrationCard;
