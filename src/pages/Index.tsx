import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { User, Building, Briefcase, Upload, FileText, Euro, TrendingUp, Calendar, BarChart3, PieChart, ChevronUp, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import MetricCard from '@/components/dashboard/MetricCard';
import RecentInvoices from '@/components/dashboard/RecentInvoices';
import ProjectBreakdown from '@/components/dashboard/ProjectBreakdown';
import SubscriptionUsage from '@/components/SubscriptionUsage';
import InvoiceImageDialog from '@/components/InvoiceImageDialog';
import { formatCurrency } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { parseISO } from 'date-fns';

interface Profile {
  name: string;
  position: string;
  company: string;
  avatar_url: string;
}

const getFirstName = (fullName: string | undefined): string => {
  if (!fullName) return '';
  const nameParts = fullName.trim().split(' ');
  return nameParts[nameParts.length - 1];
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return 'Jó reggelt';
  } else if (hour >= 12 && hour < 18) {
    return 'Szép napot';
  } else {
    return 'Jó estét';
  }
};

interface Category {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface Invoice {
  id: string;
  szamlaszam: string;
  elado_nev: string;
  vevo_nev: string;
  brutto_vegosszeg: number;
  kibocsatas_datuma: string;
  statusz: string;
  penznem?: string;
  category_id?: string;
  image_url?: string;
}

interface DashboardMetrics {
  totalInvoices: number;
  totalAmountByCurrency: { [currency: string]: number };
  thisMonthAmountByCurrency: { [currency: string]: number };
  averageInvoiceAmount: number;
  processingCount: number;
  completedCount: number;
}

interface NavVatData {
  inboundVat: { [currency: string]: number };
  outboundVat: { [currency: string]: number };
  revenueNet: { [currency: string]: number };
  revenueGross: { [currency: string]: number };
}

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

const Index = () => {
  const { user, signOut } = useAuth();
  const { selectedCompany } = useCompany();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('HUF');
  const [exchangeRates, setExchangeRates] = useState<{[key: string]: number}>({});
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [navVatData, setNavVatData] = useState<NavVatData | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString().padStart(2, '0'));
  
  // Analytics states
  const [showBrutto, setShowBrutto] = useState(true);
  const [vatSectionOpen, setVatSectionOpen] = useState(true);
  const [revenueSectionOpen, setRevenueSectionOpen] = useState(true);
  const [showRevenue, setShowRevenue] = useState(true);
  const [showPaidExpenses, setShowPaidExpenses] = useState(true);
  const [showPaidSalaries, setShowPaidSalaries] = useState(false);
  const [showCurrentPeriod, setShowCurrentPeriod] = useState(true);
  const [comparisonMonth, setComparisonMonth] = useState(new Date().getMonth() > 0 ? new Date().getMonth() - 1 : 11);
  const [rawInvoices, setRawInvoices] = useState<RawInvoice[]>([]);
  const [rawSalaries, setRawSalaries] = useState<RawSalary[]>([]);
  const [currentOutboundVatCategories, setCurrentOutboundVatCategories] = useState<VatCategoryData[]>([]);
  const [currentInboundVatCategories, setCurrentInboundVatCategories] = useState<VatCategoryData[]>([]);
  const [currentTotalOutboundVat, setCurrentTotalOutboundVat] = useState(0);
  const [currentTotalInboundVat, setCurrentTotalInboundVat] = useState(0);
  const [compOutboundVatCategories, setCompOutboundVatCategories] = useState<VatCategoryData[]>([]);
  const [compInboundVatCategories, setCompInboundVatCategories] = useState<VatCategoryData[]>([]);
  const [compTotalOutboundVat, setCompTotalOutboundVat] = useState(0);
  const [compTotalInboundVat, setCompTotalInboundVat] = useState(0);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const vatChartRef = useRef<HTMLDivElement>(null);
  const currentMonthName = MONTH_NAMES[new Date().getMonth()];
  const currentYear = new Date().getFullYear();
  const years = [2024, 2025];

  // Displayed data based on toggle
  const displayedMonthName = showCurrentPeriod ? currentMonthName : MONTH_NAMES[comparisonMonth];
  const displayedYear = showCurrentPeriod ? currentYear : parseInt(selectedYear);
  const outboundVatCategories = showCurrentPeriod ? currentOutboundVatCategories : compOutboundVatCategories;
  const inboundVatCategories = showCurrentPeriod ? currentInboundVatCategories : compInboundVatCategories;
  const totalOutboundVat = showCurrentPeriod ? currentTotalOutboundVat : compTotalOutboundVat;
  const totalInboundVat = showCurrentPeriod ? currentTotalInboundVat : compTotalInboundVat;
  
