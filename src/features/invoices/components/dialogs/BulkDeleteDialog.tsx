import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useInvoiceContext } from '../../context/useInvoiceContext';

export function BulkDeleteDialog() {
  const {
    bulkDeleteDialogOpen,
    setBulkDeleteDialogOpen,
    activeSelection,
    handleBulkDeleteSubmitted,
  } = useInvoiceContext();

  return (
    <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Biztosan törölni szeretnéd a kijelölt bizonylatokat?</AlertDialogTitle>
          <AlertDialogDescription>
            Ez a művelet nem vonható vissza. A kijelölt {activeSelection.size} db számla véglegesen törlődik a rendszerből.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Mégse</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            onClick={async () => {
              await handleBulkDeleteSubmitted();
              setBulkDeleteDialogOpen(false);
            }}
          >
            Törlés
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
