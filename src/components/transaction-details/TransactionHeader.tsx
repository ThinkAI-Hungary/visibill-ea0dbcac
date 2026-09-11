import React from 'react';
import { SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const TransactionHeader: React.FC = () => {
  const { t } = useTranslation(['transactions']);

  return (
    <SheetHeader className="pb-2 text-left">
      <SheetTitle className="flex items-center gap-2 text-base justify-start">
        <FileText className="h-4 w-4" />
        {t('transactions:dialogs.details.title')}
      </SheetTitle>
      <SheetDescription className="text-xs text-left">
        {t('transactions:dialogs.details.subtitle')}
      </SheetDescription>
    </SheetHeader>
  );
};
