import React from 'react';
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
import { Info, FileText, Download, ChevronDown, FileSpreadsheet, FileDown } from 'lucide-react';
import { NavSyncButton } from './NavSyncButton';
import { useInvoiceContext } from '../../context/useInvoiceContext';

export function InvoiceHeader() {
  const { setFilesDialogOpen, setInvoiceParam, openDataExportDialog } = useInvoiceContext();

  const handleOpenFiles = () => {
    setFilesDialogOpen(true);
    setInvoiceParam(null, 'files');
  };

  return (
    <CardHeader>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-2xl font-bold">Számlák</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-5 w-5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    Itt láthatod a NAV-ból szinkronizált és a beküldött számláidat. Szűrj irány, dátum, összeg vagy
                    állapot szerint. Exportálhatod CSV vagy Excel formátumban.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="relative">
          <div className="flex gap-2 justify-end">
            <NavSyncButton />

            <Button variant="outline" size="sm" onClick={handleOpenFiles}>
              <FileText className="h-4 w-4 mr-2" />
              Feltöltött fájlok
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48">
                <DropdownMenuItem onClick={() => openDataExportDialog('xlsx')} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  <span>Export Excel (.xlsx)</span>
                </DropdownMenuItem>

                <DropdownMenuItem onClick={() => openDataExportDialog('csv')} className="gap-2 cursor-pointer">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span>Export CSV (.csv)</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={() => openDataExportDialog('pdf')} className="gap-2 cursor-pointer">
                  <FileDown className="h-4 w-4 text-rose-500" />
                  <span>Export PDF (.pdf)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </CardHeader>
  );
}
