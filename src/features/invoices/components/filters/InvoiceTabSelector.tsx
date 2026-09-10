import React from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';

export function InvoiceTabSelector() {
  const { t } = useTranslation(['invoices', 'common']);

  return (
    <TabsList className="grid w-full max-w-2xl grid-cols-4">
      <TabsTrigger value="OUTBOUND">{t('invoices:tabs.outgoing', { defaultValue: 'Kimenő (NAV)' })}</TabsTrigger>
      <TabsTrigger value="INBOUND">{t('invoices:tabs.incoming', { defaultValue: 'Bejövő (NAV)' })}</TabsTrigger>
      <TabsTrigger value="SUBMITTED_OUTBOUND">{t('invoices:tabs.submitted_outgoing', { defaultValue: 'Beküldött (Kimenő)' })}</TabsTrigger>
      <TabsTrigger value="SUBMITTED_INBOUND">{t('invoices:tabs.submitted_incoming', { defaultValue: 'Beküldött (Bejövő)' })}</TabsTrigger>
    </TabsList>
  );
}
