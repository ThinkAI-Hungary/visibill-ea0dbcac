import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import type { AnnualReport } from '../../types';

interface Step1AlapadatokProps {
  report: AnnualReport;
  selectedCompany: any;
  getField: (field: keyof AnnualReport) => any;
  setField: (field: string, value: any, extras?: Record<string, any>) => void;
}

export function Step1Alapadatok({
  report,
  selectedCompany,
  getField,
  setField,
}: Step1AlapadatokProps) {
  const { t } = useTranslation('accounting');

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" />
        {t('annual_report.step1.header', '1. Alapadatok')}
      </h2>

      {/* Company info (read-only from company profile) */}
      <div className="bg-muted/30 border border-border/40 rounded-xl p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          {t('annual_report.step1.company_info_title', 'Cégadatok (a cégprofilból)')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">{t('annual_report.step1.company_name', 'Cégnév')}</Label>
            <Input value={selectedCompany?.name || '—'} disabled className="mt-1 bg-muted/20" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('annual_report.step1.company_address', 'Székhely')}</Label>
            <Input value={selectedCompany?.address || '—'} disabled className="mt-1 bg-muted/20" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">{t('annual_report.step1.tax_number', 'Adószám')}</Label>
            <Input value={selectedCompany?.tax_number || '—'} disabled className="mt-1 bg-muted/20" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label>{t('annual_report.step1.fiscal_year', 'Üzleti év')}</Label>
          <Input value={report.fiscal_year} disabled className="mt-1.5" />
        </div>
        <div>
          <Label>{t('annual_report.step1.report_status', 'Beszámoló státusza')}</Label>
          <Input
            value={
              report.status === 'draft'
                ? t('annual_report.status.draft', 'Vázlat')
                : report.status === 'finalized'
                ? t('annual_report.status.finalized', 'Véglegesítve')
                : report.status
            }
            disabled
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>{t('annual_report.step1.representative_name', 'Képviselő neve *')}</Label>
          <Input
            value={getField('representative_name') || ''}
            onChange={(e) => setField('representative_name', e.target.value)}
            placeholder={t('annual_report.step1.representative_placeholder', 'pl. Kiss János')}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>{t('annual_report.step1.representative_role', 'Beosztás')}</Label>
          <Input
            value={getField('representative_role') || t('annual_report.step1.default_role', 'ügyvezető')}
            onChange={(e) => setField('representative_role', e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>{t('annual_report.step1.report_date', 'Beszámoló dátuma *')}</Label>
          <DatePicker
            value={getField('report_date') || new Date().toISOString().slice(0, 10)}
            onChange={(val) => setField('report_date', val)}
            className="mt-1.5"
            placeholder={t('annual_report.step1.select_date', 'Válassz dátumot')}
          />
        </div>
        <div>
          <Label>{t('annual_report.step1.accounting_method', 'Számviteli módszer')}</Label>
          <Input
            value={getField('accounting_method') || t('annual_report.step1.default_method', 'kettős könyvvitel')}
            onChange={(e) => setField('accounting_method', e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>
    </div>
  );
}
