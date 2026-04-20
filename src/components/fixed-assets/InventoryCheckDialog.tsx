import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldCheck, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { ASSET_STATUS_LABELS, ASSET_STATUS_COLORS } from '@/types/fixed-assets';
import type { FixedAsset } from '@/types/fixed-assets';

interface InventoryCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: FixedAsset[];
}

export function InventoryCheckDialog({ open, onOpenChange, assets }: InventoryCheckDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Only active assets for inventory
  const activeAssets = useMemo(() => assets.filter(a => a.status === 'active'), [assets]);

  const filtered = useMemo(() => {
    if (!search) return activeAssets;
    const s = search.toLowerCase();
    return activeAssets.filter(a =>
      a.name.toLowerCase().includes(s) ||
      a.inventory_number.toLowerCase().includes(s) ||
      (a.location?.name || '').toLowerCase().includes(s)
    );
  }, [activeAssets, search]);

  const toggleAsset = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (checkedIds.size === filtered.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filtered.map(a => a.id)));
    }
  };

  const handleSubmit = async () => {
    if (!user || !selectedCompany || checkedIds.size === 0) return;
    setSubmitting(true);

    try {
      const events = Array.from(checkedIds).map(assetId => ({
        asset_id: assetId,
        company_id: selectedCompany.id,
        user_id: user.id,
        event_type: 'inventory_check' as const,
        event_date: new Date().toISOString().split('T')[0],
        description: 'Leltár — Fellelve ✅',
      }));

      const { error } = await supabase
        .from('asset_events')
        .insert(events);

      if (error) throw error;

      // Mark missing: active assets NOT checked
      const missingIds = activeAssets
        .filter(a => !checkedIds.has(a.id))
        .map(a => a.id);

      if (missingIds.length > 0) {
        const { error: updateError } = await supabase
          .from('fixed_assets')
          .update({ status: 'missing', updated_at: new Date().toISOString() })
          .in('id', missingIds);

        if (updateError) console.error('Missing status update error:', updateError);

        // Log missing events
        const missingEvents = missingIds.map(assetId => ({
          asset_id: assetId,
          company_id: selectedCompany.id,
          user_id: user.id,
          event_type: 'inventory_check' as const,
          event_date: new Date().toISOString().split('T')[0],
          description: 'Leltár — Nem fellelve ❌',
        }));

        await supabase.from('asset_events').insert(missingEvents);
      }

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['fixedAssets', selectedCompany.id] });
      activeAssets.forEach(a => queryClient.invalidateQueries({ queryKey: ['fixedAssetDetail', a.id] }));

      const foundCount = checkedIds.size;
      const missingCount = missingIds.length;

      toast({
        title: 'Leltár rögzítve',
        description: `${foundCount} fellelve${missingCount > 0 ? `, ${missingCount} hiányzik` : ''}.`,
      });

      onOpenChange(false);
      setCheckedIds(new Set());
      setSearch('');
    } catch (error: any) {
      toast({ title: 'Hiba', description: error?.message || 'Leltár rögzítése sikertelen.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const allChecked = filtered.length > 0 && checkedIds.size === filtered.length;
  const foundCount = checkedIds.size;
  const missingCount = activeAssets.length - checkedIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Leltár Ellenőrzés
          </DialogTitle>
          <DialogDescription>
            Jelöld be a fizikailag fellelve eszközöket. A nem kijelölt eszközök "Hiányzik" státuszt kapnak.
          </DialogDescription>
        </DialogHeader>

        {/* Summary bar */}
        <div className="flex gap-3 text-sm">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Fellelve: {foundCount}
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            Hiányzik: {missingCount > 0 ? missingCount : 0}
          </div>
          <div className="text-muted-foreground px-2 py-1.5">
            Összesen: {activeAssets.length} aktív eszköz
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Keresés leltári szám, név vagy helyszín alapján..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto rounded-lg border border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-10">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead className="font-semibold">Leltári Szám</TableHead>
                <TableHead className="font-semibold">Megnevezés</TableHead>
                <TableHead className="font-semibold">Helyszín</TableHead>
                <TableHead className="text-center font-semibold w-[80px]">Státusz</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(asset => (
                <TableRow
                  key={asset.id}
                  className={checkedIds.has(asset.id) ? 'bg-success/5' : ''}
                >
                  <TableCell>
                    <Checkbox
                      checked={checkedIds.has(asset.id)}
                      onCheckedChange={() => toggleAsset(asset.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{asset.inventory_number}</TableCell>
                  <TableCell className="font-medium">{asset.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{asset.location?.name || '-'}</TableCell>
                  <TableCell className="text-center">
                    {checkedIds.has(asset.id) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                        <CheckCircle2 className="h-3 w-3" />
                        OK
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ASSET_STATUS_COLORS[asset.status]}`}>
                        {ASSET_STATUS_LABELS[asset.status]}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || checkedIds.size === 0}
            className="gap-2"
          >
            <ShieldCheck className="h-4 w-4" />
            {submitting ? 'Rögzítés...' : `Leltár rögzítése (${foundCount} fellelve)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
