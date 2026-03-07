import { CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, isSameDay } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useState } from 'react';

export function GlobalDatePicker() {
  const { dateFrom, dateTo, setDateFrom, setDateTo, setThisMonth, setPreviousMonth, setThisYear } = useDateRange();
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const isThisMonth = isSameDay(dateFrom, startOfMonth(new Date())) && isSameDay(dateTo, endOfMonth(new Date()));
  const isPreviousMonth = isSameDay(dateFrom, startOfMonth(subMonths(new Date(), 1))) && isSameDay(dateTo, endOfMonth(subMonths(new Date(), 1)));
  const isThisYear = isSameDay(dateFrom, startOfYear(new Date())) && isSameDay(dateTo, endOfYear(new Date()));

  return (
    <div className="flex items-center gap-2 flex-wrap px-6 py-2 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <span className="text-sm font-medium text-muted-foreground mr-1">Időszak:</span>
      
      {/* Preset buttons */}
      <div className="flex gap-1">
        <Button
          variant={isThisMonth ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs px-3"
          onClick={setThisMonth}
        >
          Ez a hónap
        </Button>
        <Button
          variant={isPreviousMonth ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs px-3"
          onClick={setPreviousMonth}
        >
          Előző hónap
        </Button>
        <Button
          variant={isThisYear ? "default" : "outline"}
          size="sm"
          className="h-7 text-xs px-3"
          onClick={setThisYear}
        >
          Ez az év
        </Button>
      </div>

      <span className="text-muted-foreground mx-1 text-xs">|</span>

      {/* Calendar pickers */}
      <div className="flex gap-1.5 items-center">
        <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-7 text-xs px-2.5 justify-start font-normal")}
            >
              <CalendarIcon className="mr-1.5 h-3 w-3" />
              {format(dateFrom, "yyyy. MMM dd.", { locale: hu })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFrom}
              onSelect={(date) => {
                if (date) {
                  setDateFrom(date);
                  setDateFromOpen(false);
                }
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <span className="text-xs text-muted-foreground">–</span>

        <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-7 text-xs px-2.5 justify-start font-normal")}
            >
              <CalendarIcon className="mr-1.5 h-3 w-3" />
              {format(dateTo, "yyyy. MMM dd.", { locale: hu })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={dateTo}
              onSelect={(date) => {
                if (date) {
                  setDateTo(date);
                  setDateToOpen(false);
                }
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
