import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { getVatReturnXmlString } from '@/lib/vatReturnXml';
import type { ReturnLine, MLine, XmlValidationCheck, VatFrequency } from '../types';

interface VatXmlValidationDialogProps {
  selectedCompany: any;
  year: number;
  month: number;
  frequency: VatFrequency;
  lines: ReturnLine[];
  mLines: MLine[];
  xmlValidationResults: XmlValidationCheck[];
  isValidatingXml: boolean;
  runXmlValidationLocal: (xmlContent: string) => void;
}

export function VatXmlValidationDialog({
  selectedCompany,
  year,
  month,
  frequency,
  lines,
  mLines,
  xmlValidationResults,
  isValidatingXml,
  runXmlValidationLocal,
}: VatXmlValidationDialogProps) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-medium">NAV XML Validátor</div>
          <Badge
            variant="outline"
            className="text-[10px] bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
          >
            ÁNYK sémateszt
          </Badge>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const xml = getVatReturnXmlString({
                companyName: selectedCompany.name || '',
                companyTaxNumber: (selectedCompany as any).tax_number || '',
                companyAddress: (selectedCompany as any).address || '',
                periodYear: year,
                periodMonth: month,
                frequency,
                lines: lines as any[],
                mLines: mLines as any[],
              });
              runXmlValidationLocal(xml);
            }}
            disabled={isValidatingXml}
            className="flex-1 text-[10px] h-7 bg-primary/5 text-primary border-primary/10 hover:bg-primary/10"
          >
            {isValidatingXml ? 'Validálás...' : 'Aktuális validálása'}
          </Button>

          <div className="relative flex-1">
            <input
              type="file"
              id="xml-file-upload"
              accept=".xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  const content = evt.target?.result as string;
                  runXmlValidationLocal(content);
                };
                reader.readAsText(file);
              }}
              className="hidden"
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full text-[10px] h-7"
              onClick={() => document.getElementById('xml-file-upload')?.click()}
            >
              XML Feltöltés
            </Button>
          </div>
        </div>

        {xmlValidationResults.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border/40">
            {xmlValidationResults.map((res) => (
              <div key={res.id} className="text-[11px] space-y-0.5">
                <div className="flex items-center gap-1.5 font-semibold text-foreground/90">
                  {res.status === 'success' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  )}
                  <span>{res.name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground pl-5 leading-relaxed">
                  {res.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
