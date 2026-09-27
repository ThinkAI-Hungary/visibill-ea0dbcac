import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus,
  Search,
  FileSpreadsheet,
  Download,
  Upload,
  Eye,
  Filter,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  Sparkles,
  Wheat,
  FileText,
  AlertCircle,
  Coins,
  CreditCard,
  Banknote,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useFilePreview, FilePreviewModal } from '@/components/ui/FilePreviewModal';
import { usePurchaseVouchers } from '../hooks/usePurchaseVouchers';
import { PurchaseVoucherKpiCards } from './PurchaseVoucherKpiCards';
import { PurchaseVoucherDialog } from './PurchaseVoucherDialog';
import { PurchaseVoucher } from '../types';

export const PurchaseVouchersTab: React.FC = () => {
  const {
    vouchers,
    summary,
    isLoading,
    isFeatureEnabled,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    enableFeatureMutation,
    saveVoucherMutation,
    deleteVoucherMutation,
    togglePaymentStatusMutation,
    uploadVouchersMutation,
  } = usePurchaseVouchers();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<PurchaseVoucher | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { previewFile, openPreview, closePreview } = useFilePreview();

  const handleOpenAdd = () => {
    setEditingVoucher(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (v: PurchaseVoucher) => {
    setEditingVoucher(v);
    setDialogOpen(true);
  };

  const handleDownloadSampleCsv = () => {
    const csvContent =
      'bizonylatszam;ostermelo_neve;adoazonosito;ostermeloi_igazolvany;datum;fizetesi_mod;termeny_megnevezes;mennyiseg;egyseg;egysegar;kompenzacios_felar_szazalek\n' +
      'FJ-2026/001;Kovács János;8412345678;FELIR-019283;2026-03-10;TRANSFER;Étkezési búza;2500;kg;85;12\n' +
      'FJ-2026/002;Szabó István;8398765432;1234567;2026-03-15;CASH;Hízósertés;1200;kg;620;7\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'felvasarlasi_jegy_minta.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // If feature is disabled for this company, show an informative activation banner/card
  if (!isFeatureEnabled) {
    return (
      <Card className="border border-emerald-500/30 bg-emerald-500/5 p-6 rounded-2xl space-y-4 max-w-3xl mx-auto my-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 shrink-0">
            <Wheat className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              Mezőgazdasági Felvásárlási Jegyek Modul
              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 bg-emerald-500/10">
                Opcionális agrár modul
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ez a modul mezőgazdasági őstermelőktől történő termény-, állat- és alapanyag-felvásárlást végző cégek számára készült. 
              Kezeli a szigorú számadású felvásárlási jegyeket, a jogszabályi kompenzációs felárat (12% növénytermesztés, 7% állattenyésztés), 
              és előkészíti az adatokat a havi NAV 08-as bérügyi adatszolgáltatáshoz és a banki utalási csomaghoz.
            </p>
            <div className="pt-2 flex items-center gap-3">
              <Button
                onClick={() => enableFeatureMutation.mutate(true)}
                disabled={enableFeatureMutation.isPending}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 shadow-xs"
              >
                {enableFeatureMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Modul aktiválása ehhez a céghez</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSampleCsv}
                className="text-xs h-9 gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Minta fájl letöltése
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. KPI Összesítő Kártyák */}
      <PurchaseVoucherKpiCards summary={summary} />

      {/* 2. Kereső, Szűrő és Műveleti Sáv */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border/60">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Keresőmező */}
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Keresés bizonylatra, őstermelőre..."
              className="h-8.5 text-xs pl-8 bg-background focus:border-primary"
            />
          </div>

          {/* Státusz Szűrő Gombok */}
          <div className="flex items-center gap-1 bg-background p-0.5 rounded-lg border border-border/60 text-xs">
            <Button
              size="sm"
              variant={statusFilter === 'all' ? 'secondary' : 'ghost'}
              onClick={() => setStatusFilter('all')}
              className="h-7 px-2.5 text-xs font-medium"
            >
              Mind ({vouchers.length})
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'unpaid' ? 'secondary' : 'ghost'}
              onClick={() => setStatusFilter('unpaid')}
              className={cn("h-7 px-2.5 text-xs font-medium", statusFilter === 'unpaid' && "text-amber-600 dark:text-amber-400 font-bold")}
            >
              Kifizetésre vár
            </Button>
            <Button
              size="sm"
              variant={statusFilter === 'paid' ? 'secondary' : 'ghost'}
              onClick={() => setStatusFilter('paid')}
              className={cn("h-7 px-2.5 text-xs font-medium", statusFilter === 'paid' && "text-emerald-600 dark:text-emerald-400 font-bold")}
            >
              Kifizetve
            </Button>
          </div>
        </div>

        {/* Jobb oldali Akciógombok */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                uploadVouchersMutation.mutate(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadVouchersMutation.isPending}
            className="h-8.5 text-xs gap-1.5 font-medium hover:text-foreground border-border/80"
          >
            {uploadVouchersMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>Felvásárlási jegy feltöltése</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadSampleCsv}
            className="h-8.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Download className="w-3.5 h-3.5" /> Minta CSV
          </Button>
          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="h-8.5 text-xs gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            <Plus className="w-4 h-4" /> Új felvásárlási jegy
          </Button>
        </div>
      </div>

      {/* 3. Bizonylatok Táblázata */}
      <div className="border border-border/60 rounded-xl overflow-hidden bg-card shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-muted/80 border-b border-border/60 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3 text-left w-32">Bizonylatszám</th>
                <th className="py-2.5 px-3 text-left w-24">Teljesítés</th>
                <th className="py-2.5 px-3 text-left min-w-[200px]">Őstermelő / Adószám</th>
                <th className="py-2.5 px-3 text-left min-w-[180px]">Termény / Tételek</th>
                <th className="py-2.5 px-3 text-right w-28">Nettó érték</th>
                <th className="py-2.5 px-3 text-right w-28">Komp. felár</th>
                <th className="py-2.5 px-3 text-right w-32">Kifizetendő</th>
                <th className="py-2.5 px-3 text-center w-28">Fizetési mód</th>
                <th className="py-2.5 px-3 text-center w-28">Státusz</th>
                <th className="py-2.5 px-2 text-center w-20">Művelet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    <span>Felvásárlási jegyek betöltése...</span>
                  </td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-muted-foreground">
                    <Wheat className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="font-semibold text-foreground">Nincs felvásárlási jegy a kiválasztott időszakban</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Rögzíts új felvásárlási jegyet a fenti zöld gombbal.
                    </p>
                  </td>
                </tr>
              ) : (
                vouchers.map((v) => {
                  const isPaid = v.payment_status === 'paid';
                  const itemsSummary = v.items && v.items.length > 0
                    ? v.items.map(i => `${i.item_name} (${i.quantity} ${i.unit_of_measure})`).join(', ')
                    : v.description || 'Felvásárolt termény';

                  return (
                    <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                      {/* Bizonylatszám */}
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{v.voucher_number}</span>
                          {v.document_url && (
                            <button
                              type="button"
                              onClick={() => openPreview({ url: v.document_url!, name: `${v.voucher_number}.pdf` })}
                              className="text-primary/70 hover:text-primary transition-colors cursor-pointer"
                              title="Bizonylat megtekintése"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Dátum */}
                      <td className="py-2.5 px-3 font-mono text-muted-foreground">
                        {v.fulfillment_date}
                      </td>

                      {/* Őstermelő adatai */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-foreground">{v.producer_name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                          {v.producer_tax_id && <span>{v.producer_tax_id}</span>}
                          {v.producer_card_number && (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                              {v.producer_card_number}
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Tételek */}
                      <td className="py-2.5 px-3 text-muted-foreground truncate max-w-xs" title={itemsSummary}>
                        {itemsSummary}
                      </td>

                      {/* Nettó */}
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                        {formatCurrency(Number(v.net_amount))}
                      </td>

                      {/* Kompenzációs felár */}
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        <div>+{formatCurrency(Number(v.compensation_surcharge_amount))}</div>
                        <div className="text-[10px] text-muted-foreground font-sans">
                          {v.compensation_surcharge_rate}%
                        </div>
                      </td>

                      {/* Bruttó kifizetendő */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground text-sm">
                        {formatCurrency(Number(v.gross_amount))}
                      </td>

                      {/* Fizetési mód */}
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant="secondary" className="gap-1 text-[10px] font-medium py-0.5">
                          {v.payment_method === 'CASH' ? (
                            <>
                              <Banknote className="w-3 h-3 text-amber-500" />
                              <span>Pénztár</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-3 h-3 text-blue-500" />
                              <span>Utalás</span>
                            </>
                          )}
                        </Badge>
                      </td>

                      {/* Státusz gomb (kattintásra vált) */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            togglePaymentStatusMutation.mutate({
                              voucherId: v.id,
                              newStatus: isPaid ? 'unpaid' : 'paid',
                              amount: Number(v.gross_amount),
                            })
                          }
                          className="cursor-pointer transition-transform active:scale-95"
                          title="Kattints a kifizetési státusz átkapcsolásához"
                        >
                          {isPaid ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 gap-1 text-[10px] font-semibold py-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Kifizetve
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10 gap-1 text-[10px] font-semibold py-0.5">
                              <Clock className="w-3 h-3" /> {v.payment_method === 'TRANSFER' ? 'Utalásra vár' : 'Kifizetésre vár'}
                            </Badge>
                          )}
                        </button>
                      </td>

                      {/* Műveletek */}
                      <td className="py-2.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {v.document_url && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => openPreview({ url: v.document_url!, name: `${v.voucher_number}.pdf` })}
                              className="h-7 w-7 text-muted-foreground hover:text-primary"
                              title="Bizonylat előnézete"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOpenEdit(v)}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Szerkesztés"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Biztosan törlöd a(z) ${v.voucher_number} számú felvásárlási jegyet?`)) {
                                deleteVoucherMutation.mutate(v.id);
                              }
                            }}
                            className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                            title="Törlés"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Rögzítő / Szerkesztő Dialógus */}
      <PurchaseVoucherDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        voucher={editingVoucher}
        onSave={saveVoucherMutation.mutateAsync}
        isLoading={saveVoucherMutation.isPending}
      />

      {/* 5. Fájl előnézet Modal */}
      <FilePreviewModal
        previewFile={previewFile}
        onClose={closePreview}
      />
    </div>
  );
};
