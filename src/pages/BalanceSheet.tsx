import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from '@/components/ui/context-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActivePreset } from '@/hooks/useActivePreset';
import { Loader2, Save, ChevronRight, ChevronDown, Download, FileText, CheckCircle2, AlertTriangle, Lock, Maximize2, Minimize2, ReceiptText, ClipboardCopy, Wand2, RefreshCw, Columns } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { FinancialPageSkeleton } from '@/components/ui/financial-skeleton';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { exportBsExcel } from '@/lib/bsExport';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { reportError } from '@/lib/errorReporter';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

// ── Default BS mapping rules based on Hungarian Sztv. "A" variant ──
// Maps GL account prefixes (class 1-4) to bs_structure arabic/roman leaf rows
const DEFAULT_BS_RULES: Array<{ prefix: string; bsId: string; label: string }> = [
  // 1. Befektetett eszközök
  // A/I. Immateriális javak
  { prefix: '111', bsId: '00000000-0000-0000-0001-000000000111', label: 'A/I/1. Alapítás-átszervezés' },
  { prefix: '112', bsId: '00000000-0000-0000-0001-000000000112', label: 'A/I/2. Kísérleti fejlesztés' },
  { prefix: '113', bsId: '00000000-0000-0000-0001-000000000113', label: 'A/I/3. Vagyoni értékű jogok' },
  { prefix: '114', bsId: '00000000-0000-0000-0001-000000000114', label: 'A/I/4. Szellemi termékek' },
  { prefix: '115', bsId: '00000000-0000-0000-0001-000000000115', label: 'A/I/5. Üzleti vagy cégérték' },
  { prefix: '116', bsId: '00000000-0000-0000-0001-000000000116', label: 'A/I/6. Immat. javak előleg' },
  { prefix: '117', bsId: '00000000-0000-0000-0001-000000000117', label: 'A/I/7. Immat. javak értékh.' },
  { prefix: '118', bsId: '00000000-0000-0000-0001-000000000111', label: 'A/I/1. (terv felüli ÉCS)' },
  { prefix: '119', bsId: '00000000-0000-0000-0001-000000000111', label: 'A/I/1. (értékvesztés)' },
  // A/II. Tárgyi eszközök
  { prefix: '121', bsId: '00000000-0000-0000-0001-000000000121', label: 'A/II/1. Földterület' },
  { prefix: '122', bsId: '00000000-0000-0000-0001-000000000121', label: 'A/II/1. Épületek' },
  { prefix: '123', bsId: '00000000-0000-0000-0001-000000000121', label: 'A/II/1. Épít. jogok' },
  { prefix: '124', bsId: '00000000-0000-0000-0001-000000000122', label: 'A/II/2. Műszaki berend.' },
  { prefix: '125', bsId: '00000000-0000-0000-0001-000000000123', label: 'A/II/3. Egyéb berend.' },
  { prefix: '126', bsId: '00000000-0000-0000-0001-000000000124', label: 'A/II/4. Tenyészállatok' },
  { prefix: '127', bsId: '00000000-0000-0000-0001-000000000125', label: 'A/II/5. Beruházások' },
  { prefix: '128', bsId: '00000000-0000-0000-0001-000000000126', label: 'A/II/6. Beruházás előleg' },
  { prefix: '129', bsId: '00000000-0000-0000-0001-000000000127', label: 'A/II/7. Tárgyi eszk. értékh.' },
  { prefix: '13', bsId: '00000000-0000-0000-0001-000000000121', label: 'A/II/1. Ingatlanok (ÉCS)' },
  { prefix: '14', bsId: '00000000-0000-0000-0001-000000000122', label: 'A/II/2. Műszaki (ÉCS)' },
  { prefix: '15', bsId: '00000000-0000-0000-0001-000000000123', label: 'A/II/3. Egyéb (ÉCS)' },
  { prefix: '16', bsId: '00000000-0000-0000-0001-000000000125', label: 'A/II/5. Beruházások (ÉCS)' },
  // A/III. Befektetett pénzügyi eszközök
  { prefix: '17', bsId: '00000000-0000-0000-0001-000000000131', label: 'A/III/1. Tartós részesedés' },
  { prefix: '18', bsId: '00000000-0000-0000-0001-000000000135', label: 'A/III/5. Egyéb tartós kölcsön' },
  { prefix: '19', bsId: '00000000-0000-0000-0001-000000000136', label: 'A/III/6. Tartós hitelvisz. ép.' },
  // 2. Készletek → B/I.
  { prefix: '211', bsId: '00000000-0000-0000-0001-000000000211', label: 'B/I/1. Anyagok' },
  { prefix: '212', bsId: '00000000-0000-0000-0001-000000000211', label: 'B/I/1. Anyagok' },
  { prefix: '214', bsId: '00000000-0000-0000-0001-000000000211', label: 'B/I/1. Anyagok' },
  { prefix: '21', bsId: '00000000-0000-0000-0001-000000000211', label: 'B/I/1. Anyagok' },
  { prefix: '22', bsId: '00000000-0000-0000-0001-000000000211', label: 'B/I/1. Anyagok' },
  { prefix: '23', bsId: '00000000-0000-0000-0001-000000000212', label: 'B/I/2. Befejezetlen term.' },
  { prefix: '24', bsId: '00000000-0000-0000-0001-000000000213', label: 'B/I/3. Növendékállatok' },
  { prefix: '25', bsId: '00000000-0000-0000-0001-000000000214', label: 'B/I/4. Késztermékek' },
  { prefix: '26', bsId: '00000000-0000-0000-0001-000000000215', label: 'B/I/5. Áruk' },
  { prefix: '27', bsId: '00000000-0000-0000-0001-000000000215', label: 'B/I/5. Áruk (közvetített)' },
  { prefix: '28', bsId: '00000000-0000-0000-0001-000000000216', label: 'B/I/6. Készletek előleg' },
  { prefix: '29', bsId: '00000000-0000-0000-0001-000000000211', label: 'B/I/1. (értékvesztés)' },
  // 3. Követelések, értékpapírok, pénzeszközök
  { prefix: '311', bsId: '00000000-0000-0000-0001-000000000221', label: 'B/II/1. Vevők' },
  { prefix: '312', bsId: '00000000-0000-0000-0001-000000000221', label: 'B/II/1. Vevők' },
  { prefix: '313', bsId: '00000000-0000-0000-0001-000000000221', label: 'B/II/1. Vevők' },
  { prefix: '314', bsId: '00000000-0000-0000-0001-000000000221', label: 'B/II/1. Vevők' },
  { prefix: '315', bsId: '00000000-0000-0000-0001-000000000221', label: 'B/II/1. Vevők' },
  { prefix: '316', bsId: '00000000-0000-0000-0001-000000000222', label: 'B/II/2. Követelés kapcsolt' },
  { prefix: '317', bsId: '00000000-0000-0000-0001-000000000223', label: 'B/II/3. Követelés egyéb rész.' },
  { prefix: '318', bsId: '00000000-0000-0000-0001-000000000221', label: 'B/II/1. Vevők (értékv.)' },
  { prefix: '319', bsId: '00000000-0000-0000-0001-000000000221', label: 'B/II/1. Vevők (értékv.)' },
  { prefix: '32', bsId: '00000000-0000-0000-0001-000000000224', label: 'B/II/4. Váltókövetelések' },
  { prefix: '33', bsId: '00000000-0000-0000-0001-000000000225', label: 'B/II/5. Egyéb követelések' },
  { prefix: '34', bsId: '00000000-0000-0000-0001-000000000225', label: 'B/II/5. Egyéb követelések' },
  { prefix: '35', bsId: '00000000-0000-0000-0001-000000000225', label: 'B/II/5. Egyéb követelések' },
  { prefix: '36', bsId: '00000000-0000-0000-0001-000000000225', label: 'B/II/5. Egyéb követelések' },
  // B/III. Értékpapírok
  { prefix: '371', bsId: '00000000-0000-0000-0001-000000000231', label: 'B/III/1. Részesedés kapcsolt' },
  { prefix: '372', bsId: '00000000-0000-0000-0001-000000000232', label: 'B/III/2. Egyéb részesedés' },
  { prefix: '373', bsId: '00000000-0000-0000-0001-000000000233', label: 'B/III/3. Saját részvények' },
  { prefix: '374', bsId: '00000000-0000-0000-0001-000000000234', label: 'B/III/4. Forg. célú ép.' },
  { prefix: '375', bsId: '00000000-0000-0000-0001-000000000234', label: 'B/III/4. Ép. elszámolási' },
  { prefix: '379', bsId: '00000000-0000-0000-0001-000000000235', label: 'B/III/5. Ép. értékv.' },
  // B/IV. Pénzeszközök
  { prefix: '381', bsId: '00000000-0000-0000-0001-000000000241', label: 'B/IV/1. Pénztár' },
  { prefix: '382', bsId: '00000000-0000-0000-0001-000000000241', label: 'B/IV/1. Valutapénztár' },
  { prefix: '383', bsId: '00000000-0000-0000-0001-000000000241', label: 'B/IV/1. Csekkek' },
  { prefix: '384', bsId: '00000000-0000-0000-0001-000000000242', label: 'B/IV/2. Betétszámla' },
  { prefix: '385', bsId: '00000000-0000-0000-0001-000000000242', label: 'B/IV/2. Elkülönített betét' },
  { prefix: '386', bsId: '00000000-0000-0000-0001-000000000242', label: 'B/IV/2. Devizabetét' },
  { prefix: '389', bsId: '00000000-0000-0000-0001-000000000242', label: 'B/IV/2. Átvezetési' },
  // C. Aktív időbeli elhatárolások
  { prefix: '391', bsId: '00000000-0000-0000-0001-000000000301', label: 'C/1. Bevétel aktív elhat.' },
  { prefix: '392', bsId: '00000000-0000-0000-0001-000000000302', label: 'C/2. Költség aktív elhat.' },
  { prefix: '393', bsId: '00000000-0000-0000-0001-000000000303', label: 'C/3. Halasztott ráford.' },
  { prefix: '399', bsId: '00000000-0000-0000-0001-000000000301', label: 'C/1. Aktív elhat. értékv.' },
  // 4. Források
  // D. Saját tőke
  { prefix: '411', bsId: '00000000-0000-0000-0001-000000001110', label: 'D/I. Jegyzett tőke' },
  { prefix: '412', bsId: '00000000-0000-0000-0001-000000001130', label: 'D/III. Tőketartalék' },
  { prefix: '413', bsId: '00000000-0000-0000-0001-000000001140', label: 'D/IV. Eredménytartalék' },
  { prefix: '414', bsId: '00000000-0000-0000-0001-000000001150', label: 'D/V. Lekötött tartalék' },
  { prefix: '417', bsId: '00000000-0000-0000-0001-000000001160', label: 'D/VI. Értékelési tartalék' },
  { prefix: '419', bsId: '00000000-0000-0000-0001-000000001170', label: 'D/VII. Mérleg sz. eredmény' },
  // E. Céltartalékok
  { prefix: '421', bsId: '00000000-0000-0000-0001-000000001201', label: 'E/1. Céltartalék kötelez.' },
  { prefix: '422', bsId: '00000000-0000-0000-0001-000000001202', label: 'E/2. Céltartalék jövőbeni' },
  { prefix: '429', bsId: '00000000-0000-0000-0001-000000001203', label: 'E/3. Egyéb céltartalék' },
  // F. Kötelezettségek
  { prefix: '431', bsId: '00000000-0000-0000-0001-000000001311', label: 'F/I/1. Hátrasorolt kapcsolt' },
  { prefix: '432', bsId: '00000000-0000-0000-0001-000000001312', label: 'F/I/2. Hátrasorolt egyéb r.' },
  { prefix: '433', bsId: '00000000-0000-0000-0001-000000001313', label: 'F/I/3. Hátrasorolt egyéb g.' },
  { prefix: '441', bsId: '00000000-0000-0000-0001-000000001321', label: 'F/II/1. Hosszú kölcsönök' },
  { prefix: '442', bsId: '00000000-0000-0000-0001-000000001322', label: 'F/II/2. Átváltoz. kötvény' },
  { prefix: '443', bsId: '00000000-0000-0000-0001-000000001323', label: 'F/II/3. Kötvénykibocsátás' },
  { prefix: '444', bsId: '00000000-0000-0000-0001-000000001324', label: 'F/II/4. Beruh. hitelek' },
  { prefix: '445', bsId: '00000000-0000-0000-0001-000000001325', label: 'F/II/5. Egyéb hosszú hitel' },
  { prefix: '446', bsId: '00000000-0000-0000-0001-000000001326', label: 'F/II/6. Tartós kapcs. köt.' },
  { prefix: '447', bsId: '00000000-0000-0000-0001-000000001327', label: 'F/II/7. Tartós egyéb r. köt.' },
  { prefix: '448', bsId: '00000000-0000-0000-0001-000000001328', label: 'F/II/8. Egyéb hosszú köt.' },
  { prefix: '449', bsId: '00000000-0000-0000-0001-000000001328', label: 'F/II/8. Egyéb hosszú köt.' },
  { prefix: '451', bsId: '00000000-0000-0000-0001-000000001331', label: 'F/III/1. Rövid kölcsönök' },
  { prefix: '452', bsId: '00000000-0000-0000-0001-000000001332', label: 'F/III/2. Rövid hitelek' },
  { prefix: '453', bsId: '00000000-0000-0000-0001-000000001333', label: 'F/III/3. Vevői előlegek' },
  { prefix: '454', bsId: '00000000-0000-0000-0001-000000001334', label: 'F/III/4. Szállítók' },
  { prefix: '455', bsId: '00000000-0000-0000-0001-000000001334', label: 'F/III/4. Beruh. szállítók' },
  { prefix: '456', bsId: '00000000-0000-0000-0001-000000001334', label: 'F/III/4. Faktoring tart.' },
  { prefix: '457', bsId: '00000000-0000-0000-0001-000000001335', label: 'F/III/5. Váltótartozások' },
  { prefix: '458', bsId: '00000000-0000-0000-0001-000000001336', label: 'F/III/6. Rövid kapcs. köt.' },
  { prefix: '459', bsId: '00000000-0000-0000-0001-000000001337', label: 'F/III/7. Rövid egyéb r. köt.' },
  { prefix: '46', bsId: '00000000-0000-0000-0001-000000001338', label: 'F/III/8. Egyéb rövid köt.' },
  { prefix: '47', bsId: '00000000-0000-0000-0001-000000001338', label: 'F/III/8. Egyéb rövid köt.' },
  // G. Passzív időbeli elhatárolások
  { prefix: '481', bsId: '00000000-0000-0000-0001-000000001401', label: 'G/1. Bevétel passzív elhat.' },
  { prefix: '482', bsId: '00000000-0000-0000-0001-000000001402', label: 'G/2. Költség passzív elhat.' },
  { prefix: '483', bsId: '00000000-0000-0000-0001-000000001403', label: 'G/3. Halasztott bevételek' },
  // 49. Záró számlák — nem kell mérlegbe (belső technikai)
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  BsMappingTab (P8: FinancialPageSkeleton)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function BsMappingTab({ presetId, isGenericPreset }: { presetId?: string; isGenericPreset?: boolean }) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

  const { data: bsStructure, isLoading: isLoadingStructure } = useQuery({
    queryKey: ['bs_structure'],
    queryFn: async () => {
      const { data, error } = await supabase.from('bs_structure').select('*').order('order_num');
      if (error) throw error;
      return data;
    }
  });

  const { data: glAccounts, isLoading: isLoadingGlAccounts } = useQuery({
    queryKey: ['gl_accounts_bs', presetId],
    queryFn: async () => {
      if (!presetId) return [];
      const { data, error } = await supabase.from('gl_accounts').select('*').eq('preset_id', presetId).order('gl_number');
      if (error) throw error;
      // Filter to 1-4 account classes only
      return (data || []).filter(a => /^[1-4]/.test(a.gl_number));
    },
    enabled: !!presetId
  });

  const { data: existingMappings, isLoading: isLoadingMappings } = useQuery({
    queryKey: ['bs_mapping', selectedCompany?.id, presetId],
    queryFn: async () => {
      if (!selectedCompany?.id || !presetId) return [];
      const { data, error } = await supabase.from('bs_mapping').select('*').eq('company_id', selectedCompany.id).eq('preset_id', presetId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && !!presetId
  });

  useEffect(() => {
    if (existingMappings) {
      const map: Record<string, string> = {};
      existingMappings.forEach(m => { map[m.gl_account_id] = m.bs_structure_id; });
      setMappings(map);
      setHasChanges(false);
    }
  }, [existingMappings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id || !presetId) throw new Error("Missing company or preset");
      const payload = Object.entries(mappings).map(([gl_account_id, bs_structure_id]) => ({ gl_account_id, bs_structure_id }));
      const { error } = await supabase.rpc('save_bs_mappings', { p_company_id: selectedCompany.id, p_preset_id: presetId, p_mappings: payload });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Sikeres mentés', description: 'A mérleg hozzárendelések frissítve.' });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['bs_mapping'] });
      queryClient.invalidateQueries({ queryKey: ['bs_report'] });
    },
    onError: (err: any) => { toast({ title: 'Hiba', description: err.message, variant: 'destructive' }); }
  });

  const handleSelectChange = (glAccountId: string, structureId: string) => {
    setMappings(prev => {
      const next = { ...prev };
      if (structureId === 'none') delete next[glAccountId]; else next[glAccountId] = structureId;
      return next;
    });
    setHasChanges(true);
  };

  const handleAutoAssign = () => {
    if (!glAccounts) return;
    const newMappings: Record<string, string> = { ...mappings };
    const cleanGl = (id: string) => id ? String(id).replace(/\./g, '') : '';
    let assignedCount = 0;

    glAccounts.forEach(gl => {
      const clean = gl.gl_number.split('-')[0].replace(/\./g, '');
      const hasChildren = glAccounts.some(other => {
        const otherClean = cleanGl(other.gl_number);
        return otherClean.startsWith(cleanGl(gl.gl_number)) && otherClean !== cleanGl(gl.gl_number);
      });
      if (hasChildren) return;

      let bestRule: typeof DEFAULT_BS_RULES[0] | null = null;
      for (const rule of DEFAULT_BS_RULES) {
        if (clean.startsWith(rule.prefix)) {
          if (!bestRule || rule.prefix.length > bestRule.prefix.length) {
            bestRule = rule;
          }
        }
      }
      if (bestRule) {
        newMappings[gl.id] = bestRule.bsId;
        assignedCount++;
      }
    });

    setMappings(newMappings);
    setHasChanges(true);
    toast({ title: 'Automatikus hozzárendelés kész', description: `${assignedCount} főkönyvi szám hozzárendelve a Sztv. "A" változat szerint. Ellenőrizd és mentsd el!` });
  };

  const toggleRow = (id: string, hasChildren: boolean) => {
    if (!hasChildren) return;
    setExpandedRowIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const expandAll = () => {
    if (!glAccounts) return;
    const allParents = glAccounts.filter(a => {
      const cid = a.gl_number ? String(a.gl_number).replace(/\./g, '') : '';
      return glAccounts.some(d => { const did = d.gl_number ? String(d.gl_number).replace(/\./g, '') : ''; return did.startsWith(cid) && did !== cid; });
    });
    setExpandedRowIds(new Set(allParents.map(a => a.id)));
  };

  const collapseAll = () => setExpandedRowIds(new Set());

  const processedAccounts = React.useMemo(() => {
    if (!glAccounts) return [];
    const cleanId = (id: string) => id ? String(id).replace(/\./g, '') : '';
    const rawData = glAccounts.map(dbItem => {
      const cid = cleanId(dbItem.gl_number);
      const hasChildren = glAccounts.some(d => cleanId(d.gl_number).startsWith(cid) && cleanId(d.gl_number) !== cid);
      return { ...dbItem, cid, hasChildren };
    });
    return rawData.map(item => {
      const ancestors = rawData.filter(a => item.cid.startsWith(a.cid) && a.cid !== item.cid);
      const isRoot = ancestors.length === 0;
      const depth = ancestors.length;
      const isVisibleOnScreen = isRoot || ancestors.every(a => expandedRowIds.has(a.id));
      return { ...item, isRoot, depth, isVisibleOnScreen };
    });
  }, [glAccounts, expandedRowIds]);

  // Build grouped dropdown items
  const dropdownGroups = React.useMemo(() => {
    if (!bsStructure) return { assets: [] as any[], liabilities: [] as any[] };
    const letterRows = bsStructure.filter(r => r.type === 'letter');
    const buildGroup = (section: string) => {
      return letterRows.filter(l => l.section === section).map(letter => {
        const romanRows = bsStructure.filter(r => r.parent_id === letter.id && r.type === 'roman');
        const leafRows: any[] = [];
        romanRows.forEach(roman => {
          const arabicChildren = bsStructure.filter(r => r.parent_id === roman.id && r.type === 'arabic');
          if (arabicChildren.length > 0) {
            arabicChildren.forEach(a => leafRows.push({ ...a, label: `${roman.row_code}/${a.row_code} ${a.name}` }));
          } else {
            leafRows.push({ ...roman, label: `${roman.row_code} ${roman.name}` });
          }
        });
        const directArabic = bsStructure.filter(r => r.parent_id === letter.id && r.type === 'arabic');
        directArabic.forEach(a => leafRows.push({ ...a, label: `${a.row_code} ${a.name}` }));
        return { letter, leafRows };
      });
    };
    return { assets: buildGroup('assets'), liabilities: buildGroup('liabilities') };
  }, [bsStructure]);

  // P8: FinancialPageSkeleton instead of blank page
  if (isLoadingStructure || isLoadingGlAccounts || isLoadingMappings) {
    return <FinancialPageSkeleton title="Hozzárendelések betöltése..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 justify-end mb-4">
        {isGenericPreset && (
          <Button variant="outline" onClick={handleAutoAssign} className="gap-2">
            <Wand2 className="w-4 h-4" />
            Alapértelmezett hozzárendelés
          </Button>
        )}
        <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending} className="gap-2">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Mentés
        </Button>
      </div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
      <div className="border rounded-md">
        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-muted/50 font-medium text-sm">
          <div className="col-span-3">Főkönyvi Szám</div>
          <div className="col-span-4">Megnevezés</div>
          <div className="col-span-5">Mérleg Sor</div>
        </div>
        <ScrollArea className="h-[600px]">
          {processedAccounts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nincsenek 1-4. számlaosztályú főkönyvi számok.</div>
          ) : (
            processedAccounts.map(gl => {
              if (!gl.isVisibleOnScreen) return null;
              const isExpanded = expandedRowIds.has(gl.id);
              const indentPadding = `${0.75 + (gl.depth * 1.5)}rem`;
              return (
                <div key={gl.id} className={cn("grid grid-cols-12 gap-4 p-3 border-b items-center hover:bg-muted/20 transition-colors", gl.isRoot ? "bg-muted/10 font-medium" : "", gl.hasChildren ? "cursor-pointer" : "")} onClick={() => toggleRow(gl.id, gl.hasChildren)}>
                  <div className="col-span-3 flex items-center font-mono text-sm" style={{ paddingLeft: indentPadding }}>
                    <div className="w-5 h-5 shrink-0 flex items-center justify-center mr-1">
                      {gl.hasChildren && <div className="text-muted-foreground/70">{isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</div>}
                    </div>
                    {gl.gl_number}
                  </div>
                  <div className={cn("col-span-4 text-sm truncate", gl.isRoot ? "uppercase" : "")} title={gl.short_name}>{gl.short_name}</div>
                  <div className="col-span-5" onClick={e => e.stopPropagation()}>
                    <Select value={mappings[gl.id] || 'none'} onValueChange={(val) => handleSelectChange(gl.id, val)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Válassz sort..." /></SelectTrigger>
                      <SelectContent className="max-h-[400px]">
                        <SelectItem value="none" className="text-muted-foreground italic">Nincs besorolva</SelectItem>
                        {dropdownGroups.assets.map(group => (
                          <React.Fragment key={group.letter.id}>
                            <SelectItem disabled value={`__h_${group.letter.id}`} className="font-bold text-xs uppercase tracking-wide text-emerald-500 dark:text-emerald-400 mt-1">
                              {group.letter.row_code} {group.letter.name}
                            </SelectItem>
                            {group.leafRows.map((row: any) => (
                              <SelectItem key={row.id} value={row.id} className="pl-6 text-xs">
                                {row.label}
                              </SelectItem>
                            ))}
                          </React.Fragment>
                        ))}
                        {dropdownGroups.liabilities.map(group => (
                          <React.Fragment key={group.letter.id}>
                            <SelectItem disabled value={`__h_${group.letter.id}`} className="font-bold text-xs uppercase tracking-wide text-blue-500 dark:text-blue-400 mt-1">
                              {group.letter.row_code} {group.letter.name}
                            </SelectItem>
                            {group.leafRows.map((row: any) => (
                              <SelectItem key={row.id} value={row.id} className="pl-6 text-xs" disabled={row.is_pnl_bridge}>
                                {row.is_pnl_bridge ? '🔒 ' : ''}{row.label}
                              </SelectItem>
                            ))}
                          </React.Fragment>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })
          )}
        </ScrollArea>
      </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={expandAll} className="gap-2"><Maximize2 className="w-4 h-4" /> Mind kinyitása</ContextMenuItem>
          <ContextMenuItem onClick={collapseAll} className="gap-2"><Minimize2 className="w-4 h-4" /> Mind összecsukása</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  BsViewTab (U9, U10, F11, F12, P7: onBalanceComputed callback)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function BsViewTab({ presetId, onBalanceComputed }: { presetId?: string; onBalanceComputed?: (isBalanced: boolean) => void }) {
  const { selectedCompany } = useCompany();
  const { dateToFormatted: dateTo } = useDateRange();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inThousands, setInThousands] = useState(true);
  const [hideZeroRows, setHideZeroRows] = useState(false);
  const [sideBySide, setSideBySide] = useState(false); // F11
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedGl, setExpandedGl] = useState<Set<string>>(new Set());
  const { data: exchangeRates } = useExchangeRates();

  // Derive fiscal year from the global date picker
  const fiscalYear = dateTo ? new Date(dateTo).getFullYear() : new Date().getFullYear();

  // U10: retry: 1 instead of false, gcTime: 5000 instead of 0
  const { data: bsData, isLoading, isError, error: queryError, refetch } = useQuery({
    queryKey: ['bs_report', selectedCompany?.id, presetId, dateTo, exchangeRates],
    queryFn: async () => {
      if (!selectedCompany?.id || !presetId) return [];
      const { data, error } = await supabase.rpc('get_bs_report', {
        p_company_id: selectedCompany.id,
        p_preset_id: presetId,
        p_date_to: dateTo || null,
        p_fiscal_year: fiscalYear,
        p_exchange_rates: exchangeRates || {}
      });
      if (error) {
        reportError({ type: 'db_query', component: 'BalanceSheet', action: 'error', message: '[BS Report RPC Error]', error: error });
        throw error;
      }
      return data;
    },
    enabled: !!selectedCompany?.id && !!presetId,
    retry: 1,
    gcTime: 5_000,
  });


  // 2nd-level drill-down: transaction items per GL account
  const { data: dbItems } = useQuery({
    queryKey: ['glItems_bs', selectedCompany?.id, presetId, exchangeRates],
    queryFn: async () => {
      if (!selectedCompany?.id || !presetId) return [];
      const { data, error } = await supabase.rpc('get_gl_categorized_items', {
        p_company_id: selectedCompany.id,
        p_preset_id: presetId,
        p_date_from: null,
        p_date_to: null,
        p_exchange_rates: exchangeRates || {}
      });
      if (error) return [];
      return data;
    },
    enabled: !!selectedCompany?.id && !!presetId
  });


  const formatValue = (val: number) => {
    const finalVal = inThousands ? Math.round(val / 1000) : val;
    if (finalVal === 0) return '0';
    return new Intl.NumberFormat('hu-HU').format(finalVal);
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const toggleGl = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGl(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const expandAllView = () => {
    if (!bsData) return;
    const allExpandable = bsData.filter(r =>
      r.type === 'letter' ||
      (r.type === 'roman' && bsData.some(c => c.parent_id === r.bs_structure_id)) ||
      (r.type === 'arabic' && ((r.gl_accounts as any[]) || []).length > 0)
    );
    setExpandedRows(new Set(allExpandable.map(r => r.bs_structure_id)));
  };

  const collapseAllView = () => setExpandedRows(new Set());

  // Hierarchical sum calculation
  const processedData = React.useMemo(() => {
    if (!bsData) return { assets: [] as any[], liabilities: [] as any[], totalAssets: 0, totalLiabilities: 0 };
    const balanceMap: Record<string, number> = {};

    bsData.forEach(row => {
      if (row.type === 'arabic' || (row.type === 'roman' && !bsData.some(r => r.parent_id === row.bs_structure_id))) {
        const raw = Number(row.current_balance) || 0;
        balanceMap[row.bs_structure_id] = raw;
      }
    });

    bsData.filter(r => r.type === 'roman').forEach(roman => {
      const children = bsData.filter(r => r.parent_id === roman.bs_structure_id);
      if (children.length > 0) {
        balanceMap[roman.bs_structure_id] = children.reduce((s, c) => s + (balanceMap[c.bs_structure_id] || 0), 0);
      }
    });

    bsData.filter(r => r.type === 'letter').forEach(letter => {
      const children = bsData.filter(r => r.parent_id === letter.bs_structure_id);
      balanceMap[letter.bs_structure_id] = children.reduce((s, c) => s + (balanceMap[c.bs_structure_id] || 0), 0);
    });

    const totalAssets = bsData.filter(r => r.type === 'letter' && r.section === 'assets').reduce((s, r) => s + (balanceMap[r.bs_structure_id] || 0), 0);
    const totalLiabilities = bsData.filter(r => r.type === 'letter' && r.section === 'liabilities').reduce((s, r) => s + (balanceMap[r.bs_structure_id] || 0), 0);

    bsData.filter(r => r.type === 'total').forEach(t => {
      balanceMap[t.bs_structure_id] = t.section === 'assets' ? totalAssets : totalLiabilities;
    });

    const enriched = bsData.map(row => ({ ...row, computedBalance: balanceMap[row.bs_structure_id] || 0 }));
    return {
      assets: enriched.filter(r => r.section === 'assets'),
      liabilities: enriched.filter(r => r.section === 'liabilities'),
      totalAssets,
      totalLiabilities,
    };
  }, [bsData]);

  // P7: Notify parent about balance status
  const { totalAssets, totalLiabilities, assets, liabilities } = processedData;
  const isBalanced = Math.abs(totalAssets - totalLiabilities) < 0.01;
  const difference = totalAssets - totalLiabilities;

  React.useEffect(() => {
    onBalanceComputed?.(isBalanced);
  }, [isBalanced, onBalanceComputed]);

  // Determine which rows have expandable children
  const hasChildrenMap = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    if (!bsData) return map;
    bsData.forEach(row => {
      if (row.type === 'letter') {
        map[row.bs_structure_id] = bsData.some(r => r.parent_id === row.bs_structure_id);
      } else if (row.type === 'roman') {
        map[row.bs_structure_id] = bsData.some(r => r.parent_id === row.bs_structure_id);
      } else if (row.type === 'arabic') {
        map[row.bs_structure_id] = ((row.gl_accounts as any[]) || []).length > 0;
      }
    });
    return map;
  }, [bsData]);

  if (isLoading) return <FinancialPageSkeleton title="Mérleg betöltése..." />;

  // U10: Error state with retry button
  if (isError) return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 p-4 rounded-xl border-2 bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-400">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <div className="flex-1">
          <p className="font-bold">Hiba a mérleg betöltésekor</p>
          <p className="text-sm mt-1 opacity-80">{(queryError as any)?.message || 'Ismeretlen hiba. Ellenőrizd, hogy a get_bs_report RPC funkció le van-e futtatva a Supabase-ben.'}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 border-red-500/30 hover:bg-red-500/10"
          onClick={() => refetch()}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Újrapróbálás
        </Button>
      </div>
    </div>
  );

  const renderSection = (rows: any[]) => {
    return rows.map(row => {
      const isLetter = row.type === 'letter';
      const isRoman = row.type === 'roman';
      const isArabic = row.type === 'arabic';
      const isTotal = row.type === 'total';

      if (hideZeroRows && !isTotal && row.computedBalance === 0 && (Number(row.prior_year_balance) || 0) === 0 && (Number(row.prior_year_adjustment) || 0) === 0) {
        return null;
      }
      const glAccounts = (row.gl_accounts as any[]) || [];
      const hasGl = glAccounts.length > 0;
      const isExpanded = expandedRows.has(row.bs_structure_id);
      const hasChildren = hasChildrenMap[row.bs_structure_id] || false;
      const isClickable = hasChildren || (isArabic && hasGl);

      // Visibility: roman is hidden if parent letter is collapsed
      if (isRoman) {
        const parentLetter = rows.find(r => r.bs_structure_id === row.parent_id);
        if (parentLetter && !expandedRows.has(parentLetter.bs_structure_id)) {
          return <React.Fragment key={row.bs_structure_id}>
            <div className="hidden print:block">
              {renderRowContent(row, isLetter, isRoman, isArabic, isTotal, glAccounts, hasGl, isExpanded, isClickable)}
            </div>
          </React.Fragment>;
        }
      }

      // Visibility: arabic is hidden if parent roman is collapsed
      if (isArabic) {
        const parentRoman = rows.find(r => r.bs_structure_id === row.parent_id);
        if (parentRoman) {
          const grandparentLetter = rows.find(r => r.bs_structure_id === parentRoman.parent_id);
          if (grandparentLetter && !expandedRows.has(grandparentLetter.bs_structure_id)) {
            return <React.Fragment key={row.bs_structure_id}>
              <div className="hidden print:block">
                {renderRowContent(row, isLetter, isRoman, isArabic, isTotal, glAccounts, hasGl, isExpanded, isClickable)}
              </div>
            </React.Fragment>;
          }
          if (!expandedRows.has(parentRoman.bs_structure_id)) {
            return <React.Fragment key={row.bs_structure_id}>
              <div className="hidden print:block">
                {renderRowContent(row, isLetter, isRoman, isArabic, isTotal, glAccounts, hasGl, isExpanded, isClickable)}
              </div>
            </React.Fragment>;
          }
        }
      }

      return <React.Fragment key={row.bs_structure_id}>
        {renderRowContent(row, isLetter, isRoman, isArabic, isTotal, glAccounts, hasGl, isExpanded, isClickable)}
      </React.Fragment>;
    });
  };

  const renderRowContent = (row: any, isLetter: boolean, isRoman: boolean, isArabic: boolean, isTotal: boolean, glAccounts: any[], hasGl: boolean, isExpanded: boolean, isClickable: boolean) => {
    const indent = isRoman ? 'pl-6' : isArabic ? 'pl-12' : '';

    // F12: Highlight rows with >50% year-over-year change
    const prevYearBal = Number(row.prior_year_balance) || 0;
    const currBal = row.computedBalance || 0;
    const hasSignificantChange = (isRoman || isArabic) && prevYearBal !== 0 && Math.abs((currBal - prevYearBal) / Math.abs(prevYearBal)) > 0.5;

    return (
      <>
        <div
          className={cn(
            "grid grid-cols-12 gap-4 p-3 items-center transition-colors hover:bg-muted/30",
            isTotal ? "bg-primary/10 font-bold border-t-2 border-b-2 border-border/80 text-base" : "",
            isLetter ? "bg-primary/5 font-bold border-t border-border/60" : "",
            isRoman ? "font-semibold" : "",
            isClickable ? "cursor-pointer" : "",
            // F12: significant change highlight
            hasSignificantChange ? "bg-amber-500/5 border-l-2 border-l-amber-500/40" : ""
          )}
          onClick={() => isClickable && toggleRow(row.bs_structure_id)}
        >
          <div className={cn("col-span-1 text-center font-bold text-muted-foreground text-sm", indent)}>
            {row.row_code}
          </div>
          <div className={cn("col-span-5 flex items-center gap-2", indent)}>
            {isClickable && (
              <div className="w-4 h-4 shrink-0 text-muted-foreground/70">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            )}
            <span className={cn(isTotal && "uppercase tracking-wide", isLetter && "uppercase")}>
              {row.name}
            </span>
            {row.is_pnl_bridge && <span title="Automatikusan az Eredménykimutatásból"><Lock className="w-3.5 h-3.5 text-amber-500 ml-1" /></span>}
            {/* F12: tooltip for significant change */}
            {hasSignificantChange && (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>Előző évhez képest &gt;50% változás</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="col-span-2 text-right tabular-nums text-muted-foreground/50">
            {formatValue(prevYearBal)}
          </div>
          <div className="col-span-2 text-right tabular-nums text-muted-foreground/50">
            {formatValue(Number(row.prior_year_adjustment) || 0)}
          </div>
          <div className={cn("col-span-2 text-right tabular-nums", isTotal ? "text-primary text-base" : "", isLetter ? "font-bold" : "")}>
            {formatValue(row.computedBalance)}
            {(() => {
              const prev = prevYearBal;
              const curr = row.computedBalance || 0;
              if (prev === 0 || curr === prev) return null;
              const pctChange = Math.round(((curr - prev) / Math.abs(prev)) * 100);
              const isUp = pctChange > 0;
              return (
                <span className={cn("ml-1 text-[9px] font-medium", isUp ? "text-emerald-500" : "text-red-400")}>
                  {isUp ? '▲' : '▼'}{Math.abs(pctChange)}%
                </span>
              );
            })()}
          </div>
        </div>

        {/* GL Drill-down for arabic rows */}
        {isArabic && hasGl && (
          <div className={cn("bg-muted/10 border-b border-border/50 pb-2 shadow-inner", !isExpanded && "hidden print:block")}>
            {glAccounts.map((gl: any) => {
              if (!gl.gl_account_id) return null;
              const isGlExpanded = expandedGl.has(gl.gl_account_id);
              const items = dbItems?.filter((i: any) => i.gl_account_id === gl.gl_account_id) || [];
              const hasItems = items.length > 0;

              return (
                <React.Fragment key={gl.gl_account_id}>
                  <div
                    className={cn(
                      "grid grid-cols-12 gap-4 py-2 px-3 items-center text-sm hover:bg-muted/40 border-l-4 border-l-transparent",
                      hasItems ? "cursor-pointer hover:border-l-primary/40" : ""
                    )}
                    onClick={(e) => hasItems && toggleGl(gl.gl_account_id, e)}
                  >
                    <div className="col-span-1"></div>
                    <div className="col-span-5 flex items-center gap-2 pl-16 text-muted-foreground">
                      <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                        {hasItems && (
                          <div className="text-muted-foreground/50">
                            {isGlExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-foreground/70">{gl.gl_number}</span>
                      <span className="truncate">{gl.short_name}</span>
                    </div>
                    <div className="col-span-2"></div>
                    <div className="col-span-2"></div>
                    <div className="col-span-2 text-right text-muted-foreground tabular-nums">{formatValue(row.section === 'liabilities' ? -gl.balance : gl.balance)}</div>
                  </div>

                  {/* Level 2: Transactions */}
                  {hasItems && (
                    <div className={cn("bg-background/50 py-1 shadow-inner pl-12 pr-4 border-y border-border/20", !isGlExpanded && "hidden print:block")}>
                      {items.map((item: any) => (
                        <div key={item.item_id} className="grid grid-cols-12 gap-4 py-1.5 items-center text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 px-2 rounded-md transition-colors">
                          <div className="col-span-2 flex items-center gap-2">
                            <ReceiptText className="w-3 h-3 opacity-50" />
                            {item.item_date?.substring(0, 10).replace(/-/g, '.')}
                          </div>
                          <div className="col-span-6 flex items-center gap-2 truncate" title={item.description || item.partner}>
                            {item.partner && <span className="font-medium text-foreground/80 mr-2">{item.partner}</span>}
                            <span className="truncate">{item.description}</span>
                          </div>
                          <div className="col-span-2"></div>
                          <div className="col-span-2 text-right tabular-nums">
                            {formatValue(row.section === 'liabilities' ? -(item.amount || 0) : (item.amount || 0))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </>
    );
  };

  // F11: Side-by-side table header (used in both single and side-by-side)
  const tableHeader = (
    <div className="grid grid-cols-12 gap-4 p-4 bg-muted/80 border-b text-sm font-bold uppercase text-muted-foreground select-none sticky top-0 z-10 backdrop-blur-sm">
      <div className="col-span-1 text-center">Sor</div>
      <div className="col-span-5">Megnevezés</div>
      <div className="col-span-2 text-right">Előző év</div>
      <div className="col-span-2 text-right">Módosítások</div>
      <div className="col-span-2 text-right text-foreground">Tárgyév</div>
    </div>
  );

  return (
    <div className="space-y-4 content-animate">
      {/* U9: Single balance equality indicator (removed duplicate banner) */}
      {totalAssets !== undefined && totalLiabilities !== undefined && (
        <div className={cn(
          "flex items-center justify-center gap-4 p-3 rounded-xl border-2 text-sm",
          isBalanced
            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
            : "bg-red-500/10 border-red-500/40 text-red-700 dark:text-red-400"
        )}>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider opacity-80">Eszközök</div>
            <div className="font-bold tabular-nums">{new Intl.NumberFormat('hu-HU').format(Math.round(totalAssets))}</div>
          </div>
          <div className="text-lg font-bold">
            {isBalanced ? '⚖️ =' : '⚖️ ≠'}
          </div>
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider opacity-80">Források</div>
            <div className="font-bold tabular-nums">{new Intl.NumberFormat('hu-HU').format(Math.round(totalLiabilities))}</div>
          </div>
          {isBalanced ? <CheckCircle2 className="w-4 h-4 ml-2" /> : <AlertTriangle className="w-4 h-4 ml-2" />}
          {!isBalanced && (
            <span className="text-xs font-semibold ml-2">
              Eltérés: {formatValue(difference)} {inThousands ? 'E Ft' : 'Ft'}
            </span>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-border/50 print:hidden">
        <div className="flex items-center gap-6">
          <div className="flex items-center space-x-2">
            <Switch id="bs-view-mode" checked={inThousands} onCheckedChange={setInThousands} />
            <Label htmlFor="bs-view-mode" className="font-medium cursor-pointer">Hivatalos nézet (Ezer Ft)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="bs-hide-zero" checked={hideZeroRows} onCheckedChange={setHideZeroRows} />
            <Label htmlFor="bs-hide-zero" className="font-medium cursor-pointer">Nullás sorok elrejtése</Label>
          </div>
          {/* F11: Side-by-side toggle */}
          <div className="flex items-center space-x-2">
            <Switch id="bs-side-by-side" checked={sideBySide} onCheckedChange={setSideBySide} />
            <Label htmlFor="bs-side-by-side" className="font-medium cursor-pointer flex items-center gap-1">
              <Columns className="w-3.5 h-3.5" /> Hagyományos nézet
            </Label>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <Download className="h-4 w-4" />
                Export
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => window.print()}>
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                try {
                  await exportBsExcel(assets, liabilities, totalAssets, totalLiabilities, inThousands, selectedCompany?.name || 'Vallalkozas');
                  toast({ title: 'Sikeres exportálás', description: 'A mérleg letöltése megkezdődött.' });
                } catch (err: any) {
                  toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
                }
              }}>
                <FileText className="h-4 w-4 mr-2" />
                Export XLSX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* F11: Side-by-side vs stacked layout */}
      {sideBySide ? (
        // Side-by-side (traditional balance sheet layout)
        <div className="grid grid-cols-2 gap-4 print:grid-cols-2">
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="border rounded-md shadow-sm overflow-auto max-h-[70vh] bg-card">
                <div className="p-3 bg-emerald-500/10 border-b font-bold text-sm uppercase tracking-wide text-emerald-700 dark:text-emerald-400 text-center sticky top-0 z-10">
                  Eszközök (Aktívák)
                </div>
                {tableHeader}
                <div className="divide-y divide-border/40">
                  {renderSection(assets)}
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={expandAllView} className="gap-2"><Maximize2 className="w-4 h-4" /> Mind kinyitása</ContextMenuItem>
              <ContextMenuItem onClick={collapseAllView} className="gap-2"><Minimize2 className="w-4 h-4" /> Mind összecsukása</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="border rounded-md shadow-sm overflow-auto max-h-[70vh] bg-card">
                <div className="p-3 bg-blue-500/10 border-b font-bold text-sm uppercase tracking-wide text-blue-700 dark:text-blue-400 text-center sticky top-0 z-10">
                  Források (Passzívák)
                </div>
                {tableHeader}
                <div className="divide-y divide-border/40">
                  {renderSection(liabilities)}
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={expandAllView} className="gap-2"><Maximize2 className="w-4 h-4" /> Mind kinyitása</ContextMenuItem>
              <ContextMenuItem onClick={collapseAllView} className="gap-2"><Minimize2 className="w-4 h-4" /> Mind összecsukása</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      ) : (
        // Stacked (default layout)
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="border rounded-md shadow-sm overflow-auto max-h-[70vh] bg-card">
              {tableHeader}
              <div className="divide-y divide-border/40">
                {renderSection(assets)}
                <div className="h-4 bg-muted/30" /> {/* Separator */}
                {renderSection(liabilities)}
              </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={expandAllView} className="gap-2"><Maximize2 className="w-4 h-4" /> Mind kinyitása</ContextMenuItem>
            <ContextMenuItem onClick={collapseAllView} className="gap-2"><Minimize2 className="w-4 h-4" /> Mind összecsukása</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem className="gap-2" onClick={() => {
              const rows = [...assets, ...liabilities];
              const csv = 'Sor;Megnevezés;Tárgyév\n' + rows.map(r => `${r.row_code};${r.name};${r.current_year_balance || 0}`).join('\n');
              navigator.clipboard.writeText(csv);
            }}><ClipboardCopy className="w-4 h-4" /> Másolás CSV-ként</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Main BalanceSheet (P7: no duplicate bsData query)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function BalanceSheet() {
  const { selectedCompany } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'view';
  const setActiveTab = (val: string) => { setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('tab', val); return next; }, { replace: true }); };
  const { activePresetId, setActivePresetId, presets } = useActivePreset(selectedCompany?.id);

  // P7: isBalanced comes from BsViewTab callback instead of a duplicate query
  const [isBalanced, setIsBalanced] = useState(true);
  const handleBalanceComputed = useCallback((balanced: boolean) => {
    setIsBalanced(balanced);
  }, []);

  // GL accounts query for unassigned count
  const { data: glAccounts } = useQuery({
    queryKey: ['gl_accounts_bs', activePresetId],
    queryFn: async () => {
      if (!activePresetId) return [];
      const { data, error } = await supabase.from('gl_accounts').select('*').eq('preset_id', activePresetId).order('gl_number');
      if (error) throw error;
      return (data || []).filter(a => /^[1-4]/.test(a.gl_number));
    },
    enabled: !!activePresetId
  });

  const { data: existingMappings } = useQuery({
    queryKey: ['bs_mapping', selectedCompany?.id, activePresetId],
    queryFn: async () => {
      if (!selectedCompany?.id || !activePresetId) return [];
      const { data, error } = await supabase.from('bs_mapping').select('*').eq('company_id', selectedCompany.id).eq('preset_id', activePresetId);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id && !!activePresetId
  });

  const unassignedCount = React.useMemo(() => {
    if (!glAccounts) return 0;
    const cleanId = (id: string) => id ? String(id).replace(/\./g, '') : '';
    const rawData = glAccounts.map(dbItem => {
      const cid = cleanId(dbItem.gl_number);
      const hasChildren = glAccounts.some(d => 
        cleanId(d.gl_number).startsWith(cid) && 
        cleanId(d.gl_number) !== cid
      );
      return { ...dbItem, hasChildren };
    });

    const leafAccounts = rawData.filter(gl => !gl.hasChildren);
    const mappedIds = new Set(existingMappings?.map(m => m.gl_account_id) || []);
    return leafAccounts.filter(a => !mappedIds.has(a.id)).length;
  }, [glAccounts, existingMappings]);

  useKeyboardShortcuts([
    { combo: { key: 'p', ctrl: true }, handler: () => window.print(), description: 'Nyomtatás' },
  ]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 page-animate">
      {/* Print-only header */}
      <div className="hidden print:flex flex-col items-center justify-center mb-8 w-full border-b-2 border-primary/20 pb-6">
        <h1 className="text-5xl font-semibold text-primary tracking-tight print:text-black mb-2">eaisybill</h1>
        <h2 className="text-2xl font-bold uppercase tracking-widest text-foreground mt-2">Mérleg</h2>
        <p className="text-sm text-muted-foreground mt-1">Sztv. "A" változat szerinti mérleg</p>
        <div className="mt-4 flex items-center gap-4 text-sm font-medium text-muted-foreground">
          <span>{selectedCompany?.name}</span>
          <span>•</span>
          <span>Fordulónap: {new Date().toISOString().slice(0, 10).replace(/-/g, '.')}</span>
        </div>
      </div>

      <PageHeader
        companyName={selectedCompany?.name}
        breadcrumb="Mérleg"
        title="Mérleg"
        description="Sztv. 'A' változat szerinti mérleg és beállítások"
      />

      {(!isBalanced || unassignedCount > 0) && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 text-amber-800 dark:text-amber-400 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm print:hidden">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Figyelmeztetés a Mérleg összeállításában</p>
              <p className="text-xs mt-1 opacity-90">
                {!isBalanced && 'A mérleg nem egyezik (Eszközök ≠ Források). '}
                {unassignedCount > 0 && `Jelenleg ${unassignedCount} db nem besorolt főkönyvi szám található az 1-4. számlaosztályban.`}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setActiveTab('mapping')}
            className="border-amber-500/30 hover:bg-amber-500/20 text-amber-900 dark:text-amber-300 font-semibold shrink-0 text-xs gap-1.5 h-8 bg-transparent"
          >
            <span>Hozzárendelési Mátrix megnyitása</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 h-12 w-full md:w-auto p-1 bg-muted/50">
          <TabsTrigger value="view" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6">Mérleg</TabsTrigger>
          <TabsTrigger value="mapping" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-6">Hozzárendelési Mátrix</TabsTrigger>
        </TabsList>
        <TabsContent value="view" className="mt-0 outline-none">
          <Card className="border-border/60 shadow-md">
            <CardHeader className="pb-4 border-b border-border/40">
              <div className="flex justify-between items-center">
                <div><CardTitle className="text-xl">Mérleg</CardTitle><CardDescription>Sztv. szerinti "A" változat</CardDescription></div>
                {presets && presets.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Aktív sablon:</span>
                    <Select value={activePresetId || ''} onValueChange={setActivePresetId}>
                      <SelectTrigger className="w-[200px] h-8 text-xs bg-muted/50 border-0 font-semibold"><SelectValue placeholder="Sablon" /></SelectTrigger>
                      <SelectContent>{presets.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} {p.type === 'generic' ? '(Beépített)' : ''}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {/* P7: onBalanceComputed callback eliminates duplicate query */}
              <BsViewTab presetId={activePresetId} onBalanceComputed={handleBalanceComputed} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="mapping" className="mt-0 outline-none">
          <Card className="border-border/60 shadow-md">
            <CardHeader className="pb-4 border-b border-border/40">
              <div className="flex justify-between items-center">
                <div><CardTitle className="text-xl">Hozzárendelési Mátrix</CardTitle><CardDescription>Párosítsd az 1-4. számlaosztály főkönyvi számait a Mérleg soraihoz.</CardDescription></div>
                {presets && presets.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Aktív sablon:</span>
                    <Select value={activePresetId || ''} onValueChange={setActivePresetId}>
                      <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Sablon" /></SelectTrigger>
                      <SelectContent>{presets.map(p => (<SelectItem key={p.id} value={p.id}>{p.name} {p.type === 'generic' ? '(Beépített)' : ''}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6"><BsMappingTab presetId={activePresetId} isGenericPreset={presets?.find(p => p.id === activePresetId)?.type === 'generic'} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
