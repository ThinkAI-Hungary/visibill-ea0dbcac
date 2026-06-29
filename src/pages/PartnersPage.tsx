import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn, formatCurrency } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { Search, Plus, Pencil, Trash2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CopyableCell } from "@/components/ui/copyable-cell";
import { UnifiedPagination } from "@/components/ui/unified-pagination";
import { PartnerTypeFilter, PartnerTypeFilterValue } from "@/components/ui/partner-type-filter";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { TableEmptyState } from "@/components/ui/table-empty-state";
import { TablePlaceholderRows } from "@/components/ui/table-placeholder-rows";
import {
  PartnerInvoiceDetailDialog,
  type PartnerInvoice,
} from "@/components/partners/PartnerInvoiceDetailDialog";

const DEFAULT_PAGE_SIZE = 15;

/** Returns true if the tax_number is a worker-generated synthetic ID for foreign partners */
const isForeignPartner = (taxNumber: string | null | undefined): boolean =>
  !!taxNumber?.startsWith('FOREIGN:');

/** Display-safe tax_number: returns empty string for synthetic FOREIGN: IDs */
const displayTaxNumber = (taxNumber: string | null | undefined): string =>
  !taxNumber || isForeignPartner(taxNumber) ? '' : taxNumber;

interface Partner {
  id: string;
  name: string;
  tax_number: string;
  address: string | null;
  email: string | null;
  partner_type: string;
  company_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  exclude_from_accounting?: boolean;
}

// Import shared helpers
import { decodeHtmlEntities, getInitials as _getInitials, getAvatarColor } from '@/lib/helpers';

// Partner-specific getInitials with HTML entity decoding
const getInitials = (name: string): string => {
  return _getInitials(decodeHtmlEntities(name));
};

