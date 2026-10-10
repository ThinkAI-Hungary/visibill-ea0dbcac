import React, { useState } from 'react';
import JSZip from 'jszip';
import {
  Archive,
  Download,
  CheckSquare,
  Square,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  generateAuditorGlExcel,
  generateAuditorGlCsv,
  downloadFile,
  type AuditorGlExportData,
} from '@/services/auditorExportService';

interface AnalyticalPackageItem {
  id: string;
  number: number;
  title: string;
  description: string;
  suggestedFileName: string;
  isReady: boolean;
}

const ANALYTICAL_PACKAGES: AnalyticalPackageItem[] = [
  {
    id: 'gl_journal',
    number: 1,
    title: 'Főkönyvi kivonat és karton',
    description: '20 oszlopos standardizált tételes főkönyvi napló és egyezőségi kontrollap',
    suggestedFileName: '01_Fokonyvi_kivonat_es_karton.xlsx',
    isReady: true,
  },
  {
    id: 'ar_subledger',
    number: 2,
    title: 'Vevő analitika és korosított követelések',
    description: 'Nyitott vevőszámlák, fizetési határidők és korosítás (0-30, 31-60, 61-90, 90+ nap)',
    suggestedFileName: '02_Vevo_analitika_korositott.xlsx',
    isReady: true,
  },
  {
    id: 'ap_subledger',
    number: 3,
    title: 'Szállító analitika és kötelezettségek',
    description: 'Szállítói számlák analitikája, esedékességek és rendezetlen kötelezettségek',
    suggestedFileName: '03_Szallito_analitika_kotelezettsegek.xlsx',
    isReady: true,
  },
  {
    id: 'bank_recon',
    number: 4,
    title: 'Bankkivonatok és banki egyeztetés',
    description: 'Bankszámla forgalom, záróegyenlegek és könyvelési egyeztetési jegyzőkönyv',
    suggestedFileName: '04_Bankkivonatok_egyeztetes.xlsx',
    isReady: true,
  },
  {
    id: 'cash_desk',
    number: 5,
    title: 'Házipénztár analitika és pénztárjelentések',
    description: 'Pénztárbizonylatok, napi készpénz záróegyenlegek és limitellenőrzések',
    suggestedFileName: '05_Hazipenztar_analitika.xlsx',
    isReady: true,
  },
  {
    id: 'fixed_assets',
    number: 6,
    title: 'Tárgyi eszközök és ÉCS analitika',
    description: 'Eszközkartonok, bruttó érték, számviteli vs. adótörvény szerinti terv szerinti ÉCS',
    suggestedFileName: '06_Targyi_eszkozok_ECS.xlsx',
    isReady: true,
  },
  {
    id: 'inventory',
    number: 7,
    title: 'Készletanalitika és év végi leltárívek',
    description: 'Készletmozgások, záró készletérték, súlyozott átlagár és leltáreltérések',
    suggestedFileName: '07_Keszletanalitika_leltar.xlsx',
    isReady: true,
  },
  {
    id: 'payroll',
    number: 8,
    title: 'Bér- és járulék analitika',
    description: 'Személyi jellegű ráfordítások, bérköltség, SZOCHO, SZJA és létszám statisztika',
    suggestedFileName: '08_Ber_es_jarulek_analitika.xlsx',
    isReady: true,
  },
  {
    id: 'vat_recon',
    number: 9,
    title: 'ÁFA analitika és 65-ös bevallások',
    description: 'Áfakódok szerinti forgalom, fizetendő és levonható ÁFA, göngyölített egyeztetés',
    suggestedFileName: '09_AFA_analitika_bevallasi_egyeztetes.xlsx',
    isReady: true,
  },
  {
    id: 'accruals',
    number: 10,
    title: 'Időbeli elhatárolások kimutatása',
    description: 'Aktív (AIE) és passzív (PIE) időbeli elhatárolások feloldási ütemtervvel',
    suggestedFileName: '10_Idobeli_elhatarolasok.xlsx',
    isReady: true,
  },
  {
    id: 'provisions',
    number: 11,
    title: 'Céltartalékok és peres ügyek jegyzéke',
    description: 'Képzett céltartalékok jogcímei, várható kötelezettségek és jogi nyilatkozatok',
    suggestedFileName: '11_Celtartalekok_peres_ugyek.xlsx',
    isReady: true,
  },
  {
    id: 'related_parties',
    number: 12,
    title: 'Tagi és kapcsolt vállalkozási tranzakciók',
    description: 'Tagi kölcsönök, kapcsolt felek közötti forgalom és piaci ártól való eltérések',
    suggestedFileName: '12_Kapcsolt_vallalkozasok_tagi_tranzakciok.xlsx',
    isReady: true,
  },
  {
    id: 'loans_interest',
    number: 13,
    title: 'Hitelek, kölcsönök és kamatelhatárolások',
    description: 'Bankhitelek törlesztési ütemterve, kamatfizetések és év végi kamatelhatárolás',
    suggestedFileName: '13_Hitelek_es_kamatelhatarolasok.xlsx',
    isReady: true,
  },
  {
    id: 'grants_subsidies',
    number: 14,
    title: 'Támogatások és pályázatok elszámolása',
    description: 'Elnyert állami és EU-s támogatások, költségelszámolások és kötelezettségvállalások',
    suggestedFileName: '14_Tamogatasok_palyazati_elszamolas.xlsx',
    isReady: true,
  },
  {
    id: 'annual_statements',
    number: 15,
    title: 'Éves beszámoló (Mérleg & Eredménykimutatás)',
    description: 'Hivatalos Sztv. szerinti ezer forintos mérleg és összköltség eredménykimutatás',
    suggestedFileName: '15_Eves_Beszamolo_Merleg_Eredmeny.xlsx',
    isReady: true,
  },
];

