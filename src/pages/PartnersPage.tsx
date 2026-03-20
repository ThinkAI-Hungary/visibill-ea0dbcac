import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CopyableCell } from "@/components/ui/copyable-cell";
import { UnifiedPagination } from "@/components/ui/unified-pagination";
import { PartnerTypeFilter, PartnerTypeFilterValue } from "@/components/ui/partner-type-filter";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { TableEmptyState } from "@/components/ui/table-empty-state";
import { TablePlaceholderRows } from "@/components/ui/table-placeholder-rows";

const DEFAULT_PAGE_SIZE = 20;

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

  // Fetch partners - company scoped (required)
  const { data: partners, isLoading } = useQuery({
    queryKey: ["partners", selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Partner[];
    },
    enabled: !!user?.id && !!selectedCompany?.id,
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
      queryClient.invalidateQueries({ queryKey: ["partners"] });
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
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      toast({
        title: "Partner törölve",
        description: "A partner sikeresen törölve.",
      });
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
          p.tax_number.toLowerCase().includes(query) ||
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
        tax_number: partner.tax_number,
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

  const validateEmail = (email: string): boolean => {
    if (!email.trim()) return true; // optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.tax_number.trim()) {
      toast({
        title: "Hiányzó adatok",
        description: "A név és adószám megadása kötelező.",
        variant: "destructive",
      });
      return;
    }
    if (formData.email && !validateEmail(formData.email)) {
      setEmailError("Érvénytelen email-cím formátum");
      return;
    }
    setEmailError("");
    saveMutation.mutate({
      ...formData,
      id: editingPartner?.id,
    });
  };

  const handleDelete = (partner: Partner) => {
    if (confirm(`Biztosan törölni szeretnéd a "${decodeHtmlEntities(partner.name)}" partnert?`)) {
      deleteMutation.mutate(partner.id);
    }
  };


  return (
    <div className="h-full space-y-2 px-2 pt-0 pb-0">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Partnertörzs</h1>
        <p className="text-muted-foreground">
          Vevők és szállítók kezelése
        </p>
      </div>

      {/* Main Card */}
      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-4">
          {/* Unified Toolbar */}
          <div className="flex flex-col gap-3 mb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <PartnerTypeFilter
                  value={typeFilter}
                  onChange={handleTypeFilterChange}
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Keresés..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10 bg-background/50 h-9"
                  />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="icon" variant="outline" className="h-9 w-9 shrink-0">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="flex gap-3">
                      <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        Úgy tudsz új partnert létrehozni, ha beküldesz egy számlát, amin az új partner szerepel, vagy kiállítasz egy számlát egy új partnernek.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Top Pagination */}
            {totalFiltered > 0 && (
              <UnifiedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalFiltered}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={handlePageSizeChange}
              />
            )}
          </div>

          {/* Table */}
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table className="table-fixed compact-table">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[28%]">
                    Név
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[18%]">
                    Adószám
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[24%]">
                    Cím
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[14%]">
                    Típus
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right w-[16%]">
                    Műveletek
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton rows={10} columns={5} />
                ) : paginatedPartners.length === 0 ? (
                  <TableEmptyState
                    colSpan={5}
                    title={searchQuery || typeFilter !== 'all' ? 'Nincs találat a szűrésre' : 'Még nincsenek partnerek'}
                    description={searchQuery || typeFilter !== 'all' ? 'Próbáld módosítani a szűrőket.' : 'Küldj be egy számlát, hogy automatikusan megjelenjen a partner.'}
                    onClearFilters={searchQuery || typeFilter !== 'all' ? () => { setSearchQuery(''); setTypeFilter('all'); } : undefined}
                  />
                ) : (
                  paginatedPartners.map((partner) => {
                    const decodedName = decodeHtmlEntities(partner.name);
                    const decodedAddress = partner.address ? decodeHtmlEntities(partner.address) : null;
                    return (
                      <TableRow
                        key={partner.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className={`text-xs font-medium ${getAvatarColor(partner.name)}`}>
                                {getInitials(partner.name)}
                              </AvatarFallback>
                            </Avatar>
                            <CopyableCell
                              value={decodedName}
                              truncate
                              maxWidth="160px"
                              className="font-medium text-sm"
                              ariaLabel="Név másolása"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <CopyableCell
                            value={partner.tax_number}
                            className="font-mono text-xs text-muted-foreground"
                            ariaLabel="Adószám másolása"
                          />
                        </TableCell>
                        <TableCell>
                          {decodedAddress ? (
                            <CopyableCell
                              value={decodedAddress}
                              truncate
                              maxWidth="180px"
                              className="text-xs text-muted-foreground"
                              ariaLabel="Cím másolása"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {partner.partner_type === 'customer' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-500">
                              Vevő
                            </span>
                          )}
                          {partner.partner_type === 'supplier' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-500">
                              Szállító
                            </span>
                          )}
                          {partner.partner_type === 'both' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                              Mindkettő
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(partner)}
                              className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(partner)}
                              className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
                <TablePlaceholderRows currentCount={paginatedPartners.length} pageSize={pageSize} columns={5} />
              </TableBody>
            </Table>
          </div>

          {/* Bottom Pagination */}
          {totalPages > 1 && (
            <UnifiedPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalFiltered}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={handlePageSizeChange}
              className="pt-3"
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Partner szerkesztése
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
              <Label htmlFor="tax_number">Adószám *</Label>
              <Input
                id="tax_number"
                value={formData.tax_number}
                onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                placeholder="12345678-1-23"
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
    </div>
  );
}
