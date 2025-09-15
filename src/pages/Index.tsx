import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LogOut, User, Building, Briefcase, Upload, FileText, Euro, TrendingUp, Calendar, BarChart3, PieChart } from 'lucide-react';
import MetricCard from '@/components/dashboard/MetricCard';
import RecentInvoices from '@/components/dashboard/RecentInvoices';
import ProjectBreakdown from '@/components/dashboard/ProjectBreakdown';
import { formatCurrency } from '@/lib/utils';

interface Profile {
  name: string;
  position: string;
  company: string;
  avatar_url: string;
}

interface Project {
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
  project_id?: string;
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

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

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      // Fetch invoices with project names
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          projects!inner(name)
        `)
        .eq('user_id', user.id)
        .order('kibocsatas_datuma', { ascending: false })
        .limit(10);

      if (invoicesError) throw invoicesError;
      
      const formattedInvoices = (invoicesData || []).map(invoice => ({
        ...invoice,
        project_name: invoice.projects?.name
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

  const getProjectBreakdownData = () => {
    if (!projects.length || !invoices.length) return [];

    const projectStats = projects.map(project => {
      const projectInvoices = invoices.filter(invoice => invoice.project_id === project.id);
      const totalAmount = projectInvoices.reduce((sum, invoice) => sum + invoice.brutto_vegosszeg, 0);
      
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        invoice_count: projectInvoices.length,
        total_amount: totalAmount,
        avg_amount: projectInvoices.length > 0 ? totalAmount / projectInvoices.length : 0,
        percentage: metrics ? (totalAmount / metrics.totalAmount) * 100 : 0
      };
    }).filter(project => project.invoice_count > 0)
      .sort((a, b) => b.total_amount - a.total_amount);

    return projectStats;
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
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Számla Kezelő</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              {profile?.name || user?.email}
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Kijelentkezés
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">Üdvözlünk vissza, {profile?.name}!</h2>
          <p className="text-muted-foreground">
            Itt van a vállalkozásod teljes áttekintése
          </p>
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
              value={formatCurrency(metrics.totalAmount)}
              description="Minden számla összege"
              icon={Euro}
              variant="success"
            />
            <MetricCard
              title="Ez a hónap"
              value={formatCurrency(metrics.thisMonthAmount)}
              description="Jelenlegi havi bevétel"
              icon={Calendar}
              variant="warning"
            />
            <MetricCard
              title="Átlagos számla"
              value={formatCurrency(metrics.averageInvoiceAmount)}
              description="Számla átlagérték"
              icon={TrendingUp}
              variant="default"
            />
          </div>
        )}

        {/* Main Dashboard Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Invoices */}
          <RecentInvoices 
            invoices={invoices} 
            onViewInvoice={(invoice) => console.log('View invoice:', invoice)}
          />

          {/* Project Breakdown */}
          <ProjectBreakdown 
            projects={getProjectBreakdownData()}
            totalAmount={metrics?.totalAmount || 0}
          />
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
          <Card className="p-6 text-center hover:bg-muted/50 transition-colors">
            <BarChart3 className="h-8 w-8 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold mb-2">Részletes Elemzések</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Mélyebb betekintés a pénzügyi adatokba
            </p>
            <Button variant="outline" className="w-full" disabled>
              Hamarosan
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
            <Button variant="outline" className="w-full" disabled>
              Hamarosan
            </Button>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Index;
