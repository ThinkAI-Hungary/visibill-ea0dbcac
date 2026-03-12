import { useState, useEffect, useMemo } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useDateRange } from "@/contexts/DateRangeContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Edit,
  Wallet,
  Users,
  TrendingUp,
  Banknote,
} from "lucide-react";
import { format } from "date-fns";
import { hu } from "date-fns/locale";
import { UnifiedPagination } from "@/components/ui/unified-pagination";

// ---------- Types ----------

interface SalaryItem {
  id: string;
  név: string;
  összeg: number;
  dátum: string | null;
  tipus: string | null;
  statusz: string | null;
  kifizetes_ideje: string | null;
  fizetesi_mod: string | null;
  megjegyzes: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Helpers ----------

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "HUF",
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (dateString: string | null) => {
  if (!dateString) return "—";
  try {
    return format(new Date(dateString), "yyyy. MMM d.", { locale: hu });
  } catch {
    return dateString;
  }
};

const getTypeBadge = (tipus: string | null) => {
  const t = tipus?.toLowerCase() ?? "";
  if (t === "bér")
    return { label: "Bér", className: "bg-purple-500/15 text-purple-500 border-purple-500/20" };
  if (t === "bruttó_bér")
    return { label: "Bruttó Bér", className: "bg-indigo-500/15 text-indigo-500 border-indigo-500/20" };
  if (t === "áfa")
    return { label: "ÁFA", className: "bg-blue-500/15 text-blue-500 border-blue-500/20" };
  if (t === "adó")
    return { label: "Adó", className: "bg-rose-500/15 text-rose-500 border-rose-500/20" };
  if (t === "járulék")
    return { label: "Járulék", className: "bg-amber-500/15 text-amber-500 border-amber-500/20" };
  return { label: tipus || "—", className: "bg-muted text-muted-foreground border-border" };
};

// ---------- Component ----------

export default function SalariesPage() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { dateFrom, dateTo } = useDateRange();

