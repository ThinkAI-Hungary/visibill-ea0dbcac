import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { formatCurrency } from '@/lib/utils';
import { Edit, User, CheckCircle2, Clock } from 'lucide-react';
import { getTypeBadge } from '@/lib/salary-helpers';
import type { SalaryItem } from '@/lib/salary-helpers';

interface Props {
  employeeGroups: [string, SalaryItem[]][];
  allNavPaid: boolean;
  onEdit: (item: SalaryItem) => void;
}

export function EmployeeAccordion({ employeeGroups, allNavPaid, onEdit }: Props) {
  if (employeeGroups.length === 0) return null;

  const getSubtotal = (items: SalaryItem[]) =>
    items.reduce((sum, item) => sum + Number(item.összeg), 0);

  const getNetTotal = (items: SalaryItem[]) =>
    items.filter(item => item.tipus === 'bér').reduce((sum, item) => sum + Number(item.összeg), 0);

  const getAllPaid = (items: SalaryItem[]) =>
    allNavPaid || items.every(item => !!item.transaction_id);

  return (
    <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">
            Dolgozói bontás{' '}
            <span className="text-muted-foreground font-normal">({employeeGroups.length} fő)</span>
          </h2>
        </div>

        <div className="grid grid-cols-[1fr_120px_140px_140px_40px] items-center px-4 py-2 mb-1 border-b border-border/30">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Megnevezés</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Státusz</span>
          <span />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Összeg</span>
          <span />
        </div>

        <Accordion type="multiple" className="w-full">
          {employeeGroups.map(([employeeName, items]) => {
            const subtotal = getSubtotal(items);
            const netTotal = getNetTotal(items);
            const allPaid = getAllPaid(items);

            return (
              <AccordionItem key={employeeName} value={employeeName} className="border-border/50">
                <AccordionTrigger className="hover:no-underline py-0 rounded-lg hover:bg-muted/40 transition-colors relative [&>svg]:absolute [&>svg]:right-4 [&>svg]:top-1/2 [&>svg]:-translate-y-1/2">
                  <div className="grid grid-cols-[1fr_120px_140px_140px_40px] items-center w-full px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {employeeName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-base">{employeeName}</p>
                        <p className="text-xs text-muted-foreground">{items.length} tétel</p>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      {allPaid ? (
                        <div className="flex items-center gap-1.5 text-emerald-500">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-xs font-medium">Fizetve</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-500">
                          <Clock className="h-4 w-4" />
                          <span className="text-xs font-medium">Nyitott</span>
                        </div>
                      )}
                    </div>
                    <span />
                    <div className="text-right">
                      <span className="font-mono font-bold text-base tabular-nums">
                        {formatCurrency(netTotal)}
                      </span>
                      <p className="text-xs text-muted-foreground">nettó</p>
                    </div>
                    <span />
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-0">
                  <div className="rounded-lg border border-border/50 overflow-hidden mx-4">
                    <div className="grid grid-cols-[1fr_120px_140px_140px_40px] items-center bg-muted/30 px-4 py-2.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Megnevezés</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">Típus</span>
                      <span />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Összeg</span>
                      <span />
                    </div>
                    {items.map(item => {
                      const typeBadge = getTypeBadge(item.tipus);
                      return (
                        <div
                          key={item.id}
                          className="grid grid-cols-[1fr_120px_140px_140px_40px] items-center px-4 py-3 border-t border-border/30 hover:bg-muted/40 transition-colors"
                        >
                          <span className="font-medium">{item.név}</span>
                          <div className="text-center">
                            <Badge variant="outline" className={`text-xs ${typeBadge.className}`}>
                              {typeBadge.label}
                            </Badge>
                          </div>
                          <span />
                          <span className="font-mono font-semibold tabular-nums text-right">
                            {formatCurrency(item.összeg)}
                          </span>
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
                              onClick={() => onEdit(item)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="grid grid-cols-[1fr_120px_140px_140px_40px] items-center px-4 py-3 bg-muted/20 border-t-2 border-border/60">
                      <span className="font-semibold text-muted-foreground text-sm">Összesen</span>
                      <span />
                      <span />
                      <span className="font-mono font-bold tabular-nums text-right">
                        {formatCurrency(subtotal)}
                      </span>
                      <span />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
