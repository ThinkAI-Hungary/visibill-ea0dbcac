import React from 'react';
import { VatReturnContainer } from '@/features/vat';

export * from '@/features/vat/types';
export * from '@/features/vat/core/vatEngine';
export { useVatReturnData } from '@/features/vat/hooks/useVatReturnData';

export default function VatReturnPage() {
  return <VatReturnContainer />;
}
