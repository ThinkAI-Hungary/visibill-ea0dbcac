import { createContext, useContext, useState, ReactNode } from 'react';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';

interface DateRangeContextType {
  dateFrom: Date;
  dateTo: Date;
  setDateFrom: (date: Date) => void;
  setDateTo: (date: Date) => void;
  setThisMonth: () => void;
  setPreviousMonth: () => void;
  setThisYear: () => void;
  dateFromFormatted: string;
  dateToFormatted: string;
}

const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));

  const setThisMonth = () => {
    setDateFrom(startOfMonth(new Date()));
    setDateTo(endOfMonth(new Date()));
  };

  const setPreviousMonth = () => {
    setDateFrom(startOfMonth(subMonths(new Date(), 1)));
    setDateTo(endOfMonth(subMonths(new Date(), 1)));
  };

  const setThisYear = () => {
    setDateFrom(startOfYear(new Date()));
    setDateTo(endOfYear(new Date()));
  };

  return (
    <DateRangeContext.Provider value={{
      dateFrom,
      dateTo,
      setDateFrom,
      setDateTo,
      setThisMonth,
      setPreviousMonth,
      setThisYear,
      dateFromFormatted: formatDate(dateFrom),
      dateToFormatted: formatDate(dateTo),
    }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (!context) {
    throw new Error('useDateRange must be used within a DateRangeProvider');
  }
  return context;
}
