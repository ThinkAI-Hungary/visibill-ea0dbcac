import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Search, Plus, Pencil, Trash2, Users, ChevronLeft, ChevronRight } from "lucide-react";

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
  const { paginatedPartners, totalPages, totalFiltered } = useMemo(() => {
    if (!partners) return { paginatedPartners: [], totalPages: 0, totalFiltered: 0 };
    
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
    
    return { paginatedPartners, totalPages, totalFiltered };
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
    if (confirm(`Biztosan törölni szeretnéd a "${partner.name}" partnert?`)) {
      deleteMutation.mutate(partner.id);
    }
  };

  const getPartnerTypeLabel = (type: string) => {
    switch (type) {
      case "customer":
        return "Vevő";
      case "supplier":
        return "Szállító";
      case "both":
      default:
        return "Mindkettő";
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Partnertörzs</h1>
          <p className="text-muted-foreground">
            Vevők és szállítók kezelése
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Új partner
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Partnerek ({totalFiltered})
            </CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Keresés név vagy adószám alapján..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {paginatedPartners.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? (
                <p>Nincs találat a keresésre: "{searchQuery}"</p>
              ) : (
                <p>Még nincsenek partnerek. Kattints az "Új partner" gombra a hozzáadáshoz.</p>
              )}
            </div>
          ) : (
            <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Név</TableHead>
                    <TableHead>Adószám</TableHead>
                    <TableHead>Cím</TableHead>
                    <TableHead>Típus</TableHead>
                    <TableHead className="w-[100px]">Műveletek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPartners.map((partner) => (
                    <TableRow key={partner.id}>
                      <TableCell className="font-medium">{partner.name}</TableCell>
                      <TableCell className="font-mono text-sm">{partner.tax_number}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {partner.address || "-"}
                      </TableCell>
                      <TableCell>{getPartnerTypeLabel(partner.partner_type)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
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
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, totalFiltered)} / {totalFiltered} partner
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Előző
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Következő
                    <ChevronRight className="h-4 w-4" />
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
