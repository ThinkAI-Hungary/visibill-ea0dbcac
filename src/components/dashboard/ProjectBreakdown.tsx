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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Projekt összefoglaló
        </CardTitle>
        <CardDescription>
          Számlák megoszlása projektek szerint
        </CardDescription>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Még nincsenek projekthez rendelt számlák</p>
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
                      {project.invoice_count} számla
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Összesen: {formatCurrency(project.total_amount)}
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
                    Átlag: {formatCurrency(project.avg_amount)} / számla
                  </span>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>Aktív projekt</span>
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