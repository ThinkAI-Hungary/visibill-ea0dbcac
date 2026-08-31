import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '../common/ManagementStatCard';
import { SkeletonList } from '../common/ManagementSkeleton';
import { RoleBadge } from '../common/RoleBadge';
import { UserDetail, OverviewData } from '../../api/types';
import { Building2 } from 'lucide-react';

interface UserDetailViewProps {
  userDetail: UserDetail | undefined;
  userLoading: boolean;
  overview: OverviewData | undefined;
  onOpenCompany: (companyId: string) => void;
}

export function UserDetailView({
  userDetail,
  userLoading,
  overview,
  onOpenCompany,
}: UserDetailViewProps) {
  // Filter overview companies to only those this user belongs to
  const userCompanyIds = new Set((userDetail?.companies || []).map(c => c.id));
  const userCompanies = (overview?.companies || []).filter(c => userCompanyIds.has(c.id));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <StatCard
        icon={Building2}
        label="Cégekhez hozzárendelve"
        value={userDetail?.companyCount ?? 0}
        loading={userLoading}
      />

      {userLoading ? (
        <Card><CardContent className="p-6"><SkeletonList rows={3} /></CardContent></Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" aria-hidden="true" /> Cégek
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                    <th className="text-left py-3 px-5 font-medium">Cég</th>
                    <th className="text-left py-3 px-4 font-medium">Adószám</th>
                    <th className="text-left py-3 px-4 font-medium">Rang</th>
                    <th className="text-left py-3 px-4 font-medium">Tagok</th>
                    <th className="text-center py-3 px-4 font-medium">Számla</th>
                    <th className="text-center py-3 px-4 font-medium">Tranzakciók</th>
                    <th className="text-center py-3 px-4 font-medium">Bér/járulék</th>
                    <th className="text-right py-3 px-5 font-medium">Havi költség</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {userCompanies.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">Nincs cég hozzárendelve</td>
                    </tr>
                  ) : userCompanies.map(c => {
                    const userRole = userDetail?.companies.find(uc => uc.id === c.id)?.role || '';
                    const MAX_VISIBLE = 3;
                    const visible = c.members.slice(0, MAX_VISIBLE);
                    const overflow = c.members.length - MAX_VISIBLE;
                    const roleColors: Record<string, string> = {
                      CEO: 'bg-amber-400/20 text-amber-900 dark:text-amber-300 border-amber-400/30',
                      ADMIN: 'bg-info/15 text-info border-info/25',
                    };
                    return (
                      <tr
                        key={c.id}
                        onClick={() => onOpenCompany(c.id)}
                        className="cursor-pointer hover:bg-accent/50 active:bg-accent/70
                                   transition-colors duration-150 group"
                        role="button"
                        tabIndex={0}
                        aria-label={`${c.name} megnyitása`}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenCompany(c.id); } }}
                      >
                        <td className="py-3 px-5">
                          <span className="font-medium text-foreground group-hover:text-primary transition-colors duration-150">
                            {c.name}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground tabular-nums text-xs">
                          {c.tax_number || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <RoleBadge role={userRole} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {visible.map((m, i) => {
                              const cls = roleColors[m.role] || 'bg-muted text-muted-foreground border-border';
                              return (
                                <span
                                  key={i}
                                  className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border ${cls}`}
                                  title={`${m.name} — ${m.role}`}
                                >
                                  {m.name}
                                </span>
                              );
                            })}
                            {overflow > 0 && (
                              <span
                                className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground"
                                title={c.members.slice(MAX_VISIBLE).map(m => m.name).join(', ')}
                              >
                                +{overflow}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center tabular-nums text-muted-foreground">
                          {c.invoiceCount}
                        </td>
                        <td className="py-3 px-4 text-center tabular-nums text-muted-foreground">
                          {c.transactionCount}
                        </td>
                        <td className="py-3 px-4 text-center tabular-nums text-muted-foreground">
                          {c.payrollCount}
                        </td>
                        <td className="py-3 px-5 text-right tabular-nums font-medium text-foreground">
                          ${c.monthlyCostUsd.toFixed(4)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
