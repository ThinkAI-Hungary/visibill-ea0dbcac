import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { ChevronUp, Loader2 } from "lucide-react";
import { format, parseISO, subMonths } from "date-fns";
import { hu } from "date-fns/locale";

interface MonthlyData {
  month: string;
  monthIndex: number;
  revenue: number;
  expenses: number;
  salaries: number;
}

interface RawInvoice {
  invoice_issue_date: string | null;
  invoice_direction: string | null;
  invoice_gross_amount: number | null;
  invoice_net_amount: number | null;
}

interface RawSalary {
  dátum: string | null;
  összeg: number;
}

interface VatCategoryData {
  rate: string;
  vatAmount: number;
  netAmount: number;
}

const MONTH_NAMES = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

export default function Analytics() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showBrutto, setShowBrutto] = useState(true);
  const [vatSectionOpen, setVatSectionOpen] = useState(true);
  const [revenueSectionOpen, setRevenueSectionOpen] = useState(true);
  
  // Filter toggles
  const [showRevenue, setShowRevenue] = useState(true);
  const [showPaidExpenses, setShowPaidExpenses] = useState(true);
  const [showPaidSalaries, setShowPaidSalaries] = useState(false);
  
  const years = [2024, 2025];
  const currentMonth = new Date().getMonth();
  const currentMonthName = MONTH_NAMES[currentMonth];

  // Current vs previous period toggle
  const [showCurrentPeriod, setShowCurrentPeriod] = useState(true);
  const [comparisonMonth, setComparisonMonth] = useState(currentMonth > 0 ? currentMonth - 1 : 11);
  
  // Raw data states (for recalculation on brutto/netto toggle)
  const [rawInvoices, setRawInvoices] = useState<RawInvoice[]>([]);
  const [rawSalaries, setRawSalaries] = useState<RawSalary[]>([]);
  const [outboundVatCategories, setOutboundVatCategories] = useState<VatCategoryData[]>([]);
  const [inboundVatCategories, setInboundVatCategories] = useState<VatCategoryData[]>([]);
  const [totalOutboundVat, setTotalOutboundVat] = useState(0);
  const [totalInboundVat, setTotalInboundVat] = useState(0);
  const [comparisonPeriodVat, setComparisonPeriodVat] = useState(0);

  const vatChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && selectedCompany) {
      fetchAnalyticsData();
    }
  }, [user, selectedCompany, selectedYear, comparisonMonth]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRawData(),
        fetchVatData()
      ]);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRawData = async () => {
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    // Fetch NAV invoices for the year
    const { data: navInvoices } = await supabase
      .from("nav_invoices")
      .select("invoice_issue_date, invoice_direction, invoice_gross_amount, invoice_net_amount")
      .eq("company_id", selectedCompany?.id)
      .gte("invoice_issue_date", yearStart)
      .lte("invoice_issue_date", yearEnd);

    // Fetch salaries
    const { data: salaries } = await supabase
      .from("salary")
      .select("*")
      .eq("company_id", selectedCompany?.id)
      .gte("dátum", yearStart)
      .lte("dátum", yearEnd);

    setRawInvoices(navInvoices || []);
    setRawSalaries((salaries || []).map(s => ({ dátum: s.dátum, összeg: s.összeg })));
  };

  // Calculate monthly data based on showBrutto toggle using useMemo
  const monthlyData = useMemo(() => {
    const monthlyMap: { [key: number]: MonthlyData } = {};
    for (let i = 0; i < 12; i++) {
      monthlyMap[i] = {
        month: MONTH_NAMES[i],
        monthIndex: i,
        revenue: 0,
        expenses: 0,
        salaries: 0
      };
    }

    // Process NAV invoices
    rawInvoices.forEach(inv => {
      if (inv.invoice_issue_date) {
        const date = parseISO(inv.invoice_issue_date);
        const monthIndex = date.getMonth();
        const amount = showBrutto 
          ? (inv.invoice_gross_amount || 0)
          : (inv.invoice_net_amount || 0);
        
        if (inv.invoice_direction === "OUTBOUND") {
          monthlyMap[monthIndex].revenue += amount;
        } else {
          monthlyMap[monthIndex].expenses += amount;
        }
      }
    });

    // Process salaries
    rawSalaries.forEach(sal => {
      if (sal.dátum) {
        const date = parseISO(sal.dátum);
        const monthIndex = date.getMonth();
        monthlyMap[monthIndex].salaries += sal.összeg || 0;
      }
    });

    return Object.values(monthlyMap);
  }, [rawInvoices, rawSalaries, showBrutto]);

  const fetchVatData = async () => {
    const currentDate = new Date();
    const currentMonthStart = `${selectedYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const currentMonthEnd = `${selectedYear}-${String(currentMonth + 1).padStart(2, '0')}-31`;
    
    // Comparison month (selected from chart year)
    const compMonthStart = `${selectedYear}-${String(comparisonMonth + 1).padStart(2, '0')}-01`;
    const compMonthEnd = `${selectedYear}-${String(comparisonMonth + 1).padStart(2, '0')}-31`;

    // Current period data
    const { data: currentNavInvoices } = await supabase
      .from("nav_invoices")
      .select("*")
      .eq("company_id", selectedCompany?.id)
      .gte("invoice_issue_date", currentMonthStart)
      .lte("invoice_issue_date", currentMonthEnd);

    // Comparison period data (selected month from chart year)
    const { data: compNavInvoices } = await supabase
      .from("nav_invoices")
      .select("*")
      .eq("company_id", selectedCompany?.id)
      .gte("invoice_issue_date", compMonthStart)
      .lte("invoice_issue_date", compMonthEnd);

    // Calculate current period VAT
    let outboundVat = 0;
    let outboundNet = 0;
    let inboundVat = 0;
    let inboundNet = 0;

    currentNavInvoices?.forEach(inv => {
      if (inv.invoice_direction === "OUTBOUND") {
        outboundVat += inv.invoice_vat_amount || 0;
        outboundNet += inv.invoice_net_amount || 0;
      } else {
        inboundVat += inv.invoice_vat_amount || 0;
        inboundNet += inv.invoice_net_amount || 0;
      }
    });

    // Calculate comparison period VAT position
    let compOutboundVat = 0;
    let compInboundVat = 0;
    compNavInvoices?.forEach(inv => {
      if (inv.invoice_direction === "OUTBOUND") {
        compOutboundVat += inv.invoice_vat_amount || 0;
      } else {
        compInboundVat += inv.invoice_vat_amount || 0;
      }
    });

    setTotalOutboundVat(outboundVat);
    setTotalInboundVat(inboundVat);
    setComparisonPeriodVat(compOutboundVat - compInboundVat);

    // VAT categories (simplified - in real implementation would parse from invoice data)
    const outboundCategories: VatCategoryData[] = [];
    const inboundCategories: VatCategoryData[] = [];

    if (outboundVat > 0) {
      outboundCategories.push({
        rate: "27%",
        vatAmount: outboundVat,
        netAmount: outboundNet
      });
    }

    if (inboundVat > 0 || inboundNet > 0) {
      // Estimate 0% and 27% split based on VAT ratio
      const vatRatio = inboundNet > 0 ? inboundVat / inboundNet : 0;
      if (vatRatio < 0.27) {
        const estimatedZeroNet = inboundNet - (inboundVat / 0.27);
        if (estimatedZeroNet > 0) {
          inboundCategories.push({
            rate: "0%",
            vatAmount: 0,
            netAmount: Math.round(estimatedZeroNet)
          });
        }
      }
      if (inboundVat > 0) {
        inboundCategories.push({
          rate: "27%",
          vatAmount: inboundVat,
          netAmount: Math.round(inboundVat / 0.27)
        });
      }
    }

    setOutboundVatCategories(outboundCategories);
    setInboundVatCategories(inboundCategories);
  };

  const formatCurrency = (amount: number, compact = false) => {
    if (compact && Math.abs(amount) >= 1000000) {
      return `${(amount / 1000000).toFixed(2).replace('.', ',')} M Ft`;
    }
    return new Intl.NumberFormat("hu-HU", {
      maximumFractionDigits: 0
    }).format(amount) + " Ft";
  };

  const netVatPosition = totalOutboundVat - totalInboundVat;
  const maxVatValue = Math.max(totalOutboundVat, totalInboundVat, Math.abs(netVatPosition));

  // Chart data for VAT bars
  const vatBarData = [
    { name: "Kimenő ÁFA", value: totalOutboundVat, color: "#F59E0B" },
    { name: "Bejövő ÁFA", value: totalInboundVat, color: "#8B5CF6" },
    { name: "Becsült ÁFA pozíció", value: netVatPosition, color: "#A78BFA" }
  ];

  // Calculate totals for VAT categories
  const outboundTotalVat = outboundVatCategories.reduce((sum, c) => sum + c.vatAmount, 0);
  const outboundTotalNet = outboundVatCategories.reduce((sum, c) => sum + c.netAmount, 0);
  const inboundTotalVat = inboundVatCategories.reduce((sum, c) => sum + c.vatAmount, 0);
  const inboundTotalNet = inboundVatCategories.reduce((sum, c) => sum + c.netAmount, 0);


  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* ÁFA Section */}
        <Collapsible open={vatSectionOpen} onOpenChange={setVatSectionOpen}>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    ÁFA (Live): <span className="text-purple-600 font-semibold">{formatCurrency(netVatPosition)}</span> az aktuális ÁFA pozíciód a hiányos költségszámlákat is figyelembe véve, {MONTH_NAMES[comparisonMonth]} ({selectedYear}) ÁFA pozíciója <span className="text-purple-600 font-semibold">{formatCurrency(comparisonPeriodVat)}</span>
                  </span>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronUp className={`h-4 w-4 transition-transform ${vatSectionOpen ? '' : 'rotate-180'}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            
            <CollapsibleContent>
              <CardContent className="pt-4">
                {/* Period toggle */}
                <div className="flex justify-end mb-4 gap-2 items-center">
                  <div className="inline-flex rounded-lg border p-1 bg-muted/30 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCurrentPeriod(true)}
                      className={`transition-all duration-300 ease-out ${showCurrentPeriod ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
                    >
                      {showCurrentPeriod && <span className="w-2 h-2 rounded-full bg-orange-500 mr-2" />}
                      Aktuális időszak
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCurrentPeriod(false)}
                      className={`transition-all duration-300 ease-out ${!showCurrentPeriod ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
                    >
                      {!showCurrentPeriod && <span className="w-2 h-2 rounded-full bg-orange-500 mr-2" />}
                      <Select 
                        value={comparisonMonth.toString()} 
                        onValueChange={(v) => {
                          setComparisonMonth(parseInt(v));
                          setShowCurrentPeriod(false);
                        }}
                      >
                        <SelectTrigger className="border-0 bg-transparent p-0 h-auto shadow-none focus:ring-0 focus:ring-offset-0 focus:outline-none min-w-[100px] gap-3">
                          <SelectValue>{MONTH_NAMES[comparisonMonth]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-none">
                          {MONTH_NAMES.map((month, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {month} ({selectedYear})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" ref={vatChartRef}>
                  {/* Left side - VAT bar chart */}
                  <div>
                    <h3 className="text-lg font-semibold text-purple-600 mb-6">
                      {formatCurrency(netVatPosition)} fizetendő ÁFA ({currentMonthName})
                    </h3>
                    
                    <div className="space-y-6">
                      {vatBarData.map((item, index) => (
                        <div key={item.name} className="space-y-2">
                          <div className="flex items-center gap-4">
                            <div className="w-3 rounded" style={{ minHeight: '40px', backgroundColor: item.color }} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-muted-foreground">{item.name}</span>
                                <span className="font-semibold">{formatCurrency(item.value)}</span>
                              </div>
                              <div className="h-8 bg-muted rounded overflow-hidden">
                                <div 
                                  className="h-full rounded transition-all"
                                  style={{ 
                                    width: maxVatValue > 0 ? `${(Math.abs(item.value) / maxVatValue) * 100}%` : '0%',
                                    backgroundColor: item.color
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>

                  {/* Right side - VAT breakdown tables */}
                  <div>
                    <h3 className="text-lg font-semibold mb-6">ÁFA analitika ({currentMonthName})</h3>
                    
                    {/* Outbound invoices VAT */}
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-5 bg-purple-600 rounded" />
                        <h4 className="font-medium">Kimenő számlák ÁFA tartalma</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left py-2">ÁFA kategóriák:</th>
                              <th className="text-right py-2">Fizetendő ÁFA:</th>
                              <th className="text-right py-2">Árbevétel:</th>
                            </tr>
                          </thead>
                          <tbody>
                            {outboundVatCategories.length > 0 ? (
                              <>
                                {outboundVatCategories.map(cat => (
                                  <tr key={cat.rate}>
                                    <td className="py-1">{cat.rate}:</td>
                                    <td className="text-right">{formatCurrency(cat.vatAmount)}</td>
                                    <td className="text-right">{formatCurrency(cat.netAmount + cat.vatAmount)}</td>
                                  </tr>
                                ))}
                                <tr className="font-medium border-t">
                                  <td className="py-1">Összesen:</td>
                                  <td className="text-right">{formatCurrency(outboundTotalVat)}</td>
                                  <td className="text-right">{formatCurrency(outboundTotalNet + outboundTotalVat)}</td>
                                </tr>
                              </>
                            ) : (
                              <tr>
                                <td colSpan={3} className="text-center py-4 text-muted-foreground">
                                  Nincs adat
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Inbound invoices VAT */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-5 bg-purple-600 rounded" />
                        <h4 className="font-medium">Bejövő számlák ÁFA tartalma</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left py-2">ÁFA kategóriák:</th>
                              <th className="text-right py-2">Levonható ÁFA:</th>
                              <th className="text-right py-2">Költségek:</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inboundVatCategories.length > 0 ? (
                              <>
                                {inboundVatCategories.map(cat => (
                                  <tr key={cat.rate}>
                                    <td className="py-1">{cat.rate}:</td>
                                    <td className="text-right">{formatCurrency(cat.vatAmount)}</td>
                                    <td className="text-right">{formatCurrency(cat.netAmount + cat.vatAmount)}</td>
                                  </tr>
                                ))}
                                <tr className="font-medium border-t">
                                  <td className="py-1">Összesen:</td>
                                  <td className="text-right">{formatCurrency(inboundTotalVat)}</td>
                                  <td className="text-right">{formatCurrency(inboundTotalNet + inboundTotalVat)}</td>
                                </tr>
                              </>
                            ) : (
                              <tr>
                                <td colSpan={3} className="text-center py-4 text-muted-foreground">
                                  Nincs adat
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Revenue & Expenses Section */}
        <Collapsible open={revenueSectionOpen} onOpenChange={setRevenueSectionOpen}>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-medium">Kiadások és bevételek {selectedYear}. évben</span>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronUp className={`h-4 w-4 transition-transform ${revenueSectionOpen ? '' : 'rotate-180'}`} />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            
            <CollapsibleContent>
              <CardContent className="pt-4">
                {/* Filters row */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox 
                        checked={showRevenue} 
                        onCheckedChange={(checked) => setShowRevenue(!!checked)}
                        className="border-green-500 data-[state=checked]:bg-green-500"
                      />
                      <span className="text-sm">Bevétel</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox 
                        checked={showPaidExpenses} 
                        onCheckedChange={(checked) => setShowPaidExpenses(!!checked)}
                        className="border-orange-500 data-[state=checked]:bg-orange-500"
                      />
                      <span className="text-sm">Fizetett kiadás</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox 
                        checked={showPaidSalaries} 
                        onCheckedChange={(checked) => setShowPaidSalaries(!!checked)}
                      />
                      <span className="text-sm text-muted-foreground">Fizetett bér</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Időszak</span>
                      <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map(year => (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="inline-flex rounded-lg border p-1 bg-muted/30 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowBrutto(true)}
                        className={`transition-all duration-300 ease-out ${showBrutto ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
                      >
                        {showBrutto && <span className="w-2 h-2 rounded-full bg-orange-500 mr-2" />}
                        bruttó
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowBrutto(false)}
                        className={`transition-all duration-300 ease-out ${!showBrutto ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
                      >
                        {!showBrutto && <span className="w-2 h-2 rounded-full bg-orange-500 mr-2" />}
                        nettó
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Monthly summary row */}
                <div className="grid gap-2 mb-2 text-center" style={{ gridTemplateColumns: 'minmax(80px, auto) repeat(12, 1fr)' }}>
                  <div className="font-semibold text-left">{selectedYear}. év</div>
                  {MONTH_NAMES.map((month, i) => (
                    <div key={month} className="text-sm font-medium">{month.slice(0, 3)}.</div>
                  ))}
                </div>
                <div className="grid gap-2 mb-6 text-center" style={{ gridTemplateColumns: 'minmax(80px, auto) repeat(12, 1fr)' }}>
                  <div className="text-orange-500 font-medium text-left">Eredmény</div>
                  {monthlyData.map((data, i) => {
                    const result = data.revenue - data.expenses - data.salaries;
                    return (
                      <div key={i} className="text-sm text-purple-600 font-medium">
                        {result === 0 ? "0 Ft" : formatCurrency(result, true)}
                      </div>
                    );
                  })}
                </div>

                {/* Area Chart */}
                <div className="relative">
                  {loading && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-lg">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F97316" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tickFormatter={(v) => {
                        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                        if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                        return `${v}`;
                      }}
                      tick={{ fontSize: 12 }}
                      width={50}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    {showRevenue && (
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        name="Bevétel"
                        stroke="#22C55E" 
                        strokeWidth={2}
                        fill="url(#revenueGradient)"
                      />
                    )}
                    {showPaidExpenses && (
                      <Area 
                        type="monotone" 
                        dataKey="expenses" 
                        name="Kiadás"
                        stroke="#F97316" 
                        strokeWidth={2}
                        fill="url(#expensesGradient)"
                      />
                    )}
                    {showPaidSalaries && (
                      <Area 
                        type="monotone" 
                        dataKey="salaries" 
                        name="Bérek"
                        stroke="#8B5CF6" 
                        strokeWidth={2}
                        fill="none"
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
                </div>

              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </main>
    </div>
  );
}
