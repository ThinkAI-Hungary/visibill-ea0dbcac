import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { SearchX, FileQuestion, type LucideIcon } from 'lucide-react';

interface TableEmptyStateProps {
    colSpan: number;
    icon?: LucideIcon;
    title?: string;
    description?: string;
    onClearFilters?: () => void;
    clearLabel?: string;
}

export function TableEmptyState({
    colSpan,
    icon: Icon = SearchX,
    title = 'Nincs megjeleníthető adat',
    description = 'Próbáld módosítani a szűrőket vagy keresési feltételeket.',
    onClearFilters,
    clearLabel = 'Szűrők törlése',
}: TableEmptyStateProps) {
    return (
        <TableRow className="hover:bg-transparent">
            <TableCell colSpan={colSpan} className="h-48">
                <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <div className="rounded-xl bg-muted/50 p-4">
                        <Icon className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <div className="text-center space-y-1">
                        <h3 className="text-base font-bold tracking-tight text-foreground">
                            {title}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            {description}
                        </p>
                    </div>
                    {onClearFilters && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onClearFilters}
                            className="mt-2 text-primary border-primary/30 hover:bg-primary/10 hover:text-primary"
                        >
                            {clearLabel}
                        </Button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
}
