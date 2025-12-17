import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "@/hooks/use-toast";
import { Search, Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const ITEMS_PER_PAGE = 15;

interface Partner {
  id: string;
  name: string;
  tax_number: string;
  address: string | null;
  partner_type: string;
  company_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// Helper to decode HTML entities
const decodeHtmlEntities = (text: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

// Helper to get initials from name
const getInitials = (name: string): string => {
  const decoded = decodeHtmlEntities(name);
  const words = decoded.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return decoded.slice(0, 2).toUpperCase();
};

// Generate consistent color based on name
const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-primary/20 text-primary',
    'bg-blue-500/20 text-blue-500',
    'bg-purple-500/20 text-purple-500',
    'bg-amber-500/20 text-amber-500',
    'bg-emerald-500/20 text-emerald-500',
    'bg-rose-500/20 text-rose-500',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function PartnersPage() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    tax_number: "",
    address: "",
    partner_type: "both",
  });

  // Fetch partners - company scoped (required)
  const { data: partners, isLoading } = useQuery({
    queryKey: ["partners", user?.id, selectedCompany?.id],
    queryFn: async () => {
      if (!user?.id || !selectedCompany?.id) return [];
      
      const { data, error } = await supabase
        .from("partners")
        .select("*")
        .eq("user_id", user.id)
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

  // Filter partners by search query and paginate
  const { paginatedPartners, totalPages, totalFiltered, hasAnyAddress } = useMemo(() => {
    if (!partners) return { paginatedPartners: [], totalPages: 0, totalFiltered: 0, hasAnyAddress: false };
    
    let filtered = partners;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = partners.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.tax_number.toLowerCase().includes(query)
      );
    }
    
    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedPartners = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const hasAnyAddress = partners.some(p => p.address);
    
    return { paginatedPartners, totalPages, totalFiltered, hasAnyAddress };
  }, [partners, searchQuery, currentPage]);

  // Reset page when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleOpenDialog = (partner?: Partner) => {
    if (partner) {
      setEditingPartner(partner);
      setFormData({
        name: partner.name,
        tax_number: partner.tax_number,
        address: partner.address || "",
        partner_type: partner.partner_type,
      });
    } else {
      setEditingPartner(null);
      setFormData({
        name: "",
        tax_number: "",
        address: "",
        partner_type: "both",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPartner(null);
    setFormData({
      name: "",
      tax_number: "",
      address: "",
      partner_type: "both",
    });
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

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Partnertörzs</h1>
        <p className="text-muted-foreground">
          Vevők és szállítók kezelése
        </p>
      </div>

      {/* Main Card */}
      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          {/* Unified Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold">
              Partnerek <span className="text-muted-foreground font-normal">({totalFiltered})</span>
            </h2>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Keresés név vagy adószám alapján..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10 bg-background/50"
                />
              </div>
              <Button onClick={() => handleOpenDialog()} className="shrink-0">
                <Plus className="h-4 w-4 mr-2" />
                Új partner
              </Button>
            </div>
          </div>

          {/* Table or Empty State */}
          {paginatedPartners.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              {searchQuery ? (
                <p>Nincs találat a keresésre: "{searchQuery}"</p>
              ) : (
                <p>Még nincsenek partnerek. Kattints az "Új partner" gombra a hozzáadáshoz.</p>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Név
                      </TableHead>
                      <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Adószám
                      </TableHead>
                      {hasAnyAddress && (
                        <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Cím
                        </TableHead>
                      )}
                      <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Típus
                      </TableHead>
                      <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right w-[100px]">
                        Műveletek
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPartners.map((partner) => {
                      const decodedName = decodeHtmlEntities(partner.name);
                      return (
                        <TableRow 
                          key={partner.id} 
                          className="hover:bg-muted/40 transition-colors"
                        >
                          <TableCell className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9 shrink-0">
                                <AvatarFallback className={`text-xs font-medium ${getAvatarColor(partner.name)}`}>
                                  {getInitials(partner.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{decodedName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 px-4">
                            <span className="font-mono text-sm text-muted-foreground">
                              {partner.tax_number}
                            </span>
                          </TableCell>
                          {hasAnyAddress && (
                            <TableCell className="py-4 px-4 text-muted-foreground text-sm">
                              {partner.address ? decodeHtmlEntities(partner.address) : "—"}
                            </TableCell>
                          )}
                          <TableCell className="py-4 px-4">
                            {partner.partner_type === 'customer' && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-500">
                                Vevő
                              </span>
                            )}
                            {partner.partner_type === 'supplier' && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-500">
                                Szállító
                              </span>
                            )}
                            {partner.partner_type === 'both' && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                                Mindkettő
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(partner)}
                                className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(partner)}
                                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-6">
                  <p className="text-sm text-muted-foreground">
                    {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, totalFiltered)} / {totalFiltered} partner
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Előző
                    </Button>
                    <span className="text-sm text-muted-foreground px-3">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Következő
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPartner ? "Partner szerkesztése" : "Új partner"}
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
