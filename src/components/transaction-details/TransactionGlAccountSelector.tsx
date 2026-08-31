import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ClipboardCheck, Pencil, Undo2, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TransactionItem, BookTransactionGlPayload } from '@/lib/matching/types';

export interface GlAccountItem {
  id: string;
  gl_number: string;
  short_name: string;
}

export interface TransactionGlAccountSelectorProps {
  transaction: TransactionItem;
  glAccounts: GlAccountItem[];
  companyId: string;
  userId?: string;
  presetId?: string;
  isSaving: boolean;
  onBookGl: (payload: BookTransactionGlPayload) => void;
  onUnbookGl: (params: {
    transactionId: string;
    companyId: string;
    userId: string;
    presetId: string;
    originalGlAccountId?: string | null;
  }) => void;
}

export const TransactionGlAccountSelector: React.FC<TransactionGlAccountSelectorProps> = ({
  transaction,
  glAccounts,
  companyId,
  userId,
  presetId,
  isSaving,
  onBookGl,
  onUnbookGl,
}) => {
  const [selectedGlId, setSelectedGlId] = useState(transaction.gl_account_id || '');
  const [isEditingGl, setIsEditingGl] = useState(false);
  const [glSearchQuery, setGlSearchQuery] = useState('');

  const cleanGlNum = (num: any) => (num ? String(num).replace(/\./g, '') : '');

  const handleSaveGl = () => {
    if (!selectedGlId || !userId || !presetId) return;
    const newGlItem = glAccounts.find(gl => gl.id === selectedGlId);
    const newGlNumber = newGlItem?.gl_number || '';

    onBookGl({
      transactionId: transaction.id,
      companyId,
      userId,
      presetId,
      selectedGlId,
      newGlNumber,
      originalGlAccountId: transaction.gl_account_id || null,
    });
    setIsEditingGl(false);
  };

  const handleRemoveGl = () => {
    if (!userId || !presetId) return;
    onUnbookGl({
      transactionId: transaction.id,
      companyId,
      userId,
      presetId,
      originalGlAccountId: transaction.gl_account_id || null,
    });
    setIsEditingGl(false);
    setSelectedGlId('');
  };

  return (
    <>
      <Separator className="my-1" />
      <Card className="bg-muted/30 border-border/50">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
            <ClipboardCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            Közvetlen könyvelés (Számla nélkül)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          {transaction.gl_account_id ? (
            <div className="space-y-2">
              <div className="bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-md p-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    Lekönyvelt számlaosztály:
                  </p>
                  <p className="text-xs font-mono font-bold mt-1 truncate">
                    {(() => {
                      const gl = glAccounts.find(g => g.id === transaction.gl_account_id);
                      return gl
                        ? `${gl.gl_number} ${gl.short_name}`
                        : transaction.gl_account_id;
                    })()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-emerald-800 hover:text-emerald-900 shrink-0"
                  onClick={() => {
                    setSelectedGlId(transaction.gl_account_id || '');
                    setIsEditingGl(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>

              {!isEditingGl && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={handleRemoveGl}
                  className="text-xs w-full text-red-500 hover:text-red-600 border-red-500/30 hover:bg-red-500/10 h-8"
                >
                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                  Könyvelés törlése
                </Button>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Ha a tételhez nem tartozik bizonylat (pl. biztosítási díj, banki jutalék),
              közvetlenül kontírozhatod egy főkönyvi számra.
            </p>
          )}

          {(isEditingGl || !transaction.gl_account_id) && (
            <div className="space-y-2 pt-1">
              <div className="relative">
                <Command
                  className="rounded-lg border shadow-sm w-full overflow-hidden h-[180px]"
                  shouldFilter={false}
                >
                  <CommandInput
                    placeholder="Keresés főkönyvi szám vagy név alapján..."
                    value={glSearchQuery}
                    onValueChange={setGlSearchQuery}
                    className="h-8 text-xs w-full border-none focus:ring-0"
                  />
                  <CommandList className="h-[140px] max-h-[140px] overflow-y-auto w-full overflow-x-hidden">
                    <CommandEmpty className="py-2 text-xs text-center text-muted-foreground">
                      Nincs találat.
                    </CommandEmpty>
                    <CommandGroup>
                      {glAccounts
                        ?.filter(
                          gl =>
                            !glSearchQuery ||
                            `${gl.gl_number} ${gl.short_name}`
                              .toLowerCase()
                              .includes(glSearchQuery.toLowerCase())
                        )
                        .sort((a, b) =>
                          cleanGlNum(a.gl_number).localeCompare(cleanGlNum(b.gl_number))
                        )
                        .map(gl => {
                          // Only show leaf nodes
                          const isLeaf = !glAccounts.some(
                            sub =>
                              cleanGlNum(sub.gl_number).startsWith(cleanGlNum(gl.gl_number)) &&
                              sub.id !== gl.id
                          );
                          if (!isLeaf) return null;

                          return (
                            <CommandItem
                              key={gl.id}
                              value={`${gl.gl_number} ${gl.short_name}`}
                              onSelect={() => setSelectedGlId(gl.id)}
                              className="cursor-pointer py-1.5 px-2.5 text-xs flex items-center justify-between hover:bg-muted/50"
                            >
                              <span
                                className={cn(
                                  'truncate',
                                  selectedGlId === gl.id ? 'font-bold text-foreground' : ''
                                )}
                              >
                                {gl.gl_number} {gl.short_name}
                              </span>
                              {selectedGlId === gl.id && (
                                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              )}
                            </CommandItem>
                          );
                        })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>

              <div className="flex gap-2">
                {isEditingGl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditingGl(false);
                      setSelectedGlId(transaction.gl_account_id || '');
                      setGlSearchQuery('');
                    }}
                    className="text-xs flex-1 h-8"
                  >
                    Mégse
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={
                    !selectedGlId ||
                    isSaving ||
                    transaction.gl_account_id === selectedGlId
                  }
                  onClick={handleSaveGl}
                  className="text-xs flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1" />
                  )}
                  {transaction.gl_account_id
                    ? 'Módosítás mentése'
                    : 'Kontírozás közvetlenül'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};
