import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Building, Briefcase, Upload, FileText, Euro, TrendingUp, Calendar, BarChart3, PieChart } from 'lucide-react';
import MetricCard from '@/components/dashboard/MetricCard';
import RecentInvoices from '@/components/dashboard/RecentInvoices';
import ProjectBreakdown from '@/components/dashboard/ProjectBreakdown';
import SubscriptionUsage from '@/components/SubscriptionUsage';
import InvoiceImageDialog from '@/components/InvoiceImageDialog';
import { formatCurrency } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';

interface Profile {
  name: string;
  position: string;
  company: string;
  avatar_url: string;
}

// Helper function to extract first name from full name
// Hungarian names follow "Családnév Keresztnév" format
const getFirstName = (fullName: string | undefined): string => {
  if (!fullName) return '';
  const nameParts = fullName.trim().split(' ');
  return nameParts[nameParts.length - 1]; // Get the last word (first name)
};

// Helper function to get greeting based on time of day
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
  
  // Computed value for backward compatibility
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
    
    // First convert to HUF (base currency)
    let amountInHUF = amount;
    if (fromCurrency !== 'HUF') {
      const rateFromHUF = exchangeRates[fromCurrency] || 1;
      amountInHUF = amount / rateFromHUF;
    }
    
    // Then convert from HUF to selected currency
    if (selectedCurrency === 'HUF') return amountInHUF;
    const rateToSelected = exchangeRates[selectedCurrency] || 1;
    return amountInHUF * rateToSelected;
  };

  const fetchDashboardData = async () => {
    if (!user || !selectedCompany) return;
    
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch categories for the user (user-based, not company-based)
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch invoices with category names for the selected company
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          categories(name)
        `)
        .eq('company_id', selectedCompany.id)
        .order('kibocsatas_datuma', { ascending: false })
        .limit(10);

      if (invoicesError) throw invoicesError;
      
      const formattedInvoices = (invoicesData || []).map(invoice => ({
        ...invoice,
        category_name: invoice.categories?.name
      }));
      setInvoices(formattedInvoices);

      // Calculate metrics for selected month
      const [yearNum, monthNum] = selectedVatMonth.split('-').map(Number);
      
      const { data: allInvoicesData, error: metricsError } = await supabase
        .from('invoices')
        .select('brutto_vegosszeg, kibocsatas_datuma, statusz, penznem')
        .eq('company_id', selectedCompany.id);

      if (metricsError) throw metricsError;

      // Filter invoices for the selected month
      const selectedMonthInvoices = (allInvoicesData || []).filter(invoice => {
        const invoiceDate = new Date(invoice.kibocsatas_datuma);
        return invoiceDate.getMonth() === monthNum - 1 && invoiceDate.getFullYear() === yearNum;
      });

      // Group amounts by currency for selected month
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
        averageInvoiceAmount: 0, // Not used anymore
        processingCount,
        completedCount
      });

      // Fetch NAV invoices for VAT calculation and revenue (selected month)
      const firstDayOfSelectedMonth = new Date(yearNum, monthNum - 1, 1).toISOString().split('T')[0];
      const lastDayOfSelectedMonth = new Date(yearNum, monthNum, 0).toISOString().split('T')[0];

      const { data: navInvoicesData, error: navInvoicesError } = await supabase
        .from('nav_invoices')
        .select('invoice_direction, invoice_vat_amount, invoice_net_amount, invoice_gross_amount, currency')
        .eq('company_id', selectedCompany.id)
        .gte('invoice_issue_date', firstDayOfSelectedMonth)
        .lte('invoice_issue_date', lastDayOfSelectedMonth);

      if (navInvoicesError) throw navInvoicesError;

      // Calculate VAT by direction and currency + revenue for OUTBOUND
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
      {/* Main Content */}
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

              // Calculate payable VAT (OUTBOUND - INBOUND) in selected currency
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
                      console.log('Opening invoice:', invoice);
                      console.log('Invoice image_url:', invoice.image_url);
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
        <div className="grid gap-4 md:grid-cols-4">
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
