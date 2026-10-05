import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDevelopmentReserves, useCreateDevelopmentReserve, useDeleteDevelopmentReserve } from '@/hooks/useDevelopmentReserves';
import { useCompany } from '@/contexts/CompanyContext';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ContentSkeleton } from '@/components/ui/content-skeleton';
import { toast } from '@/hooks/use-toast';
import { PlusCircle, Search, PiggyBank, Calendar, Clock, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import type { DevelopmentReserve } from '@/types/fixed-assets';

export function DevelopmentReservesTab() {
  const { t } = useTranslation(['hr', 'common']);
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const { data: reserves = [], isLoading } = useDevelopmentReserves(companyId);
  const createReserve = useCreateDevelopmentReserve();
  const deleteReserve = useDeleteDevelopmentReserve();

  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'exhausted' | 'expired'>('all');

  // Form states for new reserve modal
  const [creationYear, setCreationYear] = useState<number>(new Date().getFullYear());
  const [reserveAmount, setReserveAmount] = useState<string>('');
  const [expirationDate, setExpirationDate] = useState<string>(`${new Date().getFullYear() + 4}-12-31`);
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Automatically update expiration date when creationYear changes
  const handleYearChange = (year: number) => {
    setCreationYear(year);
    setExpirationDate(`${year + 4}-12-31`);
  };

  const handleCreate = async () => {
    if (!companyId) return;
    const amount = parseFloat(reserveAmount);
    if (!amount || amount <= 0) {
      toast({
        title: t('common:status.error', 'Hiba'),
        description: t('hr:fixed_assets.dev_reserves.invalid_amount', 'Kérjük adjon meg egy érvényes összeget!'),
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await createReserve.mutateAsync({
        companyId,
        creationYear,
        reserveAmount: amount,
        expirationDate,
        description: description.trim() || undefined,
      });

      toast({
        title: t('hr:fixed_assets.dev_reserves.toast_create_success_title', 'Sikeres rögzítés'),
        description: t('hr:fixed_assets.dev_reserves.toast_create_success_desc', {
          defaultValue: `${creationYear}. évi fejlesztési tartalék elmentve.`,
          year: creationYear,
        }),
      });
      setModalOpen(false);
      setReserveAmount('');
      setDescription('');
    } catch (err: any) {
      toast({
        title: t('hr:fixed_assets.dev_reserves.toast_create_error_title', 'Hiba a mentés során'),
        description: err?.message || t('common:status.error', 'Nem sikerült elmenteni a tartalékot'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reserve: DevelopmentReserve) => {
    if (!companyId) return;
    if (
      !window.confirm(
        t('hr:fixed_assets.dev_reserves.delete_confirm', {
          defaultValue: `Biztosan törölni szeretné a ${reserve.creation_year}. évi fejlesztési tartalékot?`,
          year: reserve.creation_year,
        })
      )
    )
      return;

    try {
      await deleteReserve.mutateAsync({ id: reserve.id, companyId });
      toast({ title: t('hr:fixed_assets.dev_reserves.toast_delete_success', 'Fejlesztési tartalék törölve') });
    } catch (err: any) {
      toast({
        title: t('hr:fixed_assets.dev_reserves.toast_delete_error', 'Törlés sikertelen'),
        description: err?.message || 'Nem sikerült törölni a tartalékot',
        variant: 'destructive',
      });
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    let total = 0;
    let utilized = 0;
    let remaining = 0;
    let nearestExp: string | null = null;

    reserves.forEach(r => {
      total += r.reserve_amount;
      utilized += r.utilized_amount || 0;
      remaining += r.remaining_amount || 0;

      if ((r.remaining_amount || 0) > 0 && r.status === 'active') {
        if (!nearestExp || r.expiration_date < nearestExp) {
          nearestExp = r.expiration_date;
        }
      }
    });

    return { total, utilized, remaining, nearestExp };
  }, [reserves]);

  // Filtered list
  const filtered = useMemo(() => {
    return reserves.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        String(r.creation_year).includes(s) ||
        (r.description && r.description.toLowerCase().includes(s))
      );
    });
  }, [reserves, statusFilter, search]);

  if (isLoading) {
    return (
      <div className="p-6">
        <ContentSkeleton  />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 page-animate">
      {/* 1. Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Reserves */}
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('hr:fixed_assets.dev_reserves.kpi_total', 'Képzett Tartalékok')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <PiggyBank className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-foreground">
            {formatCurrency(metrics.total, 'HUF')}
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            {t('hr:fixed_assets.dev_reserves.kpi_total_sub', 'Összes rögzített keret')}
          </span>
        </div>

        {/* Utilized on Fixed Assets */}
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('hr:fixed_assets.dev_reserves.kpi_utilized', 'Eszközökre Felhasznált')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">
            {formatCurrency(metrics.utilized, 'HUF')}
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            {metrics.total > 0
              ? `${Math.round((metrics.utilized / metrics.total) * 100)}% ${t('hr:fixed_assets.dev_reserves.utilized_suffix', 'felhasználva')}`
              : '0%'}
          </span>
        </div>

        {/* Remaining Capacity */}
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('hr:fixed_assets.dev_reserves.kpi_remaining', 'Szabad Keret')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold mt-2 text-amber-600 dark:text-amber-400">
            {formatCurrency(metrics.remaining, 'HUF')}
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            {t('hr:fixed_assets.dev_reserves.kpi_remaining_sub', 'Beruházásra fordítható még')}
          </span>
        </div>

        {/* Earliest Expiration */}
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('hr:fixed_assets.dev_reserves.kpi_next_expiry', 'Következő Határidő')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-xl font-bold mt-2 text-foreground">
            {metrics.nearestExp ? metrics.nearestExp.replace(/-/g, '.') : t('hr:fixed_assets.dev_reserves.kpi_no_expiry', 'Nincs lejáró keret')}
          </p>
          <span className="text-xs text-muted-foreground mt-1 block">
            {t('hr:fixed_assets.dev_reserves.kpi_tax_law_sub', 'Tao. tv. 4 éves jogvesztő határidő')}
          </span>
        </div>
      </div>

      {/* 2. Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t('hr:fixed_assets.dev_reserves.search_placeholder', 'Keresés év vagy megjegyzés...')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 text-sm h-9"
            />
          </div>
          <div className="flex rounded-md border border-border/60 bg-muted/30 p-0.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${statusFilter === 'all' ? 'bg-background shadow-xs font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('hr:fixed_assets.dev_reserves.filter_all', {
                defaultValue: `Mind (${reserves.length})`,
                count: reserves.length
              })}
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${statusFilter === 'active' ? 'bg-background shadow-xs font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('hr:fixed_assets.dev_reserves.filter_active', 'Aktív')}
            </button>
            <button
              onClick={() => setStatusFilter('exhausted')}
              className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${statusFilter === 'exhausted' ? 'bg-background shadow-xs font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t('hr:fixed_assets.dev_reserves.filter_exhausted', 'Kimerült')}
            </button>
          </div>
        </div>

        <Button
          onClick={() => setModalOpen(true)}
          className="gap-2 w-full sm:w-auto shrink-0"
          size="sm"
        >
          <PlusCircle className="h-4 w-4" />
          {t('hr:fixed_assets.dev_reserves.btn_new', 'Új fejlesztési tartalék')}
        </Button>
      </div>

      {/* 3. Table of Reserves */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <PiggyBank className="h-10 w-10 mx-auto opacity-30 mb-3" />
            <p className="font-medium">{t('hr:fixed_assets.dev_reserves.empty_title', 'Nincs megjeleníthető fejlesztési tartalék')}</p>
            <p className="text-xs mt-1">{t('hr:fixed_assets.dev_reserves.empty_desc', 'Rögzítsen egy új tartalék keretet a fenti gombra kattintva.')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[120px]">{t('hr:fixed_assets.dev_reserves.col_creation_year', 'Képzés Éve')}</TableHead>
                <TableHead className="w-[180px]">{t('hr:fixed_assets.dev_reserves.col_reserve_amount', 'Képzett Keret (Ft)')}</TableHead>
                <TableHead className="w-[220px]">{t('hr:fixed_assets.dev_reserves.col_usage', 'Felhasználtság')}</TableHead>
                <TableHead className="w-[180px]">{t('hr:fixed_assets.dev_reserves.col_remaining', 'Szabad Keret (Ft)')}</TableHead>
                <TableHead className="w-[140px]">{t('hr:fixed_assets.dev_reserves.col_expiration', 'Lejárat')}</TableHead>
                <TableHead className="w-[110px] text-center">{t('hr:fixed_assets.dev_reserves.col_status', 'Státusz')}</TableHead>
                <TableHead>{t('hr:fixed_assets.dev_reserves.col_notes', 'Megjegyzés')}</TableHead>
                <TableHead className="w-[60px] text-right">{t('hr:fixed_assets.dev_reserves.col_action', 'Művelet')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(r => {
                const pct = r.reserve_amount > 0 ? Math.min(100, Math.round(((r.utilized_amount || 0) / r.reserve_amount) * 100)) : 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-bold text-base">{r.creation_year}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(r.reserve_amount, 'HUF')}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{formatCurrency(r.utilized_amount || 0, 'HUF')}</span>
                          <span className="font-medium text-foreground">{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(r.remaining_amount || 0, 'HUF')}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.expiration_date.replace(/-/g, '.')}</TableCell>
                    <TableCell className="text-center">
                      {r.status === 'active' && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                          {t('hr:fixed_assets.dev_reserves.status_active', 'Aktív')}
                        </Badge>
                      )}
                      {r.status === 'exhausted' && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">
                          {t('hr:fixed_assets.dev_reserves.status_exhausted', 'Kimerült')}
                        </Badge>
                      )}
                      {r.status === 'expired' && (
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                          {t('hr:fixed_assets.dev_reserves.status_expired', 'Lejárt')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate" title={r.description || ''}>
                      {r.description || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(r)}
                        disabled={(r.utilized_amount || 0) > 0}
                        title={(r.utilized_amount || 0) > 0 ? t('hr:fixed_assets.dev_reserves.delete_disabled_tooltip', 'Nem törölhető, mert már használták fel belőle') : t('common:actions.delete', 'Törlés')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* 4. New Reserve Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('hr:fixed_assets.dev_reserves.modal_new_title', 'Új Fejlesztési Tartalék Rögzítése')}</DialogTitle>
            <DialogDescription>
              {t('hr:fixed_assets.dev_reserves.modal_new_desc', 'Rögzítse az adóév végén lekötött fejlesztési tartalék összegét a Tao. tv. 7. § (1) f) alapján.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="creation-year">{t('hr:fixed_assets.dev_reserves.modal_creation_year', 'Képzés Éve')}</Label>
                <Input
                  id="creation-year"
                  type="number"
                  min={2000}
                  max={2100}
                  value={creationYear}
                  onChange={e => handleYearChange(parseInt(e.target.value) || new Date().getFullYear())}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="expiration-date">{t('hr:fixed_assets.dev_reserves.modal_expiration_date', 'Felhasználási Határidő')}</Label>
                <Input
                  id="expiration-date"
                  type="date"
                  value={expirationDate}
                  onChange={e => setExpirationDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reserve-amount">{t('hr:fixed_assets.dev_reserves.modal_amount', 'Képzett Összeg (Ft)')}</Label>
              <Input
                id="reserve-amount"
                type="number"
                placeholder={t('hr:fixed_assets.dev_reserves.modal_amount_placeholder', 'pl. 10000000')}
                value={reserveAmount}
                onChange={e => setReserveAmount(e.target.value)}
              />
              <span className="text-[11px] text-muted-foreground">
                {t('hr:fixed_assets.dev_reserves.modal_amount_sub', 'A 414. Lekötött tartalék számlán rögzített összeg.')}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">{t('hr:fixed_assets.dev_reserves.modal_notes', 'Megjegyzés / Határozat száma')}</Label>
              <Input
                id="description"
                placeholder={t('hr:fixed_assets.dev_reserves.modal_notes_placeholder', 'pl. 2023. évi taggyűlési határozat szerinti tartalék')}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                {t('hr:fixed_assets.dev_reserves.modal_tax_rule', 'Fontos törvényi szabály: A fejlesztési tartalékból megvalósított tárgyi eszközök után a Tao. tv. 7. § (15) bek. szerint társasági adó szerinti értékcsökkenés (Tao ÉCS) nem számolható el!')}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {t('common:actions.cancel', 'Mégse')}
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? t('common:actions.saving', 'Mentés...') : t('hr:fixed_assets.dev_reserves.btn_save_reserve', 'Tartalék Mentése')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
