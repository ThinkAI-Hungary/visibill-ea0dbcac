import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import EmptyStateDashboard from '@/components/dashboard/EmptyStateDashboard';
import { ProductTour } from '@/components/ProductTour';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { User, Building, Briefcase, Upload, FileText, Euro, TrendingUp, Calendar, BarChart3, PieChart, ChevronUp, Loader2, CalendarIcon, ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import MetricCard from '@/components/dashboard/MetricCard';
import RecentInvoices from '@/components/dashboard/RecentInvoices';
import ProjectBreakdown from '@/components/dashboard/ProjectBreakdown';
import SubscriptionUsage from '@/components/SubscriptionUsage';
import InvoiceImageDialog from '@/components/InvoiceImageDialog';
import InvoiceStatusTables from '@/components/dashboard/InvoiceStatusTables';
import { formatCurrency, cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { parseISO, format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, isSameDay } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

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
  expensesNet: { [currency: string]: number };
  expensesGross: { [currency: string]: number };
  unpaidInboundNet: { [currency: string]: number };
  unpaidInboundGross: { [currency: string]: number };
  unpaidOutboundNet: { [currency: string]: number };
  unpaidOutboundGross: { [currency: string]: number };
}

interface MonthlyData {
  month: string;
  monthIndex: number;
  revenuePaid: number;      // Fizetett bevétel (pozitív)
  revenueUnpaid: number;    // Kintlévőségek (pozitív)
  expensesPaid: number;     // Fizetett kiadás (negatív!)
  expensesUnpaid: number;   // Követelések (negatív!)
  salaries: number;         // Bérek (negatív!)
}

interface RawInvoice {
  invoice_issue_date: string | null;
  invoice_direction: string | null;
  invoice_gross_amount: number | null;
  invoice_net_amount: number | null;
  paid: boolean | null;
  currency: string | null;
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
  const { selectedCompany, companies, loading: companyLoading } = useCompany();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('HUF');
  const [exchangeRates, setExchangeRates] = useState<{[key: string]: number}>({});
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [navVatData, setNavVatData] = useState<NavVatData | null>(null);
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  
  // Analytics states
  const [showBrutto, setShowBrutto] = useState(true);
  const [vatSectionOpen, setVatSectionOpen] = useState(true);
  const [revenueSectionOpen, setRevenueSectionOpen] = useState(true);
  const [showRevenuePaid, setShowRevenuePaid] = useState(true);
  const [showRevenueUnpaid, setShowRevenueUnpaid] = useState(true);
  const [showExpensesPaid, setShowExpensesPaid] = useState(true);
  const [showExpensesUnpaid, setShowExpensesUnpaid] = useState(true);
  const [showSalaries, setShowSalaries] = useState(true);
  const [rawInvoices, setRawInvoices] = useState<RawInvoice[]>([]);
  const [rawSalaries, setRawSalaries] = useState<RawSalary[]>([]);
  const [outboundVatCategories, setOutboundVatCategories] = useState<VatCategoryData[]>([]);
  const [inboundVatCategories, setInboundVatCategories] = useState<VatCategoryData[]>([]);
  const [totalOutboundVat, setTotalOutboundVat] = useState(0);
  const [totalInboundVat, setTotalInboundVat] = useState(0);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  
  // Product Tour state
  const [showTour, setShowTour] = useState(false);

  const vatChartRef = useRef<HTMLDivElement>(null);

  // Displayed date range info
  const dateFromFormatted = format(dateFrom, 'yyyy-MM-dd');
  const dateToFormatted = format(dateTo, 'yyyy-MM-dd');
  const displayedPeriod = `${format(dateFrom, 'yyyy. MMM dd.', { locale: hu })} - ${format(dateTo, 'yyyy. MMM dd.', { locale: hu })}`;

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
  }, [user, selectedCompany, dateFrom, dateTo]);

  // Check if user needs to see the product tour
  useEffect(() => {
    const checkTourStatus = async () => {
      if (!user || !selectedCompany) return;
      
      try {
        const { data } = await supabase
          .from('profiles')
          .select('has_completed_tour')
          .eq('user_id', user.id)
          .single();
        
        if (data && data.has_completed_tour === false) {
          // Small delay to ensure UI is rendered
          setTimeout(() => setShowTour(true), 500);
        }
      } catch (error) {
        console.error('Error checking tour status:', error);
      }
    };
    
    checkTourStatus();
  }, [user, selectedCompany]);

  useEffect(() => {
    if (user && selectedCompany) {
      fetchAnalyticsData();
    }
  }, [user, selectedCompany, dateFrom, dateTo]);

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
    const yearStart = format(dateFrom, 'yyyy-01-01');
    const yearEnd = format(dateTo, 'yyyy-12-31');

    const { data: navInvoices } = await supabase
      .from("nav_invoices")
      .select("invoice_issue_date, invoice_direction, invoice_gross_amount, invoice_net_amount, paid, currency")
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
    // Helper: HUF-ba konvertál tetszőleges pénznemből
    const convertToHUF = (amount: number, fromCurrency: string | null): number => {
      const currency = fromCurrency || 'HUF';
      if (currency === 'HUF') return amount;
      
      // exchangeRates a HUF-hoz képest vannak (pl. EUR = 0.0026)
      // Tehát: EUR összeg → HUF = összeg / exchangeRates['EUR']
      const rate = exchangeRates[currency];
      if (!rate || rate === 0) return amount; // fallback ha nincs árfolyam
      return amount / rate;
    };

    const monthlyMap: { [key: number]: MonthlyData } = {};
    for (let i = 0; i < 12; i++) {
      monthlyMap[i] = {
        month: MONTH_NAMES[i],
        monthIndex: i,
        revenuePaid: 0,
        revenueUnpaid: 0,
        expensesPaid: 0,
        expensesUnpaid: 0,
        salaries: 0
      };
    }

    rawInvoices.forEach(inv => {
      if (inv.invoice_issue_date) {
        const date = parseISO(inv.invoice_issue_date);
        const monthIndex = date.getMonth();
        const originalAmount = showBrutto 
          ? (inv.invoice_gross_amount || 0)
          : (inv.invoice_net_amount || 0);
        
        // Konvertálás HUF-ba
        const amount = convertToHUF(originalAmount, inv.currency);
        
        if (inv.invoice_direction === "OUTBOUND") {
          if (inv.paid === true) {
            monthlyMap[monthIndex].revenuePaid += amount;
          } else {
            monthlyMap[monthIndex].revenueUnpaid += amount;
          }
        } else { // INBOUND
          if (inv.paid === true) {
            monthlyMap[monthIndex].expensesPaid -= amount; // NEGATÍV
          } else {
            monthlyMap[monthIndex].expensesUnpaid -= amount; // NEGATÍV
          }
        }
      }
    });

    // Bérek már HUF-ban vannak
    rawSalaries.forEach(sal => {
      if (sal.dátum) {
        const date = parseISO(sal.dátum);
        const monthIndex = date.getMonth();
        monthlyMap[monthIndex].salaries -= (sal.összeg || 0); // NEGATÍV - kiadásokhoz
      }
    });

    return Object.values(monthlyMap);
  }, [rawInvoices, rawSalaries, showBrutto, exchangeRates]);

  const fetchVatData = async () => {
    const monthStart = dateFromFormatted;
    const monthEnd = dateToFormatted;

    // Fetch VAT data from nav_invoice_items with actual vat_rate field
    const { data: vatItems } = await supabase
      .from("nav_invoice_items")
      .select(`
        vat_rate,
        net_amount,
        vat_amount,
        nav_invoices!inner (
          invoice_direction,
          invoice_issue_date,
          company_id
        )
      `)
      .eq("nav_invoices.company_id", selectedCompany?.id)
      .gte("nav_invoices.invoice_issue_date", monthStart)
      .lte("nav_invoices.invoice_issue_date", monthEnd);

    // If we have detailed line items, use them for breakdown by VAT rate
    if (vatItems && vatItems.length > 0) {
      const outboundByRate: Record<string, { netAmount: number; vatAmount: number }> = {};
      const inboundByRate: Record<string, { netAmount: number; vatAmount: number }> = {};

      vatItems.forEach(item => {
        const navInvoice = item.nav_invoices as unknown as { invoice_direction: string };
        const direction = navInvoice?.invoice_direction;
        
        let rateLabel: string;
        if (item.vat_rate === null || item.vat_rate === undefined) {
          rateLabel = 'ÁFA mentes';
        } else {
          const ratePercent = Math.round(Number(item.vat_rate) * 100);
          rateLabel = `${ratePercent}%`;
        }
        
        const target = direction === 'OUTBOUND' ? outboundByRate : inboundByRate;
        
        if (!target[rateLabel]) {
          target[rateLabel] = { netAmount: 0, vatAmount: 0 };
        }
        target[rateLabel].netAmount += item.net_amount || 0;
        target[rateLabel].vatAmount += item.vat_amount || 0;
      });

      const sortOrder = ['ÁFA mentes', '5%', '18%', '27%'];
      const sortCategories = (categories: VatCategoryData[]) => {
        return categories.sort((a, b) => {
          const indexA = sortOrder.indexOf(a.rate);
          const indexB = sortOrder.indexOf(b.rate);
          if (indexA === -1 && indexB === -1) return a.rate.localeCompare(b.rate);
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      };

      const outboundCategories = sortCategories(
        Object.entries(outboundByRate).map(([rate, data]) => ({
          rate,
          netAmount: data.netAmount,
          vatAmount: data.vatAmount
        }))
      );

      const inboundCategories = sortCategories(
        Object.entries(inboundByRate).map(([rate, data]) => ({
          rate,
          netAmount: data.netAmount,
          vatAmount: data.vatAmount
        }))
      );

      const totalOutbound = outboundCategories.reduce((sum, c) => sum + c.vatAmount, 0);
      const totalInbound = inboundCategories.reduce((sum, c) => sum + c.vatAmount, 0);

      setTotalOutboundVat(totalOutbound);
      setTotalInboundVat(totalInbound);
      setOutboundVatCategories(outboundCategories);
      setInboundVatCategories(inboundCategories);
    } else {
      // Fallback: use nav_invoices table for aggregated VAT totals
      const { data: navInvoices } = await supabase
        .from("nav_invoices")
        .select("invoice_direction, invoice_vat_amount, invoice_net_amount")
        .eq("company_id", selectedCompany?.id)
        .gte("invoice_issue_date", monthStart)
        .lte("invoice_issue_date", monthEnd);

      let outboundVatTotal = 0;
      let inboundVatTotal = 0;
      let outboundNetTotal = 0;
      let inboundNetTotal = 0;

      navInvoices?.forEach(inv => {
        if (inv.invoice_direction === 'OUTBOUND') {
          outboundVatTotal += inv.invoice_vat_amount || 0;
          outboundNetTotal += inv.invoice_net_amount || 0;
        } else {
          inboundVatTotal += inv.invoice_vat_amount || 0;
          inboundNetTotal += inv.invoice_net_amount || 0;
        }
      });

      setTotalOutboundVat(outboundVatTotal);
      setTotalInboundVat(inboundVatTotal);
      setOutboundVatCategories([{ 
        rate: 'Összesített', 
        vatAmount: outboundVatTotal, 
        netAmount: outboundNetTotal 
      }]);
      setInboundVatCategories([{ 
        rate: 'Összesített', 
        vatAmount: inboundVatTotal, 
        netAmount: inboundNetTotal 
      }]);
    }
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
    
    setMetricsLoading(true);
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

      // Use date range for filtering - query with date filter to avoid 1000 row limit
      const { data: allInvoicesData, error: metricsError } = await supabase
        .from('invoices')
        .select('brutto_vegosszeg, kibocsatas_datuma, statusz, penznem')
        .eq('company_id', selectedCompany.id)
        .gte('kibocsatas_datuma', dateFromFormatted)
        .lte('kibocsatas_datuma', dateToFormatted);

      if (metricsError) throw metricsError;

      const selectedPeriodInvoices = allInvoicesData || [];

      const selectedPeriodAmountByCurrency: { [key: string]: number } = {};
      
      selectedPeriodInvoices.forEach(invoice => {
        const currency = invoice.penznem || 'HUF';
        selectedPeriodAmountByCurrency[currency] = (selectedPeriodAmountByCurrency[currency] || 0) + invoice.brutto_vegosszeg;
      });

      const processingCount = selectedPeriodInvoices.filter(invoice => invoice.statusz === 'feldolgozas_alatt').length;
      const completedCount = selectedPeriodInvoices.filter(invoice => invoice.statusz === 'feldolgozva').length;

      setMetrics({
        totalInvoices: selectedPeriodInvoices.length,
        totalAmountByCurrency: selectedPeriodAmountByCurrency,
        thisMonthAmountByCurrency: selectedPeriodAmountByCurrency,
        averageInvoiceAmount: 0,
        processingCount,
        completedCount
      });

      const { data: navInvoicesData, error: navInvoicesError } = await supabase
        .from('nav_invoices')
        .select('invoice_direction, invoice_vat_amount, invoice_net_amount, invoice_gross_amount, currency, paid')
        .eq('company_id', selectedCompany.id)
        .gte('invoice_issue_date', dateFromFormatted)
        .lte('invoice_issue_date', dateToFormatted);

      if (navInvoicesError) throw navInvoicesError;

      const inboundVat: { [currency: string]: number } = {};
      const outboundVat: { [currency: string]: number } = {};
      const revenueNet: { [currency: string]: number } = {};
      const revenueGross: { [currency: string]: number } = {};
      const expensesNet: { [currency: string]: number } = {};
      const expensesGross: { [currency: string]: number } = {};
      const unpaidInboundNet: { [currency: string]: number } = {};
      const unpaidInboundGross: { [currency: string]: number } = {};
      const unpaidOutboundNet: { [currency: string]: number } = {};
      const unpaidOutboundGross: { [currency: string]: number } = {};

      (navInvoicesData || []).forEach(invoice => {
        const currency = invoice.currency || 'HUF';
        const vatAmount = invoice.invoice_vat_amount || 0;
        const netAmount = invoice.invoice_net_amount || 0;
        // Fallback: ha a gross 0 vagy hiányzik, számítsuk ki net + vat-ból
        const grossAmount = (invoice.invoice_gross_amount && invoice.invoice_gross_amount > 0)
          ? invoice.invoice_gross_amount
          : netAmount + vatAmount;

        if (invoice.invoice_direction === 'INBOUND') {
          inboundVat[currency] = (inboundVat[currency] || 0) + vatAmount;
          expensesNet[currency] = (expensesNet[currency] || 0) + netAmount;
          expensesGross[currency] = (expensesGross[currency] || 0) + grossAmount;
          
          // Track unpaid inbound invoices (paid is false or null)
          if (invoice.paid === false || invoice.paid === null) {
            unpaidInboundNet[currency] = (unpaidInboundNet[currency] || 0) + netAmount;
            unpaidInboundGross[currency] = (unpaidInboundGross[currency] || 0) + grossAmount;
          }
        } else if (invoice.invoice_direction === 'OUTBOUND') {
          outboundVat[currency] = (outboundVat[currency] || 0) + vatAmount;
          revenueNet[currency] = (revenueNet[currency] || 0) + netAmount;
          revenueGross[currency] = (revenueGross[currency] || 0) + grossAmount;
          
          // Track unpaid outbound invoices (paid is false or null)
          if (invoice.paid === false || invoice.paid === null) {
            unpaidOutboundNet[currency] = (unpaidOutboundNet[currency] || 0) + netAmount;
            unpaidOutboundGross[currency] = (unpaidOutboundGross[currency] || 0) + grossAmount;
          }
        }
      });

      setNavVatData({ inboundVat, outboundVat, revenueNet, revenueGross, expensesNet, expensesGross, unpaidInboundNet, unpaidInboundGross, unpaidOutboundNet, unpaidOutboundGross });

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setMetricsLoading(false);
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

  // Debug logging
  console.log('Index render - companyLoading:', companyLoading, 'companies:', companies.length, 'metricsLoading:', metricsLoading);

  // Handle onboarding complete - trigger product tour
  const handleOnboardingComplete = () => {
    setTimeout(() => setShowTour(true), 500);
  };

  // Show empty state dashboard when no companies exist (check FIRST before any loading states)
  if (!companyLoading && companies.length === 0) {
    console.log('Showing EmptyStateDashboard');
    return <EmptyStateDashboard onOnboardingComplete={handleOnboardingComplete} />;
  }

  // Show loading spinner while company data is being fetched
  if (companyLoading) {
    return <LoadingSpinner message="Irányítópult betöltése..." />;
  }

  // Show loading spinner while metrics data is being fetched
  if (metricsLoading) {
    return <LoadingSpinner message="Irányítópult betöltése..." />;
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
          <div className="flex gap-2 items-center flex-wrap">
            {/* Quick period buttons */}
            <div className="flex gap-1 items-center">
              <Button
                variant={isSameDay(dateFrom, startOfMonth(new Date())) && isSameDay(dateTo, endOfMonth(new Date())) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDateFrom(startOfMonth(new Date()));
                  setDateTo(endOfMonth(new Date()));
                }}
              >
                Ez a hónap
              </Button>
              <Button
                variant={isSameDay(dateFrom, startOfMonth(subMonths(new Date(), 1))) && isSameDay(dateTo, endOfMonth(subMonths(new Date(), 1))) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDateFrom(startOfMonth(subMonths(new Date(), 1)));
                  setDateTo(endOfMonth(subMonths(new Date(), 1)));
                }}
              >
                Előző hónap
              </Button>
              <Button
                variant={isSameDay(dateFrom, startOfYear(new Date())) && isSameDay(dateTo, endOfYear(new Date())) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setDateFrom(startOfYear(new Date()));
                  setDateTo(endOfYear(new Date()));
                }}
              >
                Ez az év
              </Button>
            </div>
            <span className="text-muted-foreground mx-1">|</span>
            <div className="flex gap-2 items-center">
              <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[160px] justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "yyyy. MMM dd.", { locale: hu }) : <span>Kezdő dátum</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => {
                      if (date) {
                        setDateFrom(date);
                        setDateFromOpen(false);
                      }
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-sm text-muted-foreground">-</span>
              <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[160px] justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "yyyy. MMM dd.", { locale: hu }) : <span>Záró dátum</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => {
                      if (date) {
                        setDateTo(date);
                        setDateToOpen(false);
                      }
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
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

        {/* Nettó/Bruttó Toggle */}
        <div className="flex items-center gap-3">
          <span className={cn("text-sm font-medium", !showBrutto && "text-primary")}>Nettó</span>
          <Switch
            checked={showBrutto}
            onCheckedChange={setShowBrutto}
          />
          <span className={cn("text-sm font-medium", showBrutto && "text-primary")}>Bruttó</span>
        </div>

        {/* Metrics Cards */}
        {metrics && (() => {
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

          // Get the appropriate revenue data based on nettó/bruttó toggle
          const revenueData = showBrutto ? navVatData?.revenueGross : navVatData?.revenueNet;
          const expensesData = showBrutto ? navVatData?.expensesGross : navVatData?.expensesNet;
          const unpaidInboundData = showBrutto ? navVatData?.unpaidInboundGross : navVatData?.unpaidInboundNet;
          const unpaidOutboundData = showBrutto ? navVatData?.unpaidOutboundGross : navVatData?.unpaidOutboundNet;

          return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-stretch">
              <MetricCard
                title="Feltöltött számlák"
                value={metrics.totalInvoices}
                description={`${metrics.completedCount} feldolgozva`}
                icon={Upload}
                variant="default"
              />
              <MetricCard
                title={`Kimenő számlaösszeg (${showBrutto ? 'bruttó' : 'nettó'})`}
                value={
                  revenueData && Object.keys(revenueData).length > 0
                    ? Object.entries(revenueData)
                        .map(([currency, amount]) => formatCurrency(amount, currency))
                        .join(' | ')
                    : '0 Ft'
                }
                description="NAV OUTBOUND"
                icon={ArrowUpRight}
                variant="success"
              />
              <MetricCard
                title={`Kintlévőség (${showBrutto ? 'bruttó' : 'nettó'})`}
                value={
                  unpaidOutboundData && Object.keys(unpaidOutboundData).length > 0
                    ? Object.entries(unpaidOutboundData)
                        .map(([currency, amount]) => formatCurrency(amount, currency))
                        .join(' | ')
                    : '0 Ft'
                }
                description="Kifizetetlen kimenő számlák"
                icon={TrendingUp}
                variant="warning"
              />
              <MetricCard
                title={`Bejövő számlaösszeg (${showBrutto ? 'bruttó' : 'nettó'})`}
                value={
                  expensesData && Object.keys(expensesData).length > 0
                    ? Object.entries(expensesData)
                        .map(([currency, amount]) => formatCurrency(amount, currency))
                        .join(' | ')
                    : '0 Ft'
                }
                description="NAV INBOUND"
                icon={ArrowDownLeft}
                variant="warning"
              />
              <MetricCard
                title="Várható ÁFA"
                value={formatCurrency(payableVat, selectedCurrency)}
                description="OUTBOUND - INBOUND"
                icon={PieChart}
                variant={payableVat > 0 ? "warning" : "success"}
              />
              <MetricCard
                title={`Követelés (${showBrutto ? 'bruttó' : 'nettó'})`}
                value={
                  unpaidInboundData && Object.keys(unpaidInboundData).length > 0
                    ? Object.entries(unpaidInboundData)
                        .map(([currency, amount]) => formatCurrency(amount, currency))
                        .join(' | ')
                    : '0 Ft'
                }
                description="Kifizetetlen bejövő számlák"
                icon={Wallet}
                variant="destructive"
              />
            </div>
          );
        })()}

        {/* ÁFA Section */}
        <Collapsible open={vatSectionOpen} onOpenChange={setVatSectionOpen}>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    ÁFA ({displayedPeriod}): <span className="text-purple-600 font-semibold">{formatAnalyticsCurrency(netVatPosition)}</span> a kiválasztott időszak ÁFA pozíciója
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" ref={vatChartRef}>
                  {/* Left side - VAT bar chart */}
                  <div>
                    <h3 className="text-lg font-semibold text-purple-600 mb-6">
                      {formatAnalyticsCurrency(netVatPosition)} fizetendő ÁFA ({displayedPeriod})
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
                    <h3 className="text-lg font-semibold mb-6">ÁFA analitika ({displayedPeriod})</h3>
                    
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

        {/* Invoice Status Tables */}
        <InvoiceStatusTables />

        {/* Revenue & Expenses Section */}
        <Collapsible open={revenueSectionOpen} onOpenChange={setRevenueSectionOpen}>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-medium">Kiadások és bevételek ({format(dateFrom, 'yyyy', { locale: hu })}. évben)</span>
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
                        checked={showRevenuePaid} 
                        onCheckedChange={(checked) => setShowRevenuePaid(!!checked)}
                        className="border-green-600 data-[state=checked]:bg-green-600"
                      />
                      <span className="text-sm text-green-600">Bevétel (fizetett)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox 
                        checked={showRevenueUnpaid} 
                        onCheckedChange={(checked) => setShowRevenueUnpaid(!!checked)}
                        className="border-cyan-500 data-[state=checked]:bg-cyan-500"
                      />
                      <span className="text-sm text-cyan-500">Kintlévőségek</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox 
                        checked={showExpensesPaid} 
                        onCheckedChange={(checked) => setShowExpensesPaid(!!checked)}
                        className="border-red-600 data-[state=checked]:bg-red-600"
                      />
                      <span className="text-sm text-red-600">Kiadás (fizetett)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox 
                        checked={showExpensesUnpaid} 
                        onCheckedChange={(checked) => setShowExpensesUnpaid(!!checked)}
                        className="border-amber-500 data-[state=checked]:bg-amber-500"
                      />
                      <span className="text-sm text-amber-500">Követelések</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox 
                        checked={showSalaries} 
                        onCheckedChange={(checked) => setShowSalaries(!!checked)}
                        className="border-purple-500 data-[state=checked]:bg-purple-500"
                      />
                      <span className="text-sm text-purple-500">Bérek</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-4">
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
                  <div className="font-semibold text-left">{format(dateFrom, 'yyyy', { locale: hu })}. év</div>
                  {MONTH_NAMES.map((month, i) => (
                    <div key={month} className="text-sm font-medium">{month.slice(0, 3)}.</div>
                  ))}
                </div>
                <div className="grid gap-2 mb-6 text-center" style={{ gridTemplateColumns: 'minmax(80px, auto) repeat(12, 1fr)' }}>
                  <div className="text-orange-500 font-medium text-left">Eredmény</div>
                  {monthlyData.map((data, i) => {
                    const result = data.revenuePaid + data.revenueUnpaid + data.expensesPaid + data.expensesUnpaid + data.salaries;
                    return (
                      <div key={i} className={cn("text-sm font-medium", result >= 0 ? "text-green-600" : "text-red-600")}>
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
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={monthlyData}>
                      <defs>
                        {/* Bevételi gradiensek (zöld árnyalatok - felfelé) */}
                        <linearGradient id="revenuePaidGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#16A34A" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#16A34A" stopOpacity={0.05}/>
                        </linearGradient>
                        <linearGradient id="revenueUnpaidGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05}/>
                        </linearGradient>
                        {/* Kiadási gradiensek (piros árnyalatok - lefelé, negatív tartomány) */}
                        <linearGradient id="expensesPaidGradient" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="5%" stopColor="#DC2626" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#DC2626" stopOpacity={0.05}/>
                        </linearGradient>
                        <linearGradient id="expensesUnpaidGradient" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05}/>
                        </linearGradient>
                        {/* Bérek gradiens (lila - lefelé, negatív tartomány) */}
                        <linearGradient id="salariesGradient" x1="0" y1="1" x2="0" y2="0">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.05}/>
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
                        domain={['auto', 'auto']}
                        tickFormatter={(v) => {
                          const absV = Math.abs(v);
                          if (absV >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                          if (absV >= 1000) return `${(v / 1000).toFixed(0)}k`;
                          return `${v}`;
                        }}
                        tick={{ fontSize: 12 }}
                        width={60}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip 
                        formatter={(value: number, name: string) => [formatAnalyticsCurrency(Math.abs(value)) + (value < 0 ? ' (kiadás)' : ''), name]}
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      {/* Pozitív tartomány - Bevételek (zöld) */}
                      {showRevenuePaid && (
                        <Area 
                          type="monotone" 
                          dataKey="revenuePaid" 
                          name="Bevétel (fizetett)"
                          stroke="#16A34A" 
                          strokeWidth={2}
                          fill="url(#revenuePaidGradient)"
                          stackId="positive"
                        />
                      )}
                      {showRevenueUnpaid && (
                        <Area 
                          type="monotone" 
                          dataKey="revenueUnpaid" 
                          name="Kintlévőségek"
                          stroke="#06b6d4" 
                          strokeWidth={2}
                          fill="url(#revenueUnpaidGradient)"
                          stackId="positive"
                        />
                      )}
                      {/* Negatív tartomány - Kiadások (piros) és Bérek (lila) */}
                      {showExpensesPaid && (
                        <Area 
                          type="monotone" 
                          dataKey="expensesPaid" 
                          name="Kiadás (fizetett)"
                          stroke="#DC2626" 
                          strokeWidth={2}
                          fill="url(#expensesPaidGradient)"
                          stackId="negative"
                        />
                      )}
                      {showExpensesUnpaid && (
                        <Area 
                          type="monotone" 
                          dataKey="expensesUnpaid" 
                          name="Követelések"
                          stroke="#f59e0b" 
                          strokeWidth={2}
                          fill="url(#expensesUnpaidGradient)"
                          stackId="negative"
                        />
                      )}
                      {showSalaries && (
                        <Area 
                          type="monotone" 
                          dataKey="salaries" 
                          name="Bérek"
                          stroke="#8B5CF6" 
                          strokeWidth={2}
                          fill="url(#salariesGradient)"
                          stackId="negative"
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
          <Card className="p-6 text-center flex flex-col">
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
          <Card className="p-6 text-center flex flex-col">
            <Upload className="h-8 w-8 mx-auto mb-3 text-primary" />
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
          <Card className="p-6 text-center flex flex-col">
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
      
      {/* Product Tour */}
      <ProductTour 
        run={showTour} 
        onComplete={() => setShowTour(false)} 
      />
    </div>
  );
};

export default Index;
