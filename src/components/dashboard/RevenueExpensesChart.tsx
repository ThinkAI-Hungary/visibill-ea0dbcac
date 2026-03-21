import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronUp, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import type { MonthlyData } from '@/hooks/useDashboardData';
import type { ChartLineFlags } from '@/hooks/useDashboardPreferences';

const MONTH_NAMES = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

interface RevenueExpensesChartProps {
  monthlyData: MonthlyData[];
  chartLines: ChartLineFlags;
  showBrutto: boolean;
  analyticsLoading: boolean;
  dateFrom: Date;
  revenueSectionOpen: boolean;
  onRevenueSectionOpenChange: (open: boolean) => void;
  onSetChartLine: (key: keyof ChartLineFlags, v: boolean) => void;
  onSetShowBrutto: (v: boolean) => void;
}

const RevenueExpensesChart = React.memo(function RevenueExpensesChart({
  monthlyData,
  chartLines,
  showBrutto,
  analyticsLoading,
  dateFrom,
  revenueSectionOpen,
  onRevenueSectionOpenChange,
  onSetChartLine,
  onSetShowBrutto,
}: RevenueExpensesChartProps) {
  return (
    <Collapsible open={revenueSectionOpen} onOpenChange={onRevenueSectionOpenChange}>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg font-medium">Kiadások és bevételek a {new Date().getFullYear()}. időszakra</span>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronUp className={`h-4 w-4 transition-transform ${revenueSectionOpen ? '' : 'rotate-180'}`} />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-4">
            {/* Filters row */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={chartLines.revenuePaid}
                    onCheckedChange={(checked) => onSetChartLine('revenuePaid', !!checked)}
                    className="border-green-600 data-[state=checked]:bg-green-600"
                  />
                  <span className="text-sm text-green-600">Bevétel (fizetett)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={chartLines.revenueUnpaid}
                    onCheckedChange={(checked) => onSetChartLine('revenueUnpaid', !!checked)}
                    className="border-cyan-500 data-[state=checked]:bg-cyan-500"
                  />
                  <span className="text-sm text-cyan-500">Kintlévőségek</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={chartLines.expensesPaid}
                    onCheckedChange={(checked) => onSetChartLine('expensesPaid', !!checked)}
                    className="border-red-600 data-[state=checked]:bg-red-600"
                  />
                  <span className="text-sm text-red-600">Kiadás (fizetett)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={chartLines.expensesUnpaid}
                    onCheckedChange={(checked) => onSetChartLine('expensesUnpaid', !!checked)}
                    className="border-amber-500 data-[state=checked]:bg-amber-500"
                  />
                  <span className="text-sm text-amber-500">Követelések</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={chartLines.salaries}
                    onCheckedChange={(checked) => onSetChartLine('salaries', !!checked)}
                    className="border-purple-500 data-[state=checked]:bg-purple-500"
                  />
                  <span className="text-sm text-purple-500">Bérek</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={chartLines.cashFlow}
                    onCheckedChange={(checked) => onSetChartLine('cashFlow', !!checked)}
                    className="border-indigo-500 data-[state=checked]:bg-indigo-500"
                  />
                  <span className="text-sm text-indigo-500">Cash-flow</span>
                </label>
              </div>
              <div className="flex items-center gap-4">
                <div className="inline-flex rounded-lg border p-1 bg-muted/30 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSetShowBrutto(true)}
                    className={`transition-all duration-300 ease-out ${showBrutto ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
                  >
                    {showBrutto && <span className="w-2 h-2 rounded-full bg-orange-500 mr-2" />}
                    bruttó
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSetShowBrutto(false)}
                    className={`transition-all duration-300 ease-out ${!showBrutto ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}`}
                  >
                    {!showBrutto && <span className="w-2 h-2 rounded-full bg-orange-500 mr-2" />}
                    nettó
                  </Button>
                </div>
              </div>
            </div>

            {/* Monthly summary row */}
            <div className="grid gap-2 mb-2 text-center" style={{ gridTemplateColumns: 'minmax(80px, auto) repeat(12, 1fr)' }}>
              <div className="font-semibold text-left">{format(dateFrom, 'yyyy', { locale: hu })}. év</div>
              {MONTH_NAMES.map((month) => (
                <div key={month} className="text-sm font-medium">{month.slice(0, 3)}.</div>
              ))}
            </div>
            <div className="grid gap-2 mb-6 text-center" style={{ gridTemplateColumns: 'minmax(80px, auto) repeat(12, 1fr)' }}>
              <div className="text-orange-500 font-medium text-left">Eredmény</div>
              {monthlyData.map((data, i) => {
                const result = data.revenuePaid + data.revenueUnpaid + data.expensesPaid + data.expensesUnpaid + data.salaries;
                return (
                  <div key={i} className={cn("text-sm font-medium", result >= 0 ? "text-green-600" : "text-red-600")}>
                    {result === 0 ? "0 Ft" : formatCurrency(result, 'HUF', true)}
                  </div>
                );
              })}
            </div>

            {/* Area Chart */}
            <div className="relative">
              {analyticsLoading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              )}
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="revenuePaidGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16A34A" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#16A34A" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="revenueUnpaidGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="expensesPaidGradient" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="5%" stopColor="#DC2626" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#DC2626" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="expensesUnpaidGradient" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="salariesGradient" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => {
                      const absV = Math.abs(v);
                      if (absV >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                      if (absV >= 1000) return `${(v / 1000).toFixed(0)}k`;
                      return `${v}`;
                    }}
                    tick={{ fontSize: 12 }}
                    width={60}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [formatCurrency(Math.abs(value)) + (value < 0 ? ' (kiadás)' : ''), name]}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  {chartLines.revenuePaid && (
                    <Area type="monotone" dataKey="revenuePaid" name="Bevétel (fizetett)" stroke="#16A34A" strokeWidth={2} fill="url(#revenuePaidGradient)" stackId="positive" />
                  )}
                  {chartLines.revenueUnpaid && (
                    <Area type="monotone" dataKey="revenueUnpaid" name="Kintlévőségek" stroke="#06b6d4" strokeWidth={2} fill="url(#revenueUnpaidGradient)" stackId="positive" />
                  )}
                  {chartLines.expensesPaid && (
                    <Area type="monotone" dataKey="expensesPaid" name="Kiadás (fizetett)" stroke="#DC2626" strokeWidth={2} fill="url(#expensesPaidGradient)" stackId="negative" />
                  )}
                  {chartLines.expensesUnpaid && (
                    <Area type="monotone" dataKey="expensesUnpaid" name="Követelések" stroke="#f59e0b" strokeWidth={2} fill="url(#expensesUnpaidGradient)" stackId="negative" />
                  )}
                  {chartLines.salaries && (
                    <Area type="monotone" dataKey="salaries" name="Bérek" stroke="#8B5CF6" strokeWidth={2} fill="url(#salariesGradient)" stackId="salaries" />
                  )}
                  {chartLines.cashFlow && (
                    <Area type="monotone" dataKey="cashFlow" name="Cash-flow" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" fill="none" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
});

export default RevenueExpensesChart;
