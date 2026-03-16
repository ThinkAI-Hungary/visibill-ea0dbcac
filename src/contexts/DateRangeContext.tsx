import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, addDays, differenceInDays } from 'date-fns';

const MAX_RANGE_DAYS = 365;

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
  const [dateFrom, setDateFromRaw] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateToRaw] = useState<Date>(endOfMonth(new Date()));

  const setDateFrom = useCallback((newFrom: Date) => {
    setDateFromRaw(newFrom);
    setDateToRaw((prevTo) => {
      // If new start date is after end date, move end date to match
      if (newFrom > prevTo) {
        return newFrom;
      }
      // If range exceeds max, cap the end date
      if (differenceInDays(prevTo, newFrom) > MAX_RANGE_DAYS) {
        return addDays(newFrom, MAX_RANGE_DAYS);
      }
      return prevTo;
    });
  }, []);

  const setDateTo = useCallback((newTo: Date) => {
    setDateToRaw(newTo);
    setDateFromRaw((prevFrom) => {
      // If new end date is before start date, move start date to match
      if (newTo < prevFrom) {
        return newTo;
      }
      // If range exceeds max, cap the start date
      if (differenceInDays(newTo, prevFrom) > MAX_RANGE_DAYS) {
        return addDays(newTo, -MAX_RANGE_DAYS);
      }
      return prevFrom;
    });
  }, []);

  const setThisMonth = () => {
    setDateFromRaw(startOfMonth(new Date()));
    setDateToRaw(endOfMonth(new Date()));
  };

  const setPreviousMonth = () => {
    setDateFromRaw(startOfMonth(subMonths(new Date(), 1)));
    setDateToRaw(endOfMonth(subMonths(new Date(), 1)));
  };

  const setThisYear = () => {
    setDateFromRaw(startOfYear(new Date()));
    setDateToRaw(endOfYear(new Date()));
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
