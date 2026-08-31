import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '../common/ManagementStatCard';
import { SkeletonList } from '../common/ManagementSkeleton';
import { RoleBadge } from '../common/RoleBadge';
import { CompanyLlmCostTable } from './CompanyLlmCostTable';
import { CompanyDetail } from '../../api/types';
import { FileText, Users, Coins, Clock } from 'lucide-react';

interface CompanyDetailViewProps {
  companyId: string;
  companyDetail: CompanyDetail | undefined;
  companyLoading: boolean;
}

export function CompanyDetailView({
  companyId,
  companyDetail,
  companyLoading,
}: CompanyDetailViewProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FileText}
          label="Számlák összesen"
          value={companyDetail?.invoiceCount ?? 0}
          loading={companyLoading}
          sub={companyDetail ? `${companyDetail.submittedInvoiceCount} feltöltött · ${companyDetail.navInvoiceCount} NAV` : undefined}
        />
        <StatCard
          icon={Users}
          label="Tagok"
          value={companyDetail?.members.length ?? 0}
          loading={companyLoading}
        />
        <StatCard
          icon={Coins}
          label="LLM költség (USD)"
          value={companyDetail ? `$${companyDetail.llmCosts.totalCostUsd.toFixed(4)}` : '$0'}
          loading={companyLoading}
          sub={companyDetail ? `${companyDetail.llmCosts.callCount} hívás · ${(companyDetail.llmCosts.totalTokens / 1000).toFixed(1)}k token` : undefined}
        />
        <StatCard
          icon={Clock}
          label="Utolsó aktivitás"
          loading={companyLoading}
          value={companyDetail?.lastActivity ? new Date(companyDetail.lastActivity.created_at).toLocaleDateString('hu-HU') : '—'}
          sub={companyDetail?.lastActivity ? `${companyDetail.lastActivity.user_name} · ${companyDetail.lastActivity.action}` : 'Nincs aktivitás'}
        />
      </div>

      {/* Last activity */}
      {!companyLoading && companyDetail?.lastActivity && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" aria-hidden="true" /> Utolsó művelet részletei
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              {[
                { label: 'Művelet', value: companyDetail.lastActivity.action, bold: true },
                { label: 'Fájl', value: companyDetail.lastActivity.entity_name || companyDetail.lastActivity.entity },
                { label: 'Felhasználó', value: companyDetail.lastActivity.user_name },
                { label: 'Időpont', value: new Date(companyDetail.lastActivity.created_at).toLocaleString('hu-HU') },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-muted-foreground text-xs mb-1">{item.label}</p>
                  <p className={`text-foreground ${item.bold ? 'font-medium' : ''}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {companyLoading ? (
        <Card><CardContent className="p-6"><SkeletonList rows={3} /></CardContent></Card>
      ) : companyDetail && (
        <>
          {/* Members */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" aria-hidden="true" /> Hozzárendelt felhasználók
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {companyDetail.members.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Nincs tag</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs">
                        <th className="text-left py-3 px-5 font-medium">Név</th>
                        <th className="text-left py-3 px-4 font-medium">Rang</th>
                        <th className="text-right py-3 px-5 font-medium">Csatlakozás dátuma</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {companyDetail.members.map(m => (
                        <tr key={m.user_id} className="hover:bg-accent/30 transition-colors duration-150">
                          <td className="py-3 px-5">
                            <p className="font-medium text-foreground">{m.name}</p>
                            <p className="text-[11px] text-muted-foreground">{m.email}</p>
                          </td>
                          <td className="py-3 px-4"><RoleBadge role={m.role} /></td>
                          <td className="py-3 px-5 text-right tabular-nums text-muted-foreground text-xs">
                            {new Date(m.joined_at).toLocaleDateString('hu-HU')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* LLM cost table (server-side paginated) */}
          <CompanyLlmCostTable companyId={companyId} />
        </>
      )}
    </div>
  );
}
