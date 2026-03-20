import { useEffect, useState, useMemo, useRef } from 'react';
import { useRealtimeInvalidation } from '@/hooks/useRealtimeInvalidation';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
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
import { User, Building, Briefcase, Upload, FileText, Euro, TrendingUp, Calendar, BarChart3, PieChart, ChevronUp, Loader2, ArrowDownLeft, ArrowUpRight, Wallet, Banknote } from 'lucide-react';
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
import { parseISO, format } from 'date-fns';
import { hu } from 'date-fns/locale';

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
  bizonylatsorszam: string;
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
  transaction_id: string | null;
  currency: string | null;
}

interface RawSalary {
  dátum: string | null;
  összeg: number;
  statusz: string | null;
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
  const { dateFrom, dateTo, dateFromFormatted, dateToFormatted } = useDateRange();
  const navigate = useNavigate();
  useRealtimeInvalidation(selectedCompany?.id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('HUF');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [navVatData, setNavVatData] = useState<NavVatData | null>(null);

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
  const [pettyCashBalance, setPettyCashBalance] = useState<number | null>(null);
  
  // Product Tour state
  const [showTour, setShowTour] = useState(false);

  const vatChartRef = useRef<HTMLDivElement>(null);

  // displayedPeriod for UI labels
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

  // TanStack Query: exchange rates (global, no company dependency)
  const { data: exchangeRates = {} } = useQuery({
    queryKey: queryKeys.exchangeRates(),
    queryFn: async () => {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/HUF');
      const data = await response.json();
      return data.rates as {[key: string]: number};
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  // TanStack Query: dashboard data
  const { isLoading: metricsLoading } = useQuery({
    queryKey: queryKeys.dashboardData(selectedCompany?.id || '', dateFromFormatted, dateToFormatted),
    queryFn: async () => {
      await fetchDashboardData();
      return true; // just used to track loading
    },
    enabled: !!user && !!selectedCompany?.id,
  });

  // TanStack Query: analytics data
  const { isLoading: analyticsLoading } = useQuery({
    queryKey: queryKeys.dashboardAnalytics(selectedCompany?.id || '', dateFromFormatted, dateToFormatted),
    queryFn: async () => {
      await fetchAnalyticsData();
      return true;
    },
    enabled: !!user && !!selectedCompany?.id,
  });

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
          setTimeout(() => setShowTour(true), 500);
        }
      } catch (error) {
        console.error('Error checking tour status:', error);
      }
    };
    
    checkTourStatus();
  }, [user, selectedCompany]);

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
    try {
      await Promise.all([fetchRawData(), fetchVatData()]);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    }
  };

  const fetchRawData = async () => {
    const yearStart = format(dateFrom, 'yyyy-01-01');
    const yearEnd = format(dateTo, 'yyyy-12-31');

    const { data: navInvoices } = await supabase
      .from("nav_invoices")
      .select("invoice_issue_date, invoice_direction, invoice_gross_amount, invoice_net_amount, transaction_id, currency")
      .eq("company_id", selectedCompany?.id)
      .gte("invoice_issue_date", yearStart)
      .lte("invoice_issue_date", yearEnd);

    const { data: salaries } = await supabase
      .from("salary")
      .select("dátum, összeg, statusz, transaction_id")
      .eq("company_id", selectedCompany?.id)
      .not("transaction_id", "is", null)
      .gte("dátum", yearStart)
      .lte("dátum", yearEnd) as { data: any[] | null };

    setRawInvoices(navInvoices || []);
    setRawSalaries(
      (salaries || [])
        .map((s: any) => ({ dátum: s.dátum, összeg: s.összeg, statusz: s.statusz }))
    );
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
        
        const isPaid = !!inv.transaction_id;
        if (inv.invoice_direction === "OUTBOUND") {
          if (isPaid) {
            monthlyMap[monthIndex].revenuePaid += amount;
          } else {
            monthlyMap[monthIndex].revenueUnpaid += amount;
          }
        } else { // INBOUND
          if (isPaid) {
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
    { name: "Fizetendő ÁFA", value: totalOutboundVat, color: "#F59E0B" },
    { name: "Levonható ÁFA", value: totalInboundVat, color: "#8B5CF6" },
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
        .eq('company_id', selectedCompany.id)
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

      // Use RPC functions for aggregation to avoid 1000 row limit
      const { data: invoiceAggregates, error: invoiceAggError } = await supabase
        .rpc('get_invoice_aggregates', {
          p_company_id: selectedCompany.id,
          p_date_from: dateFromFormatted,
          p_date_to: dateToFormatted
        });

      if (invoiceAggError) {
        console.error('Invoice aggregation error:', invoiceAggError);
        throw invoiceAggError;
      }

      const selectedPeriodAmountByCurrency: { [key: string]: number } = {};
      let totalInvoices = 0;
      let processingCount = 0;
      let completedCount = 0;
      
      (invoiceAggregates || []).forEach((agg: { currency: string; total_gross: number; processing_count: number; completed_count: number; total_count: number }) => {
        const currency = agg.currency || 'HUF';
        selectedPeriodAmountByCurrency[currency] = (selectedPeriodAmountByCurrency[currency] || 0) + Number(agg.total_gross || 0);
        totalInvoices += Number(agg.total_count || 0);
        processingCount += Number(agg.processing_count || 0);
        completedCount += Number(agg.completed_count || 0);
      });

      setMetrics({
        totalInvoices,
        totalAmountByCurrency: selectedPeriodAmountByCurrency,
        thisMonthAmountByCurrency: selectedPeriodAmountByCurrency,
        averageInvoiceAmount: 0,
        processingCount,
        completedCount
      });

      // Use RPC function for NAV invoice aggregation to avoid 1000 row limit
      const { data: navAggregates, error: navAggError } = await supabase
        .rpc('get_nav_invoice_aggregates', {
          p_company_id: selectedCompany.id,
          p_date_from: dateFromFormatted,
          p_date_to: dateToFormatted
        });

      if (navAggError) {
        console.error('NAV aggregation error:', navAggError);
        throw navAggError;
      }

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

      (navAggregates || []).forEach((agg: { 
        invoice_direction: string; 
        currency: string; 
        total_net: number; 
        total_gross: number; 
        total_vat: number;
        paid_net: number;
        paid_gross: number;
        unpaid_net: number;
        unpaid_gross: number;
        invoice_count: number;
      }) => {
        const currency = agg.currency || 'HUF';
        const vatAmount = Number(agg.total_vat || 0);
        const netAmount = Number(agg.total_net || 0);
        const grossAmount = Number(agg.total_gross || 0);
        const unpaidNet = Number(agg.unpaid_net || 0);
        const unpaidGross = Number(agg.unpaid_gross || 0);

        if (agg.invoice_direction === 'INBOUND') {
          inboundVat[currency] = (inboundVat[currency] || 0) + vatAmount;
          expensesNet[currency] = (expensesNet[currency] || 0) + netAmount;
          expensesGross[currency] = (expensesGross[currency] || 0) + grossAmount;
          unpaidInboundNet[currency] = (unpaidInboundNet[currency] || 0) + unpaidNet;
          unpaidInboundGross[currency] = (unpaidInboundGross[currency] || 0) + unpaidGross;
        } else if (agg.invoice_direction === 'OUTBOUND') {
          outboundVat[currency] = (outboundVat[currency] || 0) + vatAmount;
          revenueNet[currency] = (revenueNet[currency] || 0) + netAmount;
          revenueGross[currency] = (revenueGross[currency] || 0) + grossAmount;
          unpaidOutboundNet[currency] = (unpaidOutboundNet[currency] || 0) + unpaidNet;
          unpaidOutboundGross[currency] = (unpaidOutboundGross[currency] || 0) + unpaidGross;
        }
      });

      setNavVatData({ inboundVat, outboundVat, revenueNet, revenueGross, expensesNet, expensesGross, unpaidInboundNet, unpaidInboundGross, unpaidOutboundNet, unpaidOutboundGross });

      // Fetch petty cash balance
      try {
        const { data: hpSettings } = await supabase
          .from('hp_settings')
          .select('opening_balance, start_date')
          .eq('company_id', selectedCompany.id)
          .maybeSingle();

        // Only use opening balance if hp_settings exists AND start_date is set
        const hasValidSettings = hpSettings && hpSettings.start_date;
        const ob = hasValidSettings ? (hpSettings.opening_balance || 0) : 0;
        const startDateFilter = hpSettings?.start_date;

        if (!hasValidSettings) {
          setPettyCashBalance(null);
        } else {

        let withdrawalsQuery = supabase
          .from('transactions')
          .select('amount')
          .eq('company_id', selectedCompany.id)
          .in('type', ['atm készpénzfelvét', 'pénztári kp felvét']);
        if (startDateFilter) withdrawalsQuery = withdrawalsQuery.gte('transaction_date', startDateFilter);

        let cashDepositsQuery = supabase
          .from('transactions')
          .select('amount')
          .eq('company_id', selectedCompany.id)
          .in('type', ['pénztári kp befizetés', 'kp befizetés atm-en keresztül']);
        if (startDateFilter) cashDepositsQuery = cashDepositsQuery.gte('transaction_date', startDateFilter);

        let cashSalesQuery = supabase
          .from('nav_invoices')
          .select('invoice_gross_amount')
          .eq('company_id', selectedCompany.id)
          .eq('invoice_direction', 'OUTBOUND')
          .in('payment_method', ['CASH', 'KÉSZPÉNZ']);
        if (startDateFilter) cashSalesQuery = cashSalesQuery.gte('invoice_issue_date', startDateFilter);

        let cashExpensesQuery = supabase
          .from('invoices')
          .select('brutto_vegosszeg, bizonylatsorszam')
          .eq('company_id', selectedCompany.id)
          .ilike('fizetesi_mod', '%készpénz%')
          .is('reference_number', null);
        if (startDateFilter) cashExpensesQuery = cashExpensesQuery.gte('kibocsatas_datuma', startDateFilter);

        let navCashExpensesQuery = supabase
          .from('nav_invoices')
          .select('invoice_gross_amount, invoice_number')
          .eq('company_id', selectedCompany.id)
          .eq('invoice_direction', 'INBOUND')
          .in('payment_method', ['CASH', 'KÉSZPÉNZ']);
        if (startDateFilter) navCashExpensesQuery = navCashExpensesQuery.gte('invoice_issue_date', startDateFilter);

        const [withdrawalsRes, cashDepositsRes, cashSalesRes, cashExpensesRes, navCashExpensesRes] = await Promise.all([
          withdrawalsQuery, cashDepositsQuery, cashSalesQuery, cashExpensesQuery, navCashExpensesQuery
        ]);

        const withdrawals = (withdrawalsRes.data || []).reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
        const cashDeposits = (cashDepositsRes.data || []).reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0);
        const cashSales = (cashSalesRes.data || []).reduce((sum: number, inv: any) => sum + Math.abs(inv.invoice_gross_amount || 0), 0);
        const cashExpenses = (cashExpensesRes.data || []).reduce((sum: number, inv: any) => sum + Math.abs(inv.brutto_vegosszeg || 0), 0);

        // De-duplicate: exclude nav_invoices already present in invoices table
        const invoiceNumbers = new Set((cashExpensesRes.data || []).map((inv: any) => inv.bizonylatsorszam).filter(Boolean));
        const navCashExpenses = (navCashExpensesRes.data || [])
          .filter((inv: any) => !inv.invoice_number || !invoiceNumbers.has(inv.invoice_number))
          .reduce((sum: number, inv: any) => sum + Math.abs(inv.invoice_gross_amount || 0), 0);

        setPettyCashBalance(ob + withdrawals - cashDeposits + cashSales - cashExpenses - navCashExpenses);
        }
      } catch (e) {
        console.error('Error fetching petty cash balance:', e);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryBreakdownData = () => {
    if (!categories.length || !invoices.length) return [];

    const categoryStats = categories.map(category => {
      const categoryInvoices = invoices.filter(invoice => invoice.category_id === category.id && !(invoice as any).reference_number);
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-stretch">
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
                title="Házipénztár"
                value={formatCurrency(pettyCashBalance ?? 0)}
                description="Aktuális készpénz egyenleg"
                icon={Banknote}
                variant={pettyCashBalance !== null && pettyCashBalance >= 0 ? 'success' : 'destructive'}
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
