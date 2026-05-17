import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  /** Company name displayed in breadcrumb strip */
  companyName?: string;
  /** Breadcrumb label (e.g. "ÁFA Bevallás (2665)") */
  breadcrumb?: string;
  /** Page title */
  title: string;
  /** Subtitle / description */
  description?: string;
  /** Right-side action buttons */
  actions?: React.ReactNode;
  /** Additional className */
  className?: string;
}

export function PageHeader({ companyName, breadcrumb, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("space-y-2 print:hidden", className)}>
      {/* Breadcrumb strip */}
      {(companyName || breadcrumb) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {companyName && <span className="font-medium text-foreground/70">{companyName}</span>}
          {companyName && breadcrumb && <span>•</span>}
          {breadcrumb && <span>{breadcrumb}</span>}
        </div>
      )}

      {/* Title row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground/90">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
