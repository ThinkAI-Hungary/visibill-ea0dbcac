import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Upload, PieChart } from 'lucide-react';
import { useScopedNavigate } from '@/lib/navigation';

const QuickActions = React.memo(function QuickActions() {
  const { t } = useTranslation(['dashboard', 'common']);
  const scopedNavigate = useScopedNavigate();

  return (
    <div className="grid gap-4 md:grid-cols-3">
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
      <Card className="p-6 text-center flex flex-col">
        <Upload className="h-8 w-8 mx-auto mb-3 text-primary" />
        <h3 className="font-semibold mb-2">
          {t('dashboard:quick_actions.upload_invoices.title', 'Számlák feltöltése')}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 flex-1">
          {t('dashboard:quick_actions.upload_invoices.desc', 'Új számlák kézi feltöltése')}
        </p>
        <Button variant="default" className="w-full mt-auto" onClick={() => scopedNavigate('upload')}>
          {t('dashboard:quick_actions.upload_invoices.button', 'Fájlok feltöltése')}
        </Button>
      </Card>
      <Card className="p-6 text-center flex flex-col">
        <PieChart className="h-8 w-8 mx-auto mb-3 text-warning" />
        <h3 className="font-semibold mb-2">
          {t('dashboard:quick_actions.project_management.title', 'Projekt Kezelés')}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 flex-1">
          {t('dashboard:quick_actions.project_management.desc', 'Projektek szerkesztése és rendszerezése')}
        </p>
        <Button variant="outline" className="w-full mt-auto" onClick={() => scopedNavigate('projects')}>
          {t('dashboard:quick_actions.project_management.button', 'Projektek kezelése')}
        </Button>
      </Card>
    </div>
  );
});

export default QuickActions;
