import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tag, ChevronRight, Plus } from 'lucide-react';
import { useScopedNavigate } from '@/lib/navigation';
import { formatCurrencyTotals } from '@/components/CategoryAccordionItem';
import type { CategoryStatItem } from '@/hooks/useDashboardData';

interface CategoryBreakdownProps {
  categories: CategoryStatItem[];
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ categories }) => {
  const { t } = useTranslation(['dashboard', 'categories', 'common']);
  const scopedNavigate = useScopedNavigate();

  const activeCategories = categories.filter((c) => c.invoiceCount > 0);
  const maxAmount = Math.max(...activeCategories.map((c) => c.totalAmount), 1);

  return (
    <Card className="h-[520px] flex flex-col overflow-hidden border-border/80 shadow-card">
      <CardHeader className="px-5 py-3.5 border-b border-border/40 shrink-0 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-primary-subtle text-primary flex items-center justify-center shrink-0">
              <Tag className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight text-foreground">
                {t('dashboard:category_breakdown.title', 'Kategória összefoglaló')}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {t('dashboard:category_breakdown.description', 'Számlák megoszlása kategóriák szerint')}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs font-medium"
            onClick={() => scopedNavigate('categories')}
          >
            {t('dashboard:category_breakdown.view_categories', 'Kategóriák')}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 flex flex-col justify-between overflow-hidden">
        {activeCategories.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground my-auto">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <Tag className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {t('dashboard:category_breakdown.empty_title', 'Még nincsenek kategorizált számlák')}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
              {t('dashboard:category_breakdown.empty_desc', 'Rendelj számlákat költségkategóriákhoz a kiadások részletes elemzéséhez.')}
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-4 sm:px-5 py-3.5">
            <div className="space-y-3.5">
              {activeCategories.map((cat) => {
                const amountLabel = formatCurrencyTotals(cat.currencyTotals);
                const barPct = maxAmount > 0 ? Math.max((cat.totalAmount / maxAmount) * 100, 2.5) : 0;
                const dotColor = cat.color || '#6366F1';

                return (
                  <div key={cat.id} className="space-y-1.5 group">
                    <div className="flex items-center justify-between text-xs font-medium">
                      {/* Left: Dot & Name & Count */}
                      <div className="flex items-center gap-2 min-w-0 mr-2 flex-1">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0 transition-transform group-hover:scale-125 shadow-xs"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span className="text-foreground truncate font-medium group-hover:text-primary transition-colors text-xs">
                          {cat.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70 shrink-0 font-normal">
                          ({cat.invoiceCount})
                        </span>
                      </div>

                      {/* Right: Multi-currency amount */}
                      <span
                        className="text-xs font-semibold tabular-nums text-right text-foreground shrink-0 truncate max-w-[190px]"
                        title={amountLabel}
                      >
                        {amountLabel}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-4 bg-muted/50 rounded overflow-hidden relative">
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{
                          width: `${barPct}%`,
                          backgroundColor: dotColor,
                          opacity: 0.75,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Bottom CTA Card */}
        <div className="p-3 mx-4 mb-3.5 sm:mx-5 sm:mb-4 rounded-lg border border-dashed border-primary/30 bg-primary-subtle/30 flex items-center justify-between shrink-0">
          <div className="min-w-0 mr-2">
            <p className="text-xs font-semibold text-primary truncate">
              {t('dashboard:category_breakdown.manage_title', 'Kategóriák kezelése')}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {t('dashboard:category_breakdown.manage_desc', 'Rendszerezd számláidat költségkategóriákba')}
            </p>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1 shrink-0 font-medium"
            onClick={() => scopedNavigate('categories')}
          >
            <Plus className="h-3 w-3" />
            {t('dashboard:category_breakdown.new_category_btn', 'Új kategória')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CategoryBreakdown;
