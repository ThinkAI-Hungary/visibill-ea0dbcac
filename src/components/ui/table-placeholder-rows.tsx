import { TableRow, TableCell } from '@/components/ui/table';

interface TablePlaceholderRowsProps {
    currentCount: number;
    pageSize: number;
    columns: number;
    rowHeight?: string;
}

export function TablePlaceholderRows({
    currentCount,
    pageSize,
    columns,
    rowHeight = 'h-[45px]',
}: TablePlaceholderRowsProps) {
    const emptyRows = pageSize - currentCount;
    if (emptyRows <= 0) return null;

    return (
        <>
            {Array.from({ length: emptyRows }).map((_, i) => (
                <TableRow
                    key={`placeholder-${i}`}
                    className={`${rowHeight} pointer-events-none hover:bg-transparent border-b border-border/20`}
                >
                    {Array.from({ length: columns }).map((_, c) => (
                        <TableCell key={`ph-${i}-${c}`} className="py-0 border-none">
                            &nbsp;
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );
}
