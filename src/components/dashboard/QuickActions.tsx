import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Upload, ArrowLeftRight } from 'lucide-react';
import { useScopedNavigate } from '@/lib/navigation';

interface QuickActionsProps {
  embedded?: boolean;
}

const QuickActions = React.memo(function QuickActions({ embedded = false }: QuickActionsProps) {
  const { t } = useTranslation(['dashboard', 'common']);
  const scopedNavigate = useScopedNavigate();

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3.5 bg-primary rounded" />
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t('dashboard:quick_actions.title', 'Gyorsműveletek')}
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Számlák áttekintése */}
          <div
            onClick={() => scopedNavigate('invoices')}
            className="flex flex-col items-center justify-between p-3 rounded-lg border border-border/80 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all text-center group cursor-pointer shadow-sm"
          >
            <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105">
              <BarChart3 className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors block mb-1">
              {t('dashboard:quick_actions.review_invoices.title', 'Számlák áttekintése')}
            </span>
            <Button
              size="sm"
              variant="default"
              className="w-full h-7 text-xs px-2 mt-auto"
              onClick={(e) => {
                e.stopPropagation();
                scopedNavigate('invoices');
              }}
            >
              {t('dashboard:quick_actions.review_invoices.button', 'Számlák megtekintése')}
            </Button>
          </div>

          {/* 2. Bizonylatfeltöltés */}
          <div
            onClick={() => scopedNavigate('upload')}
            className="flex flex-col items-center justify-between p-3 rounded-lg border border-border/80 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all text-center group cursor-pointer shadow-sm"
          >
            <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105">
              <Upload className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors block mb-1">
              {t('dashboard:quick_actions.upload_invoices.title', 'Bizonylatfeltöltés')}
            </span>
            <Button
              size="sm"
              variant="default"
              className="w-full h-7 text-xs px-2 mt-auto"
              onClick={(e) => {
                e.stopPropagation();
                scopedNavigate('upload');
              }}
            >
              {t('dashboard:quick_actions.upload_invoices.button', 'Fájlok feltöltése')}
            </Button>
          </div>

          {/* 3. Tranzakciók */}
          <div
            onClick={() => scopedNavigate('transactions')}
            className="flex flex-col items-center justify-between p-3 rounded-lg border border-border/80 bg-card hover:bg-muted/40 hover:border-primary/40 transition-all text-center group cursor-pointer shadow-sm"
          >
            <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105">
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors block mb-1">
              {t('dashboard:quick_actions.transactions.title', 'Tranzakciók')}
            </span>
            <Button
              size="sm"
              variant="default"
              className="w-full h-7 text-xs px-2 mt-auto"
              onClick={(e) => {
                e.stopPropagation();
                scopedNavigate('transactions');
              }}
            >
              {t('dashboard:quick_actions.transactions.button', 'Tranzakciók megtekintése')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* 1. Számlák áttekintése */}
      <Card className="p-6 text-center flex flex-col">
        <BarChart3 className="h-8 w-8 mx-auto mb-3 text-primary" />
        <h3 className="font-semibold mb-2">
          {t('dashboard:quick_actions.review_invoices.title', 'Számlák áttekintése')}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 flex-1">
          {t('dashboard:quick_actions.review_invoices.desc', 'Részletes számla lista szűrési lehetőségekkel')}
        </p>
        <Button variant="default" className="w-full mt-auto" onClick={() => scopedNavigate('invoices')}>
          {t('dashboard:quick_actions.review_invoices.button', 'Számlák megtekintése')}
        </Button>
      </Card>

      {/* 2. Bizonylatfeltöltés */}
      <Card className="p-6 text-center flex flex-col">
        <Upload className="h-8 w-8 mx-auto mb-3 text-primary" />
        <h3 className="font-semibold mb-2">
          {t('dashboard:quick_actions.upload_invoices.title', 'Bizonylatfeltöltés')}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 flex-1">
          {t('dashboard:quick_actions.upload_invoices.desc', 'Új számlák és bizonylatok feltöltése')}
        </p>
        <Button variant="default" className="w-full mt-auto" onClick={() => scopedNavigate('upload')}>
          {t('dashboard:quick_actions.upload_invoices.button', 'Fájlok feltöltése')}
        </Button>
      </Card>

      {/* 3. Tranzakciók */}
      <Card className="p-6 text-center flex flex-col">
        <ArrowLeftRight className="h-8 w-8 mx-auto mb-3 text-primary" />
        <h3 className="font-semibold mb-2">
          {t('dashboard:quick_actions.transactions.title', 'Tranzakciók')}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 flex-1">
          {t('dashboard:quick_actions.transactions.desc', 'Banki tranzakciók és számlapárosítások áttekintése')}
        </p>
        <Button variant="default" className="w-full mt-auto" onClick={() => scopedNavigate('transactions')}>
          {t('dashboard:quick_actions.transactions.button', 'Tranzakciók megtekintése')}
        </Button>
      </Card>
    </div>
  );
});

export default QuickActions;
