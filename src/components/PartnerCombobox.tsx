import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Partner {
  id: string;
  name: string;
  tax_number: string;
  partner_type: string;
}

interface PartnerComboboxProps {
  value: string;
  onChange: (partnerName: string) => void;
  companyId?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function PartnerCombobox({
  value,
  onChange,
  companyId,
  placeholder = "Partner keresése...",
  disabled = false,
}: PartnerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (open && user) {
      loadPartners();
    }
  }, [open, user, companyId]);

  const loadPartners = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      let query = supabase
        .from('partners')
        .select('id, name, tax_number, partner_type')
        .in('partner_type', ['customer', 'both'])
        .order('name');

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error('Error loading partners:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedPartner = partners.find(p => p.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
        >
          {value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Keresés név vagy adószám alapján..." />
          <CommandList>
            <CommandEmpty>
              {loading ? (
                <span className="text-muted-foreground">Betöltés...</span>
              ) : (
                <span className="text-muted-foreground">Nincs találat</span>
              )}
            </CommandEmpty>
            <CommandGroup>
              {partners.map((partner) => (
                <CommandItem
                  key={partner.id}
                  value={`${partner.name} ${partner.tax_number}`}
                  onSelect={() => {
                    onChange(partner.name);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === partner.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{partner.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {partner.tax_number}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
