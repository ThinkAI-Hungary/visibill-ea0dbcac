import { useState, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, RefreshCw, Clock, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentSkeleton } from "@/components/ui/content-skeleton";
import { supabase } from "@/integrations/supabase/client";

interface ExchangeRate {
  currency: string;
  currencyName: string;
  rate: number;
  flag: string;
  mockChange: number;
}

const currencyData = [
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
  { code: "SEK", name: "Svéd Korona", flag: "🇸🇪" },
  { code: "NOK", name: "Norvég Korona", flag: "🇳🇴" },
  { code: "DKK", name: "Dán Korona", flag: "🇩🇰" },
  { code: "HRK", name: "Horvát Kuna", flag: "🇭🇷" },
];

export default function ExchangeRates() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Converter state
  const [amount, setAmount] = useState<string>("100000");
  const [sourceCurrency, setSourceCurrency] = useState<string>("HUF");
  const [targetCurrency, setTargetCurrency] = useState<string>("EUR");
  
  // Hero cards state
  const [heroCurrencies, setHeroCurrencies] = useState<string[]>(["EUR", "USD", "GBP"]);

  const { data: ratesData, isLoading: initialLoading, refetch } = useQuery({
    queryKey: queryKeys.exchangeRatesPage('HUF'),
    queryFn: async () => {
      // 1. Query rates from database
      let { data: dbRates, error } = await supabase
        .from('daily_exchange_rates')
        .select('currency, rate, rate_date')
        .eq('source', 'MNB')
        .order('rate_date', { ascending: false })
        .limit(200);

      if (error) throw error;

      // 2. If database has no rates, trigger the fetch-mnb-rates Edge Function to seed it
      if (!dbRates || dbRates.length === 0) {
        try {
          const { data: session } = await supabase.auth.getSession();
          const token = session?.session?.access_token;
          if (token) {
            await supabase.functions.invoke('fetch-mnb-rates', {
              headers: { Authorization: `Bearer ${token}` },
              body: {
                date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                date_to: new Date().toISOString().split('T')[0],
              }
            });

            // Re-query database after seeding
            const refetched = await supabase
              .from('daily_exchange_rates')
              .select('currency, rate, rate_date')
              .eq('source', 'MNB')
              .order('rate_date', { ascending: false })
              .limit(200);
            
            dbRates = refetched.data || [];
          }
        } catch (e) {
          console.error('Failed to auto-seed MNB rates:', e);
        }
      }

      // Group rates by currency to find today's and yesterday's rates
      const ratesByCurrency: Record<string, { rates: number[]; dates: string[] }> = {};
      (dbRates || []).forEach(row => {
        if (!ratesByCurrency[row.currency]) {
          ratesByCurrency[row.currency] = { rates: [], dates: [] };
        }
        ratesByCurrency[row.currency].rates.push(Number(row.rate));
        ratesByCurrency[row.currency].dates.push(row.rate_date);
      });

      const formattedRates: ExchangeRate[] = currencyData.map(curr => {
        const history = ratesByCurrency[curr.code];
        const rateToday = history?.rates[0] || 400; // fallback if no MNB rate
        const rateYesterday = history?.rates[1] || rateToday;
        const change = rateToday - rateYesterday;

        return {
          currency: curr.code,
          currencyName: curr.name,
          rate: 1 / rateToday, // Frontend expects 1 HUF = X DEV (e.g. 0.00244 EUR)
          flag: curr.flag,
          mockChange: change, // using real daily change instead of mock
        };
      });

      const latestDateStr = dbRates?.[0]?.rate_date
        ? new Date(dbRates[0].rate_date).toLocaleDateString('hu-HU')
        : new Date().toLocaleDateString('hu-HU');

      return { rates: formattedRates, lastUpdate: latestDateStr };
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    placeholderData: keepPreviousData,
  });

  const rates = ratesData?.rates || [];
  const lastUpdate = ratesData?.lastUpdate || '';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (token) {
        await supabase.functions.invoke('fetch-mnb-rates', {
          headers: { Authorization: `Bearer ${token}` },
          body: {
            date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            date_to: new Date().toISOString().split('T')[0],
          }
        });
      }
    } catch (e) {
      console.error('Failed to trigger fetch-mnb-rates Edge Function during refresh:', e);
    }
    await refetch();
    setIsRefreshing(false);
  };

  const calculateHufValue = (rate: number) => {
    return (1 / rate).toFixed(2);
  };

  const heroRates = useMemo(() => {
    return heroCurrencies.map(code => rates.find(r => r.currency === code)).filter(Boolean) as ExchangeRate[];
  }, [rates, heroCurrencies]);

  const tableRates = useMemo(() => {
    return rates.filter(r => !heroCurrencies.includes(r.currency));
  }, [rates, heroCurrencies]);

  const updateHeroCurrency = (index: number, newCurrency: string) => {
    setHeroCurrencies(prev => {
      const updated = [...prev];
      updated[index] = newCurrency;
      return updated;
    });
  };

  const convertedAmount = useMemo(() => {
    const parsedAmount = parseFloat(amount.replace(/\s/g, "")) || 0;
    if (parsedAmount === 0) return "0.00";
    
    // If source is HUF, convert directly to target
    if (sourceCurrency === "HUF") {
      const targetRate = rates.find(r => r.currency === targetCurrency);
      if (!targetRate) return "0.00";
      return (parsedAmount * targetRate.rate).toFixed(2);
    }
    
    // If target is HUF, convert from source to HUF
    if (targetCurrency === "HUF") {
      const sourceRate = rates.find(r => r.currency === sourceCurrency);
      if (!sourceRate) return "0.00";
      return (parsedAmount / sourceRate.rate).toFixed(2);
    }
    
    // Convert source -> HUF -> target
    const sourceRate = rates.find(r => r.currency === sourceCurrency);
    const targetRate = rates.find(r => r.currency === targetCurrency);
    if (!sourceRate || !targetRate) return "0.00";
    const hufValue = parsedAmount / sourceRate.rate;
    return (hufValue * targetRate.rate).toFixed(2);
  }, [rates, sourceCurrency, targetCurrency, amount]);

  const swapCurrencies = () => {
    setSourceCurrency(targetCurrency);
    setTargetCurrency(sourceCurrency);
  };

  const allCurrencies = useMemo(() => {
    return [{ currency: "HUF", currencyName: "Magyar Forint", flag: "🇭🇺", rate: 1, mockChange: 0 }, ...rates];
  }, [rates]);

  const formatHuf = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return "0";
    return num.toLocaleString('hu-HU');
  };

  if (initialLoading) {
    return <ContentSkeleton />;
  }

  return (
    <div className="container mx-auto py-4 px-4 space-y-4 relative page-animate">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Árfolyamok</h1>
          <p className="text-muted-foreground mt-1">
            Élő devizaárfolyamok HUF-hoz viszonyítva
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs flex items-center gap-1.5 px-3 py-1.5">
            <Clock className="h-3 w-3" />
            {lastUpdate}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Frissítés
          </Button>
        </div>
      </div>

      {/* Refresh Loading Overlay */}
      {isRefreshing && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Árfolyamok frissítése...</p>
          </div>
        </div>
      )}

      {/* Hero Cards - Key Currencies */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {heroRates.map((rate, index) => {
          const hufValue = parseFloat(calculateHufValue(rate.rate));
          const isPositive = rate.mockChange >= 0;
          
          return (
            <Card key={index} className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50">
              <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
                <span className="text-[120px] leading-none">{rate.flag}</span>
              </div>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center text-2xl">
                    {rate.flag}
                  </div>
                  <Select value={rate.currency} onValueChange={(value) => updateHeroCurrency(index, value)}>
                    <SelectTrigger className="w-auto border-0 bg-transparent p-0 h-auto hover:bg-muted/50 rounded-md px-2 py-1 -ml-2">
                      <div className="text-left">
                        <p className="text-sm text-muted-foreground">{rate.currencyName}</p>
                        <p className="font-semibold text-lg">{rate.currency}</p>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {rates.map((r) => (
                        <SelectItem key={r.currency} value={r.currency} disabled={heroCurrencies.includes(r.currency)}>
                          <div className="flex items-center gap-2">
                            <span>{r.flag}</span>
                            <span>{r.currency}</span>
                            <span className="text-muted-foreground">- {r.currencyName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <p className="text-3xl font-bold tabular-nums">
                    {formatHuf(hufValue.toString())} <span className="text-lg font-normal text-muted-foreground">Ft</span>
                  </p>
                  <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                    {isPositive ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    <span className="font-medium tabular-nums">
                      {isPositive ? '+' : ''}{rate.mockChange.toFixed(2)} Ft
                    </span>
                    <span className="text-muted-foreground ml-1">ma</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content - Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side - Exchange Rate Table */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">További árfolyamok</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[60px] pl-6"></TableHead>
                  <TableHead>Név</TableHead>
                  <TableHead className="w-[80px]">Kód</TableHead>
                  <TableHead className="text-right pr-6">Árfolyam</TableHead>
                  <TableHead className="text-right pr-6 w-[100px]">Változás</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRates.map((rate) => {
                  const hufValue = parseFloat(calculateHufValue(rate.rate));
                  const isPositive = rate.mockChange >= 0;
                  
                  return (
                    <TableRow key={rate.currency} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="pl-6">
                        <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-lg">
                          {rate.flag}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {rate.currencyName}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono">
                        {rate.currency}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <span className="text-lg font-semibold tabular-nums">
                          {formatHuf(hufValue.toString())}
                        </span>
                        <span className="text-muted-foreground ml-1">Ft</span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <span className={`text-sm font-medium tabular-nums ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                          {isPositive ? '+' : ''}{rate.mockChange.toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Right Side - Quick Converter */}
        <div className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                Gyorsváltó
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm text-muted-foreground">
                  Összeg
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="amount"
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                    className="text-lg font-semibold tabular-nums h-12 flex-1"
                    placeholder="100000"
                  />
                  <Select value={sourceCurrency} onValueChange={setSourceCurrency}>
                    <SelectTrigger className="h-12 w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allCurrencies.map((rate) => (
                        <SelectItem key={rate.currency} value={rate.currency}>
                          <div className="flex items-center gap-2">
                            <span>{rate.flag}</span>
                            <span>{rate.currency}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-center">
                <Button variant="ghost" size="icon" onClick={swapCurrencies} className="rounded-full h-8 w-8 hover:bg-primary/10 hover:text-primary">
                  <ArrowRightLeft className="h-4 w-4 rotate-90" />
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="target-currency" className="text-sm text-muted-foreground">
                  Célvaluta
                </Label>
                <Select value={targetCurrency} onValueChange={setTargetCurrency}>
                  <SelectTrigger id="target-currency" className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allCurrencies.map((rate) => (
                      <SelectItem key={rate.currency} value={rate.currency}>
                        <div className="flex items-center gap-2">
                          <span>{rate.flag}</span>
                          <span>{rate.currency}</span>
                          <span className="text-muted-foreground">- {rate.currencyName}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Átváltott összeg</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums text-primary">
                    {parseFloat(convertedAmount).toLocaleString('hu-HU', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-lg text-muted-foreground">{targetCurrency}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-muted/20 border-border/30">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                Az árfolyamok tájékoztató jellegűek. A napi változás adatok szimuláltak.
                Tranzakciók előtt mindig ellenőrizze a bankjánál az aktuális árfolyamokat.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
