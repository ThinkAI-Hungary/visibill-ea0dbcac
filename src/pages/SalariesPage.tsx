import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
import { Plus, Search, FileText, Trash2, Edit, ExternalLink, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";

interface Salary {
  id: string;
  payment_type: string;
  employee_name: string | null;
  recipient_name: string;
  description: string;
  amount_to_transfer: number;
  payment_date: string | null;
  due_date: string | null;
  period_month: number | null;
  period_year: number | null;
  status: string;
  payment_reference: string | null;
  file_url: string | null;
  file_name: string | null;
  source: string;
  created_at: string;
}

const PAYMENT_TYPES = [
  { value: "salary", label: "Bér" },
  { value: "tax_contribution", label: "TB járulék" },
  { value: "social_security", label: "Társadalombiztosítás" },
  { value: "health_insurance", label: "EHO" },
  { value: "pension", label: "Nyugdíj" },
  { value: "other", label: "Egyéb" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Függőben", color: "bg-yellow-500" },
  { value: "paid", label: "Kifizetve", color: "bg-green-500" },
  { value: "overdue", label: "Lejárt", color: "bg-red-500" },
  { value: "cancelled", label: "Törölt", color: "bg-gray-500" },
];

export default function SalariesPage() {
  const { user } = useAuth();
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    payment_type: "salary",
    employee_name: "",
    recipient_name: "",
    description: "",
    amount_to_transfer: "",
    payment_date: "",
    due_date: "",
    period_month: "",
    period_year: new Date().getFullYear().toString(),
    status: "pending",
    payment_reference: "",
  });

  useEffect(() => {
    fetchSalaries();
  }, []);

  const fetchSalaries = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("salary_files")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSalaries(data || []);
    } catch (error) {
      console.error("Error fetching salaries:", error);
      toast({
        variant: "destructive",
        title: "Hiba",
        description: "Nem sikerült betölteni a béreket és járulékokat.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const dataToSubmit = {
        user_id: user.id,
        payment_type: formData.payment_type,
        employee_name: formData.employee_name || null,
        recipient_name: formData.recipient_name,
        description: formData.description,
        amount_to_transfer: parseFloat(formData.amount_to_transfer),
        payment_date: formData.payment_date || null,
        due_date: formData.due_date || null,
        period_month: formData.period_month ? parseInt(formData.period_month) : null,
        period_year: formData.period_year ? parseInt(formData.period_year) : null,
        status: formData.status,
        payment_reference: formData.payment_reference || null,
        source: "manual",
      };

      if (editingId) {
        const { error } = await supabase
          .from("salary_files")
          .update(dataToSubmit)
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Siker", description: "Bejegyzés frissítve." });
      } else {
        const { error } = await supabase
          .from("salary_files")
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
      payment_type: salary.payment_type,
      employee_name: salary.employee_name || "",
      recipient_name: salary.recipient_name,
      description: salary.description,
      amount_to_transfer: salary.amount_to_transfer.toString(),
      payment_date: salary.payment_date || "",
      due_date: salary.due_date || "",
      period_month: salary.period_month?.toString() || "",
      period_year: salary.period_year?.toString() || "",
      status: salary.status,
      payment_reference: salary.payment_reference || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Biztosan törölni szeretnéd ezt a bejegyzést?")) return;

    try {
      const { error } = await supabase
        .from("salary_files")
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
      payment_type: "salary",
      employee_name: "",
      recipient_name: "",
      description: "",
      amount_to_transfer: "",
      payment_date: "",
      due_date: "",
      period_month: "",
      period_year: new Date().getFullYear().toString(),
      status: "pending",
      payment_reference: "",
    });
  };

  const filteredSalaries = salaries.filter((salary) => {
    const matchesSearch =
      salary.recipient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      salary.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (salary.employee_name && salary.employee_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || salary.status === statusFilter;
    const matchesType = typeFilter === "all" || salary.payment_type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const totalPending = filteredSalaries
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + s.amount_to_transfer, 0);

  const totalPaid = filteredSalaries
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + s.amount_to_transfer, 0);

  const getStatusBadge = (status: string) => {
    const statusConfig = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <Badge className={statusConfig?.color}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getPaymentTypeLabel = (type: string) => {
    return PAYMENT_TYPES.find((t) => t.value === type)?.label || type;
  };

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
            <h1 className="text-3xl font-bold">Bérek és járulékok</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-5 w-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Kezeld a bérek kifizetéseit és az adó/járulék kötelezettségeket. Feltölthetsz fájlokat vagy manuálisan rögzíthetsz bejegyzéseket.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-muted-foreground">Kezelje a béreket és kormányzati járulékokat</p>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_type">Típus *</Label>
                  <Select
                    value={formData.payment_type}
                    onValueChange={(value) => setFormData({ ...formData, payment_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Státusz *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipient_name">Címzett *</Label>
                <Input
                  id="recipient_name"
                  value={formData.recipient_name}
                  onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                  placeholder="Alkalmazott neve vagy kormányzati szerv"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee_name">Alkalmazott neve</Label>
                <Input
                  id="employee_name"
                  value={formData.employee_name}
                  onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                  placeholder="Alkalmazott neve (opcionális)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Megnevezés *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Részletes leírás"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount_to_transfer">Utalandó összeg (HUF) *</Label>
                  <Input
                    id="amount_to_transfer"
                    type="number"
                    step="0.01"
                    value={formData.amount_to_transfer}
                    onChange={(e) => setFormData({ ...formData, amount_to_transfer: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_reference">Közlemény</Label>
                  <Input
                    id="payment_reference"
                    value={formData.payment_reference}
                    onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                    placeholder="Utalási közlemény"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_date">Fizetés dátuma</Label>
                  <Input
                    id="payment_date"
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">Esedékesség</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="period_month">Időszak (hónap)</Label>
                  <Select
                    value={formData.period_month}
                    onValueChange={(value) => setFormData({ ...formData, period_month: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Válasszon" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <SelectItem key={month} value={month.toString()}>
                          {month}. hónap
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="period_year">Év</Label>
                  <Input
                    id="period_year"
                    type="number"
                    value={formData.period_year}
                    onChange={(e) => setFormData({ ...formData, period_year: e.target.value })}
                  />
                </div>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Függőben lévő</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPending)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Kifizetve</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPaid)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Összesen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredSalaries.length} bejegyzés</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Keresés név vagy leírás alapján..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Típus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Minden típus</SelectItem>
                {PAYMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Státusz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Minden státusz</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Típus</TableHead>
                <TableHead>Címzett</TableHead>
                <TableHead>Megnevezés</TableHead>
                <TableHead>Időszak</TableHead>
                <TableHead className="text-right">Utalandó</TableHead>
                <TableHead>Esedékesség</TableHead>
                <TableHead>Státusz</TableHead>
                <TableHead>Forrás</TableHead>
                <TableHead className="text-right">Műveletek</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSalaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Nincs megjeleníthető bejegyzés
                  </TableCell>
                </TableRow>
              ) : (
                filteredSalaries.map((salary) => (
                  <TableRow key={salary.id}>
                    <TableCell>
                      <Badge variant="outline">{getPaymentTypeLabel(salary.payment_type)}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{salary.recipient_name}</TableCell>
                    <TableCell className="max-w-xs truncate">{salary.description}</TableCell>
                    <TableCell>
                      {salary.period_year && salary.period_month
                        ? `${salary.period_year}. ${salary.period_month}.`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(salary.amount_to_transfer)}
                    </TableCell>
                    <TableCell>{salary.due_date || "-"}</TableCell>
                    <TableCell>{getStatusBadge(salary.status)}</TableCell>
                    <TableCell>
                      <Badge variant={salary.source === "manual" ? "secondary" : "default"}>
                        {salary.source === "manual" ? "Kézi" : "Automatikus"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {salary.file_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(salary.file_url!, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
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
