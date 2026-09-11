import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FolderOpen, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          {t('dashboard:project_breakdown.title', 'Projekt összefoglaló')}
        </CardTitle>
        <CardDescription>
          {t('dashboard:project_breakdown.description', 'Számlák megoszlása projektek szerint')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('dashboard:project_breakdown.empty', 'Még nincsenek projekthez rendelt számlák')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {projects.map((project) => (
              <div key={project.id} className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{project.name}</h4>
                    <p className="text-sm text-muted-foreground truncate">
                      {project.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Badge variant="secondary">
                      {t('dashboard:project_breakdown.invoices_count', {
                        count: project.invoice_count,
                        defaultValue: `${project.invoice_count} számla`,
                      })}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t('dashboard:project_breakdown.total', 'Összesen:')} {formatCurrency(project.total_amount)}
                  </span>
                  <span className="text-muted-foreground">
                    {project.percentage.toFixed(1)}%
                  </span>
                </div>
                
                <Progress 
                  value={project.percentage} 
                  className="h-2"
                />
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {t('dashboard:project_breakdown.average', {
                      amount: formatCurrency(project.avg_amount),
                      defaultValue: `Átlag: ${formatCurrency(project.avg_amount)} / számla`,
                    })}
                  </span>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>{t('dashboard:project_breakdown.active_project', 'Aktív projekt')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectBreakdown;