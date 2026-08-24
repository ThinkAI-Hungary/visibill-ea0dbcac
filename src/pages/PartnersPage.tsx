import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
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
import { Search, Plus, Pencil, Trash2, Info, RotateCcw, ChevronDown, BarChart3, Calendar } from "lucide-react";
import { format } from "date-fns";
import { hu } from "date-fns/locale";
import { useDateRange } from "@/contexts/DateRangeContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PartnerRankingCard, type RankedPartner } from "@/components/partners/PartnerRankingCard";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CopyableCell } from "@/components/ui/copyable-cell";
import { UnifiedPagination } from "@/components/ui/unified-pagination";
import { PartnerTypeFilter, PartnerTypeFilterValue } from "@/components/ui/partner-type-filter";
import { ColorPicker, COLOR_PALETTE } from "@/components/IconPicker";
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
  custom_monogram?: string | null;
  custom_color?: string | null;
  custom_bg_color?: string | null;
  related_party?: boolean;
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
  const { dateFrom, dateTo, dateFromFormatted, dateToFormatted } = useDateRange();

  const periodLabel = useMemo(() => {
    if (!dateFrom || !dateTo) return '';
    return `${format(dateFrom, 'yyyy. MMM dd.', { locale: hu })} – ${format(dateTo, 'yyyy. MMM dd.', { locale: hu })}`;
  }, [dateFrom, dateTo]);

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
    custom_monogram: "",
    custom_color: "",
    custom_bg_color: "",
    related_party: false,
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
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePageSize, setInvoicePageSize] = useState(50);
  // Ranking section collapsible state (default open, persisted)
  const [rankingOpen, setRankingOpen] = useState(() => {
    const saved = localStorage.getItem('partners-ranking-open');
    return saved !== null ? saved === 'true' : true;
  });
  const handleRankingToggle = (open: boolean) => {
    setRankingOpen(open);
    localStorage.setItem('partners-ranking-open', String(open));
  };

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
      const [{ data: partnerData, error: partnerError }, { data: navInvoicesData }, { data: uploadedCounts }] = await Promise.all([
        supabase
          .from("partners")
          .select("id, name, tax_number, address, email, partner_type, company_id, user_id, default_project_id, created_at, updated_at, exclude_from_accounting, custom_monogram, custom_color, custom_bg_color, related_party")
          .eq("company_id", selectedCompany.id)
          .order("name", { ascending: true }),
        supabase.from("nav_invoices").select("supplier_tax_number, customer_tax_number, supplier_name, customer_name").eq("company_id", selectedCompany.id),
        supabase.from("invoices").select("elado_vat_id, vevo_vat_id, elado_nev, vevo_nev").eq("company_id", selectedCompany.id),
      ]);

      if (partnerError) throw partnerError;

      const countsMap: Record<string, number> = {};

      // NAV supplier & customer invoices
      (navInvoicesData || []).forEach((inv: any) => {
        if (inv.supplier_tax_number) {
          const cleanTax = inv.supplier_tax_number.substring(0, 8);
          countsMap[cleanTax] = (countsMap[cleanTax] || 0) + 1;
        }
        if (inv.customer_tax_number) {
          const cleanTax = inv.customer_tax_number.substring(0, 8);
          countsMap[cleanTax] = (countsMap[cleanTax] || 0) + 1;
        }
      });
      // Uploaded invoices — count BOTH elado and vevo sides independently
      // Build both tax-based AND name-based count maps
      const nameCountsMap: Record<string, number> = {}; // key: lowercase partner name
      (uploadedCounts || []).forEach((inv: any) => {
        if (inv.elado_vat_id) {
          const cleanTax = inv.elado_vat_id.replace(/-/g, '').replace(/^HU/i, '').substring(0, 8);
          countsMap[cleanTax] = (countsMap[cleanTax] || 0) + 1;
        }
        if (inv.vevo_vat_id) {
          const cleanTax = inv.vevo_vat_id.replace(/-/g, '').replace(/^HU/i, '').substring(0, 8);
          countsMap[cleanTax] = (countsMap[cleanTax] || 0) + 1;
        }
        // Name-based counts for invoices where tax ID is missing
        if (inv.elado_nev && !inv.elado_vat_id) {
          const key = inv.elado_nev.toLowerCase().trim();
          nameCountsMap[key] = (nameCountsMap[key] || 0) + 1;
        }
        if (inv.vevo_nev && !inv.vevo_vat_id) {
          const key = inv.vevo_nev.toLowerCase().trim();
          nameCountsMap[key] = (nameCountsMap[key] || 0) + 1;
        }
      });

      // Name-based invoice counts for FOREIGN partners — computed directly in-memory (0 extra DB queries)
      const foreignPartners = (partnerData as Partner[]).filter(p => isForeignPartner(p.tax_number));
      const foreignCounts: Record<string, number> = {};
      if (foreignPartners.length > 0) {
        foreignPartners.forEach(fp => {
          const lowerName = (fp.name || '').toLowerCase().trim();
          if (!lowerName) return;
          let matchCount = 0;

          (navInvoicesData || []).forEach((inv: any) => {
            const sName = (inv.supplier_name || '').toLowerCase();
            const cName = (inv.customer_name || '').toLowerCase();
            if (sName.includes(lowerName) || cName.includes(lowerName)) {
              matchCount++;
            }
          });

          (uploadedCounts || []).forEach((inv: any) => {
            const eName = (inv.elado_nev || '').toLowerCase();
            const vName = (inv.vevo_nev || '').toLowerCase();
            if (eName.includes(lowerName) || vName.includes(lowerName)) {
              matchCount++;
            }
          });

          foreignCounts[fp.id] = matchCount;
        });
      }

      return (partnerData as Partner[]).map(partner => {
        if (isForeignPartner(partner.tax_number)) {
          return { ...partner, invoice_count: foreignCounts[partner.id] || 0 };
        }
        const cleanTax = partner.tax_number ? partner.tax_number.replace(/-/g, '').substring(0, 8) : '';
        const taxCount = countsMap[cleanTax] || 0;
        // Also add name-based count for invoices without tax IDs
        const nameKey = partner.name.toLowerCase().trim();
        const nameCount = nameCountsMap[nameKey] || 0;
        return {
          ...partner,
          invoice_count: taxCount + nameCount
        };
      });
    },
    enabled: !!user?.id && !!selectedCompany?.id,
    placeholderData: keepPreviousData,
  });

  // ── Fetch partner ranking data ──
  const { data: rankingRaw, isLoading: isRankingLoading } = useQuery({
    queryKey: ['partner-ranking', selectedCompany?.id, dateFromFormatted, dateToFormatted],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase.rpc('get_partner_ranking', {
        p_company_id: selectedCompany.id,
        p_date_from: dateFromFormatted,
        p_date_to: dateToFormatted,
      });
      if (error) throw error;
      return data as Array<{
        partner_tax_number: string;
        partner_name: string;
        direction: string;
        invoice_count: number;
        total_gross: number;
      }>;
    },
    enabled: !!selectedCompany?.id,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  // ── Aggregate ranking: merge HU-prefixed duplicates, split supplier/customer, take top 10 ──
  const { topSuppliers, topCustomers, totalSupplier, totalCustomer } = useMemo(() => {
    if (!rankingRaw) return { topSuppliers: [], topCustomers: [], totalSupplier: 0, totalCustomer: 0 };

    // Normalize tax_number: strip HU prefix, take first 8 digits for grouping
    // FOREIGN: partners keep their full key — each is unique, must not be truncated
    const normalize = (tax: string) => {
      if (tax.startsWith('FOREIGN:')) return tax; // keep full key — truncating would merge all FOREIGN: partners
      const stripped = tax.replace(/^HU/i, '');
      return stripped.substring(0, 8);
    };

    // Determine the merge key for grouping:
    // - FOREIGN: → full key (each is unique)
    // - Pure numeric (HU-style): first 6 digits — handles HU27553202 vs 27553202 variants
    // - Prefixed foreign VAT (EU, GB, DE, etc.): full 8-char key — must NOT truncate,
    //   because EU372041 (OpenAI) and EU372088 (Ynoox) would falsely merge under "EU3720"
    const getMergeKey = (normTax: string): string => {
      if (normTax.startsWith('FOREIGN:')) return normTax;
      // Purely numeric → truncate to 6 for HU-prefix dedup
      if (/^\d+$/.test(normTax)) return normTax.substring(0, 6);
      // Has letter prefix (EU, GB, ATU, etc.) → keep full 8 chars — different companies!
      return normTax;
    };

    // Find partner custom avatar data from partners list
    const partnersByTax = new Map<string, { custom_monogram?: string | null; custom_color?: string | null; custom_bg_color?: string | null }>();
    if (partners) {
      (partners as Partner[]).forEach(p => {
        if (p.tax_number) {
          // FOREIGN: partners use full tax_number as key to match the RPC output
          const clean = p.tax_number.startsWith('FOREIGN:')
            ? p.tax_number
            : p.tax_number.replace(/-/g, '').replace(/^HU/i, '').substring(0, 8);
          partnersByTax.set(clean, { custom_monogram: p.custom_monogram, custom_color: p.custom_color, custom_bg_color: p.custom_bg_color });
        }
      });
    }

    // Aggregate by normalized tax + direction
    const agg = new Map<string, { tax: string; name: string; dir: string; count: number; gross: number }>();
    rankingRaw.forEach(r => {
      const normTax = normalize(r.partner_tax_number);
      const mergeKey = getMergeKey(normTax);
      const fullKey = `${mergeKey}__${r.direction}`;

      const existing = agg.get(fullKey);
      if (existing) {
        existing.count += Number(r.invoice_count);
        existing.gross += Number(r.total_gross);
        // Keep the longer tax and name (more complete)
        if (normTax.length > existing.tax.length) existing.tax = normTax;
        if (r.partner_name.length > existing.name.length) existing.name = r.partner_name;
      } else {
        agg.set(fullKey, { tax: normTax, name: r.partner_name, dir: r.direction, count: Number(r.invoice_count), gross: Number(r.total_gross) });
      }
    });

    const all = Array.from(agg.values());
    const suppliers = all.filter(a => a.dir === 'supplier').sort((a, b) => b.gross - a.gross);
    const customers = all.filter(a => a.dir === 'customer').sort((a, b) => b.gross - a.gross);

    const toRanked = (items: typeof suppliers): RankedPartner[] =>
      items.slice(0, 10).map(item => {
        const avatar = partnersByTax.get(item.tax);
        return {
          tax_number: item.tax,
          name: decodeHtmlEntities(item.name),
          invoice_count: item.count,
          total_gross: item.gross,
          custom_monogram: avatar?.custom_monogram,
          custom_color: avatar?.custom_color,
          custom_bg_color: avatar?.custom_bg_color,
        };
      });

    return {
      topSuppliers: toRanked(suppliers),
      topCustomers: toRanked(customers),
      totalSupplier: suppliers.reduce((s, a) => s + a.gross, 0),
      totalCustomer: customers.reduce((s, a) => s + a.gross, 0),
    };
  }, [rankingRaw, partners]);

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
            : `supplier_tax_number.eq.${selectedPartner.tax_number},customer_tax_number.eq.${selectedPartner.tax_number},supplier_name.ilike."%${escapedName}%",customer_name.ilike."%${escapedName}%"`
          )
          .order('invoice_issue_date', { ascending: false })
          .limit(1000),
        // Uploaded invoices — combine tax + name search for completeness
        supabase
          .from('invoices')
          .select('id, bizonylatsorszam, invoice_direction, brutto_vegosszeg, kibocsatas_datuma, fizetesi_hatarido, penznem, elado_nev, vevo_nev, fizetesi_mod, elado_vat_id, vevo_vat_id')
          .eq('company_id', selectedCompany.id)
          .or(isForeign
            ? `elado_nev.ilike."%${escapedName}%",vevo_nev.ilike."%${escapedName}%"`
            : `elado_vat_id.ilike.${cleanTax}%,vevo_vat_id.ilike.${cleanTax}%,elado_vat_id.ilike.HU${cleanTax}%,vevo_vat_id.ilike.HU${cleanTax}%,elado_nev.ilike."%${escapedName}%",vevo_nev.ilike."%${escapedName}%"`
          )
          .order('kibocsatas_datuma', { ascending: false })
          .limit(1000),
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
        custom_monogram: data.custom_monogram?.trim() || null,
        custom_color: data.custom_color || null,
        custom_bg_color: data.custom_bg_color || null,
        user_id: user.id,
        company_id: selectedCompany?.id || null,
        related_party: data.related_party || false,
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
        custom_monogram: partner.custom_monogram || "",
        custom_color: partner.custom_color || "",
        custom_bg_color: partner.custom_bg_color || "",
        related_party: partner.related_party || false,
      });
    } else {
      setEditingPartner(null);
      setFormData({
        name: "",
        tax_number: "",
        address: "",
        email: "",
        partner_type: "both",
        custom_monogram: "",
        custom_color: "",
        custom_bg_color: "",
        related_party: false,
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
      custom_monogram: "",
      custom_color: "",
      custom_bg_color: "",
      related_party: false,
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
    setInvoicePage(1); // reset pagination on partner switch
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

      {/* ── Ranking & Analytics Section (collapsible) ── */}
      <Collapsible open={rankingOpen} onOpenChange={handleRankingToggle} className="shrink-0">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full group py-1">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground">Rangsor & Kimutatás</span>
            {periodLabel && (
              <Badge variant="outline" className="h-5 text-[10px] font-normal gap-1 bg-background/50 px-2 py-0 border-primary/20 text-primary">
                <Calendar className="h-2.5 w-2.5" />
                <span>{periodLabel}</span>
              </Badge>
            )}
            <ChevronDown className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              rankingOpen && "rotate-180"
            )} />
            <div className="flex-1 h-px bg-border/30 group-hover:bg-border/50 transition-colors" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4">
            <PartnerRankingCard
              title="Top 10 beszállító"
              type="supplier"
              data={topSuppliers}
              totalAll={totalSupplier}
              isLoading={isRankingLoading}
              periodLabel={periodLabel}
              onPartnerClick={(taxNumber) => {
                // Find partner by tax_number and select it
                // FOREIGN: partners: taxNumber is the full FOREIGN:xxx key, match directly
                const match = (partners as Partner[] | undefined)?.find(p => {
                  const clean = p.tax_number?.startsWith('FOREIGN:')
                    ? p.tax_number
                    : p.tax_number?.replace(/-/g, '').replace(/^HU/i, '').substring(0, 8);
                  return clean === taxNumber;
                });
                if (match) {
                  setSelectedPartnerId(match.id);
                  setPartnerParam(match.id);
                }
              }}
            />
            <PartnerRankingCard
              title="Top 10 vevő"
              type="customer"
              data={topCustomers}
              totalAll={totalCustomer}
              isLoading={isRankingLoading}
              periodLabel={periodLabel}
              onPartnerClick={(taxNumber) => {
                // FOREIGN: partners: taxNumber is the full FOREIGN:xxx key, match directly
                const match = (partners as Partner[] | undefined)?.find(p => {
                  const clean = p.tax_number?.startsWith('FOREIGN:')
                    ? p.tax_number
                    : p.tax_number?.replace(/-/g, '').replace(/^HU/i, '').substring(0, 8);
                  return clean === taxNumber;
                });
                if (match) {
                  setSelectedPartnerId(match.id);
                  setPartnerParam(match.id);
                }
              }}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

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
                                  {(partner.custom_color || partner.custom_bg_color) ? (
                                    <AvatarFallback
                                      className="text-xs font-medium"
                                      style={{
                                        backgroundColor: partner.custom_bg_color || (partner.custom_color ? partner.custom_color + '20' : undefined),
                                        color: partner.custom_color || '#fff',
                                      }}
                                    >
                                      {partner.custom_monogram || getInitials(partner.name)}
                                    </AvatarFallback>
                                  ) : (
                                    <AvatarFallback className={`text-xs font-medium ${getAvatarColor(partner.name)}`}>
                                      {partner.custom_monogram || getInitials(partner.name)}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 leading-tight">
                                    <p className="font-semibold text-sm truncate text-foreground">
                                      {decodedName}
                                    </p>
                                    {partner.related_party && (
                                      <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400 font-semibold shrink-0">
                                        Kapcsolt
                                      </Badge>
                                    )}
                                  </div>
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
                disableScrollToTop
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
                    {(selectedPartner.custom_color || selectedPartner.custom_bg_color) ? (
                      <AvatarFallback
                        className="text-sm font-semibold"
                        style={{
                          backgroundColor: selectedPartner.custom_bg_color || (selectedPartner.custom_color ? selectedPartner.custom_color + '20' : undefined),
                          color: selectedPartner.custom_color || '#fff',
                        }}
                      >
                        {selectedPartner.custom_monogram || getInitials(selectedPartner.name)}
                      </AvatarFallback>
                    ) : (
                      <AvatarFallback className={`text-sm font-semibold ${getAvatarColor(selectedPartner.name)}`}>
                        {selectedPartner.custom_monogram || getInitials(selectedPartner.name)}
                      </AvatarFallback>
                    )}
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
                          onClick={() => { setInvoiceTab(tab); setInvoicePage(1); }}
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
                    onChange={(e) => { setInvoiceSearch(e.target.value); setInvoicePage(1); }}
                    className="pl-8 h-8 text-xs bg-background/50"
                  />
                </div>

                {/* Invoice list */}
                <div className="border border-border/30 rounded-xl bg-muted/5 overflow-hidden flex flex-col" style={{ minHeight: '200px' }}>
                  <div className="overflow-y-auto flex-1 p-2 space-y-2" style={{ maxHeight: '350px' }}>
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
                      const totalPages = Math.ceil(filtered.length / invoicePageSize);
                      const safePage = Math.min(invoicePage, totalPages);
                      const paged = filtered.slice((safePage - 1) * invoicePageSize, safePage * invoicePageSize);
                      return paged.map((invoice) => {
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
                  {/* UnifiedPagination — only when multiple pages */}
                  {(() => {
                    const q = invoiceSearch.trim().toLowerCase();
                    const totalFiltered = (partnerInvoices || [])
                      .filter(inv => inv.source === invoiceTab)
                      .filter(inv => !q || (inv.invoice_number || '').toLowerCase().includes(q)).length;
                    const totalPages = Math.ceil(totalFiltered / invoicePageSize);
                    if (totalPages <= 1) return null;
                    return (
                      <div className="border-t border-border/30 px-2 py-1 shrink-0">
                        <UnifiedPagination
                          currentPage={Math.min(invoicePage, totalPages)}
                          totalPages={totalPages}
                          totalItems={totalFiltered}
                          pageSize={invoicePageSize}
                          onPageChange={setInvoicePage}
                          onPageSizeChange={(size) => { setInvoicePageSize(size); setInvoicePage(1); }}
                          pageSizeOptions={[50, 100]}
                          disableScrollToTop
                          className="text-xs [&_button]:h-6 [&_button]:w-6 [&_button]:text-[10px] [&_.text-sm]:text-[10px] [&_select]:h-6 [&_select]:text-[10px]"
                        />
                      </div>
                    );
                  })()}
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
            
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="related_party"
                checked={formData.related_party}
                onCheckedChange={(checked) => setFormData({ ...formData, related_party: !!checked })}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="related_party"
                  className="text-xs font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Kapcsolt vállalkozás
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  A céggel kapcsolt vállalkozási viszonyban álló partner (limit ellenőrzéshez).
                </p>
              </div>
            </div>

            {/* ── Avatar customization ── */}
            <div className="space-y-3 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Megjelenés testreszabása</Label>
                {(formData.custom_monogram || formData.custom_color || formData.custom_bg_color) && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, custom_monogram: '', custom_color: '', custom_bg_color: '' })}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Visszaállítás
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                {/* Live preview */}
                {(() => {
                  const previewMonogram = formData.custom_monogram || (formData.name ? getInitials(formData.name) : '?');
                  const previewColor = formData.custom_color;
                  const previewBg = formData.custom_bg_color;
                  const hasCustom = previewColor || previewBg;
                  return (
                    <div
                      className={cn("h-12 w-12 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 border border-border/50 transition-colors", !hasCustom && getAvatarColor(formData.name || '?'))}
                      style={hasCustom ? {
                        backgroundColor: previewBg || (previewColor ? previewColor + '20' : undefined),
                        color: previewColor || '#fff',
                      } : undefined}
                    >
                      {previewMonogram}
                    </div>
                  );
                })()}
                <div className="flex-1 space-y-2">
                  {/* Monogram input */}
                  <div className="space-y-1">
                    <Label htmlFor="custom_monogram" className="text-xs">Monogram</Label>
                    <Input
                      id="custom_monogram"
                      value={formData.custom_monogram}
                      onChange={(e) => setFormData({ ...formData, custom_monogram: e.target.value.slice(0, 3) })}
                      placeholder={formData.name ? getInitials(formData.name) : 'Auto'}
                      className="h-8 text-xs font-mono uppercase"
                      maxLength={3}
                    />
                  </div>
                </div>
              </div>
              {/* Text color palette */}
              <div className="space-y-1.5">
                <Label className="text-xs">Betűszín</Label>
                <div className="grid grid-cols-10 gap-1.5">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className={cn(
                        "w-7 h-7 rounded-md transition-transform hover:scale-110 outline-none",
                        formData.custom_color === c.value && "scale-110"
                      )}
                      style={{
                        backgroundColor: c.value,
                        boxShadow: formData.custom_color === c.value
                          ? `0 0 0 2px var(--background, #fff), 0 0 0 4px ${c.value}`
                          : undefined,
                      }}
                      onClick={() => setFormData({ ...formData, custom_color: formData.custom_color === c.value ? '' : c.value })}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
              {/* Background color palette */}
              <div className="space-y-1.5">
                <Label className="text-xs">Háttérszín</Label>
                <div className="grid grid-cols-10 gap-1.5">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={`bg-${c.value}`}
                      type="button"
                      className={cn(
                        "w-7 h-7 rounded-md transition-transform hover:scale-110 outline-none",
                        formData.custom_bg_color === c.value && "scale-110"
                      )}
                      style={{
                        backgroundColor: c.value,
                        boxShadow: formData.custom_bg_color === c.value
                          ? `0 0 0 2px var(--background, #fff), 0 0 0 4px ${c.value}`
                          : undefined,
                      }}
                      onClick={() => setFormData({ ...formData, custom_bg_color: formData.custom_bg_color === c.value ? '' : c.value })}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
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
