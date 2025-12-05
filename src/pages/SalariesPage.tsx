import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, Trash2, Edit, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Salary {
  id: string;
  név: string;
  összeg: number;
  dátum: string | null;
  created_at: string;
  updated_at: string;
}

export default function SalariesPage() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    név: "",
    összeg: "",
    dátum: "",
  });

  useEffect(() => {
    fetchSalaries();
  }, [selectedCompany]);

  const fetchSalaries = async () => {
    if (!user || !selectedCompany) return;
    
    try {
      const { data, error } = await supabase
        .from("salary")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSalaries(data || []);
    } catch (error) {
      console.error("Error fetching salaries:", error);
      toast({
        variant: "destructive",
        title: "Hiba",
        description: "Nem sikerült betölteni a béreket.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompany) return;

    try {
      const dataToSubmit = {
        user_id: user.id,
        company_id: selectedCompany.id,
        név: formData.név,
        összeg: parseFloat(formData.összeg),
        dátum: formData.dátum || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("salary")
          .update(dataToSubmit)
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Siker", description: "Bejegyzés frissítve." });
      } else {
        const { error } = await supabase
          .from("salary")
          .insert([dataToSubmit]);

        if (error) throw error;
        toast({ title: "Siker", description: "Új bejegyzés hozzáadva." });
      }

      setDialogOpen(false);
      resetForm();
      fetchSalaries();
    } catch (error) {
      console.error("Error saving salary:", error);
      toast({
        variant: "destructive",
        title: "Hiba",
        description: "Nem sikerült menteni a bejegyzést.",
      });
    }
  };

  const handleEdit = (salary: Salary) => {
    setEditingId(salary.id);
    setFormData({
      név: salary.név,
      összeg: salary.összeg.toString(),
      dátum: salary.dátum || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Biztosan törölni szeretnéd ezt a bejegyzést?")) return;

    try {
      const { error } = await supabase
        .from("salary")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Siker", description: "Bejegyzés törölve." });
      fetchSalaries();
    } catch (error) {
      console.error("Error deleting salary:", error);
      toast({
        variant: "destructive",
        title: "Hiba",
        description: "Nem sikerült törölni a bejegyzést.",
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      név: "",
      összeg: "",
      dátum: "",
    });
  };

  const filteredSalaries = salaries.filter((salary) => {
    const matchesSearch = salary.név.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const totalAmount = filteredSalaries.reduce((sum, s) => sum + s.összeg, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("hu-HU", {
      style: "currency",
      currency: "HUF",
    }).format(amount);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Betöltés...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">Bérek</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-5 w-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Rögzítsd és kezeld az alkalmazottak bérét. Kövesd nyomon a kifizetéseket egyszerűen.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-muted-foreground">Alkalmazottak bérének kezelése</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Új bejegyzés
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Bejegyzés szerkesztése" : "Új bejegyzés hozzáadása"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="név">Alkalmazott neve *</Label>
                <Input
                  id="név"
                  value={formData.név}
                  onChange={(e) => setFormData({ ...formData, név: e.target.value })}
                  placeholder="Alkalmazott teljes neve"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="összeg">Bér összege (HUF) *</Label>
                <Input
                  id="összeg"
                  type="number"
                  step="0.01"
                  value={formData.összeg}
                  onChange={(e) => setFormData({ ...formData, összeg: e.target.value })}
                  placeholder="0"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dátum">Fizetés dátuma</Label>
                <Input
                  id="dátum"
                  type="date"
                  value={formData.dátum}
                  onChange={(e) => setFormData({ ...formData, dátum: e.target.value })}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setDialogOpen(false);
                  resetForm();
                }}>
                  Mégse
                </Button>
                <Button type="submit">
                  {editingId ? "Frissítés" : "Hozzáadás"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Összes bér</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Bejegyzések száma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSalaries.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Keresés név alapján..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alkalmazott neve</TableHead>
                <TableHead className="text-right">Összeg</TableHead>
                <TableHead>Fizetés dátuma</TableHead>
                <TableHead className="text-right">Műveletek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSalaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nincs megjeleníthető bejegyzés
                  </TableCell>
                </TableRow>
              ) : (
                filteredSalaries.map((salary) => (
                  <TableRow key={salary.id}>
                    <TableCell className="font-medium">{salary.név}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(salary.összeg)}
                    </TableCell>
                    <TableCell>{salary.dátum || "-"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(salary)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(salary.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
