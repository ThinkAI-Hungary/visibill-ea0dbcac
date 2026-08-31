import React from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInvoiceContext } from '../../context/useInvoiceContext';

export function InvoiceTabSelector() {
  return (
    <TabsList className="grid w-full max-w-2xl grid-cols-4">
      <TabsTrigger value="OUTBOUND">Kimenő (NAV)</TabsTrigger>
      <TabsTrigger value="INBOUND">Bejövő (NAV)</TabsTrigger>
      <TabsTrigger value="SUBMITTED_OUTBOUND">Beküldött (Kimenő)</TabsTrigger>
      <TabsTrigger value="SUBMITTED_INBOUND">Beküldött (Bejövő)</TabsTrigger>
    </TabsList>
  );
}