  const [salaryItems, setSalaryItems] = useState<SalaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // "+ KP kifizetés" modal
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    megnevezes: "",
    osszeg: "",
    datum: new Date().toISOString().slice(0, 10),
  });

  // Edit modal
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SalaryItem | null>(null);
  const [editForm, setEditForm] = useState({
    megnevezes: "",
    megjegyzes: "",
  });

  // ---------- Fetch ----------

  useEffect(() => {
    fetchSalaryItems();
  }, [selectedCompany, dateFrom, dateTo]);

  const fetchSalaryItems = async () => {
    if (!user || !selectedCompany) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("salary")
        .select("*")
        .eq("company_id", selectedCompany.id)
        .gte("dátum", dateFrom.toISOString().slice(0, 10))
        .lte("dátum", dateTo.toISOString().slice(0, 10))
        .order("dátum", { ascending: false, nullsFirst: false });

      if (error) throw error;
      setSalaryItems((data as unknown as SalaryItem[]) || []);
    } catch (error) {
      console.error("Error fetching salary items:", error);
      toast({
        variant: "destructive",
        title: "Hiba",
        description: "Nem sikerült betölteni a béreket.",
      });
    } finally {
      setLoading(false);
    }
  };

  // ---------- Filtered & paginated ----------

  const filteredItems = useMemo(() => {
    return salaryItems.filter((item) =>
      item.név.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [salaryItems, searchTerm]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredItems.length / pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // ---------- KPI metrics (exact user spec) ----------

  const metrics = useMemo(() => {
    // KPI 1: Összes kifizetés – statusz === 'Kifizetve' szummája
    const totalPayments = salaryItems
      .filter((item) => item.statusz === "Kifizetve")
      .reduce((sum, item) => sum + Number(item.összeg), 0);

    // KPI 2: Alkalmazottak száma – egyedi nevek ahol tipus === 'bér'
    const employeeCount = new Set(
      salaryItems
        .filter((item) => item.tipus === "bér")
        .map((item) => item.név)
    ).size;

    // KPI 3: Összes nettó bérköltség – tipus === 'bér' szummája
    const netSalary = salaryItems
      .filter((item) => item.tipus === "bér")
      .reduce((sum, item) => sum + Number(item.összeg), 0);

    // KPI 4: Összes bruttó bérköltség – tipus === 'bruttó_bér' szummája
    const grossSalary = salaryItems
      .filter((item) => item.tipus === "bruttó_bér")
      .reduce((sum, item) => sum + Number(item.összeg), 0);

    return { totalPayments, employeeCount, netSalary, grossSalary };
  }, [salaryItems]);

  // ---------- "+ KP kifizetés" submit ----------

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompany) return;

    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("salary").insert([
        {
          user_id: user.id,
          company_id: selectedCompany.id,
          név: addForm.megnevezes,
          összeg: parseFloat(addForm.osszeg),
          dátum: addForm.datum || null,
          statusz: "Kifizetve",
          fizetesi_mod: "készpénz",
          tipus: "bér",
          kifizetes_ideje: now,
        },
      ]);

      if (error) throw error;

      toast({ title: "Siker", description: "KP kifizetés rögzítve." });
      setAddDialogOpen(false);
      resetAddForm();
      fetchSalaryItems();
    } catch (error) {
      console.error("Error adding cash payment:", error);
      toast({
        variant: "destructive",
        title: "Hiba",
        description: "Nem sikerült rögzíteni a kifizetést.",
      });
    }
  };

  const resetAddForm = () => {
    setAddForm({
      megnevezes: "",
      osszeg: "",
      datum: new Date().toISOString().slice(0, 10),
    });
  };

  // ---------- Edit (only név + megjegyzes) ----------

  const openEditModal = (record: SalaryItem) => {
    setEditingRecord(record);
    setEditForm({
      megnevezes: record.név,
      megjegyzes: record.megjegyzes ?? "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    try {
      const { error } = await supabase
        .from("salary")
        .update({
          név: editForm.megnevezes,
          megjegyzes: editForm.megjegyzes || null,
        })
        .eq("id", editingRecord.id);

      if (error) throw error;

      toast({ title: "Siker", description: "Bejegyzés frissítve." });
      setEditDialogOpen(false);
      setEditingRecord(null);
      fetchSalaryItems();
    } catch (error) {
      console.error("Error editing salary:", error);
      toast({
        variant: "destructive",
        title: "Hiba",
        description: "Nem sikerült frissíteni a bejegyzést.",
      });
    }
  };

  // ---------- Render ----------

  if (loading) {
    return <LoadingSpinner message="Bérek betöltése..." />;
  }

  return (
    <div className="h-full space-y-4 px-2 py-2">
      {/* ========== Header ========== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bérek / járulékok</h1>
          <p className="text-muted-foreground">
            Alkalmazottak bérének és járulékainak kezelése
          </p>
        </div>

        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          KP kifizetés
        </Button>
      </div>

      {/* ========== KPI Cards (4) ========== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1 – Összes kifizetés */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Összes kifizetés
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(metrics.totalPayments)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2 – Alkalmazottak száma */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Alkalmazottak száma
                </p>
                <p className="text-2xl font-bold">{metrics.employeeCount}</p>
                <p className="text-xs text-muted-foreground">
                  {salaryItems.length} bejegyzés
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3 – Összes nettó bérköltség */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Összes nettó bérköltség
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(metrics.netSalary)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-emerald-500/10">
                <Banknote className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4 – Összes bruttó bérköltség */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Összes bruttó bérköltség
                </p>
                <p className="text-2xl font-bold">
                  {formatCurrency(metrics.grossSalary)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ========== Table Card ========== */}
      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          {/* Search */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="text-lg font-semibold">
              Kifizetések{" "}
              <span className="text-muted-foreground font-normal">
                ({filteredItems.length})
              </span>
            </h2>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Keresés megnevezés alapján..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background/50"
              />
            </div>
          </div>

          {/* Table */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nincs bejegyzés a kiválasztott időszakban</p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table className="table-fixed compact-table">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[22%]">
                      Megnevezés
                    </TableHead>
                    <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[10%]">
                      Típus
                    </TableHead>
                    <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[14%]">
                      Dátum
                    </TableHead>
                    <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right w-[14%]">
                      Összeg
                    </TableHead>
                    <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[11%]">
                      Státusz
                    </TableHead>
                    <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[14%]">
                      Kifizetés ideje
                    </TableHead>
                    <TableHead className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right w-[10%]">
                      Műveletek
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedItems.map((item) => {
                    const typeBadge = getTypeBadge(item.tipus);
                    const isPaid = item.statusz === "Kifizetve";

                    return (
                      <TableRow
                        key={item.id}
                        className="hover:bg-muted/40 transition-colors h-[52px]"
                      >
                        {/* Megnevezés */}
                        <TableCell className="py-4 px-4">
                          <span className="font-medium truncate block">
                            {item.név}
                          </span>
                        </TableCell>

                        {/* Típus Badge */}
                        <TableCell className="py-4 px-4">
                          <Badge
                            variant="outline"
                            className={`text-xs ${typeBadge.className}`}
                          >
                            {typeBadge.label}
                          </Badge>
                        </TableCell>

                        {/* Dátum */}
                        <TableCell className="py-4 px-4 text-muted-foreground">
                          {formatDate(item.dátum)}
                        </TableCell>

                        {/* Összeg */}
                        <TableCell className="py-4 px-4 text-right">
                          <span className="font-mono font-semibold">
                            {formatCurrency(item.összeg)}
                          </span>
                        </TableCell>

                        {/* Státusz Badge */}
                        <TableCell className="py-4 px-4">
                          {isPaid ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-500">
                              Kifizetve
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-500">
                              Függő
                            </span>
                          )}
                        </TableCell>

                        {/* Kifizetés ideje */}
                        <TableCell className="py-4 px-4 text-muted-foreground">
                          {item.kifizetes_ideje
                            ? formatDate(item.kifizetes_ideje)
                            : "–"}
                        </TableCell>

                        {/* Műveletek (ONLY Edit – NO Delete) */}
                        <TableCell className="py-4 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                            onClick={() => openEditModal(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          <UnifiedPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredItems.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </CardContent>
      </Card>

      {/* ========== "+ KP kifizetés" Modal ========== */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) resetAddForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>KP kifizetés rögzítése</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="add-megnevezes">Megnevezés</Label>
              <Input
                id="add-megnevezes"
                value={addForm.megnevezes}
                onChange={(e) =>
                  setAddForm({ ...addForm, megnevezes: e.target.value })
                }
                placeholder="Pl. Januári bér – Kiss Péter"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-osszeg">
                KP-ban kifizetett bér összege (HUF) *
              </Label>
              <Input
                id="add-osszeg"
                type="number"
                step="1"
                value={addForm.osszeg}
                onChange={(e) =>
                  setAddForm({ ...addForm, osszeg: e.target.value })
                }
                placeholder="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-datum">Fizetés dátuma</Label>
              <Input
                id="add-datum"
                type="date"
                value={addForm.datum}
                onChange={(e) =>
                  setAddForm({ ...addForm, datum: e.target.value })
                }
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddDialogOpen(false);
                  resetAddForm();
                }}
              >
                Mégse
              </Button>
              <Button type="submit">Rögzítés</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========== Edit Modal (restricted: név + megjegyzes only) ========== */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingRecord(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bejegyzés szerkesztése</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-megnevezes">Megnevezés</Label>
              <Input
                id="edit-megnevezes"
                value={editForm.megnevezes}
                onChange={(e) =>
                  setEditForm({ ...editForm, megnevezes: e.target.value })
                }
                placeholder="Megnevezés"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-megjegyzes">Megjegyzés (opcionális)</Label>
              <Textarea
                id="edit-megjegyzes"
                value={editForm.megjegyzes}
                onChange={(e) =>
                  setEditForm({ ...editForm, megjegyzes: e.target.value })
                }
                placeholder="Opcionális megjegyzés..."
                rows={3}
              />
            </div>

            {/* Read-only context */}
            {editingRecord && (
              <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Típus:</span>{" "}
                  {getTypeBadge(editingRecord.tipus).label}
                </p>
                <p>
                  <span className="font-medium text-foreground">Összeg:</span>{" "}
                  {formatCurrency(editingRecord.összeg)}
                </p>
                <p>
                  <span className="font-medium text-foreground">Dátum:</span>{" "}
                  {formatDate(editingRecord.dátum)}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setEditingRecord(null);
                }}
              >
                Mégse
              </Button>
              <Button type="submit">Mentés</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
