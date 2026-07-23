import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Landmark, Plus, Trash2, Shield, CreditCard } from 'lucide-react';
import { reportError } from '@/lib/errorReporter';

interface BankAccount {
  id: string;
  company_id: string;
  bank_name: string;
  account_number: string;
  currency: string;
  created_at: string;
}

interface Props {
  companyId: string;
}

const BANK_GRADIENTS: Record<string, string> = {
  'OTP Bank': 'from-emerald-600 to-teal-800 text-white',
  'Erste Bank': 'from-red-600 to-orange-700 text-white',
  'K&H Bank': 'from-blue-600 to-sky-700 text-white',
  'Raiffeisen Bank': 'from-yellow-500 to-amber-700 text-zinc-900',
  'MBH Bank': 'from-zinc-800 to-slate-900 text-white border border-slate-700',
  'default': 'from-indigo-600 to-violet-800 text-white'
};

export function BankAccountsTab({ companyId }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [bankName, setBankName] = useState('OTP Bank');
  const [customBankName, setCustomBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [currency, setCurrency] = useState('HUF');
  const [saving, setSaving] = useState(false);

  const { data: accounts = [], isLoading } = useQuery<BankAccount[]>({
    queryKey: ['company-bank-accounts', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_bank_accounts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as BankAccount[];
    }
  });

  const formatAccountNumber = (value: string) => {
    // Keep only numbers and hyphens
    const clean = value.replace(/[^0-9]/g, '');
    if (clean.length <= 8) {
      return clean;
    } else if (clean.length <= 16) {
      return `${clean.slice(0, 8)}-${clean.slice(8)}`;
    } else {
      return `${clean.slice(0, 8)}-${clean.slice(8, 16)}-${clean.slice(16, 24)}`;
    }
  };

  const handleAccountNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccountNumber(formatAccountNumber(e.target.value));
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalBankName = bankName === 'other' ? customBankName.trim() : bankName;
    if (!finalBankName) {
      toast({ title: 'Hiba', description: 'Kérjük, add meg a bank nevét.', variant: 'destructive' });
      return;
    }

    const cleanNum = accountNumber.replace(/[^0-9]/g, '');
    if (cleanNum.length !== 16 && cleanNum.length !== 24) {
      toast({ title: 'Hiba', description: 'A magyar bankszámlaszámnak 16 vagy 24 számjegyből kell állnia.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_bank_accounts')
        .insert({
          company_id: companyId,
          bank_name: finalBankName,
          account_number: accountNumber,
          currency: currency
        });

      if (error) throw error;

      toast({ title: 'Siker', description: 'Bankszámla sikeresen hozzáadva.' });
      setAccountNumber('');
      setCustomBankName('');
      setShowAddForm(false);
      queryClient.invalidateQueries({ queryKey: ['company-bank-accounts', companyId] });
    } catch (err: any) {
      reportError({ type: 'db_query', component: 'BankAccountsTab', action: 'handleAddAccount', error: err });
      toast({ title: 'Hiba', description: 'Nem sikerült hozzáadni a bankszámlát.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Biztosan törölni szeretnéd ezt a bankszámlát?')) return;

    try {
      const { error } = await supabase
        .from('company_bank_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Siker', description: 'Bankszámla törölve.' });
      queryClient.invalidateQueries({ queryKey: ['company-bank-accounts', companyId] });
    } catch (err: any) {
      reportError({ type: 'db_query', component: 'BankAccountsTab', action: 'handleDeleteAccount', error: err });
      toast({ title: 'Hiba', description: 'Nem sikerült törölni a bankszámlát.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/60 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Céges bankszámlák
            </CardTitle>
            <CardDescription>
              Regisztráld a cég saját bankszámláit a kimenő utalási listák generálásához.
            </CardDescription>
          </div>
          {!showAddForm && (
            <Button size="sm" onClick={() => setShowAddForm(true)} className="gap-1.5 shadow-md">
              <Plus className="h-4 w-4" />
              Új bankszámla
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <form onSubmit={handleAddAccount} className="p-5 border border-primary/20 bg-primary/5 rounded-xl mb-6 space-y-4 animate-in fade-in slide-in-from-top-3 duration-200">
              <h3 className="font-semibold text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Új bankszámla hozzáadása</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bank neve</Label>
                  <Select value={bankName} onValueChange={setBankName}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Válassz bankot" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OTP Bank">OTP Bank</SelectItem>
                      <SelectItem value="Erste Bank">Erste Bank</SelectItem>
                      <SelectItem value="K&H Bank">K&H Bank</SelectItem>
                      <SelectItem value="Raiffeisen Bank">Raiffeisen Bank</SelectItem>
                      <SelectItem value="MBH Bank">MBH Bank</SelectItem>
                      <SelectItem value="other">Egyéb bank / SEPA számla</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {bankName === 'other' && (
                  <div className="space-y-2">
                    <Label htmlFor="custom_bank">Egyedi bank neve *</Label>
                    <Input
                      id="custom_bank"
                      value={customBankName}
                      onChange={e => setCustomBankName(e.target.value)}
                      placeholder="Pl. Gránit Bank"
                      required
                      className="bg-background"
                    />
                  </div>
                )}

                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label htmlFor="acc_num">Bankszámlaszám (magyar formátum) *</Label>
                  <Input
                    id="acc_num"
                    value={accountNumber}
                    onChange={handleAccountNumChange}
                    placeholder="12345678-12345678-12345678"
                    maxLength={26}
                    required
                    className="font-mono bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <div className="space-y-2">
                  <Label>Pénznem</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HUF">HUF (Ft)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? 'Mentés...' : 'Bankszámla mentése'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                  Mégse
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground animate-pulse">Számlák betöltése...</div>
          ) : accounts.length === 0 ? (
            <div className="py-8 text-center border border-dashed rounded-xl border-border/60">
              <Landmark className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nincsenek még bankszámlák hozzáadva ehhez a céghez.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map(acc => {
                const gradient = BANK_GRADIENTS[acc.bank_name] || BANK_GRADIENTS['default'];
                return (
                  <div
                    key={acc.id}
                    className={`relative p-5 rounded-2xl bg-gradient-to-br ${gradient} shadow-md overflow-hidden min-h-[140px] flex flex-col justify-between group transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}
                  >
                    {/* Background glassmorphic circle */}
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />

                    <div className="flex justify-between items-start z-10">
                      <div>
                        <p className="text-xs uppercase tracking-widest opacity-80 font-medium">{acc.bank_name}</p>
                        <p className="text-lg font-bold mt-1 flex items-center gap-1.5">
                          <Landmark className="h-4 w-4" />
                          {acc.currency} Számla
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-white/80 hover:text-red-400 hover:bg-white/10 rounded-full shrink-0 z-20"
                        onClick={() => handleDeleteAccount(acc.id)}
                        title="Törlés"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-4 z-10">
                      <p className="text-xs opacity-75">Számlaszám</p>
                      <p className="font-mono text-sm tracking-wider font-semibold select-all bg-black/10 px-2 py-1 rounded mt-0.5 inline-block">
                        {acc.account_number}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-muted/30 shadow-none">
        <CardContent className="pt-4 flex gap-3 items-start text-xs text-muted-foreground">
          <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground mb-0.5">Biztonságos adattárolás</p>
            <p>
              A bankszámlaszámokat kizárólag a netbanki átutalási fájl generálására és a beérkező banki kivonatok automatikus párosítására használjuk. Pénzügyi tranzakciót indítani vagy a bankszámládhoz hozzáférni a Visibill nem tud.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
