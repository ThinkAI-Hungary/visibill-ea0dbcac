import React, { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { UserPlus, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Partner } from '@/hooks/useInvoiceData';
import { useTranslation } from 'react-i18next';

interface NavInvoicePartnerAssignerProps {
  invoiceId: string;
  invoiceNumber: string;
  isOutbound: boolean;
  partners: Partner[];
  onAssigned?: () => void;
  disabled?: boolean;
}

export const NavInvoicePartnerAssigner: React.FC<NavInvoicePartnerAssignerProps> = ({
  invoiceId,
  invoiceNumber,
  isOutbound,
  partners,
  onAssigned,
  disabled = false,
}) => {
  const { t } = useTranslation(['invoices', 'common']);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizeText = (text: string) =>
    (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filteredPartners = useMemo(() => {
    const q = normalizeText(searchQuery.trim());
    if (!q) return partners.slice(0, 50);
    return partners
      .filter(p => normalizeText(p.name).includes(q) || (p.tax_number && p.tax_number.includes(q)))
      .slice(0, 50);
  }, [partners, searchQuery]);

  const handleSelectPartner = async (partner: Partner) => {
    if (loading) return;
    setLoading(true);
    try {
      const updateData: Record<string, any> = isOutbound
        ? {
            customer_name: partner.name,
            customer_tax_number: partner.tax_number || '',
          }
        : {
            supplier_name: partner.name,
            supplier_tax_number: partner.tax_number || '',
            ...(partner.id ? { supplier_partner_id: partner.id } : {}),
          };

      const { error } = await supabase
        .from('nav_invoices')
        .update(updateData)
        .eq('id', invoiceId);

      if (error) throw error;

      toast({
        title: t('invoices:partner_assign_success', 'Partner sikeresen hozzárendelve'),
        description: `${invoiceNumber}: ${partner.name}`,
      });
      setOpen(false);
      onAssigned?.();
    } catch (err: any) {
      console.error('Failed to assign partner to invoice:', err);
      toast({
        title: t('invoices:partner_assign_error', 'Hiba a partner hozzárendelésekor'),
        description: err?.message || 'Kérjük próbáld újra később.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled && !loading) {
              setOpen(true);
            }
          }}
          disabled={disabled || loading}
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer",
            (disabled || loading) && "opacity-60 cursor-not-allowed"
          )}
          title={t('invoices:assign_partner_tooltip', 'Partner hozzárendelése a számlához')}
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
          ) : (
            <UserPlus className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <span className="italic">{t('invoices:expanded.unknown_partner', 'Ismeretlen partner')}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[300px] p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('invoices:search_partner_placeholder', 'Partner keresése név vagy adószám...')}
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="text-xs h-8"
          />
          <CommandList className="max-h-[220px]">
            <CommandEmpty className="py-2.5 text-center text-xs text-muted-foreground">
              {t('common:no_results', 'Nincs találat.')}
            </CommandEmpty>
            <CommandGroup heading={t('invoices:partners_heading', 'Elérhető partnerek')}>
              {filteredPartners.map((p, idx) => (
                <CommandItem
                  key={p.id || p.tax_number || idx}
                  value={p.name}
                  onSelect={() => handleSelectPartner(p)}
                  className="text-xs flex items-center justify-between cursor-pointer py-1.5"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-medium truncate">{p.name}</span>
                    {p.tax_number && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {p.tax_number}
                      </span>
                    )}
                  </div>
                  <Check className="w-3.5 h-3.5 text-emerald-500 opacity-0 group-hover:opacity-100" />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default NavInvoicePartnerAssigner;
