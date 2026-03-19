import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Wallet,
  Users,
  TrendingUp,
  Banknote,
  User,
  Building2,
} from "lucide-react";
import { format } from "date-fns";
import { hu } from "date-fns/locale";

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
  munkavallalo_neve: string | null;
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
  const queryClient = useQueryClient();

  // "KP kifizetés" modal
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

  const dateFromStr = dateFrom.toISOString().slice(0, 10);
  const dateToStr = dateTo.toISOString().slice(0, 10);

  const { data: salaryItems = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.salaries(selectedCompany?.id || '', dateFromStr, dateToStr),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary")
        .select("*")
        .eq("company_id", selectedCompany!.id)
        .gte("dátum", dateFromStr)
        .lte("dátum", dateToStr)
        .order("dátum", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return (data as unknown as SalaryItem[]) || [];
    },
    enabled: !!user && !!selectedCompany?.id,
  });

  const invalidateSalaries = () => {
    queryClient.invalidateQueries({ queryKey: ['salaries', selectedCompany?.id] });
  };

  // ---------- Grouped data ----------

  const { employeeGroups, navItems } = useMemo(() => {
    const groups: Record<string, SalaryItem[]> = {};
    const nav: SalaryItem[] = [];

    salaryItems.forEach((item) => {
      if (item.munkavallalo_neve) {
        if (!groups[item.munkavallalo_neve]) {
          groups[item.munkavallalo_neve] = [];
        }
        groups[item.munkavallalo_neve].push(item);
      } else {
        nav.push(item);
      }
    });

    // Sort groups alphabetically
    const sortedGroups = Object.entries(groups).sort(([a], [b]) =>
      a.localeCompare(b, "hu")
    );

    return {
      employeeGroups: sortedGroups,
      navItems: nav,
    };
  }, [salaryItems]);

  // ---------- KPI metrics ----------

  const metrics = useMemo(() => {
    // Összes kifizetés – statusz === 'Kifizetve' szummája
    const totalPayments = salaryItems
      .filter((item) => item.statusz === "Kifizetve")
      .reduce((sum, item) => sum + Number(item.összeg), 0);

    // Alkalmazottak száma – egyedi munkavallalo_neve értékek (NOT NULL)
    const employeeCount = new Set(
      salaryItems
        .filter((item) => item.munkavallalo_neve)
        .map((item) => item.munkavallalo_neve)
    ).size;

    // Összes nettó bérköltség – tipus === 'bér' szummája
    const netSalary = salaryItems
      .filter((item) => item.tipus === "bér")
      .reduce((sum, item) => sum + Number(item.összeg), 0);

    // Összes bruttó bérköltség – nettó bér + járulékok + adók
    const grossSalary = salaryItems
      .filter((item) => item.tipus === "bér" || item.tipus === "járulék" || item.tipus === "adó")
      .reduce((sum, item) => sum + Number(item.összeg), 0);

    return { totalPayments, employeeCount, netSalary, grossSalary };
  }, [salaryItems]);

  // ---------- Employee subtotals ----------

  const getEmployeeSubtotal = (items: SalaryItem[]) => {
    return items.reduce((sum, item) => sum + Number(item.összeg), 0);
  };

  const getEmployeeNetTotal = (items: SalaryItem[]) => {
    return items
      .filter((item) => item.tipus === "bér")
      .reduce((sum, item) => sum + Number(item.összeg), 0);
  };

  // ---------- Mutations ----------

  const addMutation = useMutation({
    mutationFn: async (form: typeof addForm) => {
      if (!user || !selectedCompany) throw new Error("No user/company");
      const now = new Date().toISOString();
      const { error } = await supabase.from("salary").insert([
        {
          user_id: user.id,
          company_id: selectedCompany.id,
          név: form.megnevezes,
          összeg: parseFloat(form.osszeg),
          dátum: form.datum || null,
          statusz: "Kifizetve",
          fizetesi_mod: "készpénz",
          tipus: "bér",
          kifizetes_ideje: now,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Siker", description: "KP kifizetés rögzítve." });
      setAddDialogOpen(false);
      resetAddForm();
      invalidateSalaries();
    },
    onError: (error: any) => {
      console.error("Error adding cash payment:", error);
      toast({
        variant: "destructive",
        title: "Hiba",
        description: "Nem sikerült rögzíteni a kifizetést.",
      });
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(addForm);
  };

  const resetAddForm = () => {
    setAddForm({
      megnevezes: "",
      osszeg: "",
      datum: new Date().toISOString().slice(0, 10),
    });
  };

  // ---------- Edit ----------

  const openEditModal = (record: SalaryItem) => {
    setEditingRecord(record);
    setEditForm({
      megnevezes: record.név,
      megjegyzes: record.megjegyzes ?? "",
    });
    setEditDialogOpen(true);
  };

  const editMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: typeof editForm }) => {
      const { error } = await supabase
        .from("salary")
        .update({
          név: form.megnevezes,
          megjegyzes: form.megjegyzes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Siker", description: "Bejegyzés frissítve." });
      setEditDialogOpen(false);
      setEditingRecord(null);
      invalidateSalaries();
    },
    onError: (error: any) => {
      console.error("Error editing salary:", error);
      toast({
        variant: "destructive",
        title: "Hiba",
        description: "Nem sikerült frissíteni a bejegyzést.",
      });
    },
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    editMutation.mutate({ id: editingRecord.id, form: editForm });
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

      {/* ========== Employee Accordion ========== */}
      {employeeGroups.length > 0 && (
        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">
                Dolgozói bontás{" "}
                <span className="text-muted-foreground font-normal">
                  ({employeeGroups.length} fő)
                </span>
              </h2>
            </div>

            <Accordion type="multiple" className="w-full">
              {employeeGroups.map(([employeeName, items]) => {
                const subtotal = getEmployeeSubtotal(items);
                const netTotal = getEmployeeNetTotal(items);

                return (
                  <AccordionItem key={employeeName} value={employeeName} className="border-border/50">
                    <AccordionTrigger className="hover:no-underline px-4 py-4 rounded-lg hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between w-full mr-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">
                              {employeeName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </span>
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-base">{employeeName}</p>
                            <p className="text-xs text-muted-foreground">
                              {items.length} tétel
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-base tabular-nums">
                            {formatCurrency(netTotal)}
                          </span>
                          <p className="text-xs text-muted-foreground">nettó</p>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-4">
                      <div className="rounded-lg border border-border/50 overflow-hidden">
                        <Table className="table-fixed">
                          <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[40%]">
                                Megnevezés
                              </TableHead>
                              <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[25%]">
                                Típus
                              </TableHead>
                              <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right w-[25%]">
                                Összeg
                              </TableHead>
                              <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right w-[10%]">
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item) => {
                              const typeBadge = getTypeBadge(item.tipus);
                              return (
                                <TableRow
                                  key={item.id}
                                  className="hover:bg-muted/40 transition-colors"
                                >
                                  <TableCell className="py-3 px-4">
                                    <span className="font-medium">{item.név}</span>
                                  </TableCell>
                                  <TableCell className="py-3 px-4">
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${typeBadge.className}`}
                                    >
                                      {typeBadge.label}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-3 px-4 text-right">
                                    <span className="font-mono font-semibold tabular-nums">
                                      {formatCurrency(item.összeg)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-3 px-4 text-right">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                                      onClick={() => openEditModal(item)}
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {/* Subtotal row */}
                            <TableRow className="bg-muted/20 border-t-2 border-border/60">
                              <TableCell colSpan={2} className="py-3 px-4">
                                <span className="font-semibold text-muted-foreground text-sm">
                                  Összesen
                                </span>
                              </TableCell>
                              <TableCell className="py-3 px-4 text-right">
                                <span className="font-mono font-bold tabular-nums">
                                  {formatCurrency(subtotal)}
                                </span>
                              </TableCell>
                              <TableCell />
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* ========== NAV Összesítő (munkavallalo_neve IS NULL) ========== */}
      {navItems.length > 0 && (
        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold">
                Havi bérösszesítő (NAV utalások)
              </h2>
            </div>

            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[82%]">
                      Megnevezés
                    </TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right w-[15%]">
                      Összeg
                    </TableHead>
                    <TableHead className="py-2.5 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right w-[3%]">
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {navItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <TableCell className="py-3 px-4">
                        <span className="font-medium">{item.név}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right">
                        <span className="font-mono font-semibold tabular-nums">
                          {formatCurrency(item.összeg)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                          onClick={() => openEditModal(item)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* NAV subtotal */}
                  <TableRow className="bg-muted/20 border-t-2 border-border/60">
                    <TableCell className="py-3 px-4">
                      <span className="font-semibold text-muted-foreground text-sm">
                        NAV utalások összesen
                      </span>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <span className="font-mono font-bold tabular-nums">
                        {formatCurrency(
                          navItems.reduce((sum, item) => sum + Number(item.összeg), 0)
                        )}
                      </span>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== Empty state ========== */}
      {employeeGroups.length === 0 && navItems.length === 0 && (
        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nincs bejegyzés a kiválasztott időszakban</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========== "KP kifizetés" Modal ========== */}
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

      {/* ========== Edit Modal ========== */}
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
                {editingRecord.munkavallalo_neve && (
                  <p>
                    <span className="font-medium text-foreground">Dolgozó:</span>{" "}
                    {editingRecord.munkavallalo_neve}
                  </p>
                )}
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
