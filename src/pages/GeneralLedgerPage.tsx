import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import GeneralLedgerTable from '@/components/general-ledger/GeneralLedgerTable';

export default function GeneralLedgerPage() {
  const currentYear = new Date().getFullYear().toString();
  const [taxYear, setTaxYear] = useState(currentYear);
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);
  const [partnerBreakdown, setPartnerBreakdown] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      {/* Print-only beautifully formatted header */}
      <div className="hidden print:flex flex-col items-center justify-center mb-8 w-full border-b-2 border-primary/20 pb-6">
        <h1 className="text-5xl font-black bg-gradient-to-br from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent tracking-tight print:text-black mb-2">Visibill</h1>
        <h2 className="text-2xl font-bold uppercase tracking-widest text-foreground mt-2">Főkönyvi Kivonat</h2>
        <div className="mt-4 flex items-center gap-4 text-sm font-medium text-muted-foreground">
          <span>Adóév: {taxYear}</span>
          <span>•</span>
          <span>Időszak: {dateFrom.replace(/-/g, '.')} - {dateTo.replace(/-/g, '.')}</span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground/90">Főkönyv</h1>
          <p className="text-sm text-muted-foreground mt-1">Hierarchikus főkönyvi kivonat és kategóriák</p>
        </div>
        
        <div className="flex items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="tax-year" className="whitespace-nowrap font-medium text-xs text-muted-foreground">Adóév</Label>
              <Select value={taxYear} onValueChange={setTaxYear}>
                <SelectTrigger id="tax-year" className="w-[100px] h-9 text-sm relative">
                  <SelectValue placeholder="Év" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => {
                    const year = (parseInt(currentYear) - 5 + i).toString();
                    return <SelectItem key={year} value={year}>{year}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="date-from" className="whitespace-nowrap font-medium text-xs text-muted-foreground">Dátumtól</Label>
              <Input 
                id="date-from" 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="date-to" className="whitespace-nowrap font-medium text-xs text-muted-foreground">Dátumig</Label>
              <Input 
                id="date-to" 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex items-center gap-2 border-l pl-4 border-border/60">
              <Checkbox 
                id="partner-breakdown" 
                checked={partnerBreakdown}
                onCheckedChange={(checked) => setPartnerBreakdown(checked as boolean)}
              />
              <Label htmlFor="partner-breakdown" className="whitespace-nowrap font-medium text-xs cursor-pointer select-none">
                Partner bontásban
              </Label>
            </div>
            <div className="border-l pl-4 border-border/60">
              <Button variant="outline" size="sm" className="h-9 gap-2" onClick={handlePrint}>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF Export</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-border/60 shadow-md print:border-none print:shadow-none print:bg-transparent">
        <CardHeader className="py-4 border-b border-border/40 bg-muted/30 relative overflow-hidden print:hidden">
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent"></div>
          <CardTitle className="text-xl font-bold flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            Főkönyvi Kivonat
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground bg-background px-3 py-1.5 rounded-full border border-border flex items-center gap-2 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                {dateFrom.replace(/-/g, '.')} - {dateTo.replace(/-/g, '.')}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <GeneralLedgerTable />
        </CardContent>
      </Card>
    </div>
  );
}
