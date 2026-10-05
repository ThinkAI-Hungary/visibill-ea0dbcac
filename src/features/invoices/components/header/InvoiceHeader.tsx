import React, { useState } from 'react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Info, FileText, Download, ChevronDown, FileSpreadsheet, FileDown, Sliders, DownloadCloud, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { NavSyncButton } from './NavSyncButton';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import { useTranslation } from 'react-i18next';
import { useCompanyJurisdiction } from '@/hooks/useCompanyJurisdiction';
import { InvoiceRulesDialog } from '@/components/invoices/InvoiceRulesDialog';
import { useSzamlazzStatus } from '@/hooks/useSzamlazzSync';
import { SzamlazzSyncModal } from '@/components/invoices/SzamlazzSyncModal';

export function InvoiceHeader() {
  const { companyId, selectedCompany, setFilesDialogOpen, setInvoiceParam, openDataExportDialog, setCreateDialogOpen } = useInvoiceContext();
  const { t } = useTranslation(['invoices', 'common']);
  const { hasNavIntegration } = useCompanyJurisdiction();
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [szamlazzModalOpen, setSzamlazzModalOpen] = useState(false);
  const { data: szamlazzStatus } = useSzamlazzStatus(companyId);
  const hasSzamlazzKey = Boolean(szamlazzStatus?.hasAgentKey);

  const handleOpenFiles = () => {
    setFilesDialogOpen(true);
    setInvoiceParam(null, 'files');
  };

  return (
    <CardHeader>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-2xl font-bold">{t('invoices:title', { defaultValue: 'Számlák' })}</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-5 w-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>
                      {t('invoices:tooltip_desc')}
                    </p>
                  </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="relative">
          <div className="flex gap-2 justify-end">
            {hasNavIntegration && <NavSyncButton />}

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => hasSzamlazzKey && setSzamlazzModalOpen(true)}
                      disabled={!hasSzamlazzKey}
                      className="relative disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <DownloadCloud className={`h-4 w-4 mr-2 ${hasSzamlazzKey ? 'text-blue-500' : 'text-muted-foreground'}`} />
                      {t('invoices:actions.szamlazz_sync', { defaultValue: 'Számlázz.hu szinkron' })}
                      {hasSzamlazzKey && szamlazzStatus && szamlazzStatus.pendingCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-2 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-none px-1.5 py-0 text-[10px]"
                        >
                          {szamlazzStatus.pendingCount}
                        </Badge>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">
                    {hasSzamlazzKey
                      ? t('invoices:actions.szamlazz_tooltip_active')
                      : t('invoices:actions.szamlazz_tooltip_inactive')}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button variant="outline" size="sm" onClick={() => setRulesDialogOpen(true)}>
              <Sliders className="h-4 w-4 mr-2" />
              {t('invoices:actions.accounting_rules', { defaultValue: 'Könyvelési szabályok' })}
            </Button>
            <InvoiceRulesDialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen} />

            <Button variant="outline" size="sm" onClick={handleOpenFiles}>
              <FileText className="h-4 w-4 mr-2" />
              {t('invoices:actions.uploaded_files', { defaultValue: 'Feltöltött fájlok' })}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  {t('common:actions.export', { defaultValue: 'Export' })}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                <DropdownMenuItem onClick={() => openDataExportDialog('xlsx')} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  <span>{t('invoices:actions.export_excel_format', { defaultValue: 'Export Excel (.xlsx)' })}</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => openDataExportDialog('csv')} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span>{t('invoices:actions.export_csv_format', { defaultValue: 'Export CSV (.csv)' })}</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => openDataExportDialog('pdf')} className="gap-2 cursor-pointer">
                  <FileDown className="h-4 w-4 text-rose-500" />
                  <span>{t('invoices:actions.export_pdf', { defaultValue: 'Export PDF (.pdf)' })}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="default"
              size="sm"
              onClick={() => setCreateDialogOpen(true)}
              className="gap-1.5 shadow-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              <span>{t('invoices:actions.new_invoice', { defaultValue: 'Új számla rögzítése' })}</span>
            </Button>
          </div>
        </div>
      </div>
      <SzamlazzSyncModal
        open={szamlazzModalOpen}
        onOpenChange={setSzamlazzModalOpen}
        companyId={companyId}
        companyName={selectedCompany?.name}
      />
    </CardHeader>
  );
}
