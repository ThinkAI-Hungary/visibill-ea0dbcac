import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExchangeRates {
  [key: string]: number;
}

const CurrencyConverter = () => {
  const [amount, setAmount] = useState<string>('1');
  const [fromCurrency, setFromCurrency] = useState<string>('HUF');
  const [toCurrency, setToCurrency] = useState<string>('EUR');
  const [rates, setRates] = useState<ExchangeRates>({});
  const [convertedAmount, setConvertedAmount] = useState<string>('0');
  const [loading, setLoading] = useState(true);

  const currencies = [
    { code: 'HUF', name: 'Magyar Forint', flag: '🇭🇺' },
    { code: 'EUR', name: 'Euró', flag: '🇪🇺' },
    { code: 'USD', name: 'Amerikai Dollár', flag: '🇺🇸' },
    { code: 'GBP', name: 'Brit Font', flag: '🇬🇧' },
    { code: 'CHF', name: 'Svájci Frank', flag: '🇨🇭' },
    { code: 'PLN', name: 'Lengyel Zloty', flag: '🇵🇱' },
    { code: 'CZK', name: 'Cseh Korona', flag: '🇨🇿' },
    { code: 'RON', name: 'Román Lej', flag: '🇷🇴' },
    { code: 'JPY', name: 'Japán Yen', flag: '🇯🇵' },
    { code: 'CNY', name: 'Kínai Yuan', flag: '🇨🇳' },
  ];

  useEffect(() => {
    fetchExchangeRates();
  }, []);

  useEffect(() => {
    if (Object.keys(rates).length > 0) {
      convertCurrency();
    }
  }, [amount, fromCurrency, toCurrency, rates]);

  const fetchExchangeRates = async () => {
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/HUF');
      const data = await response.json();
      setRates(data.rates);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      setLoading(false);
    }
  };

  const convertCurrency = () => {
    const numAmount = parseFloat(amount) || 0;
    
    if (fromCurrency === 'HUF') {
      // From HUF to other currency
      const rate = rates[toCurrency] || 1;
      setConvertedAmount((numAmount * rate).toFixed(2));
    } else if (toCurrency === 'HUF') {
      // From other currency to HUF
      const rate = rates[fromCurrency] || 1;
      setConvertedAmount((numAmount / rate).toFixed(2));
    } else {
      // Between two non-HUF currencies
      const fromRate = rates[fromCurrency] || 1;
      const toRate = rates[toCurrency] || 1;
      const hufAmount = numAmount / fromRate;
      setConvertedAmount((hufAmount * toRate).toFixed(2));
    }
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-accent" />
          Valutaváltó
        </CardTitle>
        <CardDescription>Számítsa ki az árfolyamokat</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Összeg</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Összeg"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="from-currency">Honnan</Label>
          <Select value={fromCurrency} onValueChange={setFromCurrency}>
            <SelectTrigger id="from-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((curr) => (
                <SelectItem key={curr.code} value={curr.code}>
                  {curr.flag} {curr.code} - {curr.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={swapCurrencies}
            className="rounded-full"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="to-currency">Hová</Label>
          <Select value={toCurrency} onValueChange={setToCurrency}>
            <SelectTrigger id="to-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((curr) => (
                <SelectItem key={curr.code} value={curr.code}>
                  {curr.flag} {curr.code} - {curr.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-6 p-4 bg-accent-subtle rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">Átváltott összeg</p>
          <p className="text-2xl font-bold text-accent">
            {loading ? '...' : convertedAmount} {toCurrency}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CurrencyConverter;