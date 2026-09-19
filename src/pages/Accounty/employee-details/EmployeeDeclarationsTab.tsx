import React from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useRevokeDeclaration,
  type PayrollDeclaration,
} from '@/hooks/usePayrollData';
import { DECLARATION_TYPES, NewDeclarationDialog, EditDeclarationDialog } from './DeclarationDialogs';

interface EmployeeDeclarationsTabProps {
  declarations: PayrollDeclaration[];
  empId: string;
  showNewDeclaration: boolean;
  setShowNewDeclaration: (v: boolean) => void;
  editingDeclaration: PayrollDeclaration | null;
  setEditingDeclaration: (v: PayrollDeclaration | null) => void;
}

export function EmployeeDeclarationsTab({
  declarations,
  empId,
  showNewDeclaration,
  setShowNewDeclaration,
  editingDeclaration,
  setEditingDeclaration,
}: EmployeeDeclarationsTabProps) {
  const revokeDeclaration = useRevokeDeclaration();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground/90">Adóelőleg-nyilatkozatok</h3>
        <Button variant="outline" size="sm" className="flex items-center gap-1" onClick={() => setShowNewDeclaration(true)}>
          <Plus className="w-3 h-3" /> Új nyilatkozat
        </Button>
      </div>

      {/* New Declaration Dialog */}
      {showNewDeclaration && (
        <NewDeclarationDialog
          employeeId={empId}
          onClose={() => setShowNewDeclaration(false)}
        />
      )}

      {/* Edit Declaration Dialog */}
      {editingDeclaration && (
        <EditDeclarationDialog
          declaration={editingDeclaration}
          employeeId={empId}
          onClose={() => setEditingDeclaration(null)}
        />
      )}

      {declarations.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Nincs rögzített nyilatkozat</div>
      ) : (
        <div className="space-y-2">
          {declarations.map((d) => (
            <div key={d.id} className={cn(
              'p-4 rounded-lg border flex items-center justify-between transition-colors',
              d.status === 'revoked'
                ? 'border-border/50 opacity-60'
                : 'border-border hover:border-primary/30'
            )}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {DECLARATION_TYPES.find(t => t.value === d.declaration_type)?.label || d.declaration_type.replace(/_/g, ' ')}
                  </p>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                    d.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                    d.status === 'revoked' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                    'bg-muted text-muted-foreground dark:bg-muted'
                  )}>
                    {d.status === 'active' ? 'Aktív' : d.status === 'revoked' ? 'Visszavont' : d.status === 'expired' ? 'Lejárt' : d.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Érvényes: {d.valid_from}{d.valid_until ? ` – ${d.valid_until}` : ' –'}
                  {['family', 'anyak_3', 'anyak_2', 'netak'].includes(d.declaration_type) && (() => {
                    const cnt = (d.parameters as any)?.children_count ?? (Array.isArray((d.parameters as any)?.children) ? (d.parameters as any).children.length : undefined);
                    return cnt ? <span className="ml-2">· {cnt} eltartott</span> : null;
                  })()}
                </p>
              </div>
              {d.status === 'active' && (
                <div className="flex items-center gap-1 ml-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    title="Szerkesztés"
                    onClick={() => setEditingDeclaration(d)}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-500"
                    title="Visszavonás"
                    disabled={revokeDeclaration.isPending}
                    onClick={() => {
                      if (window.confirm('Biztosan visszavonod ezt a nyilatkozatot?')) {
                        revokeDeclaration.mutate({ id: d.id, employee_id: empId });
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
