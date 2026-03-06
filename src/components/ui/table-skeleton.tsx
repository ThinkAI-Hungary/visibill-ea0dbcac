import { TableRow, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface TableSkeletonProps {
    rows?: number;
    columns: number;
    /** Column width patterns: 'narrow' | 'medium' | 'wide' for varied widths */
    columnWidths?: ('narrow' | 'medium' | 'wide')[];
}

export function TableSkeleton({ rows = 8, columns, columnWidths }: TableSkeletonProps) {
    const getWidth = (index: number): string => {
        if (columnWidths && columnWidths[index]) {
            switch (columnWidths[index]) {
                case 'narrow': return 'w-12';
                case 'medium': return 'w-24';
                case 'wide': return 'w-36';
            }
        }
        // Default pattern for visual variety
        const pattern = ['w-16', 'w-28', 'w-20', 'w-32', 'w-24', 'w-16', 'w-20', 'w-28'];
        return pattern[index % pattern.length];
    };

    return (
        <>
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <TableRow
                    key={`skeleton-${rowIndex}`}
                    className="hover:bg-transparent border-border/30"
                    style={{
                        animationDelay: `${rowIndex * 75}ms`,
                    }}
                >
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <TableCell key={`skeleton-${rowIndex}-${colIndex}`} className="py-2.5">
                            <Skeleton
                                className={`h-4 ${getWidth(colIndex)} bg-muted/50 rounded`}
                                style={{
                                    animationDelay: `${rowIndex * 75 + colIndex * 30}ms`,
                                }}
                            />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );
}
