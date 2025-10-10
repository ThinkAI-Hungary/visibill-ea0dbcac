import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
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
import { formatCurrency } from '@/lib/utils';

interface Profile {
  name: string;
  position: string;
  company: string;
  avatar_url: string;
}

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
  category_id?: string;
}

interface DashboardMetrics {
  totalInvoices: number;
  totalAmount: number;
  thisMonthAmount: number;
  averageInvoiceAmount: number;
  processingCount: number;
  completedCount: number;
}

const Index = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('HUF');
  const [exchangeRates, setExchangeRates] = useState<{[key: string]: number}>({});

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
  }, [user]);

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

  const fetchDashboardData = async () => {
    if (!user) return;
    
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch categories (formerly projects)
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch invoices with category names
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          categories(name)
        `)
        .eq('user_id', user.id)
        .order('kibocsatas_datuma', { ascending: false })
        .limit(10);

      if (invoicesError) throw invoicesError;
      
      const formattedInvoices = (invoicesData || []).map(invoice => ({
        ...invoice,
        category_name: invoice.categories?.name
      }));
      setInvoices(formattedInvoices);

      // Calculate metrics
      const { data: allInvoicesData, error: metricsError } = await supabase
        .from('invoices')
        .select('brutto_vegosszeg, kibocsatas_datuma, statusz')
        .eq('user_id', user.id);

      if (metricsError) throw metricsError;

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const thisMonthInvoices = (allInvoicesData || []).filter(invoice => {
        const invoiceDate = new Date(invoice.kibocsatas_datuma);
        return invoiceDate.getMonth() === currentMonth && invoiceDate.getFullYear() === currentYear;
      });

      const totalAmount = (allInvoicesData || []).reduce((sum, invoice) => sum + invoice.brutto_vegosszeg, 0);
      const thisMonthAmount = thisMonthInvoices.reduce((sum, invoice) => sum + invoice.brutto_vegosszeg, 0);
      const processingCount = (allInvoicesData || []).filter(invoice => invoice.statusz === 'feldolgozas_alatt').length;
      const completedCount = (allInvoicesData || []).filter(invoice => invoice.statusz === 'feldolgozva').length;

      setMetrics({
        totalInvoices: (allInvoicesData || []).length,
        totalAmount,
        thisMonthAmount,
        averageInvoiceAmount: (allInvoicesData || []).length > 0 ? totalAmount / (allInvoicesData || []).length : 0,
        processingCount,
        completedCount
      });

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
      
      return {
        id: category.id,
        name: category.name,
        description: category.description,
        invoice_count: categoryInvoices.length,
        total_amount: totalAmount,
        avg_amount: categoryInvoices.length > 0 ? totalAmount / categoryInvoices.length : 0,
        percentage: metrics ? (totalAmount / metrics.totalAmount) * 100 : 0
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
            <h2 className="text-3xl font-bold">Üdvözlünk vissza, {profile?.name}!</h2>
            <p className="text-muted-foreground">
              Itt van a vállalkozásod teljes áttekintése
            </p>
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

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Összes számla"
              value={metrics.totalInvoices}
              description={`${metrics.completedCount} feldolgozva`}
              icon={FileText}
              variant="default"
            />
            <MetricCard
              title="Teljes összeg"
              value={formatCurrency(convertAmount(metrics.totalAmount), selectedCurrency)}
              description="Minden számla összege"
              icon={Euro}
              variant="success"
            />
            <MetricCard
              title="Ez a hónap"
              value={formatCurrency(convertAmount(metrics.thisMonthAmount), selectedCurrency)}
              description="Jelenlegi havi bevétel"
              icon={Calendar}
              variant="warning"
            />
            <MetricCard
              title="Átlagos számla"
              value={formatCurrency(convertAmount(metrics.averageInvoiceAmount), selectedCurrency)}
              description="Számla átlagérték"
              icon={TrendingUp}
              variant="default"
            />
          </div>
        )}

        {/* Main Dashboard Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Invoices */}
          <div className="lg:col-span-2">
            <RecentInvoices 
              invoices={invoices} 
              onViewInvoice={(invoice) => console.log('View invoice:', invoice)}
            />
          </div>

          {/* Subscription Usage */}
          <div className="space-y-6">
            <SubscriptionUsage />
            {/* Category Breakdown */}
            <ProjectBreakdown 
              projects={getCategoryBreakdownData()}
              totalAmount={metrics?.totalAmount || 0}
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
          <Card className="p-6 text-center hover:bg-muted/50 transition-colors">
            <BarChart3 className="h-8 w-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">Számlák áttekintése</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Részletes számla lista szűrési lehetőségekkel
            </p>
            <Button 
              variant="default" 
              className="w-full"
              onClick={() => navigate('/invoices')}
            >
              Számlák megtekintése
            </Button>
          </Card>
          <Card className="p-6 text-center hover:bg-muted/50 transition-colors">
            <Upload className="h-8 w-8 mx-auto mb-3 text-accent" />
            <h3 className="font-semibold mb-2">Számlák feltöltése</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Új számlák kézi feltöltése
            </p>
            <Button 
              variant="default" 
              className="w-full"
              onClick={() => navigate('/upload')}
            >
              Fájlok feltöltése
            </Button>
          </Card>
          <Card className="p-6 text-center hover:bg-muted/50 transition-colors">
            <PieChart className="h-8 w-8 mx-auto mb-3 text-warning" />
            <h3 className="font-semibold mb-2">Projekt Kezelés</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Projektek szerkesztése és rendszerezése
            </p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/projects')}
            >
              Projektek kezelése
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Index;
