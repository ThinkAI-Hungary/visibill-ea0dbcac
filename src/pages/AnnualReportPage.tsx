import React from 'react';
import { AnnualReportContainer } from '@/features/annual-report';

export * from '@/features/annual-report/types';
export * from '@/features/annual-report/core/annualReportEngine';
export { useAnnualReportData } from '@/features/annual-report/hooks/useAnnualReportData';

export default function AnnualReportPage() {
  return <AnnualReportContainer />;
}
