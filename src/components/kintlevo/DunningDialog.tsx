import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Mail, Send } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { CAT, fmt, validateEmail } from '@/lib/kintlevo-helpers';
import type { AgingCategory, CompanyGroup } from '@/lib/kintlevo-helpers';
import type { QueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyGroups: CompanyGroup[];
  selectedCompanyId: string;
  selectedCompanyName: string;
  queryClient: QueryClient;
  updatePartnerEmail: (args: { partnerId: string; email: string }) => Promise<void>;
}

export function DunningDialog({
  open, onOpenChange, companyGroups, selectedCompanyId, selectedCompanyName,
  queryClient, updatePartnerEmail,
}: Props) {
  const [selectedCats, setSelectedCats] = useState<Set<AgingCategory>>(
    new Set(['yellow', 'red', 'purple'])
  );
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const initDialog = () => {
    const keys = new Set<string>();
    const emails: Record<string, string> = {};
    for (const g of companyGroups) {
      if (selectedCats.has(g.worstCategory)) keys.add(g.companyName);
      emails[g.companyName] = g.partnerEmail ?? '';
    }
    setSelectedCompanies(keys);
    setEmailMap(emails);
    setEmailErrors({});
  };

  // Init when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) initDialog();
    onOpenChange(v);
  };

  const toggleCat = (cat: AgingCategory) => {
    setSelectedCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      const keys = new Set<string>();
      for (const g of companyGroups) {
        if (next.has(g.worstCategory)) keys.add(g.companyName);
      }
      setSelectedCompanies(keys);
      return next;
    });
  };

  const toggleCompanySelect = (name: string) => {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const handleSend = async () => {
    const targets = companyGroups.filter(g => selectedCompanies.has(g.companyName));
    if (targets.length === 0) { toast({ title: 'Nincs kiválasztott cég', variant: 'destructive' }); return; }

    const errors: Record<string, string> = {};
    for (const t of targets) {
      const email = (emailMap[t.companyName] ?? '').trim();
      if (!email) errors[t.companyName] = 'Email-cím megadása kötelező';
      else if (!validateEmail(email)) errors[t.companyName] = 'Érvénytelen email-cím';
    }
    if (Object.keys(errors).length > 0) { setEmailErrors(errors); return; }

    setSending(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Nincs munkamenet');

      for (const target of targets) {
        const email = emailMap[target.companyName].trim();
        try {
          if (target.partnerId && email !== (target.partnerEmail ?? '')) {
            await updatePartnerEmail({ partnerId: target.partnerId, email });
          }
          const { error } = await supabase.functions.invoke('send-dunning-email', {
            body: {
              companyId: selectedCompanyId,
              senderCompanyName: selectedCompanyName,
              debtorCompanyName: target.companyName,
              debtorTaxNumber: target.taxNumber,
              debtorEmail: email,
              invoices: target.invoices.map(inv => ({
                id: inv.id, invoiceNumber: inv.invoiceNumber,
                issueDate: inv.issueDate, dueDate: inv.dueDate,
                amount: inv.amount, currency: inv.currency,
                daysOverdue: inv.daysOverdue, category: inv.category,
                source: inv.source,
                attachmentUrl: inv.source === 'manual' ? inv.attachmentUrl : null,
              })),
              totalAmount: target.totalAmount,
              worstCategory: target.worstCategory,
            },
          });
          if (error) throw error;
          successCount++;
        } catch (err: any) {
          console.error('Dunning send error for', target.companyName, err);
          errorCount++;
        }
      }
      if (successCount > 0) {
        toast({ title: `${successCount} felszólítás sikeresen elküldve!` });
        queryClient.invalidateQueries({ queryKey: ['dunning-sends'] });
      }
      if (errorCount > 0) toast({ title: `${errorCount} levél küldése sikertelen`, variant: 'destructive' });
      if (successCount > 0) onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Hiba: ' + err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Felszólítólevelek küldése
          </DialogTitle>
          <DialogDescription>
            Minden kijelölt cégnek <strong>egyetlen levelet</strong> küldünk az összes tartozó számlájával.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Category toggles */}
          <div>
            <p className="text-sm font-medium mb-2">Kategória szűrő:</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CAT) as AgingCategory[]).map(cat => {
                const c = CAT[cat];
                const Icon = c.icon;
                const active = selectedCats.has(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCat(cat)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      active ? c.badge : 'border-border text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Company list with email */}
          <div>
            <p className="text-sm font-medium mb-2">
              Cégek ({selectedCompanies.size} kijelölve):
            </p>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {companyGroups.map(g => {
                const c = CAT[g.worstCategory];
                const Icon = c.icon;
                const isSel = selectedCompanies.has(g.companyName);
                const emailVal = emailMap[g.companyName] ?? '';
                const emailErr = emailErrors[g.companyName];
                return (
                  <div
                    key={g.companyName}
                    className={cn(
                      'p-3 rounded-lg border transition-all',
                      isSel ? cn(c.rowBg, c.border) : 'border-border bg-muted/10 opacity-50'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Checkbox
                        id={`chk-${g.companyName}`}
                        checked={isSel}
                        onCheckedChange={() => toggleCompanySelect(g.companyName)}
                      />
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', c.text)} />
                      <Label
                        htmlFor={`chk-${g.companyName}`}
                        className="flex-1 font-medium text-sm cursor-pointer truncate"
                      >
                        {g.companyName}
                      </Label>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {fmt(g.totalAmount)} · {g.invoices.length} db
                      </span>
                    </div>
                    {isSel && (
                      <div className="pl-7">
                        <Input
                          type="email"
                          placeholder={g.partnerEmail ? g.partnerEmail : 'partner@example.com'}
                          value={emailVal}
                          onChange={e => {
                            setEmailMap(prev => ({ ...prev, [g.companyName]: e.target.value }));
                            if (emailErrors[g.companyName]) {
                              setEmailErrors(prev => { const n = { ...prev }; delete n[g.companyName]; return n; });
                            }
                          }}
                          className={cn('h-7 text-xs', emailErr ? 'border-destructive' : '')}
                        />
                        {emailErr && <p className="text-xs text-destructive mt-1">{emailErr}</p>}
                        {!g.partnerEmail && (
                          <p className="text-xs text-amber-400 mt-1">
                            ⚠️ Nincs mentett email — ha megad egyet, elmentjük a Partnertörzsbe
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 border p-3 text-xs text-muted-foreground space-y-1">
            <p>📧 A levelek a <strong>Visibill rendszeréből</strong> mennek ki — a partner Önnek tud visszaírni.</p>
            <p>📎 Manuálisan feltöltött számlákhoz PDF melléklet is kerül a levélbe.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Mégse
          </Button>
          <Button onClick={handleSend} disabled={sending || selectedCompanies.size === 0} className="gap-2">
            {sending ? 'Küldés...' : (
              <><Send className="h-4 w-4" />{selectedCompanies.size} felszólítás küldése</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