export default function PartnersPage() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('partners');
  

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [typeFilter, setTypeFilter] = useState<PartnerTypeFilterValue>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    tax_number: "",
    address: "",
    email: "",
    partner_type: "both",
  });
  const [emailError, setEmailError] = useState("");
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  // Invoice detail dialog state
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<PartnerInvoice | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  // Invoice tab state in right panel
  const [invoiceTab, setInvoiceTab] = useState<'nav' | 'uploaded'>('nav');
  const [invoiceSearch, setInvoiceSearch] = useState('');

  const openInvoiceDetail = (inv: PartnerInvoice) => {
    setSelectedInvoiceForDetail(inv);
    setIsDetailDialogOpen(true);
  };
  const closeInvoiceDetail = () => {
    setIsDetailDialogOpen(false);
    setSelectedInvoiceForDetail(null);
  };

  // ── URL param helpers ──
  const setPartnerParam = useCallback((partnerId: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (partnerId) next.set('partner', partnerId);
      else next.delete('partner');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Fetch partners - company scoped (required)
  const { data: partners, isLoading } = useQuery({
    queryKey: queryKeys.partnersFull(selectedCompany?.id || ''),
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      // Fetch partners + invoice counts from both tables in parallel
      const [{ data: partnerData, error: partnerError }, { data: supplierCounts }, { data: customerCounts }, { data: uploadedCounts }] = await Promise.all([
        supabase
          .from("partners")
          .select("id, name, tax_number, address, email, partner_type, company_id, user_id, default_project_id, created_at, updated_at, exclude_from_accounting")
          .eq("company_id", selectedCompany.id)
          .order("name", { ascending: true }),
        supabase.from("nav_invoices").select("supplier_tax_number").eq("company_id", selectedCompany.id),
        supabase.from("nav_invoices").select("customer_tax_number").eq("company_id", selectedCompany.id),
        supabase.from("invoices").select("elado_vat_id, vevo_vat_id").eq("company_id", selectedCompany.id),
      ]);

      if (partnerError) throw partnerError;

      const countsMap: Record<string, number> = {};

      // NAV supplier invoices
      (supplierCounts || []).forEach((inv: any) => {
        if (inv.supplier_tax_number) {
          const cleanTax = inv.supplier_tax_number.substring(0, 8);
          countsMap[cleanTax] = (countsMap[cleanTax] || 0) + 1;
        }
      });
      // NAV customer invoices
      (customerCounts || []).forEach((inv: any) => {
        if (inv.customer_tax_number) {
          const cleanTax = inv.customer_tax_number.substring(0, 8);
          countsMap[cleanTax] = (countsMap[cleanTax] || 0) + 1;
        }
      });
      // Uploaded invoices — elado_vat_id and vevo_vat_id
      (uploadedCounts || []).forEach((inv: any) => {
        if (inv.elado_vat_id) {
          const cleanTax = inv.elado_vat_id.replace(/-/g, '').substring(0, 8);
          countsMap[cleanTax] = (countsMap[cleanTax] || 0) + 1;
        } else if (inv.vevo_vat_id) {
          const cleanTax = inv.vevo_vat_id.replace(/-/g, '').substring(0, 8);
          countsMap[cleanTax] = (countsMap[cleanTax] || 0) + 1;
        }
      });

      // Name-based invoice counts for FOREIGN: partners
      const foreignPartners = (partnerData as Partner[]).filter(p => isForeignPartner(p.tax_number));
      const foreignCounts: Record<string, number> = {};
      if (foreignPartners.length > 0) {
        const foreignResults = await Promise.all(
          foreignPartners.map(async (fp) => {
            const escapedName = fp.name.replace(/'/g, "''");
            const [{ count: invCount }, { count: navCount }] = await Promise.all([
              supabase.from('invoices')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', selectedCompany.id)
                .or(`elado_nev.ilike."%${escapedName}%",vevo_nev.ilike."%${escapedName}%"`),
              supabase.from('nav_invoices')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', selectedCompany.id)
                .or(`supplier_name.ilike."%${escapedName}%",customer_name.ilike."%${escapedName}%"`),
            ]);
            return { id: fp.id, count: (invCount || 0) + (navCount || 0) };
          })
        );
        foreignResults.forEach(r => { foreignCounts[r.id] = r.count; });
      }

      return (partnerData as Partner[]).map(partner => {
        if (isForeignPartner(partner.tax_number)) {
          return { ...partner, invoice_count: foreignCounts[partner.id] || 0 };
        }
        const cleanTax = partner.tax_number ? partner.tax_number.replace(/-/g, '').substring(0, 8) : '';
        return {
          ...partner,
          invoice_count: countsMap[cleanTax] || 0
        };
      });
    },
    enabled: !!user?.id && !!selectedCompany?.id,
    placeholderData: keepPreviousData,
  });

  // Selected partner object
  const selectedPartner = useMemo(() => {
    if (!partners || !selectedPartnerId) return null;
    return (partners as any[]).find(p => p.id === selectedPartnerId) || null;
  }, [partners, selectedPartnerId]);

  // Fetch selected partner's invoices — both NAV and uploaded
  const { data: partnerInvoices, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['partner-all-invoices', selectedPartner?.tax_number, selectedPartner?.name, selectedCompany?.id],
    queryFn: async (): Promise<PartnerInvoice[]> => {
      if (!selectedPartner?.tax_number || !selectedCompany?.id) return [];

      const isForeign = isForeignPartner(selectedPartner.tax_number);
      const cleanTax = selectedPartner.tax_number.replace(/-/g, '').substring(0, 8);
      const escapedName = selectedPartner.name.replace(/'/g, "''");

      const [{ data: navData }, { data: uploadedData }] = await Promise.all([
        // NAV invoices
        supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_direction, invoice_gross_amount, invoice_net_amount, invoice_issue_date, payment_date, currency, supplier_name, customer_name, payment_method')
          .eq('company_id', selectedCompany.id)
          .or(isForeign
            ? `supplier_name.ilike."%${escapedName}%",customer_name.ilike."%${escapedName}%"`
            : `supplier_tax_number.eq.${selectedPartner.tax_number},customer_tax_number.eq.${selectedPartner.tax_number}`
          )
          .order('invoice_issue_date', { ascending: false })
          .limit(50),
        // Uploaded invoices
        supabase
          .from('invoices')
          .select('id, bizonylatsorszam, invoice_direction, brutto_vegosszeg, kibocsatas_datuma, fizetesi_hatarido, penznem, elado_nev, vevo_nev, fizetesi_mod, elado_vat_id, vevo_vat_id')
          .eq('company_id', selectedCompany.id)
          .or(isForeign
            ? `elado_nev.ilike."%${escapedName}%",vevo_nev.ilike."%${escapedName}%"`
            : `elado_vat_id.ilike.${cleanTax}%,vevo_vat_id.ilike.${cleanTax}%`
          )
          .order('kibocsatas_datuma', { ascending: false })
          .limit(50),
      ]);

      const fromNav: PartnerInvoice[] = (navData || []).map((inv: any) => {
        const isOutbound = inv.invoice_direction === 'OUTBOUND';
        return {
          id: inv.id,
          source: 'nav' as const,
          invoice_number: inv.invoice_number,
          invoice_direction: inv.invoice_direction,
          invoice_gross_amount: inv.invoice_gross_amount,
          invoice_net_amount: inv.invoice_net_amount,
          invoice_issue_date: inv.invoice_issue_date,
          payment_date: inv.payment_date,
          currency: inv.currency || 'HUF',
          counterparty_name: isOutbound ? inv.customer_name : inv.supplier_name,
          payment_method: inv.payment_method,
        };
      });

      const fromUploaded: PartnerInvoice[] = (uploadedData || []).map((inv: any) => {
        const isOutbound = inv.invoice_direction === 'OUTBOUND';
        return {
          id: inv.id,
          source: 'uploaded' as const,
          invoice_number: inv.bizonylatsorszam,
          invoice_direction: inv.invoice_direction,
          invoice_gross_amount: inv.brutto_vegosszeg,
          invoice_net_amount: null,
          invoice_issue_date: inv.kibocsatas_datuma,
          payment_date: inv.fizetesi_hatarido,
          currency: inv.penznem || 'HUF',
          counterparty_name: isOutbound ? inv.vevo_nev : inv.elado_nev,
          payment_method: inv.fizetesi_mod,
        };
      });

      // Merge, sort by date DESC
      return [...fromNav, ...fromUploaded].sort((a, b) => {
        const da = a.invoice_issue_date ? new Date(a.invoice_issue_date).getTime() : 0;
        const db = b.invoice_issue_date ? new Date(b.invoice_issue_date).getTime() : 0;
        return db - da;
      });
    },
    enabled: !!selectedPartner?.tax_number && !!selectedCompany?.id,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (!user?.id) throw new Error("No user");

      const partnerData = {
        name: data.name,
        tax_number: data.tax_number,
        address: data.address || null,
        email: data.email?.trim() || null,
        partner_type: data.partner_type,
        user_id: user.id,
        company_id: selectedCompany?.id || null,
      };

      if (data.id) {
        const { error } = await supabase
          .from("partners")
          .update(partnerData)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("partners")
          .insert(partnerData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partnersFull(selectedCompany?.id || '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.partners(selectedCompany?.id || '') });
      toast({
        title: editingPartner ? "Partner frissítve" : "Partner létrehozva",
        description: "A partner sikeresen mentve.",
      });
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Hiba",
        description: error.message || "Nem sikerült menteni a partnert.",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("partners")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.partnersFull(selectedCompany?.id || '') });
      queryClient.invalidateQueries({ queryKey: queryKeys.partners(selectedCompany?.id || '') });
      toast({
        title: "Partner törölve",
        description: "A partner sikeresen törölve.",
        duration: 3000,
      });
      if (selectedPartnerId === editingPartner?.id || selectedPartnerId === deleteMutation.variables) {
        setSelectedPartnerId(null);
        setPartnerParam(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Hiba",
        description: error.message || "Nem sikerült törölni a partnert.",
        variant: "destructive",
      });
    },
  });

  // Filter partners by search query, type filter, and paginate
  const { paginatedPartners, totalPages, totalFiltered } = useMemo(() => {
    if (!partners) return { paginatedPartners: [], totalPages: 0, totalFiltered: 0 };

    let filtered = partners;

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(p =>
        p.partner_type === typeFilter || p.partner_type === 'both'
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (!isForeignPartner(p.tax_number) && p.tax_number.toLowerCase().includes(query)) ||
          (p.address && p.address.toLowerCase().includes(query))
      );
    }

    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedPartners = filtered.slice(startIndex, startIndex + pageSize);

    return { paginatedPartners, totalPages, totalFiltered };
  }, [partners, searchQuery, currentPage, pageSize, typeFilter]);

  // Reset page when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleTypeFilterChange = (value: PartnerTypeFilterValue) => {
    setTypeFilter(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleOpenDialog = (partner?: Partner) => {
    if (partner) {
      setEditingPartner(partner);
      setFormData({
        name: partner.name,
        tax_number: displayTaxNumber(partner.tax_number),
        address: partner.address || "",
        email: partner.email || "",
        partner_type: partner.partner_type,
      });
    } else {
      setEditingPartner(null);
      setFormData({
        name: "",
        tax_number: "",
        address: "",
        email: "",
        partner_type: "both",
      });
    }
    setEmailError("");
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPartner(null);
    setEmailError("");
    setFormData({
      name: "",
      tax_number: "",
      address: "",
      email: "",
      partner_type: "both",
    });
  };

  // Sync url partner -> selection
  const partnerIdFromUrl = searchParams.get('partner');
  useEffect(() => {
    if (partnerIdFromUrl && partners) {
      const match = partners.find(p => p.id === partnerIdFromUrl);
      if (match) {
        setSelectedPartnerId(partnerIdFromUrl);
      }
    }
  }, [partnerIdFromUrl, partners]);

  const selectPartner = (id: string) => {
    setSelectedPartnerId(id);
    setPartnerParam(id);
    setInvoiceSearch(''); // reset search on partner switch
  };

  const validateEmail = (email: string): boolean => {
    if (!email.trim()) return true; // optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isEditingForeign = editingPartner && isForeignPartner(editingPartner.tax_number);
    if (!formData.name.trim() || (!isEditingForeign && !formData.tax_number.trim())) {
      toast({
        title: "Hiányzó adatok",
        description: isEditingForeign ? "A név megadása kötelező." : "A név és adószám megadása kötelező.",
        variant: "destructive",
      });
      return;
    }
    if (formData.email && !validateEmail(formData.email)) {
      setEmailError("Érvénytelen email-cím formátum");
      return;
    }
    setEmailError("");
    // If editing a foreign partner and tax_number left empty, keep the original FOREIGN: value
    const finalTaxNumber = isEditingForeign && !formData.tax_number.trim()
      ? editingPartner.tax_number
      : formData.tax_number;
    saveMutation.mutate({
      ...formData,
      tax_number: finalTaxNumber,
      id: editingPartner?.id,
    });
  };

  const handleDelete = (partner: Partner) => {
    if (confirm(`Biztosan törölni szeretnéd a "${decodeHtmlEntities(partner.name)}" partnert?`)) {
      deleteMutation.mutate(partner.id);
    }
  };

  // ── Toggle "Nem kerül könyvelésre" on partner level ──
  const handleTogglePartnerExclude = async (partner: Partner) => {
    const newValue = !partner.exclude_from_accounting;
    // 1. Update the partner record
    const { error } = await supabase
      .from('partners')
      .update({ exclude_from_accounting: newValue })
      .eq('id', partner.id);
    if (error) {
      toast({ title: 'Hiba', description: error.message, variant: 'destructive' });
      return;
    }
    // 2. Batch-update all NAV invoices from this partner (by tax_number)
    if (selectedCompany?.id) {
      await supabase
        .from('nav_invoices')
        .update({ exclude_from_accounting: newValue })
        .eq('company_id', selectedCompany.id)
        .or(`supplier_tax_number.eq.${partner.tax_number},customer_tax_number.eq.${partner.tax_number}`);
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.partnersFull(selectedCompany?.id || '') });
    toast({
      title: newValue ? 'Partner kizárva a könyvelésből' : 'Partner visszaállítva a könyvelésbe',
      description: `${decodeHtmlEntities(partner.name)} összes számlája ${newValue ? 'nem kerül' : 'újra bekerül a'} könyvelésre.`,
      className: newValue ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-green-50 text-green-900 border-green-200',
    });
  };


  return (
    <div className="h-full space-y-4 page-animate flex flex-col overflow-hidden">
      {/* Page Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Partnertörzs</h1>
          <p className="text-muted-foreground text-sm">
            Vevők és szállítók kezelése és pénzügyi áttekintése
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2" disabled={!writable} title={!writable ? 'Nincs írási jogosultságod' : undefined}>
          <Plus className="h-4 w-4" /> Új partner hozzáadása
        </Button>
      </div>

      {/* Main Splitscreen Container */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 h-full min-h-[930px] overflow-hidden">
        {/* Left Pane: Master List & Toolbar */}
        <Card className="flex-1 rounded-xl border-border/50 bg-card/50 backdrop-blur-sm flex flex-col min-h-0 overflow-hidden lg:w-3/5">
          <CardContent className="p-4 flex flex-col h-full min-h-0 overflow-hidden space-y-3">
            {/* Unified Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <PartnerTypeFilter
                  value={typeFilter}
                  onChange={handleTypeFilterChange}
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Keresés..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10 bg-background/50 h-9"
                  />
                </div>
              </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 border border-border/50 rounded-lg overflow-y-auto min-h-0">
              <Table className="table-fixed compact-table min-w-full">
                <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[45%]">
                      Név / Cím
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[22%]">
                      Adószám
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[18%]">
                      Típus
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[15%] text-right">
                      Számlák
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableSkeleton rows={8} columns={4} />
                  ) : paginatedPartners.length === 0 ? (
                    <TableEmptyState
                      colSpan={4}
                      title={searchQuery || typeFilter !== 'all' ? 'Nincs találat a szűrésre' : 'Még nincsenek partnerek'}
                      description={searchQuery || typeFilter !== 'all' ? 'Próbáld módosítani a szűrőket.' : 'Küldj be egy számlát, hogy automatikusan megjelenjen a partner.'}
                      onClearFilters={searchQuery || typeFilter !== 'all' ? () => { setSearchQuery(''); setTypeFilter('all'); } : undefined}
                    />
                  ) : (
                    <>
                      {paginatedPartners.map((partner) => {
                        const decodedName = decodeHtmlEntities(partner.name);
                        const isSelected = selectedPartnerId === partner.id;
                        return (
                          <TableRow
                            key={partner.id}
                            className={cn(
                              "cursor-pointer transition-colors border-none",
                              isSelected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/40"
                            )}
                            onClick={() => selectPartner(partner.id)}
                          >
                            <TableCell className="py-2">
                              <div className="flex items-center gap-2 max-w-full overflow-hidden">
                                <Avatar className="h-7 w-7 shrink-0">
                                  <AvatarFallback className={`text-xs font-medium ${getAvatarColor(partner.name)}`}>
                                    {getInitials(partner.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm truncate text-foreground leading-tight">
                                    {decodedName}
                                  </p>
                                  {partner.address && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                      {decodeHtmlEntities(partner.address)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground py-2">
                              {isForeignPartner(partner.tax_number) ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 font-sans">
                                  Külföldi
                                </span>
                              ) : (
                                partner.tax_number
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              {partner.partner_type === 'customer' && (
                                <span className="inline-flex items-center justify-center w-[65px] px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                  Vevő
                                </span>
                              )}
                              {partner.partner_type === 'supplier' && (
                                <span className="inline-flex items-center justify-center w-[65px] px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                  Szállító
                                </span>
                              )}
                              {partner.partner_type === 'both' && (
                                <span className="inline-flex items-center justify-center w-[65px] px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground border border-border/50">
                                  Mindkettő
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs py-2 pr-4 text-muted-foreground font-semibold">
                              {(partner as any).invoice_count || 0} db
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TablePlaceholderRows currentCount={paginatedPartners.length} pageSize={pageSize} columns={4} />
                    </>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Bottom Pagination */}
            <div className="shrink-0 pt-2">
              <UnifiedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalFiltered}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
                pageSizeOptions={[15, 50, 100]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Right Pane: Detail Panel */}
        <Card className="lg:w-2/5 rounded-xl border-border/50 bg-card/50 backdrop-blur-sm flex flex-col min-h-[900px] overflow-hidden">
          {selectedPartner ? (
            <div className="p-6 flex flex-col h-full overflow-y-auto space-y-6">
              {/* Header section */}
              <div className="flex items-start justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border border-border/50 shadow-sm">
                    <AvatarFallback className={`text-sm font-semibold ${getAvatarColor(selectedPartner.name)}`}>
                      {getInitials(selectedPartner.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-lg font-bold text-foreground leading-tight">
                      {decodeHtmlEntities(selectedPartner.name)}
                    </h2>
                    <div className="mt-1 flex items-center gap-2">
                      {selectedPartner.partner_type === 'customer' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Vevő
                        </span>
                      )}
                      {selectedPartner.partner_type === 'supplier' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          Szállító
                        </span>
                      )}
                      {selectedPartner.partner_type === 'both' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground border border-border/50">
                          Mindkettő
                        </span>
                      )}
                      
                      {partnerInvoices && partnerInvoices.some(inv => inv.source === 'nav') && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500 bg-emerald-500/5 px-2 py-0.5 rounded-md border border-emerald-500/10">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> NAV szinkronizált
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenDialog(selectedPartner)}
                    className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                    disabled={!writable}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(selectedPartner)}
                    className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    disabled={!writable}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* General details */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Cégadatok</h4>
                <div className="grid grid-cols-2 gap-y-3 border border-border/30 rounded-xl p-4 bg-muted/10">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-semibold">Adószám</p>
                    {selectedPartner.tax_number && !isForeignPartner(selectedPartner.tax_number) ? (
                      <CopyableCell
                        value={selectedPartner.tax_number}
                        className="font-mono text-xs font-semibold mt-0.5"
                        ariaLabel="Adószám másolása"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground/50">{isForeignPartner(selectedPartner.tax_number) ? 'Külföldi partner' : '—'}</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground font-semibold">Székhely</p>
                    {selectedPartner.address ? (
                      <CopyableCell
                        value={decodeHtmlEntities(selectedPartner.address)}
                        className="text-xs mt-0.5"
                        ariaLabel="Székhely másolása"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </div>
                  {selectedPartner.email && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground font-semibold">Email-cím</p>
                      <CopyableCell
                        value={selectedPartner.email}
                        className="text-xs mt-0.5"
                        ariaLabel="Email másolása"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Accounting exclusions */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Könyvelési beállítás</h4>
                <div className="flex items-center justify-between border border-border/30 rounded-xl p-4 bg-muted/10">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold">Bekerüljön a könyvelésbe?</p>
                    <p className="text-[11px] text-muted-foreground">Kizárható a partner minden számlája a könyvelésből</p>
                  </div>
                  <Checkbox
                    checked={!selectedPartner.exclude_from_accounting}
                    onCheckedChange={() => handleTogglePartnerExclude(selectedPartner)}
                    aria-label={selectedPartner.exclude_from_accounting ? 'Könyvelésbe visszaállítás' : 'Könyvelésből kizárás'}
                    className="h-5 w-5"
                    disabled={!writable}
                  />
                </div>
              </div>

              {/* Partner Számlák — tabbed */}
              <div className="space-y-3 shrink-0">
                {/* Tab header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5">
                    {(['nav', 'uploaded'] as const).map((tab) => {
                      const count = partnerInvoices?.filter(inv => inv.source === tab).length ?? 0;
                      const label = tab === 'nav' ? 'NAV' : 'Beküldött';
                      return (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setInvoiceTab(tab)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all",
                            invoiceTab === tab
                              ? "bg-card text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {label}
                          {count > 0 && (
                            <span className={cn(
                              "inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold",
                              invoiceTab === tab
                                ? tab === 'nav' ? "bg-violet-500/15 text-violet-400" : "bg-amber-500/15 text-amber-400"
                                : "bg-muted text-muted-foreground"
                            )}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Invoice search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Számlaszám keresése..."
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    className="pl-8 h-8 text-xs bg-background/50"
                  />
                </div>

                {/* Invoice list */}
                <div className="h-[350px] border border-border/30 rounded-xl bg-muted/5 overflow-hidden flex flex-col">
                  <div className="overflow-y-auto flex-1 p-2 space-y-2">
                    {isLoadingInvoices ? (
                      <div className="flex items-center justify-center h-32">
                        <LoadingSpinner className="h-6 w-6 text-muted-foreground" />
                      </div>
                    ) : (() => {
                      const q = invoiceSearch.trim().toLowerCase();
                      const filtered = (partnerInvoices || [])
                        .filter(inv => inv.source === invoiceTab)
                        .filter(inv => !q || (inv.invoice_number || '').toLowerCase().includes(q));
                      if (filtered.length === 0) {
                        return (
                          <div className="text-center py-10 text-xs text-muted-foreground">
                            {invoiceTab === 'nav' ? 'Nincsenek NAV számlák' : 'Nincsenek beküldött számlák'}
                          </div>
                        );
                      }
                      return filtered.map((invoice) => {
                        const isOutbound = invoice.invoice_direction === 'OUTBOUND';
                        const cur = invoice.currency || 'HUF';
                        return (
                          <button
                            key={invoice.id}
                            type="button"
                            onClick={() => openInvoiceDetail(invoice)}
                            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-card/65 border border-border/40 hover:border-primary/30 hover:bg-muted/15 transition-all text-xs cursor-pointer text-left"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="flex items-center gap-1.5">
                                <span className={cn(
                                  "w-1.5 h-1.5 rounded-full shrink-0",
                                  isOutbound ? "bg-emerald-500" : "bg-blue-500"
                                )}></span>
                                <span className="font-mono font-medium truncate">{invoice.invoice_number || '–'}</span>
                              </div>
                              {invoice.invoice_issue_date && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {new Date(invoice.invoice_issue_date).toLocaleDateString('hu-HU', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit'
                                  })}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-semibold">
                                {formatCurrency(invoice.invoice_gross_amount || 0, cur)}
                              </p>
                              <span className="text-[9px] text-muted-foreground uppercase font-bold">
                                {isOutbound ? 'Kimenő' : 'Bejövő'}
                              </span>
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Information disclaimer */}
              <div className="flex gap-2.5 p-3 rounded-lg bg-blue-500/5 text-blue-600 border border-blue-500/10 text-xs mt-auto shrink-0">
                <Info className="h-4 w-4 shrink-0" />
                <p className="leading-normal">
                  A partnerek és cégadatok szinkronizálása a NAV Online Számla rendszeréből automatikusan történik az adószám alapján.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
              <Avatar className="h-16 w-16 bg-muted border border-border/50 flex items-center justify-center text-muted-foreground mb-4">
                <Info className="h-6 w-6" />
              </Avatar>
              <h3 className="font-bold text-sm text-foreground">Nincs kijelölt partner</h3>
              <p className="text-xs max-w-[240px] mt-1">
                Kattints a bal oldali listában egy partnerre az adatok megtekintéséhez.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPartner ? "Partner szerkesztése" : "Új partner hozzáadása"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Név *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Partner neve"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_number">{editingPartner && isForeignPartner(editingPartner.tax_number) ? 'Adószám' : 'Adószám *'}</Label>
              <Input
                id="tax_number"
                value={formData.tax_number}
                onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                placeholder={editingPartner && isForeignPartner(editingPartner.tax_number)
                  ? 'Külföldi partner – írd be az adószámot ha ismert'
                  : '12345678-1-23'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Cím</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Partner címe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email-cím <span className="text-muted-foreground text-xs">(felszólítólevélhez)</span></Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setEmailError("");
                }}
                placeholder="partner@example.com"
                className={emailError ? "border-destructive" : ""}
              />
              {emailError && (
                <p className="text-xs text-destructive">{emailError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner_type">Típus</Label>
              <Select
                value={formData.partner_type}
                onValueChange={(value) => setFormData({ ...formData, partner_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Mindkettő (Vevő és Szállító)</SelectItem>
                  <SelectItem value="customer">Vevő</SelectItem>
                  <SelectItem value="supplier">Szállító</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Mégse
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Mentés..." : "Mentés"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invoice detail dialog */}
      <PartnerInvoiceDetailDialog
        invoice={selectedInvoiceForDetail}
        open={isDetailDialogOpen}
        onClose={closeInvoiceDetail}
      />
    </div>
  );
}
