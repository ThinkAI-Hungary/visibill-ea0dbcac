import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, FileText, Download } from 'lucide-react';

interface Props {
  onChangePassword: () => void;
  onExportData: () => void;
  exportLoading: boolean;
}

export function SecuritySection({ onChangePassword, onExportData, exportLoading }: Props) {
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
            <Button variant="outline" className="w-full justify-start opacity-50" disabled>
              Kétfaktoros hitelesítés beállítása (hamarosan)
            </Button>
            <Button variant="outline" className="w-full justify-start opacity-50" disabled>
              Aktív munkamenetek megtekintése (hamarosan)
            </Button>
          </div>
        </CardContent>
      </Card>

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