  const selectedVatMonth = `${selectedYear}-${selectedMonth}`;

  const currencies = [
    { code: 'HUF', name: 'Magyar Forint', flag: '🇭🇺' },
    { code: 'EUR', name: 'Euró', flag: '🇪🇺' },
    { code: 'USD', name: 'Amerikai Dollár', flag: '🇺🇸' },
    { code: 'GBP', name: 'Brit Font', flag: '🇬🇧' },
    { code: 'CHF', name: 'Svájci Frank', flag: '🇨🇭' },
    { code: 'PLN', name: 'Lengyel Zloty', flag: '🇵🇱' },
    { code: 'CZK', name: 'Cseh Korona', flag: '🇨🇿' },
    { code: 'RON', name: 'Román Lej', flag: '🇷🇴' },
    { code: 'JPY', name: 'Japán Yen', flag: '🇯🇵' },
    { code: 'CNY', name: 'Kínai Yuan', flag: '🇨🇳' },
  ];

  useEffect(() => {
    fetchDashboardData();
    fetchExchangeRates();
  }, [user, selectedCompany, selectedYear, selectedMonth]);

  useEffect(() => {
    if (user && selectedCompany) {
      fetchAnalyticsData();
    }
  }, [user, selectedCompany, selectedYear, comparisonMonth]);

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/HUF');
      const data = await response.json();
      setExchangeRates(data.rates);
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
    }
  };

  const convertAmount = (amount: number): number => {
    if (selectedCurrency === 'HUF') return amount;
    const rate = exchangeRates[selectedCurrency] || 1;
    return amount * rate;
  };

  const convertToSelectedCurrency = (amount: number, fromCurrency: string): number => {
    if (fromCurrency === selectedCurrency) return amount;
    let amountInHUF = amount;
    if (fromCurrency !== 'HUF') {
      const rateFromHUF = exchangeRates[fromCurrency] || 1;
      amountInHUF = amount / rateFromHUF;
    }
    if (selectedCurrency === 'HUF') return amountInHUF;
    const rateToSelected = exchangeRates[selectedCurrency] || 1;
    return amountInHUF * rateToSelected;
  };

  // Analytics data fetching
  const fetchAnalyticsData = async () => {
    setAnalyticsLoading(true);
    try {
      await Promise.all([fetchRawData(), fetchVatData()]);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchRawData = async () => {
    const yearStart = `${selectedYear}-01-01`;
    const yearEnd = `${selectedYear}-12-31`;

    const { data: navInvoices } = await supabase
      .from("nav_invoices")
      .select("invoice_issue_date, invoice_direction, invoice_gross_amount, invoice_net_amount")
      .eq("company_id", selectedCompany?.id)
      .gte("invoice_issue_date", yearStart)
      .lte("invoice_issue_date", yearEnd);

    const { data: salaries } = await supabase
      .from("salary")
      .select("*")
      .eq("company_id", selectedCompany?.id)
      .gte("dátum", yearStart)
      .lte("dátum", yearEnd);

    setRawInvoices(navInvoices || []);
    setRawSalaries((salaries || []).map(s => ({ dátum: s.dátum, összeg: s.összeg })));
  };

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
    const actualCurrentYear = currentDate.getFullYear();
    const actualCurrentMonth = currentDate.getMonth();
    
    const currentMonthStart = `${actualCurrentYear}-${String(actualCurrentMonth + 1).padStart(2, '0')}-01`;
    const currentMonthEnd = `${actualCurrentYear}-${String(actualCurrentMonth + 1).padStart(2, '0')}-31`;
    
    const compMonthStart = `${selectedYear}-${String(comparisonMonth + 1).padStart(2, '0')}-01`;
    const compMonthEnd = `${selectedYear}-${String(comparisonMonth + 1).padStart(2, '0')}-31`;

    const { data: currentNavInvoices } = await supabase
      .from("nav_invoices")
      .select("*")
      .eq("company_id", selectedCompany?.id)
      .gte("invoice_issue_date", currentMonthStart)
      .lte("invoice_issue_date", currentMonthEnd);

    const { data: compNavInvoices } = await supabase
      .from("nav_invoices")
      .select("*")
      .eq("company_id", selectedCompany?.id)
      .gte("invoice_issue_date", compMonthStart)
      .lte("invoice_issue_date", compMonthEnd);

    const processInvoices = (invoices: typeof currentNavInvoices) => {
      let outboundVat = 0;
      let outboundNet = 0;
      let inboundVat = 0;
      let inboundNet = 0;

      invoices?.forEach(inv => {
        if (inv.invoice_direction === "OUTBOUND") {
          outboundVat += inv.invoice_vat_amount || 0;
          outboundNet += inv.invoice_net_amount || 0;
        } else {
          inboundVat += inv.invoice_vat_amount || 0;
          inboundNet += inv.invoice_net_amount || 0;
        }
      });

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

      return { outboundVat, inboundVat, outboundCategories, inboundCategories };
    };

    const currentData = processInvoices(currentNavInvoices);
    setCurrentTotalOutboundVat(currentData.outboundVat);
    setCurrentTotalInboundVat(currentData.inboundVat);
    setCurrentOutboundVatCategories(currentData.outboundCategories);
    setCurrentInboundVatCategories(currentData.inboundCategories);

    const compData = processInvoices(compNavInvoices);
    setCompTotalOutboundVat(compData.outboundVat);
    setCompTotalInboundVat(compData.inboundVat);
    setCompOutboundVatCategories(compData.outboundCategories);
    setCompInboundVatCategories(compData.inboundCategories);
  };

  const formatAnalyticsCurrency = (amount: number, compact = false) => {
    if (compact && Math.abs(amount) >= 1000000) {
      return `${(amount / 1000000).toFixed(2).replace('.', ',')} M Ft`;
    }
    return new Intl.NumberFormat("hu-HU", {
      maximumFractionDigits: 0
    }).format(amount) + " Ft";
  };

  const netVatPosition = totalOutboundVat - totalInboundVat;
  const maxVatValue = Math.max(totalOutboundVat, totalInboundVat, Math.abs(netVatPosition));

  const vatBarData = [
    { name: "Kimenő ÁFA", value: totalOutboundVat, color: "#F59E0B" },
    { name: "Bejövő ÁFA", value: totalInboundVat, color: "#8B5CF6" },
    { name: "Becsült ÁFA pozíció", value: netVatPosition, color: "#A78BFA" }
  ];

  const outboundTotalVat = outboundVatCategories.reduce((sum, c) => sum + c.vatAmount, 0);
  const outboundTotalNet = outboundVatCategories.reduce((sum, c) => sum + c.netAmount, 0);
  const inboundTotalVat = inboundVatCategories.reduce((sum, c) => sum + c.vatAmount, 0);
  const inboundTotalNet = inboundVatCategories.reduce((sum, c) => sum + c.netAmount, 0);

  const fetchDashboardData = async () => {
    if (!user || !selectedCompany) return;
    
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`*, categories(name)`)
        .eq('company_id', selectedCompany.id)
        .order('kibocsatas_datuma', { ascending: false })
        .limit(10);

      if (invoicesError) throw invoicesError;
      
      const formattedInvoices = (invoicesData || []).map(invoice => ({
        ...invoice,
        category_name: invoice.categories?.name
      }));
      setInvoices(formattedInvoices);

      const [yearNum, monthNum] = selectedVatMonth.split('-').map(Number);
      
      const { data: allInvoicesData, error: metricsError } = await supabase
        .from('invoices')
        .select('brutto_vegosszeg, kibocsatas_datuma, statusz, penznem')
        .eq('company_id', selectedCompany.id);

      if (metricsError) throw metricsError;

      const selectedMonthInvoices = (allInvoicesData || []).filter(invoice => {
        const invoiceDate = new Date(invoice.kibocsatas_datuma);
        return invoiceDate.getMonth() === monthNum - 1 && invoiceDate.getFullYear() === yearNum;
      });

      const selectedMonthAmountByCurrency: { [key: string]: number } = {};
      
      selectedMonthInvoices.forEach(invoice => {
        const currency = invoice.penznem || 'HUF';
        selectedMonthAmountByCurrency[currency] = (selectedMonthAmountByCurrency[currency] || 0) + invoice.brutto_vegosszeg;
      });

      const processingCount = selectedMonthInvoices.filter(invoice => invoice.statusz === 'feldolgozas_alatt').length;
      const completedCount = selectedMonthInvoices.filter(invoice => invoice.statusz === 'feldolgozva').length;

      setMetrics({
        totalInvoices: selectedMonthInvoices.length,
        totalAmountByCurrency: selectedMonthAmountByCurrency,
        thisMonthAmountByCurrency: selectedMonthAmountByCurrency,
        averageInvoiceAmount: 0,
        processingCount,
        completedCount
      });

      const firstDayOfSelectedMonth = new Date(yearNum, monthNum - 1, 1).toISOString().split('T')[0];
      const lastDayOfSelectedMonth = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];

      const { data: navInvoicesData, error: navInvoicesError } = await supabase
        .from('nav_invoices')
        .select('invoice_direction, invoice_vat_amount, invoice_net_amount, invoice_gross_amount, currency')
        .eq('company_id', selectedCompany.id)
        .gte('invoice_issue_date', firstDayOfSelectedMonth)
        .lte('invoice_issue_date', lastDayOfSelectedMonth);

      if (navInvoicesError) throw navInvoicesError;

      const inboundVat: { [currency: string]: number } = {};
      const outboundVat: { [currency: string]: number } = {};
      const revenueNet: { [currency: string]: number } = {};
      const revenueGross: { [currency: string]: number } = {};

      (navInvoicesData || []).forEach(invoice => {
        const currency = invoice.currency || 'HUF';
        const vatAmount = invoice.invoice_vat_amount || 0;

        if (invoice.invoice_direction === 'INBOUND') {
          inboundVat[currency] = (inboundVat[currency] || 0) + vatAmount;
        } else if (invoice.invoice_direction === 'OUTBOUND') {
          outboundVat[currency] = (outboundVat[currency] || 0) + vatAmount;
          revenueNet[currency] = (revenueNet[currency] || 0) + (invoice.invoice_net_amount || 0);
          revenueGross[currency] = (revenueGross[currency] || 0) + (invoice.invoice_gross_amount || 0);
        }
      });

      setNavVatData({ inboundVat, outboundVat, revenueNet, revenueGross });

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryBreakdownData = () => {
    if (!categories.length || !invoices.length) return [];

    const categoryStats = categories.map(category => {
      const categoryInvoices = invoices.filter(invoice => invoice.category_id === category.id);
      const totalAmount = categoryInvoices.reduce((sum, invoice) => sum + invoice.brutto_vegosszeg, 0);
      
      const allTotal = metrics ? Object.values(metrics.totalAmountByCurrency).reduce((sum, val) => sum + val, 0) : 0;
      
      return {
        id: category.id,
        name: category.name,
        description: category.description,
        invoice_count: categoryInvoices.length,
        total_amount: totalAmount,
        avg_amount: categoryInvoices.length > 0 ? totalAmount / categoryInvoices.length : 0,
        percentage: allTotal > 0 ? (totalAmount / allTotal) * 100 : 0
      };
    }).filter(category => category.invoice_count > 0)
      .sort((a, b) => b.total_amount - a.total_amount);

    return categoryStats;
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-muted-foreground">Betöltés...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold">{getGreeting()}, {getFirstName(profile?.name)}!</h2>
            <p className="text-muted-foreground">
              Itt van a vállalkozásod teljes áttekintése
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex gap-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - i;
                    return (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-none">
                  {Array.from({ length: 12 }, (_, i) => {
                    const monthNum = (i + 1).toString().padStart(2, '0');
                    const monthName = new Date(2024, i, 1).toLocaleDateString('hu-HU', { month: 'long' });
                    return (
                      <SelectItem key={monthNum} value={monthNum}>
                        {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[200px]">
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      {curr.flag} {curr.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        {metrics && (
          <>
            {(() => {
              const totalInSelectedCurrency = Object.entries(metrics.totalAmountByCurrency).reduce((total, [currency, amount]) => {
                return total + convertToSelectedCurrency(amount, currency);
              }, 0);

              let payableVat = 0;
              if (navVatData) {
                const inboundTotal = Object.entries(navVatData.inboundVat).reduce((total, [currency, amount]) => {
                  return total + convertToSelectedCurrency(amount, currency);
                }, 0);
                const outboundTotal = Object.entries(navVatData.outboundVat).reduce((total, [currency, amount]) => {
                  return total + convertToSelectedCurrency(amount, currency);
                }, 0);
                payableVat = outboundTotal - inboundTotal;
              }

              return (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-stretch">
                  <MetricCard
                    title="Összes számla"
                    value={metrics.totalInvoices}
                    description={`${metrics.completedCount} feldolgozva`}
                    icon={FileText}
                    variant="default"
                  />
                  <MetricCard
                    title="Kimenő számlaösszeg (nettó)"
                    value={
                      navVatData && Object.keys(navVatData.revenueNet).length > 0
                        ? Object.entries(navVatData.revenueNet)
                            .map(([currency, amount]) => formatCurrency(amount, currency))
                            .join(' | ')
                        : '0 Ft'
                    }
                    description="Kimenő számlák nettó összege"
                    icon={Euro}
                    variant="success"
                  />
                  <MetricCard
                    title="Kimenő számlaösszeg (bruttó)"
                    value={
                      navVatData && Object.keys(navVatData.revenueGross).length > 0
                        ? Object.entries(navVatData.revenueGross)
                            .map(([currency, amount]) => formatCurrency(amount, currency))
                            .join(' | ')
                        : '0 Ft'
                    }
                    description="Kimenő számlák bruttó összege"
                    icon={TrendingUp}
                    variant="warning"
                  />
                  <MetricCard
                    title="Összesített érték"
                    value={formatCurrency(totalInSelectedCurrency, selectedCurrency)}
                    description="Minden számla átváltva"
                    icon={TrendingUp}
                    variant="default"
                  />
                  <MetricCard
                    title="Kifizetendő ÁFA"
                    value={formatCurrency(payableVat, selectedCurrency)}
                    description="OUTBOUND - INBOUND"
                    icon={PieChart}
                    variant={payableVat > 0 ? "warning" : "success"}
                  />
                </div>
              );
            })()}
          </>
        )}

        {/* ÁFA Section */}
        <Collapsible open={vatSectionOpen} onOpenChange={setVatSectionOpen}>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    ÁFA ({displayedMonthName} {displayedYear}): <span className="text-purple-600 font-semibold">{formatAnalyticsCurrency(netVatPosition)}</span> a kiválasztott időszak ÁFA pozíciója
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
                    <div className={`inline-flex items-center rounded-md transition-all duration-300 ease-out ${!showCurrentPeriod ? 'bg-primary text-primary-foreground' : ''}`}>
                      <button
                        type="button"
                        onClick={() => setShowCurrentPeriod(false)}
                        className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-l-md transition-colors ${!showCurrentPeriod ? 'hover:bg-primary/90' : 'hover:bg-accent'}`}
                      >
                        {!showCurrentPeriod && <span className="w-2 h-2 rounded-full bg-orange-500 mr-2" />}
                        {MONTH_NAMES[comparisonMonth]}
                      </button>
                      <Select 
                        value={comparisonMonth.toString()} 
                        onValueChange={(v) => {
                          setComparisonMonth(parseInt(v));
                          setShowCurrentPeriod(false);
                        }}
                      >
                        <SelectTrigger className={`border-0 bg-transparent p-0 px-2 py-1.5 h-auto shadow-none focus:ring-0 rounded-l-none rounded-r-md border-l w-auto min-w-0 ${!showCurrentPeriod ? 'border-primary-foreground/20 hover:bg-primary/90' : 'border-border hover:bg-accent'}`} />
                        
                        <SelectContent className="max-h-none">
                          {MONTH_NAMES.map((month, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {month} ({selectedYear})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" ref={vatChartRef}>
                  {/* Left side - VAT bar chart */}
                  <div>
                    <h3 className="text-lg font-semibold text-purple-600 mb-6">
                      {formatAnalyticsCurrency(netVatPosition)} fizetendő ÁFA ({displayedMonthName} {displayedYear})
                    </h3>
                    
                    <div className="space-y-6">
                      {vatBarData.map((item, index) => (
                        <div key={item.name} className="space-y-2">
                          <div className="flex items-center gap-4">
                            <div className="w-3 rounded" style={{ minHeight: '40px', backgroundColor: item.color }} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-muted-foreground">{item.name}</span>
                                <span className="font-semibold">{formatAnalyticsCurrency(item.value)}</span>
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
                    <h3 className="text-lg font-semibold mb-6">ÁFA analitika ({displayedMonthName} {displayedYear})</h3>
                    
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
                                    <td className="text-right">{formatAnalyticsCurrency(cat.vatAmount)}</td>
                                    <td className="text-right">{formatAnalyticsCurrency(cat.netAmount + cat.vatAmount)}</td>
                                  </tr>
                                ))}
                                <tr className="font-medium border-t">
                                  <td className="py-1">Összesen:</td>
                                  <td className="text-right">{formatAnalyticsCurrency(outboundTotalVat)}</td>
                                  <td className="text-right">{formatAnalyticsCurrency(outboundTotalNet + outboundTotalVat)}</td>
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
                                    <td className="text-right">{formatAnalyticsCurrency(cat.vatAmount)}</td>
                                    <td className="text-right">{formatAnalyticsCurrency(cat.netAmount + cat.vatAmount)}</td>
                                  </tr>
                                ))}
                                <tr className="font-medium border-t">
                                  <td className="py-1">Összesen:</td>
                                  <td className="text-right">{formatAnalyticsCurrency(inboundTotalVat)}</td>
                                  <td className="text-right">{formatAnalyticsCurrency(inboundTotalNet + inboundTotalVat)}</td>
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
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
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
                        {result === 0 ? "0 Ft" : formatAnalyticsCurrency(result, true)}
                      </div>
                    );
                  })}
                </div>

                {/* Area Chart */}
                <div className="relative">
                  {analyticsLoading && (
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
                      <RechartsTooltip 
                        formatter={(value: number, name: string) => [formatAnalyticsCurrency(value), name]}
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

        {/* Main Dashboard Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Invoices */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                 <div className="lg:col-span-2">
                  <RecentInvoices 
                    invoices={invoices} 
                    onViewInvoice={(invoice) => {
                      setSelectedInvoice(invoice);
                      setIsDialogOpen(true);
                    }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>A legutóbb feldolgozott számlák listája</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Subscription Usage */}
          <div className="space-y-6">
            <SubscriptionUsage />
            {/* Category Breakdown */}
            <ProjectBreakdown 
              projects={getCategoryBreakdownData()}
              totalAmount={Object.values(metrics?.totalAmountByCurrency || {}).reduce((sum, val) => sum + val, 0)}
            />
          </div>
        </div>

        {/* Profile Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profil információk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="text-lg">
                  {profile?.name?.split(' ').map(n => n[0]).join('') || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2 flex-1">
                <h3 className="text-xl font-semibold">{profile?.name}</h3>
                <div className="flex flex-wrap gap-2">
                  {profile?.position && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Briefcase className="h-3 w-3" />
                      {profile.position}
                    </Badge>
                  )}
                  {profile?.company && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      {profile.company}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6 text-center hover:bg-muted/50 transition-colors flex flex-col">
            <BarChart3 className="h-8 w-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">Számlák áttekintése</h3>
            <p className="text-sm text-muted-foreground mb-4 flex-1">
              Részletes számla lista szűrési lehetőségekkel
            </p>
            <Button 
              variant="default" 
              className="w-full mt-auto"
              onClick={() => navigate('/invoices')}
            >
              Számlák megtekintése
            </Button>
          </Card>
          <Card className="p-6 text-center hover:bg-muted/50 transition-colors flex flex-col">
            <Upload className="h-8 w-8 mx-auto mb-3 text-accent" />
            <h3 className="font-semibold mb-2">Számlák feltöltése</h3>
            <p className="text-sm text-muted-foreground mb-4 flex-1">
              Új számlák kézi feltöltése
            </p>
            <Button 
              variant="default" 
              className="w-full mt-auto"
              onClick={() => navigate('/upload')}
            >
              Fájlok feltöltése
            </Button>
          </Card>
          <Card className="p-6 text-center hover:bg-muted/50 transition-colors flex flex-col">
            <PieChart className="h-8 w-8 mx-auto mb-3 text-warning" />
            <h3 className="font-semibold mb-2">Projekt Kezelés</h3>
            <p className="text-sm text-muted-foreground mb-4 flex-1">
              Projektek szerkesztése és rendszerezése
            </p>
            <Button 
              variant="outline" 
              className="w-full mt-auto"
              onClick={() => navigate('/projects')}
            >
              Projektek kezelése
            </Button>
          </Card>
        </div>
      </main>

      <InvoiceImageDialog 
        invoice={selectedInvoice}
        open={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedInvoice(null);
        }}
      />
    </div>
  );
};

export default Index;
