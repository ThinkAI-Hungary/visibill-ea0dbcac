import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FolderOpen, TrendingUp, ChevronRight, Plus, CheckCircle2, PieChart, Layers, Receipt } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useScopedNavigate } from '@/lib/navigation';

interface ProjectData {
  id: string;
  name: string;
  description: string;
  invoice_count: number;
  total_amount: number;
  avg_amount: number;
  percentage: number;
}

interface ProjectBreakdownProps {
  projects: ProjectData[];
  totalAmount: number;
}

const ProjectBreakdown = ({ projects, totalAmount }: ProjectBreakdownProps) => {
  const { t } = useTranslation(['dashboard', 'common']);
  const scopedNavigate = useScopedNavigate();

  const allocatedAmount = useMemo(
    () => projects.reduce((sum, p) => sum + (p.total_amount || 0), 0),
    [projects]
  );

  const totalInvoicesCount = useMemo(
    () => projects.reduce((sum, p) => sum + (p.invoice_count || 0), 0),
    [projects]
  );

  const overallAvg = totalInvoicesCount > 0 ? allocatedAmount / totalInvoicesCount : 0;

  const allocationPercentage = totalAmount > 0
    ? Math.min(100, Math.round((allocatedAmount / totalAmount) * 100))
    : (projects.length > 0 ? 100 : 0);

  return (
    <Card className="h-[520px] flex flex-col overflow-hidden border-border/80 shadow-card">
      <CardHeader className="px-5 py-3.5 border-b border-border/40 shrink-0 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-primary-subtle text-primary flex items-center justify-center shrink-0">
              <FolderOpen className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight text-foreground">
                {t('dashboard:project_breakdown.title', 'Projekt összefoglaló')}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {t('dashboard:project_breakdown.description', 'Költségek és számlák projektmegoszlása')}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs font-medium"
            onClick={() => scopedNavigate('projects')}
          >
            {t('dashboard:project_breakdown.view_projects', 'Projektek')}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto">
        {projects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground my-auto">
            <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <FolderOpen className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {t('dashboard:project_breakdown.empty_title', 'Még nincsenek aktív projektek')}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
              {t('dashboard:project_breakdown.empty_desc', 'Rendelj számlákat projektekhez a költséghelyek és büdzsék pontos nyomon követéséhez.')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            {/* Top Projects List */}
            <div className="space-y-3">
              {projects.slice(0, 3).map((project) => (
                <div
                  key={project.id}
                  className="p-3.5 rounded-lg bg-muted/30 border border-border/60 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="min-w-0 flex-1 mr-2">
                      <h4 className="font-semibold text-sm truncate text-foreground">{project.name}</h4>
                      {project.description && (
                        <p className="text-xs text-muted-foreground truncate">{project.description}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5 shrink-0 font-medium bg-secondary text-secondary-foreground">
                      {t('dashboard:project_breakdown.invoices_count', {
                        count: project.invoice_count,
                        defaultValue: `${project.invoice_count} számla`,
                      })}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs my-1 font-medium">
                    <span className="text-muted-foreground">
                      {t('dashboard:project_breakdown.total', 'Összesen:')}{' '}
                      <strong className="text-foreground tabular-nums">{formatCurrency(project.total_amount)}</strong>
                    </span>
                    <span className="text-primary font-semibold tabular-nums">
                      {project.percentage.toFixed(1)}%
                    </span>
                  </div>

                  <Progress value={project.percentage} className="h-1.5 bg-muted" />

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                    <span>
                      {t('dashboard:project_breakdown.average', {
                        amount: formatCurrency(project.avg_amount),
                        defaultValue: `Átlag: ${formatCurrency(project.avg_amount)} / számla`,
                      })}
                    </span>
                    <div className="flex items-center gap-1 text-primary font-medium">
                      <TrendingUp className="h-3 w-3" />
                      <span>{t('dashboard:project_breakdown.active_project', 'Aktív projekt')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 2x2 Mini KPI Grid filling the void */}
            <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg bg-muted/25 border border-border/40">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Receipt className="h-3 w-3 text-muted-foreground/70" />
                  <span>{t('dashboard:project_breakdown.kpi_avg_invoice', 'Átlag bizonylat')}</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-foreground tabular-nums">
                  {formatCurrency(overallAvg)}
                </p>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-success/80" />
                  <span>{t('dashboard:project_breakdown.kpi_allocation_status', 'Allokáció')}</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-success tabular-nums">
                  {allocationPercentage >= 100
                    ? t('dashboard:project_breakdown.fully_allocated', '100% Lefedve')
                    : `${allocationPercentage}% Költség`}
                </p>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Layers className="h-3 w-3 text-muted-foreground/70" />
                  <span>{t('dashboard:project_breakdown.kpi_active_count', 'Aktív projektek')}</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-foreground tabular-nums">
                  {t('dashboard:project_breakdown.project_count_val', {
                    count: projects.length,
                    defaultValue: `${projects.length} projekt`,
                  })}
                </p>
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <PieChart className="h-3 w-3 text-primary/80" />
                  <span>{t('dashboard:project_breakdown.kpi_allocated_total', 'Összes keret')}</span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-primary tabular-nums">
                  {formatCurrency(allocatedAmount)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom CTA Card */}
        <div className="p-3 rounded-lg border border-dashed border-primary/30 bg-primary-subtle/30 flex items-center justify-between mt-3">
          <div className="min-w-0 mr-2">
            <p className="text-xs font-semibold text-primary truncate">
              {t('dashboard:project_breakdown.create_project_title', 'Új projekt indítása')}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {t('dashboard:project_breakdown.create_project_desc', 'Rendelj számlákat költséghelyekhez')}
            </p>
          </div>
          <Button
            size="sm"
            className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1 shrink-0 font-medium"
            onClick={() => scopedNavigate('projects')}
          >
            <Plus className="h-3 w-3" />
            {t('dashboard:project_breakdown.new_project_btn', 'Új projekt')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectBreakdown;