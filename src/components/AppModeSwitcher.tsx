import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AppModeSwitcherProps {
  activeMode: 'eaisybill' | 'accounty';
  isCollapsed?: boolean;
  showToggle?: boolean;
}

export default function AppModeSwitcher({ activeMode, isCollapsed = false, showToggle = true }: AppModeSwitcherProps) {
  // If we shouldn't show the toggle (e.g. user has no access to the other app), just show a static logo for the active app
  if (!showToggle) {
    const isBill = activeMode === 'eaisybill';
    return (
      <div className={cn("flex items-center", isCollapsed ? "justify-center py-2" : "px-2 py-1")}>
        {isCollapsed ? (
          <span className="text-xl font-bold text-primary select-none">{isBill ? 'eB' : 'eB'}</span>
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
          to="/"
          onClick={() => localStorage.setItem('visibill_switch_pending', 'eaisybill')}
          title="eaisyBill"
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-bold transition-all duration-200 border",
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
          to="/accounty"
          onClick={() => localStorage.setItem('visibill_switch_pending', 'eaisybooks')}
          title="eaisyBooks"
          className={cn(
            "w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-bold transition-all duration-200 border",
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
        to="/"
        onClick={() => localStorage.setItem('visibill_switch_pending', 'eaisybill')}
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
        to="/accounty"
        onClick={() => localStorage.setItem('visibill_switch_pending', 'eaisybooks')}
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
