import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";
import { useDateRange } from "@/contexts/DateRangeContext";

interface AppModeSwitcherProps {
  activeMode: 'eaisybill' | 'accounty';
  isCollapsed?: boolean;
  showToggle?: boolean;
}

const prefetchEaisybooks = () => {
  void import("@/pages/Accounty/AccountyLayout");
  void import("@/pages/Accounty/ClientDetailsPage");
};

const prefetchEaisybill = () => {
  void import("@/pages/Index");
  void import("@/components/AppLayout");
};

function useSafeCompany() {
  try {
    return useCompany();
  } catch {
    return null;
  }
}

function useSafeDateRange() {
  try {
    return useDateRange();
  } catch {
    return null;
  }
}

export default function AppModeSwitcher({ activeMode, isCollapsed = false, showToggle = true }: AppModeSwitcherProps) {
  const companyContext = useSafeCompany();
  const dateRangeContext = useSafeDateRange();
  const location = useLocation();

  const selectedCompany = companyContext?.selectedCompany;
  const eaisybooksCompanyIds = companyContext?.eaisybooksCompanyIds;
  const companies = companyContext?.companies;

  const dateFromFormatted = dateRangeContext?.dateFromFormatted || '2026-01-01';
  const dateToFormatted = dateRangeContext?.dateToFormatted || '2026-12-31';
  const currentDateRange = `${dateFromFormatted}_${dateToFormatted}`;

  // Extract currently active company ID in eaisybooks from URL or fallback to storage
  const activeBooksCompanyId = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[0] === 'eaisybooks' || parts[0] === 'accounty')) {
      const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
      if (uuidRegex.test(parts[1])) {
        return parts[1];
      }
    }
    try {
      return localStorage.getItem('eaisybooks_selected_company_id');
    } catch {
      return null;
    }
  }, [location.pathname]);

  // Direct target for eaisyBooks: prioritize active company if enabled, then last viewed or first eligible company
  const booksTarget = useMemo(() => {
    if (selectedCompany && eaisybooksCompanyIds?.includes(selectedCompany.id)) {
      return `/eaisybooks/${selectedCompany.id}/${currentDateRange}/overview`;
    }
    try {
      const lastBooksCompanyId = localStorage.getItem('eaisybooks_selected_company_id');
      if (lastBooksCompanyId && eaisybooksCompanyIds?.includes(lastBooksCompanyId)) {
        return `/eaisybooks/${lastBooksCompanyId}/${currentDateRange}/overview`;
      }
      const firstEligible = companies?.find(c => eaisybooksCompanyIds?.includes(c.id));
      if (firstEligible) {
        return `/eaisybooks/${firstEligible.id}/${currentDateRange}/overview`;
      }
    } catch { /* ignore */ }
    return '/eaisybooks';
  }, [selectedCompany, eaisybooksCompanyIds, companies, currentDateRange]);

  // Direct target for eaisyBill: prioritize currently viewed company in books, then active company, then last viewed eaisybill company
  const billTarget = useMemo(() => {
    if (activeBooksCompanyId && companies?.some(c => c.id === activeBooksCompanyId)) {
      return `/${activeBooksCompanyId}/${currentDateRange}/`;
    }
    if (selectedCompany) {
      return `/${selectedCompany.id}/${currentDateRange}/`;
    }
    try {
      const lastBillCompanyId = localStorage.getItem('eaisybill_selected_company_id');
      if (lastBillCompanyId && companies?.some(c => c.id === lastBillCompanyId)) {
        return `/${lastBillCompanyId}/${currentDateRange}/`;
      }
      if (companies && companies.length > 0) {
        return `/${companies[0].id}/${currentDateRange}/`;
      }
    } catch { /* ignore */ }
    return '/';
  }, [activeBooksCompanyId, selectedCompany, companies, currentDateRange]);

  const handleSwitchToBooks = () => {
    try {
      if (selectedCompany?.id) {
        localStorage.setItem('eaisybill_selected_company_id', selectedCompany.id);
        if (eaisybooksCompanyIds?.includes(selectedCompany.id)) {
          localStorage.setItem('eaisybooks_selected_company_id', selectedCompany.id);
        }
      }
    } catch { /* ignore */ }
  };

  const handleSwitchToBill = () => {
    try {
      const targetCompanyId = activeBooksCompanyId || selectedCompany?.id || (companies && companies[0]?.id);
      if (targetCompanyId) {
        localStorage.setItem('eaisybill_selected_company_id', targetCompanyId);
      }
    } catch { /* ignore */ }
  };

  // If we shouldn't show the toggle (e.g. user has no access to the other app), just show a static logo for the active app
  if (!showToggle) {
    const isBill = activeMode === 'eaisybill';
    return (
      <div className={cn("flex items-center", isCollapsed ? "justify-center py-2" : "px-2 py-1")}>
        {isCollapsed ? (
          <span className="text-xl font-bold text-primary select-none">{isBill ? 'eB' : 'eK'}</span>
        ) : (
          <span className="text-xl font-medium text-foreground/80 select-none">
            eaisy<span className="font-bold text-primary">{isBill ? 'Bill' : 'Books'}</span>
          </span>
        )}
      </div>
    );
  }

  // Collapsed view: mini vertical pill with 'eB' and 'eK'
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2 p-1 bg-muted/30 dark:bg-muted/20 border border-border/40 rounded-full select-none w-9 pb-2">
        <Link
          to={billTarget}
          onMouseEnter={prefetchEaisybill}
          onTouchStart={prefetchEaisybill}
          onClick={handleSwitchToBill}
          title="eaisyBill"
          className={cn(
            "relative w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-bold transition-all duration-200 border",
            activeMode === "eaisybill"
              ? "bg-primary/15 dark:bg-primary/5 text-primary border-primary/20 shadow-sm"
              : "text-muted-foreground hover:bg-primary/5 hover:text-primary border-transparent"
          )}
        >
          eB
          {activeMode === "eaisybill" && (
            <span className="absolute bottom-[-1.5px] left-1/2 -translate-x-1/2 w-3 h-[2px] rounded-full bg-primary shadow-[0_0_6px_#14D4B8]" />
          )}
        </Link>
        <Link
          to={booksTarget}
          onMouseEnter={prefetchEaisybooks}
          onTouchStart={prefetchEaisybooks}
          onClick={handleSwitchToBooks}
          title="eaisyBooks"
          className={cn(
            "relative w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-bold transition-all duration-200 border",
            activeMode === "accounty"
              ? "bg-primary/15 dark:bg-primary/5 text-primary border-primary/20 shadow-sm"
              : "text-muted-foreground hover:bg-primary/5 hover:text-primary border-transparent"
          )}
        >
          eK
          {activeMode === "accounty" && (
            <span className="absolute bottom-[-1.5px] left-1/2 -translate-x-1/2 w-3 h-[2px] rounded-full bg-primary shadow-[0_0_6px_#14D4B8]" />
          )}
        </Link>
      </div>
    );
  }

  // Expanded view: beautiful Gradient Border Glow switcher optimized for light and dark themes
  return (
    <div className="w-full bg-muted/65 dark:bg-[#0d0e10]/60 border border-border/50 dark:border-border/30 rounded-full p-1 pb-1.5 flex items-center select-none font-sans min-h-[46px]">
      {/* Option 1: eaisyBill */}
      <Link
        to={billTarget}
        onMouseEnter={prefetchEaisybill}
        onTouchStart={prefetchEaisybill}
        onClick={handleSwitchToBill}
        className={cn(
          "relative flex-1 py-2 text-center text-base font-semibold tracking-tight transition-all duration-200 rounded-full border",
          activeMode === "eaisybill"
            ? "bg-primary/15 dark:bg-primary/5 text-foreground dark:text-white border-primary/25 dark:border-primary/20 shadow-sm font-bold"
            : "text-muted-foreground dark:text-white/60 hover:text-foreground dark:hover:text-white border-transparent opacity-60 hover:opacity-100"
        )}
      >
        <span>e</span>
        <span className="text-primary font-bold">ai</span>
        <span>sy</span>
        <span className="text-primary font-bold">Bill</span>
        
        {activeMode === "eaisybill" && (
          <span className="absolute bottom-[-1.5px] left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-primary shadow-[0_0_8px_#14D4B8]" />
        )}
      </Link>

      {/* Option 2: eaisyBooks */}
      <Link
        to={booksTarget}
        onMouseEnter={prefetchEaisybooks}
        onTouchStart={prefetchEaisybooks}
        onClick={handleSwitchToBooks}
        className={cn(
          "relative flex-1 py-2 text-center text-base font-semibold tracking-tight transition-all duration-200 rounded-full border",
          activeMode === "accounty"
            ? "bg-primary/15 dark:bg-primary/5 text-foreground dark:text-white border-primary/25 dark:border-primary/20 shadow-sm font-bold"
            : "text-muted-foreground dark:text-white/60 hover:text-foreground dark:hover:text-white border-transparent opacity-60 hover:opacity-100"
        )}
      >
        <span>e</span>
        <span className="text-primary font-bold">ai</span>
        <span>sy</span>
        <span className="text-primary font-bold">Books</span>
        
        {activeMode === "accounty" && (
          <span className="absolute bottom-[-1.5px] left-1/2 -translate-x-1/2 w-8 h-[3px] rounded-full bg-primary shadow-[0_0_8px_#14D4B8]" />
        )}
      </Link>
    </div>
  );
}
