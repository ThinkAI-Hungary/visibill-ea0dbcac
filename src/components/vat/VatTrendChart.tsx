import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

/* ────────────────────────────────────────── */
/*  V6: VAT Trend Chart (12 months)            */
/* ────────────────────────────────────────── */
const MONTH_SHORT = ['jan','feb','már','ápr','máj','jún','júl','aug','szep','okt','nov','dec'];

export function VatTrendChart({ companyId }: { companyId: string }) {
  const { t, i18n } = useTranslation(['accounting', 'common']);
  const { data: history = [] } = useQuery({
    queryKey: ['vat_return_history', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('vat_returns')
        .select('period_year, period_month, total_payable_tax, total_deductible_tax, net_result')
        .eq('company_id', companyId)
        .order('period_year', { ascending: true })
        .order('period_month', { ascending: true })
        .limit(12);
      return (data || []) as any[];
    },
  });

  if (history.length < 2) return null;

  const chartData = history.map((r: any) => {
    let monthLabel = MONTH_SHORT[r.period_month - 1];
    try {
      monthLabel = new Intl.DateTimeFormat(i18n.language === 'hr' ? 'hr-HR' : 'hu-HU', { month: 'short' }).format(new Date(r.period_year, r.period_month - 1, 1));
    } catch {
      // fallback to array
    }
    return {
      name: `${monthLabel} '${String(r.period_year).slice(-2)}`,
      payable: Math.round((r.total_payable_tax || 0) / 1000),
      deductible: Math.round((r.total_deductible_tax || 0) / 1000),
      balance: Math.round((r.net_result || 0) / 1000),
    };
  });

  const fmtTooltip = (v: number) => `${v.toLocaleString('hu-HU')} eFt`;

  const payableLabel = t('accounting:vat_return.chart.payable', 'Fizetendő');
  const deductibleLabel = t('accounting:vat_return.chart.deductible', 'Levonható');
  const balanceLabel = t('accounting:vat_return.chart.balance', 'Egyenleg');

  return (
    <Card className="border-border/60 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {t('accounting:vat_return.chart.title', 'ÁFA trend')}
          <Badge variant="outline" className="text-[10px] font-normal">
            {t('accounting:vat_return.chart.months_count', {
              count: history.length,
              defaultValue: `${history.length} hónap`,
            })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="vatPayable" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="vatDeductible" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="vatBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} tickFormatter={(v: number) => `${v}`} />
              <RechartsTooltip
                contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                formatter={(value: number, name: string) => [fmtTooltip(value), name]}
              />
              <Area type="monotone" dataKey="payable" stroke="#ef4444" strokeWidth={2} fill="url(#vatPayable)" name={payableLabel} />
              <Area type="monotone" dataKey="deductible" stroke="#10b981" strokeWidth={2} fill="url(#vatDeductible)" name={deductibleLabel} />
              <Area type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={1.5} fill="url(#vatBalance)" name={balanceLabel} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> {payableLabel}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> {deductibleLabel}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> {balanceLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}
