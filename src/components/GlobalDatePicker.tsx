import { CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, isSameDay, addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale, getActiveLocale } from '@/lib/locale/formatters';

const MAX_RANGE_DAYS = 365;

export function GlobalDatePicker() {
  const { t } = useTranslation('common');
  const { dateFrom, dateTo, setDateFrom, setDateTo, setThisMonth, setPreviousMonth, setThisYear } = useDateRange();
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);

  const isThisMonth = isSameDay(dateFrom, startOfMonth(new Date())) && isSameDay(dateTo, endOfMonth(new Date()));
  const isPreviousMonth = isSameDay(dateFrom, startOfMonth(subMonths(new Date(), 1))) && isSameDay(dateTo, endOfMonth(subMonths(new Date(), 1)));
  const isThisYear = isSameDay(dateFrom, startOfYear(new Date())) && isSameDay(dateTo, endOfYear(new Date()));

  const isCustom = !isThisMonth && !isPreviousMonth && !isThisYear;
  const isHr = getActiveLocale() === 'hr';
  const dateFormatPattern = isHr ? 'dd.MM.yyyy.' : 'yyyy. MMM dd.';

  return (
    <div className="flex items-center gap-2 flex-wrap px-6 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <span className="text-sm font-medium text-muted-foreground mr-1">{t('date_picker.period', { defaultValue: 'Időszak:' })}</span>
      
      {/* Preset buttons */}
      <div className="flex gap-1">
        <Button
          variant={isThisMonth ? "default" : "outline"}
          size="sm"
          className={cn("h-7 text-xs px-3", !isThisMonth && "text-muted-foreground")}
          onClick={setThisMonth}
        >
          {t('date_picker.this_month', { defaultValue: 'Ez a hónap' })}
        </Button>
        <Button
          variant={isPreviousMonth ? "default" : "outline"}
          size="sm"
          className={cn("h-7 text-xs px-3", !isPreviousMonth && "text-muted-foreground")}
          onClick={setPreviousMonth}
        >
          {t('date_picker.previous_month', { defaultValue: 'Előző hónap' })}
        </Button>
        <Button
          variant={isThisYear ? "default" : "outline"}
          size="sm"
          className={cn("h-7 text-xs px-3", !isThisYear && "text-muted-foreground")}
          onClick={setThisYear}
        >
          {t('date_picker.this_year', { defaultValue: 'Ez az év' })}
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
              className={cn(
                "h-7 text-xs px-2.5 justify-start font-normal",
                isCustom ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 dark:bg-primary/10 dark:border-primary dark:text-primary dark:hover:bg-primary/20" : "text-muted-foreground"
              )}
            >
              <CalendarIcon className={cn("mr-1.5 h-3 w-3", isCustom ? "text-primary-foreground dark:text-primary" : "text-muted-foreground")} />
              {format(dateFrom, dateFormatPattern, { locale: getDateFnsLocale() })}
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
              disabled={{ after: dateTo }}
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
              className={cn(
                "h-7 text-xs px-2.5 justify-start font-normal",
                isCustom ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 dark:bg-primary/10 dark:border-primary dark:text-primary dark:hover:bg-primary/20" : "text-muted-foreground"
              )}
            >
              <CalendarIcon className={cn("mr-1.5 h-3 w-3", isCustom ? "text-primary-foreground dark:text-primary" : "text-muted-foreground")} />
              {format(dateTo, dateFormatPattern, { locale: getDateFnsLocale() })}
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
              disabled={[
                { before: dateFrom },
                { after: addDays(dateFrom, MAX_RANGE_DAYS) }
              ]}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
