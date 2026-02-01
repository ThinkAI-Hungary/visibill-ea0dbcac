import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, Check, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

interface Invoice {
  id: string;
  invoice_number: string;
  supplier_name: string | null;
  invoice_gross_amount: number | null;
  invoice_issue_date: string | null;
  project_id: string | null;
  currency: string | null;
  project_name: string | null;
}

interface SupplierInvoiceAssignmentProps {
  projectId: string;
  projectName: string;
  companyId: string;
  onAssignmentChange?: () => void;
}

export function SupplierInvoiceAssignment({
  projectId,
  projectName,
  companyId,
  onAssignmentChange,
}: SupplierInvoiceAssignmentProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (projectId && companyId) {
      loadInvoices();
    }
  }, [projectId, companyId]);

  const loadInvoices = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get all INBOUND invoices with project names via join
      const { data, error } = await supabase
        .from('nav_invoices')
        .select(`
          id, 
          invoice_number, 
          supplier_name, 
          invoice_gross_amount, 
          invoice_issue_date, 
          project_id, 
          currency,
          projects:project_id (name)
        `)
        .eq('company_id', companyId)
        .eq('invoice_direction', 'INBOUND')
        .order('invoice_issue_date', { ascending: false });

      if (error) throw error;
      
      // Transform to flatten project name
      const transformedData = (data || []).map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        supplier_name: inv.supplier_name,
        invoice_gross_amount: inv.invoice_gross_amount,
        invoice_issue_date: inv.invoice_issue_date,
        project_id: inv.project_id,
        currency: inv.currency,
        project_name: inv.projects?.name || null,
      }));
      
      setInvoices(transformedData);
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: 'Nem sikerült betölteni a számlákat.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (invoiceId: string) => {
    setAssigningId(invoiceId);
    try {
      const { error } = await supabase
        .from('nav_invoices')
        .update({ project_id: projectId })
        .eq('id', invoiceId);

      if (error) {
        // Handle the custom error from the trigger - now includes both ID and name
        if (error.message?.includes('INVOICE_ALREADY_ASSIGNED::')) {
          const parts = error.message.split('::');
          // parts[1] = project_id, parts[2] = project_name
          const existingProjectName = parts[2] || parts[1] || 'Ismeretlen projekt';
          toast({
            variant: 'destructive',
            title: 'Hozzárendelés sikertelen',
            description: `Ez a számla már a "${existingProjectName}" projekthez van rendelve.`,
          });
          return;
        }
        throw error;
      }

      toast({
        title: 'Számla hozzárendelve',
        description: 'A számla sikeresen hozzárendelve a projekthez.',
      });

      await loadInvoices();
      onAssignmentChange?.();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: error.message || 'Nem sikerült hozzárendelni a számlát.',
      });
    } finally {
      setAssigningId(null);
    }
  };

  const handleUnassign = async (invoiceId: string) => {
    setAssigningId(invoiceId);
    try {
      const { error } = await supabase
        .from('nav_invoices')
        .update({ project_id: null })
        .eq('id', invoiceId);

      if (error) throw error;

      toast({
        title: 'Hozzárendelés törölve',
        description: 'A számla már nem tartozik ehhez a projekthez.',
      });

      await loadInvoices();
      onAssignmentChange?.();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: error.message || 'Nem sikerült törölni a hozzárendelést.',
      });
    } finally {
      setAssigningId(null);
    }
  };

  const filteredInvoices = useMemo(() => {
    if (!searchTerm) return invoices;
    const term = searchTerm.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoice_number.toLowerCase().includes(term) ||
        inv.supplier_name?.toLowerCase().includes(term)
    );
  }, [invoices, searchTerm]);

  // Categorize invoices
  const assignedToThis = filteredInvoices.filter((inv) => inv.project_id === projectId);
  const unassigned = filteredInvoices.filter((inv) => inv.project_id === null);
  const assignedToOther = filteredInvoices.filter(
    (inv) => inv.project_id !== null && inv.project_id !== projectId
  );

  const handleAssignConflicting = (invoice: Invoice) => {
    toast({
      variant: 'destructive',
      title: 'Hozzárendelés sikertelen',
      description: `Ez a számla már a(z) "${invoice.project_name}" projekthez van rendelve.`,
    });
  };

  if (loading) {
    return (
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">Számlák betöltése...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <div className="p-4 border-b">
        <h4 className="font-medium mb-3">Költségszámlák hozzárendelése</h4>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Keresés számlaszám vagy szállító alapján..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="p-4 space-y-4">
          {/* Unassigned invoices */}
          {unassigned.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-muted-foreground mb-2">
                Hozzárendelhető számlák ({unassigned.length})
              </h5>
              <div className="space-y-2">
                {unassigned.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm truncate">
                          {invoice.invoice_number}
                        </span>
                        {invoice.invoice_issue_date && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(invoice.invoice_issue_date), 'yyyy.MM.dd', { locale: hu })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {invoice.supplier_name || 'Ismeretlen szállító'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium whitespace-nowrap">
                        {formatCurrency(invoice.invoice_gross_amount || 0, invoice.currency || 'HUF')}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAssign(invoice.id)}
                        disabled={assigningId === invoice.id}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoices assigned to other projects */}
          {assignedToOther.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-muted-foreground mb-2">
                Más projekthez rendelve ({assignedToOther.length})
              </h5>
              <div className="space-y-2">
                {assignedToOther.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-2 rounded-md bg-destructive/5 border border-destructive/20"
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm truncate">
                          {invoice.invoice_number}
                        </span>
                        {invoice.invoice_issue_date && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(invoice.invoice_issue_date), 'yyyy.MM.dd', { locale: hu })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {invoice.supplier_name || 'Ismeretlen szállító'}
                      </p>
                      <p className="text-xs text-destructive mt-1">
                        Ez a számla már a(z) "{invoice.project_name}" projekthez van rendelve.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium whitespace-nowrap">
                        {formatCurrency(invoice.invoice_gross_amount || 0, invoice.currency || 'HUF')}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAssignConflicting(invoice)}
                        disabled
                        className="opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoices assigned to this project */}
          {assignedToThis.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-muted-foreground mb-2">
                Már hozzárendelve ({assignedToThis.length})
              </h5>
              <div className="space-y-2">
                {assignedToThis.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-2 rounded-md bg-primary/5 border border-primary/20"
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm truncate">
                          {invoice.invoice_number}
                        </span>
                        {invoice.invoice_issue_date && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(invoice.invoice_issue_date), 'yyyy.MM.dd', { locale: hu })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {invoice.supplier_name || 'Ismeretlen szállító'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium whitespace-nowrap">
                        {formatCurrency(invoice.invoice_gross_amount || 0, invoice.currency || 'HUF')}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnassign(invoice.id)}
                        disabled={assigningId === invoice.id}
                        className="text-primary"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredInvoices.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nincsenek hozzárendelhető számlák</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
