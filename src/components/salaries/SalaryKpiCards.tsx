import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Wallet, Users, Banknote, TrendingUp } from 'lucide-react';

interface Props {
  totalPayments: number;
  employeeCount: number;
  netSalary: number;
  grossSalary: number;
  totalItems: number;
}

export function SalaryKpiCards({ totalPayments, employeeCount, netSalary, grossSalary, totalItems }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Összes kifizetés</p>
              <p className="text-2xl font-bold">{formatCurrency(totalPayments)}</p>
            </div>
            <div className="p-3 rounded-full bg-primary/10">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Alkalmazottak száma</p>
              <p className="text-2xl font-bold">{employeeCount}</p>
              <p className="text-xs text-muted-foreground">{totalItems} bejegyzés</p>
            </div>
            <div className="p-3 rounded-full bg-blue-500/10">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Összes nettó bérköltség</p>
              <p className="text-2xl font-bold">{formatCurrency(netSalary)}</p>
            </div>
            <div className="p-3 rounded-full bg-emerald-500/10">
              <Banknote className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Összes bruttó bérköltség</p>
              <p className="text-2xl font-bold">{formatCurrency(grossSalary)}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-500/10">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