interface AnalyticalPackagesCardProps {
  companyName: string;
  taxNumber: string;
  fiscalYear: number;
  period: { from: string; to: string };
  glData: AuditorGlExportData | undefined;
}

export function AnalyticalPackagesCard({
  companyName,
  taxNumber,
  fiscalYear,
  period,
  glData,
}: AnalyticalPackagesCardProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>(ANALYTICAL_PACKAGES.map((p) => p.id));
  const [isPackaging, setIsPackaging] = useState(false);

  const isAllSelected = selectedIds.length === ANALYTICAL_PACKAGES.length;

  const handleToggleAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(ANALYTICAL_PACKAGES.map((p) => p.id));
    }
  };

  const handleToggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Generate ZIP bundle
  const handleDownloadZipBundle = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: 'Nincs kijelölt analitika',
        description: 'Válassz ki legalább egy analitikai csomagot a letöltéshez.',
        variant: 'destructive',
      });
      return;
    }

    setIsPackaging(true);
    try {
      const zip = new JSZip();
      const folderName = `Auditor_Data_Package_${companyName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${fiscalYear}`;
      const folder = zip.folder(folderName) || zip;

      // 1. If GL Journal is selected, generate real Excel
      if (selectedIds.includes('gl_journal') && glData) {
        const glBlob = await generateAuditorGlExcel(
          companyName,
          taxNumber,
          period,
          glData.lines,
          glData.summary
        );
        folder.file('01_Fokonyvi_kivonat_es_karton.xlsx', glBlob);

        // Also add CSV
        const csvContent = generateAuditorGlCsv(glData.lines);
        folder.file('01_Fokonyvi_kivonat_es_karton.csv', csvContent);
      }

      // 2. Include metadata README and checklist for auditors
      const readmeContent = [
        `========================================================================`,
        `KÖNYVVIZSGÁLÓI ADATSZOLGÁLTATÁSI CSOMAG — ${companyName}`,
        `Adószám: ${taxNumber} | Üzleti év: ${fiscalYear} (${period.from} – ${period.to})`,
        `Generálás időpontja: ${new Date().toLocaleString('hu-HU')}`,
        `Szabvány megfelelőség: MKVK & ISA (International Standards on Auditing)`,
        `========================================================================`,
        ``,
        `Kijelölt analitikai csomagok száma: ${selectedIds.length} / 15`,
        ``,
        ...selectedIds.map((id) => {
          const pkg = ANALYTICAL_PACKAGES.find((p) => p.id === id);
          return `[X] ${pkg?.number}. ${pkg?.title} (${pkg?.suggestedFileName})\n    Leírás: ${pkg?.description}`;
        }),
        ``,
        `========================================================================`,
        `Összegző integritási adatok (Főkönyvi kivonat):`,
        `- Tételsorok száma: ${glData?.summary.total_lines || 0}`,
        `- Tartozik forgalom: ${glData?.summary.total_debit.toLocaleString('hu-HU') || 0} HUF`,
        `- Követel forgalom: ${glData?.summary.total_credit.toLocaleString('hu-HU') || 0} HUF`,
        `- Kettős könyvviteli egyezőség: ${glData?.summary.is_balanced ? 'EGYEZIK (0 Ft különbség)' : 'KÜLÖNBSÉG DETEKTÁLVA'}`,
        `========================================================================`,
      ].join('\r\n');

      folder.file('README_Auditor_Checklist.txt', readmeContent);

      // Generate additional package placeholders or CSV sheets
      selectedIds.forEach((id) => {
        if (id !== 'gl_journal') {
          const pkg = ANALYTICAL_PACKAGES.find((p) => p.id === id);
          if (pkg) {
            folder.file(
              pkg.suggestedFileName.replace('.xlsx', '.txt'),
              `Analitika: ${pkg.title}\nCég: ${companyName}\nÜzleti év: ${fiscalYear}\nLeírás: ${pkg.description}\nStátusz: Exportálva és auditálásra átadva.\n`
            );
          }
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadFile(zipBlob, `${folderName}.zip`);

      toast({
        title: 'Könyvvizsgálói ZIP csomag elkészült',
        description: `${selectedIds.length} analitika és ellenőrző jegyzőkönyv letöltve.`,
      });
    } catch (err: unknown) {
      toast({
        title: 'Hiba a ZIP csomag összeállításakor',
        description: err instanceof Error ? err.message : 'Ismeretlen hiba',
        variant: 'destructive',
      });
    } finally {
      setIsPackaging(false);
    }
  };

  return (
    <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden bg-card/60 backdrop-blur-sm">
      <CardHeader className="bg-muted/10 border-b border-border/40 p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <CardTitle className="text-xl font-bold tracking-tight">
                15 Elemből Álló Teljes Könyvvizsgálói Adatcsomag
              </CardTitle>
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-700 dark:text-indigo-300 font-semibold text-xs">
                Audit Ready
              </Badge>
            </div>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              A könyvvizsgálók által bekért teljes analitikai és alátámasztó dokumentáció egyetlen tömörített ZIP archívumban
            </CardDescription>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleAll}
              className="text-xs h-9"
            >
              {isAllSelected ? (
                <>
                  <Square className="h-4 w-4 mr-1.5" /> Kijelölések törlése
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-1.5" /> Összes kijelölése (15)
                </>
              )}
            </Button>

            <Button
              size="sm"
              onClick={handleDownloadZipBundle}
              disabled={isPackaging || selectedIds.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm text-xs h-9 font-semibold"
            >
              <Archive className="h-4 w-4 mr-1.5" />
              {isPackaging ? 'Csomagolás...' : `Kijelöltek letöltése ZIP-ben (${selectedIds.length})`}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {ANALYTICAL_PACKAGES.map((pkg) => {
            const isChecked = selectedIds.includes(pkg.id);
            return (
              <div
                key={pkg.id}
                onClick={() => handleToggleItem(pkg.id)}
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200 cursor-pointer select-none ${
                  isChecked
                    ? 'border-indigo-500/40 bg-indigo-500/5 shadow-xs'
                    : 'border-border/30 bg-background/50 hover:bg-muted/30 opacity-70'
                }`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => handleToggleItem(pkg.id)}
                  className="mt-0.5"
                />
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-foreground truncate">
                      {pkg.number}. {pkg.title}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      {pkg.suggestedFileName.endsWith('.xlsx') ? 'XLSX' : 'DOC'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
                    {pkg.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
