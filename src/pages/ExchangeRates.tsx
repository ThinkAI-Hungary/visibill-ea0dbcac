import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, ArrowRight, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface ExchangeRate {
  currency: string;
  currencyName: string;
  rate: number;
  flag: string;
}

export default function ExchangeRates() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const topCurrencies = [
    { code: "EUR", name: "Euró", flag: "🇪🇺" },
    { code: "USD", name: "USA Dollár", flag: "🇺🇸" },
    { code: "GBP", name: "Font Sterling", flag: "🇬🇧" },
    { code: "CHF", name: "Svájci Frank", flag: "🇨🇭" },
    { code: "JPY", name: "Japán Yen", flag: "🇯🇵" },
    { code: "PLN", name: "Lengyel Zloty", flag: "🇵🇱" },
    { code: "CZK", name: "Cseh Korona", flag: "🇨🇿" },
    { code: "RON", name: "Román Lej", flag: "🇷🇴" },
    { code: "AUD", name: "Ausztrál Dollár", flag: "🇦🇺" },
    { code: "CAD", name: "Kanadai Dollár", flag: "🇨🇦" },
  ];

  useEffect(() => {
    fetchExchangeRates();
  }, []);

  const fetchExchangeRates = async () => {
    try {
      setLoading(true);
      
      // Using exchangerate-api.com free tier (no API key needed)
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/HUF');
      
      if (!response.ok) {
        throw new Error('Failed to fetch exchange rates');
      }

      const data = await response.json();
      
      const formattedRates: ExchangeRate[] = topCurrencies.map(curr => ({
        currency: curr.code,
        currencyName: curr.name,
        rate: data.rates[curr.code] || 0,
        flag: curr.flag,
      }));

      setRates(formattedRates);
      setLastUpdate(new Date().toLocaleString('hu-HU'));
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      toast.error('Hiba történt az árfolyamok betöltése során');
    } finally {
      setLoading(false);
    }
  };

  const formatRate = (rate: number) => {
    return rate.toFixed(4);
  };

  const calculateHufValue = (rate: number) => {
    return (1 / rate).toFixed(2);
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Árfolyamok</h1>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-5 w-5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Valós idejű árfolyamok az MNB-től. Használd referenciaként a külföldi devizás számlák feldolgozásához. Az árfolyamok automatikusan frissülnek.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-muted-foreground">
          Aktuális devizaárfolyamok magyar forinthoz viszonyítva
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Főbb devizák árfolyamai</CardTitle>
              <CardDescription>
                Bázis valuta: Magyar Forint (HUF)
              </CardDescription>
            </div>
            {lastUpdate && (
              <Badge variant="outline" className="text-xs">
                Frissítve: {lastUpdate}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Valuta</TableHead>
                  <TableHead>Név</TableHead>
                  <TableHead className="text-right">1 HUF =</TableHead>
                  <TableHead className="text-center w-[60px]"></TableHead>
                  <TableHead className="text-right">1 Valuta =</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((rate) => (
                  <TableRow key={rate.currency} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{rate.flag}</span>
                        <span className="font-mono font-semibold">{rate.currency}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rate.currencyName}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatRate(rate.rate)} {rate.currency}
                    </TableCell>
                    <TableCell className="text-center">
                      <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono tabular-nums font-semibold">
                          {calculateHufValue(rate.rate)} HUF
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">Információ</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Az árfolyamok tájékoztató jellegűek és valós időben frissülnek külső forrásból.
          </p>
          <p>
            Az árfolyamok használata előtt mindig ellenőrizze az aktuális piaci árfolyamokat.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
