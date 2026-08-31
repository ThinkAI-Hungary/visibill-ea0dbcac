import React from 'react';
import { SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { FileText } from 'lucide-react';

export const TransactionHeader: React.FC = () => {
  return (
    <SheetHeader className="pb-2 text-left">
      <SheetTitle className="flex items-center gap-2 text-base justify-start">
        <FileText className="h-4 w-4" />
        Tranzakció részletei
      </SheetTitle>
      <SheetDescription className="text-xs text-left">
        Tranzakció és párosított számla adatai
      </SheetDescription>
    </SheetHeader>
  );
};
