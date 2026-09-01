import { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActivePreset } from '@/hooks/useActivePreset';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';
import { useAuth } from '@/contexts/AuthContext';
import { useScopedNavigate } from '@/lib/navigation';
import { InvoiceDetailPopup } from '@/components/InvoiceDetailPopup';
import { computeMatchStatus } from '@/hooks/useComputedStatus';
import { useTransactionMatching } from '@/hooks/useTransactionMatching';
import { TransactionItem } from '@/lib/matching/types';

// Subcomponents
import { TransactionHeader } from './transaction-details/TransactionHeader';
import { TransactionCard } from './transaction-details/TransactionCard';
import { MatchedCourierReportsCard } from './transaction-details/MatchedCourierReportsCard';
import { MatchedEntityCard } from './transaction-details/MatchedEntityCard';
import { TransactionMultiMatchesList } from './transaction-details/TransactionMultiMatchesList';
import { ManualMatchSearchSection } from './transaction-details/ManualMatchSearchSection';
import { TransactionGlAccountSelector } from './transaction-details/TransactionGlAccountSelector';
import { TransactionNotesSection } from './transaction-details/TransactionNotesSection';

export interface TransactionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionItem | null;
  companyId: string;
  onUpdate: () => void;
}

export const TransactionDetailsDialog = ({
  open,
  onOpenChange,
  transaction,
  companyId,
  onUpdate,
}: TransactionDetailsDialogProps) => {
  const scopedNavigate = useScopedNavigate();
  const { session } = useAuth();
  const { activePresetId } = useActivePreset(companyId);

  const [invoiceDetailOpen, setInvoiceDetailOpen] = useState(false);
  const [invoiceDetailId, setInvoiceDetailId] = useState<string | null>(null);

  // Hook connecting domain matching core
  const matching = useTransactionMatching({
    transaction,
    companyId,
    isOpen: open,
    onUpdate,
    onClose: () => onOpenChange(false),
  });

  // GL accounts query for direct ledger booking (paginated)
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glAccounts', activePresetId],
    queryFn: async () => {
      if (!activePresetId) return [];
      return await fetchAllGlAccountsByPreset(activePresetId);
    },
    enabled: !!activePresetId && open,
  });

  if (!transaction) return null;

  const matchStatus = computeMatchStatus(transaction);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="sm:max-w-[540px] max-h-screen overflow-y-auto flex flex-col p-6"
        >
          <TransactionHeader />

          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Transaction metadata & status card */}
            <TransactionCard
              transaction={transaction}
              isSaving={matching.isSaving}
              onRevertStatus={matching.handleRevertStatus}
            />

            {/* Matched Courier Reports */}
            <MatchedCourierReportsCard
              courierReports={matching.matchedCourierReports}
            />

            {/* Matched Entity (Invoice / NAV / Salary) */}
            {transaction.matched_invoice_id && !matching.showManualMatch && (
              <>
                <MatchedEntityCard
                  matchedInvoice={matching.matchedInvoice}
                  matchedNavInvoice={matching.matchedNavInvoice}
                  matchedSalary={matching.matchedSalary}
                  loading={matching.loadingMatchedEntity}
                  matchStatus={matchStatus}
                  isSaving={matching.isSaving}
                  onOpenInvoiceDetails={id => {
                    setInvoiceDetailId(id);
                    setInvoiceDetailOpen(true);
                  }}
                  onNavigateSalaries={() => {
                    onOpenChange(false);
                    scopedNavigate('salaries');
                  }}
                  onVerify={matching.handleVerify}
                  onShowManualMatch={() => matching.setShowManualMatch(true)}
                  onShowAddExtraMatch={() => matching.setShowAddExtraMatch(true)}
                  onUnmatch={matching.handleUnmatch}
                />

                {/* Extra Matches (Split Transactions) */}
                <TransactionMultiMatchesList
                  extraMatches={matching.extraMatches}
                  isSaving={matching.isSaving}
                  onRemoveExtraMatch={matching.handleRemoveExtraMatch}
                  onOpenInvoiceDetails={id => {
                    setInvoiceDetailId(id);
                    setInvoiceDetailOpen(true);
                  }}
                />
              </>
            )}

            {/* Direct Ledger Classification (when no invoice matched) */}
            {!transaction.matched_invoice_id && (
              <TransactionGlAccountSelector
                transaction={transaction}
                glAccounts={glAccounts}
                companyId={companyId}
                userId={session?.user?.id}
                presetId={activePresetId || undefined}
                isSaving={matching.isSaving}
                onBookGl={matching.handleBookGl}
                onUnbookGl={matching.handleUnbookGl}
              />
            )}

            {/* Manual Candidate Search (Primary) */}
            {(matching.showManualMatch || !transaction.matched_invoice_id) && (
              <ManualMatchSearchSection
                mode="primary"
                transaction={transaction}
                candidateInvoices={matching.candidateInvoices}
                search={matching.search}
                setSearch={matching.setSearch}
                selectedInvoiceId={matching.selectedInvoiceId}
                setSelectedInvoiceId={matching.setSelectedInvoiceId}
                loading={matching.loadingAvailableInvoices}
                isSearchingServer={matching.isSearchingServer}
                isSaving={matching.isSaving}
                matchStatus={matchStatus}
                onBack={
                  transaction.matched_invoice_id
                    ? () => matching.setShowManualMatch(false)
                    : undefined
                }
                onMatch={() => matching.handleMatch()}
                onMarkNoInvoice={matching.handleMarkNoInvoice}
                onMarkInvoiceMissing={matching.handleMarkInvoiceMissing}
              />
            )}

            {/* Manual Candidate Search (Extra / Split) */}
            {matching.showAddExtraMatch && (
              <ManualMatchSearchSection
                mode="extra"
                transaction={transaction}
                candidateInvoices={matching.candidateInvoices.filter(
                  inv =>
                    inv.id !== transaction.matched_invoice_id &&
                    !matching.extraMatches.some(em => em.invoice_id === inv.id)
                )}
                search={matching.search}
                setSearch={matching.setSearch}
                selectedInvoiceId={matching.selectedInvoiceId}
                setSelectedInvoiceId={matching.setSelectedInvoiceId}
                loading={matching.loadingAvailableInvoices}
                isSearchingServer={matching.isSearchingServer}
                isSaving={matching.isSaving}
                matchStatus={matchStatus}
                onBack={() => {
                  matching.setShowAddExtraMatch(false);
                  matching.setSelectedInvoiceId(null);
                  matching.setSearch('');
                }}
                onMatch={() => matching.handleAddExtraMatch()}
              />
            )}

            {/* Notes Section */}
            {!matching.showManualMatch && !matching.showAddExtraMatch && (
              <TransactionNotesSection
                transactionId={transaction.id}
                companyId={companyId}
                isOpen={open}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <InvoiceDetailPopup
        open={invoiceDetailOpen}
        onOpenChange={setInvoiceDetailOpen}
        invoiceId={invoiceDetailId}
      />
    </>
  );
};
