import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { 
  TrendingUp, TrendingDown, Users, Building2, Clock, 
  AlertCircle, Receipt, Percent, CalendarDays 
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays, parseISO } from "date-fns";
import { hu } from "date-fns/locale";

interface RevenueData {
  month: string;
  revenue: number;
  expenses: number;
}

interface VatBreakdown {
  rate: string;
  amount: number;
  count: number;
}

interface PartnerData {
  name: string;
  taxNumber: string;
  totalAmount: number;
  invoiceCount: number;
}

interface PaymentStats {
  avgPaymentDays: number;
  overdueCount: number;
  overdueAmount: number;
  receivablesAmount: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Analytics() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  
  // Data states
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [vatBreakdown, setVatBreakdown] = useState<VatBreakdown[]>([]);
  const [topCustomers, setTopCustomers] = useState<PartnerData[]>([]);
  const [topSuppliers, setTopSuppliers] = useState<PartnerData[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats>({
    avgPaymentDays: 0,
    overdueCount: 0,
    overdueAmount: 0,
    receivablesAmount: 0
  });
  const [totalVat, setTotalVat] = useState({ outbound: 0, inbound: 0 });

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  useEffect(() => {
    if (user && selectedCompany) {
      fetchAnalyticsData();
    }
  }, [user, selectedCompany, selectedYear]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRevenueData(),
        fetchVatBreakdown(),
        fetchTopPartners(),
        fetchPaymentStats()
      ]);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevenueData = async () => {
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    // Fetch NAV invoices for the year
    const { data: navInvoices } = await supabase
      .from("nav_invoices")
      .select("*")
      .eq("company_id", selectedCompany?.id)
      .gte("invoice_issue_date", yearStart)
      .lte("invoice_issue_date", yearEnd);

    // Group by month
    const monthlyData: { [key: string]: { revenue: number; expenses: number } } = {};
    
    for (let i = 0; i < 12; i++) {
      const monthKey = format(new Date(parseInt(selectedYear), i, 1), "MMM", { locale: hu });
      monthlyData[monthKey] = { revenue: 0, expenses: 0 };
    }

    navInvoices?.forEach(inv => {
      if (inv.invoice_issue_date) {
        const date = parseISO(inv.invoice_issue_date);
        const monthKey = format(date, "MMM", { locale: hu });
        const amount = inv.invoice_gross_amount || 0;
        
        if (inv.invoice_direction === "OUTBOUND") {
          monthlyData[monthKey].revenue += amount;
        } else {
          monthlyData[monthKey].expenses += amount;
        }
      }
    });

    const data = Object.entries(monthlyData).map(([month, values]) => ({
      month,
      revenue: Math.round(values.revenue),
      expenses: Math.round(values.expenses)
    }));

    setRevenueData(data);

    // Calculate total VAT
    const outboundVat = navInvoices
      ?.filter(i => i.invoice_direction === "OUTBOUND")
      .reduce((sum, i) => sum + (i.invoice_vat_amount || 0), 0) || 0;
    const inboundVat = navInvoices
      ?.filter(i => i.invoice_direction === "INBOUND")
      .reduce((sum, i) => sum + (i.invoice_vat_amount || 0), 0) || 0;
    
    setTotalVat({ outbound: outboundVat, inbound: inboundVat });
  };

  const fetchVatBreakdown = async () => {
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    const { data: invoices } = await supabase
      .from("invoices")
      .select("afa_kulcsok_bontasban, afa_osszeg_osszesen")
      .eq("company_id", selectedCompany?.id)
      .gte("kibocsatas_datuma", yearStart)
      .lte("kibocsatas_datuma", yearEnd);

    // Parse VAT rates from invoices
    const vatMap: { [rate: string]: { amount: number; count: number } } = {
      "27%": { amount: 0, count: 0 },
      "18%": { amount: 0, count: 0 },
      "5%": { amount: 0, count: 0 },
      "0%/AM": { amount: 0, count: 0 }
    };

    invoices?.forEach(inv => {
      // Simple estimation based on total VAT
      const vatAmount = inv.afa_osszeg_osszesen || 0;
      if (vatAmount > 0) {
        vatMap["27%"].amount += vatAmount;
        vatMap["27%"].count += 1;
      } else {
        vatMap["0%/AM"].count += 1;
      }
    });

    setVatBreakdown(
      Object.entries(vatMap)
        .filter(([_, v]) => v.count > 0)
        .map(([rate, values]) => ({
          rate,
          amount: Math.round(values.amount),
          count: values.count
        }))
    );
  };

