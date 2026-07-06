import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, FileText, Download, PenTool, Upload, CheckCircle2, AlertTriangle, Clock, ExternalLink } from 'lucide-react';

interface Props {
  onChangePassword: () => void;
  onChangeEmail: () => void;
  onExportData: () => void;
  exportLoading: boolean;
  showAvdh?: boolean;
}

export function SecuritySection({ onChangePassword, onChangeEmail, onExportData, exportLoading, showAvdh = false }: Props) {
  const [avdhStatus, setAvdhStatus] = useState<'none' | 'active' | 'expiring' | 'expired'>('none');
  const [avdhName, setAvdhName] = useState<string | null>(null);
  const [avdhExpiry, setAvdhExpiry] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleAvdhUpload = async () => {
    // Simulated upload for now — will be connected to backend
    setUploading(true);
    await new Promise(r => setTimeout(r, 1500));
    setAvdhStatus('active');
    setAvdhName('Lederer Balázs');
    setAvdhExpiry('2027-06-01');
    setUploading(false);
  };

  const statusConfig = {
    none: { label: 'Nincs feltöltve', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Clock },
    active: { label: 'Érvényes', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: CheckCircle2 },
    expiring: { label: 'Hamarosan lejár', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', icon: AlertTriangle },
    expired: { label: 'Lejárt', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', icon: AlertTriangle },
  };

  const currentStatus = statusConfig[avdhStatus];
  const StatusIcon = currentStatus.icon;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Biztonsági beállítások
          </CardTitle>
          <CardDescription>Jelszó és biztonsági opciók</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <Button variant="outline" className="w-full justify-start" onClick={onChangePassword}>
              Jelszó megváltoztatása
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={onChangeEmail}>
              Email cím megváltoztatása
            </Button>
            <Button variant="outline" className="w-full justify-start opacity-50" disabled>
              Kétfaktoros hitelesítés beállítása (hamarosan)
            </Button>
            <Button variant="outline" className="w-full justify-start opacity-50" disabled>
              Aktív munkamenetek megtekintése (hamarosan)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AVDH Certificate Card — only in Accounty */}
      {showAvdh && (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PenTool className="h-5 w-5" />
                Aláírási tanúsítvány
              </CardTitle>
              <CardDescription>AVDH-megerősítés — Azonosításra Visszavezetett Dokumentum Hitelesítés</CardDescription>
            </div>
            <Badge variant="outline" className={`${currentStatus.color} border-0 gap-1.5 px-2.5 py-1`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {currentStatus.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Info banner */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
              Az AVDH tanúsítvány lehetővé teszi NAV bevallások, hivatalos dokumentumok és szerződések jogérvényes elektronikus aláírását. 
              A tanúsítványt az <strong>Ügyfélkapu+</strong> rendszeren keresztül igényelheti.
            </p>
          </div>

          {avdhStatus === 'none' ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  onClick={handleAvdhUpload}
                  disabled={uploading}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Feltöltés...' : 'Tanúsítvány feltöltése'}
                </Button>
                <Button variant="outline" className="gap-2" asChild>
                  <a href="https://niszavdh.gov.hu" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    AVDH portál megnyitása
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Elfogadott formátumok: .p12, .pfx, .pem — A feltöltött tanúsítvány titkosítva kerül tárolásra.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Certificate details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Tanúsítvány tulajdonos</p>
                  <p className="text-sm font-semibold">{avdhName}</p>
                </div>
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Érvényesség</p>
                  <p className="text-sm font-semibold">
                    {avdhExpiry ? new Date(avdhExpiry).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' }) : '–'}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Típus</p>
                  <p className="text-sm font-semibold">AVDH minősített</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button variant="outline" onClick={handleAvdhUpload} disabled={uploading} className="gap-2">
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Feltöltés...' : 'Tanúsítvány cseréje'}
                </Button>
                <Button variant="outline" className="gap-2" asChild>
                  <a href="https://niszavdh.gov.hu" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    AVDH portál
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Adatok kezelése
          </CardTitle>
          <CardDescription>Export és törlési opciók</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <Button variant="outline" className="w-full justify-start" onClick={onExportData} disabled={exportLoading}>
              <Download className="mr-2 h-4 w-4" />
              {exportLoading ? 'Exportálás...' : 'Adatok exportálása'}
            </Button>
            <Button variant="destructive" className="w-full justify-start opacity-50" disabled>
              Fiók törlése (hamarosan)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
