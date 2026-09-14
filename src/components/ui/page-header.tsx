import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  useAccountyBreadcrumbsOptional,
  normalizeBreadcrumbItem,
  type BreadcrumbItem,
} from '@/hooks/useAccountyBreadcrumbs';

export type { BreadcrumbItem };

export interface PageHeaderProps {
  /** Többszintű hierarchikus útvonal */
  breadcrumbs?: Array<BreadcrumbItem | string>;
  /** Automatikus breadcrumb feloldás Accounty kontextusban (alapértelmezetten true) */
  autoBreadcrumbs?: boolean;
  /** Company name displayed in breadcrumb strip (legacy fallback) */
  companyName?: string;
  /** Breadcrumb label (e.g. "ÁFA Bevallás (2665)") (legacy fallback) */
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

export function PageHeader({
  breadcrumbs: explicitBreadcrumbs,
  autoBreadcrumbs = true,
  companyName,
  breadcrumb,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  const autoData = useAccountyBreadcrumbsOptional();

  const resolvedBreadcrumbs = useMemo(() => {
    if (explicitBreadcrumbs !== undefined) {
      if (explicitBreadcrumbs.length === 0) return [];
      const list = explicitBreadcrumbs.map(normalizeBreadcrumbItem);
      return list.map((item, idx) => ({
        ...item,
        active: item.active ?? idx === list.length - 1,
        href: (item.active ?? idx === list.length - 1) ? undefined : item.href,
      }));
    }
    if (autoBreadcrumbs && autoData && autoData.breadcrumbs.length > 0) {
      return autoData.breadcrumbs;
    }
    return null;
  }, [explicitBreadcrumbs, autoBreadcrumbs, autoData]);

  const hasNewBreadcrumbs = Boolean(resolvedBreadcrumbs && resolvedBreadcrumbs.length > 0);
  const hasLegacyBreadcrumbs = !hasNewBreadcrumbs && Boolean(companyName || breadcrumb);

  return (
    <div className={cn("space-y-2 print:hidden", className)}>
      {/* Hierarchical Breadcrumbs */}
      {hasNewBreadcrumbs && resolvedBreadcrumbs && (
        <nav aria-label="Útvonal" className="flex items-center flex-wrap gap-1 text-xs text-muted-foreground">
          {resolvedBreadcrumbs.map((item, idx) => {
            const isLast = idx === resolvedBreadcrumbs.length - 1;
            const isActive = item.active ?? isLast;

            return (
              <React.Fragment key={`${item.label}-${idx}`}>
                {idx > 0 && (
                  <span className="text-muted-foreground/40 select-none mx-0.5" aria-hidden="true">
                    /
                  </span>
                )}
                {item.href && !isActive ? (
                  <Link
                    to={item.href}
                    className="hover:text-foreground transition-colors truncate max-w-[200px] sm:max-w-none"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      isActive ? "font-medium text-foreground" : "text-muted-foreground",
                      "truncate max-w-[240px] sm:max-w-none"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Legacy breadcrumb strip fallback */}
      {hasLegacyBreadcrumbs && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {companyName && <span className="font-medium text-foreground/70">{companyName}</span>}
          {companyName && breadcrumb && <span className="text-muted-foreground/40 select-none mx-0.5">/</span>}
          {breadcrumb && <span>{breadcrumb}</span>}
        </div>
      )}

      {/* Title row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
