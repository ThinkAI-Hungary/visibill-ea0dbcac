import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, RefreshCw, Clock, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  
  // Converter state
  const [hufAmount, setHufAmount] = useState<string>("100000");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("EUR");

  useEffect(() => {
    fetchExchangeRates();
  }, []);

  const fetchExchangeRates = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/HUF');
      if (!response.ok) {
        throw new Error('Failed to fetch exchange rates');
      }
      const data = await response.json();
      
      const formattedRates: ExchangeRate[] = currencyData.map(curr => ({
        currency: curr.code,
        currencyName: curr.name,
        rate: data.rates[curr.code] || 0,
        flag: curr.flag,
        // Mock daily change (-2% to +2% of rate)
        mockChange: parseFloat(((Math.random() - 0.5) * 4 * (1 / (data.rates[curr.code] || 1)) / 100).toFixed(2))
      }));
      
      setRates(formattedRates);
      setLastUpdate(new Date().toLocaleString('hu-HU'));
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateHufValue = (rate: number) => {
    return (1 / rate).toFixed(2);
  };

  const heroRates = useMemo(() => {
    return rates.filter(r => ["EUR", "USD", "GBP"].includes(r.currency));
  }, [rates]);

  const tableRates = useMemo(() => {
    return rates.filter(r => !["EUR", "USD", "GBP"].includes(r.currency));
  }, [rates]);

  const convertedAmount = useMemo(() => {
    const rate = rates.find(r => r.currency === selectedCurrency);
    if (!rate || !hufAmount) return "0.00";
    const amount = parseFloat(hufAmount.replace(/\s/g, "")) || 0;
    return (amount * rate.rate).toFixed(2);
  }, [rates, selectedCurrency, hufAmount]);

  const formatHuf = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return "0";
    return num.toLocaleString('hu-HU');
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
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
          <Button variant="outline" size="sm" onClick={fetchExchangeRates} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Frissítés
          </Button>
        </div>
      </div>

      {/* Hero Cards - Key Currencies */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {heroRates.map((rate) => {
          const hufValue = parseFloat(calculateHufValue(rate.rate));
          const isPositive = rate.mockChange >= 0;
          
          return (
            <Card key={rate.currency} className="relative overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/50">
              <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
                <span className="text-[120px] leading-none">{rate.flag}</span>
              </div>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center text-2xl">
                    {rate.flag}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{rate.currencyName}</p>
                    <p className="font-semibold text-lg">{rate.currency}</p>
                  </div>
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
                <Label htmlFor="huf-amount" className="text-sm text-muted-foreground">
                  Összeg (HUF)
                </Label>
                <Input
                  id="huf-amount"
                  type="text"
                  value={hufAmount}
                  onChange={(e) => setHufAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  className="text-lg font-semibold tabular-nums h-12"
                  placeholder="100000"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="currency-select" className="text-sm text-muted-foreground">
                  Célvaluta
                </Label>
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  <SelectTrigger id="currency-select" className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rates.map((rate) => (
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
                  <span className="text-lg text-muted-foreground">{selectedCurrency}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-muted/20 border-border/30">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">
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
