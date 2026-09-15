import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { SearchX, FileQuestion, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
    title,
    description,
    onClearFilters,
    clearLabel,
}: TableEmptyStateProps) {
    const { t } = useTranslation(['common']);
    const effectiveTitle = title ?? t('common:table_empty_state.title', 'Nincs megjeleníthető adat');
    const effectiveDescription = description ?? t('common:table_empty_state.description', 'Próbáld módosítani a szűrőket vagy keresési feltételeket.');
    const effectiveClearLabel = clearLabel ?? t('common:table_empty_state.clear_filters', 'Szűrők törlése');

    return (
        <TableRow className="hover:bg-transparent">
            <TableCell colSpan={colSpan} className="h-48">
                <div className="flex flex-col items-center justify-center gap-3 py-8">
                    <div className="rounded-xl bg-muted/50 p-4">
                        <Icon className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <div className="text-center space-y-1">
                        <h3 className="text-base font-bold tracking-tight text-foreground">
                            {effectiveTitle}
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            {effectiveDescription}
                        </p>
                    </div>
                    {onClearFilters && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onClearFilters}
                            className="mt-2 text-primary border-primary/30 hover:bg-primary/10 hover:text-primary"
                        >
                            {effectiveClearLabel}
                        </Button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );
}
