import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { toast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Wallet, 
  Users, 
  TrendingUp, 
  Calendar,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { hu } from "date-fns/locale";

const MONTHS = [
  { value: "0", label: "Január" },
  { value: "1", label: "Február" },
  { value: "2", label: "Március" },
  { value: "3", label: "Április" },
  { value: "4", label: "Május" },
  { value: "5", label: "Június" },
  { value: "6", label: "Július" },
  { value: "7", label: "Augusztus" },
  { value: "8", label: "Szeptember" },
  { value: "9", label: "Október" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

interface Salary {
  id: string;
  név: string;
  összeg: number;
  dátum: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to get initials from name
const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
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

export default function SalariesPage() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 11;
  
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
        .order("dátum", { ascending: false, nullsFirst: false });

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

  // Filter salaries by selected month
  const filteredSalaries = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    
    return salaries.filter((salary) => {
      const matchesSearch = salary.név.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filter by month if salary has a date
      if (salary.dátum) {
        const salaryDate = new Date(salary.dátum);
        const matchesMonth = salaryDate >= monthStart && salaryDate <= monthEnd;
        return matchesSearch && matchesMonth;
      }
      
      return matchesSearch;
    });
  }, [salaries, searchTerm, selectedMonth]);

  // Paginated salaries
  const paginatedSalaries = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredSalaries.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredSalaries, currentPage]);

  const totalPages = Math.ceil(filteredSalaries.length / ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMonth]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalAmount = filteredSalaries.reduce((sum, s) => sum + s.összeg, 0);
    const employeeCount = new Set(filteredSalaries.map(s => s.név)).size;
    const avgSalary = employeeCount > 0 ? totalAmount / employeeCount : 0;
    
    // Calculate previous month for comparison
    const prevMonth = subMonths(selectedMonth, 1);
    const prevMonthStart = startOfMonth(prevMonth);
    const prevMonthEnd = endOfMonth(prevMonth);
    
    const prevMonthSalaries = salaries.filter(s => {
      if (s.dátum) {
        const salaryDate = new Date(s.dátum);
        return salaryDate >= prevMonthStart && salaryDate <= prevMonthEnd;
      }
      return false;
    });
    
    const prevTotalAmount = prevMonthSalaries.reduce((sum, s) => sum + s.összeg, 0);
    const trendPercent = prevTotalAmount > 0 
      ? ((totalAmount - prevTotalAmount) / prevTotalAmount * 100).toFixed(1)
      : null;
    
    return { totalAmount, employeeCount, avgSalary, trendPercent };
  }, [filteredSalaries, salaries, selectedMonth]);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("hu-HU", {
      style: "currency",
      currency: "HUF",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    try {
      return format(new Date(dateString), "yyyy. MMM d.", { locale: hu });
    } catch {
      return dateString;
    }
  };

  // Determine status based on date (simplified: past date = paid, future = pending)
  const getPaymentStatus = (dateString: string | null) => {
    if (!dateString) return "pending";
    const paymentDate = new Date(dateString);
    const today = new Date();
    return paymentDate <= today ? "paid" : "pending";
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Betöltés...</div>;
  }

  return (
    <div className="h-full space-y-4 px-2 py-2">
      {/* Header with Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bérek</h1>
          <p className="text-muted-foreground">
            Alkalmazottak bérének kezelése
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Year & Month Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedMonth.getFullYear().toString()}
              onValueChange={(year) => {
                const newDate = new Date(selectedMonth);
                newDate.setFullYear(parseInt(year));
                setSelectedMonth(newDate);
              }}
            >
              <SelectTrigger className="w-[100px] bg-muted/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => {
                  const year = new Date().getFullYear() - 5 + i;
                  return (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Select
              value={selectedMonth.getMonth().toString()}
              onValueChange={(month) => {
                const newDate = new Date(selectedMonth);
                newDate.setMonth(parseInt(month));
                setSelectedMonth(newDate);
              }}
            >
              <SelectTrigger className="w-[140px] bg-muted/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-none">
                {MONTHS.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <DialogContent className="max-w-md">
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
                    step="1"
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
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Payroll */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Összes kifizetés
                </p>
                <p className="text-2xl font-bold">{formatCurrency(metrics.totalAmount)}</p>
                {metrics.trendPercent !== null && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className={`h-3 w-3 ${parseFloat(metrics.trendPercent) >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                    <span className={`text-xs font-medium ${parseFloat(metrics.trendPercent) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {parseFloat(metrics.trendPercent) >= 0 ? '+' : ''}{metrics.trendPercent}%
                    </span>
                    <span className="text-xs text-muted-foreground">előző hónaphoz</span>
                  </div>
                )}
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Employee Count */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Alkalmazottak
                </p>
                <p className="text-2xl font-bold">{metrics.employeeCount}</p>
                <p className="text-xs text-muted-foreground">
                  {filteredSalaries.length} kifizetés
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Salary */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Átlagbér
                </p>
                <p className="text-2xl font-bold">{formatCurrency(metrics.avgSalary)}</p>
                <p className="text-xs text-muted-foreground">
                  / alkalmazott
                </p>
              </div>
              <div className="p-3 rounded-full bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          {/* Search Bar */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold">
              Kifizetések <span className="text-muted-foreground font-normal">({filteredSalaries.length})</span>
            </h2>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Keresés név alapján..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background/50"
              />
            </div>
          </div>

          {/* Table */}
          {filteredSalaries.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nincs bejegyzés ebben a hónapban</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[40%]">
                      Alkalmazott
                    </TableHead>
                    <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right w-[15%]">
                      Összeg
                    </TableHead>
                    <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[15%]">
                      Dátum
                    </TableHead>
                    <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[15%]">
                      Státusz
                    </TableHead>
                    <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right w-[15%]">
                      Műveletek
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSalaries.map((salary) => {
                    const status = getPaymentStatus(salary.dátum);
                    return (
                      <TableRow 
                        key={salary.id} 
                        className="hover:bg-muted/40 transition-colors h-[52px]"
                      >
                        <TableCell className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarFallback className={`text-xs font-medium ${getAvatarColor(salary.név)}`}>
                                {getInitials(salary.név)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{salary.név}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-4 text-right">
                          <span className="font-mono font-semibold">
                            {formatCurrency(salary.összeg)}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-4 text-muted-foreground">
                          {formatDate(salary.dátum)}
                        </TableCell>
                        <TableCell className="py-4 px-4">
                          {status === 'paid' ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-500">
                              Kifizetve
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-500">
                              Függőben
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                              onClick={() => handleEdit(salary)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleDelete(salary.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Empty placeholder rows to maintain consistent table height */}
                  {Array.from({ length: Math.max(0, ITEMS_PER_PAGE - paginatedSalaries.length) }).map((_, index) => (
                    <TableRow key={`empty-${index}`} className="h-[65px]">
                      <TableCell className="py-4 px-4">&nbsp;</TableCell>
                      <TableCell className="py-4 px-4">&nbsp;</TableCell>
                      <TableCell className="py-4 px-4">&nbsp;</TableCell>
                      <TableCell className="py-4 px-4">&nbsp;</TableCell>
                      <TableCell className="py-4 px-4">&nbsp;</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Összesen {filteredSalaries.length} bejegyzés, {currentPage}. oldal / {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Előző
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Következő
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
