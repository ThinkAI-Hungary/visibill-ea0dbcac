import { useQuery } from '@tanstack/react-query';
import { reportError } from '@/lib/errorReporter';

interface ExchangeRatesResponse {
  rates: Record<string, number>;
  base: string;
}

// Fetches current exchange rates and calculates the multiplier to convert ANY currency to HUF.
export const useExchangeRates = () => {
  return useQuery({
    queryKey: ['exchange-rates'],
    queryFn: async () => {
      try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/HUF');
        if (!response.ok) {
          throw new Error('Failed to fetch exchange rates');
        }
        const data: ExchangeRatesResponse = await response.json();
        
        // We want multipliers to convert TO HUF.
        // The API returns rates like: 1 HUF = 0.0025 EUR
        // So 1 EUR = (1 / 0.0025) HUF = 400 HUF
        // The multiplier for EUR is 400.
        
        const hufMultipliers: Record<string, number> = {
          HUF: 1, // Base is always 1
        };

        for (const [currency, rate] of Object.entries(data.rates)) {
          if (currency !== 'HUF' && rate > 0) {
            hufMultipliers[currency] = 1 / rate;
          }
        }

        return hufMultipliers;
      } catch (error) {
        reportError({ type: 'db_query', component: 'useExchangeRates', action: 'error', message: 'Error fetching exchange rates:', error: error });
        // Fallback to safe defaults if API is down
        return {
          HUF: 1,
          EUR: 400,
          USD: 370,
          GBP: 470,
          CHF: 415,
          RON: 80,
        };
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
  });
};
