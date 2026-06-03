import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Mail, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CAT, fmt } from '@/lib/kintlevo-helpers';
import type { CompanyGroup } from '@/lib/kintlevo-helpers';

interface Props {
  filteredGroups: CompanyGroup[];
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function KintlevoCompanyTable({ filteredGroups, expanded, setExpanded }: Props) {
  if (filteredGroups.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500/30" />
        <p className="text-lg font-medium">Nincs kintlévőség</p>
        <p className="text-sm">Minden számla ki van egyenlítve!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredGroups.map(group => {
        const c = CAT[group.worstCategory];
        const Icon = c.icon;
        const isOpen = expanded.has(group.companyName);
        const daysSince = group.lastSent
          ? differenceInDays(new Date(), parseISO(group.lastSent))
          : null;

        return (
          <div key={group.companyName} className={cn('rounded-lg border overflow-hidden', c.border, c.rowBg)}>
            {/* Company header row */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:brightness-110 transition-all select-none"
              onClick={() => setExpanded(prev => {
                const n = new Set(prev);
                n.has(group.companyName) ? n.delete(group.companyName) : n.add(group.companyName);
                return n;
              })}
            >
              <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold border', c.border, c.rowBg, c.text)}>
                {group.companyName.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate text-sm">{group.companyName}</span>
                  {group.taxNumber && (
                    <span className="text-xs text-muted-foreground hidden sm:inline shrink-0">{group.taxNumber}</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {(['green', 'yellow', 'red', 'purple'] as const).map(cat => {
                    const count = group.invoices.filter(inv => inv.category === cat).length;
                    if (count === 0) return null;
                    const catStyle = CAT[cat];
                    return (
                      <span key={cat} className={cn('inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium', catStyle.badge)}>
                        {count}
                        <span className="hidden sm:inline">×</span>
                        <span className="hidden sm:inline">{catStyle.label}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-3">
                {daysSince !== null && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                        <Mail className="h-3 w-3" />
                        <span>{daysSince === 0 ? 'Ma' : `${daysSince} napja`}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      Utolsó felszólítás: {format(parseISO(group.lastSent!), 'yyyy. MMM d.', { locale: hu })}
                    </TooltipContent>
                  </Tooltip>
                )}
                <span className="font-bold text-sm">{fmt(group.totalAmount)}</span>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>

            {/* Invoice table */}
            {isOpen && (
              <div className="border-t border-current/10 bg-background/50">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-current/10">
                      <TableHead className="pl-4 text-xs w-[25%]">Számlaszám</TableHead>
                      <TableHead className="text-xs w-[15%]">Kiállítva</TableHead>
                      <TableHead className="text-xs w-[15%]">Lejárat</TableHead>
                      <TableHead className="text-xs w-[12%]">Késés</TableHead>
                      <TableHead className="text-right text-xs w-[18%]">Összeg</TableHead>
                      <TableHead className="text-xs w-[10%]">Forrás</TableHead>
                      <TableHead className="text-xs w-[15%]">Kategória</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.invoices.map(inv => {
                      const ic = CAT[inv.category];
                      const IIcon = ic.icon;
                      return (
                        <TableRow key={inv.id} className={cn('border-current/5', ic.rowBg)}>
                          <TableCell className="pl-4 font-mono text-xs">{inv.invoiceNumber}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {inv.issueDate ? format(parseISO(inv.issueDate), 'yyyy.MM.dd') : '—'}
                          </TableCell>
                          <TableCell className="text-xs">{inv.dueDate.replace(/-/g, '.')}</TableCell>
                          <TableCell className="text-xs">
                            {inv.daysOverdue <= 0
                              ? <span className="text-emerald-700 dark:text-emerald-400">Nem lejárt</span>
                              : <span className={ic.text}>{inv.daysOverdue} nap</span>
                            }
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {fmt(inv.amount)}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {inv.source === 'nav' ? 'NAV' : 'Feltöltött'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs gap-1', ic.badge)}>
                              <IIcon className="h-3 w-3" />
                              {ic.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
