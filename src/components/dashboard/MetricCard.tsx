import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  onClick?: () => void;
}

const MetricCard = ({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend, 
  variant = 'default',
  onClick,
}: MetricCardProps) => {
  const variantStyles = {
    default: 'border-border',
    success: 'border-success/20 bg-success/5',
    warning: 'border-warning/20 bg-warning/5',
    destructive: 'border-destructive/20 bg-destructive/5',
    info: 'border-info/20 bg-info/5'
  };

  const iconStyles = {
    default: 'text-muted-foreground',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    info: 'text-info'
  };

  return (
    <Card className={cn('relative overflow-hidden h-[160px] flex flex-col justify-center', variantStyles[variant], onClick && 'cursor-pointer hover:bg-muted/30 transition-colors duration-200')} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-0">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground leading-tight pr-2">{title}</CardTitle>
        <Icon className={cn('h-4 w-4 shrink-0', iconStyles[variant])} />
      </CardHeader>
      <CardContent className="pb-0">
        <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-2">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-2">
            <span className={cn(
              'text-xs font-medium tabular-nums',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
            <span className="text-xs text-muted-foreground ml-1">az előző hónaphoz képest</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MetricCard;