  const fetchTopPartners = async () => {
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    // Top customers (outbound invoices)
    const { data: outboundInvoices } = await supabase
      .from("nav_invoices")
      .select("*")
      .eq("company_id", selectedCompany?.id)
      .eq("invoice_direction", "OUTBOUND")
      .gte("invoice_issue_date", yearStart)
      .lte("invoice_issue_date", yearEnd);

    // Group by customer tax number
    const customerMap: { [key: string]: PartnerData } = {};
    outboundInvoices?.forEach(inv => {
      const key = inv.customer_tax_number || "Ismeretlen";
      if (!customerMap[key]) {
        customerMap[key] = {
          name: key,
          taxNumber: inv.customer_tax_number || "",
          totalAmount: 0,
          invoiceCount: 0
        };
      }
      customerMap[key].totalAmount += inv.invoice_gross_amount || 0;
      customerMap[key].invoiceCount += 1;
    });

    const sortedCustomers = Object.values(customerMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);
    setTopCustomers(sortedCustomers);

    // Top suppliers (inbound invoices)
    const { data: inboundInvoices } = await supabase
      .from("nav_invoices")
      .select("*")
      .eq("company_id", selectedCompany?.id)
      .eq("invoice_direction", "INBOUND")
      .gte("invoice_issue_date", yearStart)
      .lte("invoice_issue_date", yearEnd);

    const supplierMap: { [key: string]: PartnerData } = {};
    inboundInvoices?.forEach(inv => {
      const key = inv.supplier_tax_number || "Ismeretlen";
      if (!supplierMap[key]) {
        supplierMap[key] = {
          name: key,
          taxNumber: inv.supplier_tax_number || "",
          totalAmount: 0,
          invoiceCount: 0
        };
      }
      supplierMap[key].totalAmount += inv.invoice_gross_amount || 0;
      supplierMap[key].invoiceCount += 1;
    });

    const sortedSuppliers = Object.values(supplierMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);
    setTopSuppliers(sortedSuppliers);
  };

  const fetchPaymentStats = async () => {
    const today = new Date();
    
    // Get unpaid invoices for payment analysis
    const { data: unpaidInvoices } = await supabase
      .from("invoices")
      .select("*")
      .eq("company_id", selectedCompany?.id)
      .eq("fizetve", false);

    let overdueCount = 0;
    let overdueAmount = 0;
    let receivablesAmount = 0;
    let totalPaymentDays = 0;
    let paidCount = 0;

    unpaidInvoices?.forEach(inv => {
      const amount = inv.brutto_vegosszeg || inv.fizetendo_osszeg || 0;
      receivablesAmount += amount;

      if (inv.fizetesi_hatarido) {
        const dueDate = parseISO(inv.fizetesi_hatarido);
        if (dueDate < today) {
          overdueCount += 1;
          overdueAmount += amount;
        }
      }
    });

    // Get paid invoices for average payment time
    const { data: paidInvoices } = await supabase
      .from("invoices")
      .select("kibocsatas_datuma, feldolgozva")
      .eq("company_id", selectedCompany?.id)
      .eq("fizetve", true)
      .not("feldolgozva", "is", null);

    paidInvoices?.forEach(inv => {
      if (inv.kibocsatas_datuma && inv.feldolgozva) {
        const issueDate = parseISO(inv.kibocsatas_datuma);
        const paidDate = parseISO(inv.feldolgozva);
        totalPaymentDays += differenceInDays(paidDate, issueDate);
        paidCount += 1;
      }
    });

    setPaymentStats({
      avgPaymentDays: paidCount > 0 ? Math.round(totalPaymentDays / paidCount) : 0,
      overdueCount,
      overdueAmount: Math.round(overdueAmount),
      receivablesAmount: Math.round(receivablesAmount)
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("hu-HU", {
      style: "currency",
      currency: "HUF",
      maximumFractionDigits: 0
    }).format(amount);
  };

  const netVat = totalVat.outbound - totalVat.inbound;

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-full overflow-hidden">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Elemzések</h1>
          <p className="text-muted-foreground">
            Részletes pénzügyi elemzések és kimutatások
          </p>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-32">
            <CalendarDays className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(year => (
              <SelectItem key={year} value={year}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Éves bevétel (bruttó)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(revenueData.reduce((sum, d) => sum + d.revenue, 0))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Éves kiadás (bruttó)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(revenueData.reduce((sum, d) => sum + d.expenses, 0))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Fizetendő ÁFA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${netVat > 0 ? 'text-orange-500' : 'text-green-500'}`}>
              {formatCurrency(netVat)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Kimenő: {formatCurrency(totalVat.outbound)} | Bejövő: {formatCurrency(totalVat.inbound)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Kintlévőségek
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(paymentStats.receivablesAmount)}</p>
            {paymentStats.overdueCount > 0 && (
              <Badge variant="destructive" className="mt-1">
                {paymentStats.overdueCount} lejárt
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Bevétel & ÁFA</TabsTrigger>
          <TabsTrigger value="partners">Partnerek</TabsTrigger>
          <TabsTrigger value="payments">Fizetések</TabsTrigger>
        </TabsList>

        {/* Revenue & VAT Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Havi bevétel és kiadás trend</CardTitle>
                <CardDescription>Kimenő és bejövő számlák összege havonta</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis 
                      tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                      className="text-xs"
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Bevétel" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Kiadás" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ÁFA bontás</CardTitle>
                <CardDescription>Számlák ÁFA-kulcs szerint</CardDescription>
              </CardHeader>
              <CardContent>
                {vatBreakdown.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={vatBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          dataKey="count"
                          nameKey="rate"
                          label={({ rate }) => rate}
                        >
                          {vatBreakdown.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-4">
                      {vatBreakdown.map((vat, i) => (
                        <div key={vat.rate} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: COLORS[i % COLORS.length] }}
                            />
                            <span>{vat.rate}</span>
                          </div>
                          <span className="font-medium">{vat.count} db</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Nincs adat a kiválasztott időszakra
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Partners Tab */}
        <TabsContent value="partners" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Top 10 vevő
                </CardTitle>
                <CardDescription>Legnagyobb bevételt hozó ügyfelek</CardDescription>
              </CardHeader>
              <CardContent>
                {topCustomers.length > 0 ? (
                  <div className="space-y-3">
                    {topCustomers.map((customer, index) => (
                      <div key={customer.taxNumber || index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground w-6">
                            {index + 1}.
                          </span>
                          <div>
                            <p className="font-medium text-sm">{customer.taxNumber || "Ismeretlen"}</p>
                            <p className="text-xs text-muted-foreground">
                              {customer.invoiceCount} számla
                            </p>
                          </div>
                        </div>
                        <p className="font-bold">{formatCurrency(customer.totalAmount)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Nincs adat a kiválasztott időszakra
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Top 10 szállító
                </CardTitle>
                <CardDescription>Legnagyobb költséget jelentő beszállítók</CardDescription>
              </CardHeader>
              <CardContent>
                {topSuppliers.length > 0 ? (
                  <div className="space-y-3">
                    {topSuppliers.map((supplier, index) => (
                      <div key={supplier.taxNumber || index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground w-6">
                            {index + 1}.
                          </span>
                          <div>
                            <p className="font-medium text-sm">{supplier.taxNumber || "Ismeretlen"}</p>
                            <p className="text-xs text-muted-foreground">
                              {supplier.invoiceCount} számla
                            </p>
                          </div>
                        </div>
                        <p className="font-bold">{formatCurrency(supplier.totalAmount)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Nincs adat a kiválasztott időszakra
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Átlagos fizetési idő
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{paymentStats.avgPaymentDays}</p>
                <p className="text-muted-foreground">nap</p>
              </CardContent>
            </Card>

            <Card className={paymentStats.overdueCount > 0 ? "border-destructive" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  Lejárt számlák
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-destructive">{paymentStats.overdueCount}</p>
                <p className="text-muted-foreground">
                  {formatCurrency(paymentStats.overdueAmount)} összértékben
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Összes kintlévőség
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-4xl font-bold">{formatCurrency(paymentStats.receivablesAmount)}</p>
                <p className="text-muted-foreground">fizetésre vár</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kintlévőség előrejelzés</CardTitle>
              <CardDescription>
                A rendszer a lejárt és hamarosan lejáró számlák alapján mutatja a kintlévőségeket
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <p>Részletes előrejelzés hamarosan elérhető</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
