import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, X, Edit3, Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { supabase } from '@/integrations/supabase/client';
import {
  useAddDeclaration, useUpdateDeclaration,
  type PayrollDeclaration
} from '@/hooks/usePayrollData';

export const DECLARATION_TYPES = [
  { value: 'family', label: 'Családi kedvezmény' },
  { value: 'first_marriage', label: 'Első házasok kedvezménye' },
  { value: 'young_25', label: '25 év alattiak SZJA mentessége' },
  { value: 'young_mother_30', label: '30 év alatti anyák kedvezménye' },
  { value: 'netak', label: 'Négy vagy több gyermekes anyák (NÉTAK)' },
  { value: 'anyak_3', label: '3 gyermekes anyák kedvezménye' },
  { value: 'anyak_2', label: '2 gyermekes anyák kedvezménye (40 év alatt)' },
  { value: 'anyacska', label: 'Összevont anyák + családi (2026)' },
  { value: 'personal', label: 'Személyi kedvezmény (fogyatékosság)' },
  { value: 'ekho', label: 'EKHO nyilatkozat' },
] as const;

const selectClassName = "w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all appearance-none bg-[length:16px_16px] bg-[right_10px_center] bg-no-repeat";
const selectStyle = { backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")` };

export interface ChildItem {
  id?: string;
  birth_name: string;
  tax_id: string;
  birth_date: string;
  is_fetus?: boolean;
}

export function normalizeChildItem(c: any): ChildItem {
  return {
    id: c?.id || undefined,
    birth_name: (c?.birth_name || c?.name || c?.child_name || '').toString(),
    tax_id: (c?.tax_id || c?.taxId || '').toString(),
    birth_date: (c?.birth_date || c?.birthDate || '').toString(),
    is_fetus: Boolean(c?.is_fetus ?? c?.isFetus ?? c?.fetus ?? false),
  };
}

// ── New Declaration Dialog ──

export function NewDeclarationDialog({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const addDeclaration = useAddDeclaration();
  const [type, setType] = useState('family');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');
  
  // Children list with tax ID and birth date
  const [children, setChildren] = useState<ChildItem[]>([
    { birth_name: '', tax_id: '', birth_date: '', is_fetus: false }
  ]);
  const hasUserEdited = useRef(false);

  // Fetch existing dependents for this employee to pre-fill or suggest
  useEffect(() => {
    if (!employeeId) return;
    let isMounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('accounty_dependents')
          .select('*')
          .eq('employee_id', employeeId)
          .order('created_at', { ascending: true });
        
        if (!isMounted || !data || data.length === 0) return;
        if (hasUserEdited.current) return;

        setChildren(data.map(d => ({
          id: d.id,
          birth_name: d.birth_name || '',
          tax_id: d.tax_id || '',
          birth_date: d.birth_date || '',
          is_fetus: !!d.is_fetus,
        })));
      } catch (err) {
        console.error('Error fetching dependents for new declaration:', err);
      }
    })();
    return () => { isMounted = false; };
  }, [employeeId]);

  const handleAddChild = () => {
    hasUserEdited.current = true;
    setChildren(prev => [...prev, { birth_name: '', tax_id: '', birth_date: '', is_fetus: false }]);
  };

  const handleRemoveChild = (index: number) => {
    hasUserEdited.current = true;
    setChildren(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateChild = (index: number, field: keyof ChildItem, value: any) => {
    hasUserEdited.current = true;
    setChildren(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async () => {
    const params: Record<string, unknown> = {};
    if (type === 'family' || type === 'anyak_3' || type === 'anyak_2' || type === 'netak') {
      const validChildren = children.filter(c => c.birth_name.trim() || c.tax_id.trim() || c.birth_date.trim());
      params.children_count = validChildren.length > 0 ? validChildren.length : children.length;
      params.children = children.map(c => ({
        id: c.id,
        birth_name: c.birth_name.trim(),
        tax_id: c.tax_id.trim(),
        birth_date: c.birth_date || '',
        is_fetus: Boolean(c.is_fetus),
      }));

      // Also persist / upsert to accounty_dependents if valid details provided
      for (const ch of children) {
        if (ch.birth_name.trim()) {
          try {
            if (ch.id) {
              await supabase.from('accounty_dependents').update({
                birth_name: ch.birth_name.trim(),
                tax_id: ch.tax_id.trim() || null,
                birth_date: ch.birth_date || null,
                is_fetus: Boolean(ch.is_fetus),
              }).eq('id', ch.id);
            } else {
              let existingId: string | null = null;
              if (ch.tax_id.trim()) {
                const { data: existingDep } = await supabase
                  .from('accounty_dependents')
                  .select('id')
                  .eq('employee_id', employeeId)
                  .eq('tax_id', ch.tax_id.trim())
                  .maybeSingle();
                if (existingDep?.id) {
                  existingId = existingDep.id;
                }
              }

              if (existingId) {
                await supabase.from('accounty_dependents').update({
                  birth_name: ch.birth_name.trim(),
                  tax_id: ch.tax_id.trim() || null,
                  birth_date: ch.birth_date || null,
                  is_fetus: Boolean(ch.is_fetus),
                }).eq('id', existingId);
                ch.id = existingId;
              } else {
                const { data: newDep } = await supabase.from('accounty_dependents').insert({
                  employee_id: employeeId,
                  birth_name: ch.birth_name.trim(),
                  tax_id: ch.tax_id.trim() || null,
                  birth_date: ch.birth_date || null,
                  is_fetus: Boolean(ch.is_fetus),
                }).select('id').single();
                if (newDep?.id) {
                  ch.id = newDep.id;
                }
              }
            }
          } catch (err) {
            console.error('Error saving dependent:', err);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['payroll', 'dependents', employeeId] });
    }

    addDeclaration.mutate({
      employee_id: employeeId,
      declaration_type: type,
      valid_from: validFrom,
      valid_until: validUntil || undefined,
      parameters: params,
    }, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="mb-6 p-5 rounded-lg border-2 border-primary/30 bg-primary/5 dark:bg-primary/10 space-y-4 page-animate slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground">Új adóelőleg-nyilatkozat</h4>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nyilatkozat típusa</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={selectClassName}
            style={selectStyle}
          >
            {DECLARATION_TYPES.map((dt) => (
              <option key={dt.value} value={dt.value}>{dt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Érvényes ettől</label>
          <DatePicker
            value={validFrom}
            onChange={setValidFrom}
            placeholder="éééé. hh. nn."
            clearable
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Érvényes eddig (opcionális)</label>
          <DatePicker
            value={validUntil}
            onChange={setValidUntil}
            placeholder="éééé. hh. nn."
            clearable
            className="w-full"
          />
        </div>

        {/* Children details for family tax credit */}
        {(type === 'family' || type === 'anyak_3' || type === 'anyak_2' || type === 'netak') && (
          <div className="md:col-span-2 space-y-3 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-primary" />
                Gyermekek / Eltartottak adatai (Családi kedvezményhez és NAV 08-hoz kötelező):
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddChild}
                className="text-xs h-7 gap-1"
              >
                <Plus className="w-3 h-3" /> Gyermek hozzáadása
              </Button>
            </div>

            <div className="space-y-2">
              {children.map((child, idx) => (
                <div key={idx} className="p-3 bg-background rounded-lg border border-border grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs">
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Gyermek neve *</label>
                    <Input
                      value={child.birth_name}
                      onChange={(e) => handleUpdateChild(idx, 'birth_name', e.target.value)}
                      placeholder="pl. Kis Ádám"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Adóazonosító jel *</label>
                    <Input
                      value={child.tax_id}
                      onChange={(e) => handleUpdateChild(idx, 'tax_id', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="8XXXXXXXXX"
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Születési dátum *</label>
                    <Input
                      type="date"
                      value={child.birth_date}
                      onChange={(e) => handleUpdateChild(idx, 'birth_date', e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="sm:col-span-1 flex flex-col items-center justify-center">
                    <label className="text-[10px] text-muted-foreground mb-0.5">Magzat</label>
                    <Checkbox
                      checked={child.is_fetus}
                      onCheckedChange={(c) => handleUpdateChild(idx, 'is_fetus', Boolean(c))}
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    {children.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveChild(idx)}
                        className="h-7 w-7 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              A NAV 08 bevallás M-lapjain kötelező a gyermek adóazonosító jele és születési dátuma a családi adó- és járulékkedvezmény jogszerű érvényesítéséhez.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Mégse
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={addDeclaration.isPending || !validFrom}
          className="flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Check className="w-3 h-3" />
          {addDeclaration.isPending ? 'Mentés...' : 'Mentés'}
        </Button>
      </div>
    </div>
  );
}

// ── Edit Declaration Dialog ──

export function EditDeclarationDialog({
  declaration,
  employeeId,
  onClose,
}: {
  declaration: PayrollDeclaration;
  employeeId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const updateDeclaration = useUpdateDeclaration();
  const [type] = useState(declaration.declaration_type);
  const [validFrom, setValidFrom] = useState(declaration.valid_from);
  const [validUntil, setValidUntil] = useState(declaration.valid_until || '');
  
  const existingParams = (declaration.parameters as any) || {};
  const rawParamChildren: any[] = Array.isArray(existingParams.children)
    ? existingParams.children
    : Array.isArray(existingParams.dependents)
    ? existingParams.dependents
    : [];

  const initialParsed = rawParamChildren
    .map(normalizeChildItem)
    .filter(c => c.birth_name.trim() || c.tax_id.trim() || c.birth_date.trim() || c.id);

  const initialTargetCount = Math.max(
    Number(existingParams.children_count) || 0,
    initialParsed.length,
    1
  );

  const getInitialChildren = (): ChildItem[] => {
    const list = [...initialParsed];
    while (list.length < initialTargetCount) {
      list.push({ birth_name: '', tax_id: '', birth_date: '', is_fetus: false });
    }
    return list;
  };

  const [children, setChildren] = useState<ChildItem[]>(getInitialChildren);
  const hasUserEdited = useRef(false);

  // Fetch existing dependents for this employee to pre-fill, enrich or match
  useEffect(() => {
    if (!employeeId) return;
    let isMounted = true;

    (async () => {
      try {
        const { data: dbDependents, error } = await supabase
          .from('accounty_dependents')
          .select('*')
          .eq('employee_id', employeeId)
          .order('created_at', { ascending: true });

        if (!isMounted || error || !dbDependents) return;
        if (hasUserEdited.current) return;

        const normalizedDb: ChildItem[] = dbDependents.map(d => ({
          id: d.id,
          birth_name: d.birth_name || '',
          tax_id: d.tax_id || '',
          birth_date: d.birth_date || '',
          is_fetus: Boolean(d.is_fetus),
        }));

        setChildren(current => {
          if (hasUserEdited.current) return current;

          const targetCount = Math.max(
            Number(existingParams.children_count) || 0,
            initialParsed.length,
            normalizedDb.length,
            1
          );

          let merged: ChildItem[] = [];

          if (initialParsed.length > 0) {
            // Match with DB records by id, tax_id or name
            merged = initialParsed.map(ch => {
              const matched = normalizedDb.find(d =>
                (ch.id && d.id === ch.id) ||
                (ch.tax_id && d.tax_id && d.tax_id === ch.tax_id) ||
                (ch.birth_name && d.birth_name && d.birth_name.trim().toLowerCase() === ch.birth_name.trim().toLowerCase())
              );
              if (matched) {
                return {
                  ...matched,
                  ...ch,
                  id: matched.id,
                  tax_id: ch.tax_id || matched.tax_id,
                  birth_date: ch.birth_date || matched.birth_date,
                  birth_name: ch.birth_name || matched.birth_name,
                };
              }
              return ch;
            });

            // If DB has more records that weren't matched and we need them up to targetCount
            for (const dbChild of normalizedDb) {
              if (merged.length >= targetCount) break;
              if (!merged.some(m => m.id === dbChild.id || (m.tax_id && dbChild.tax_id && m.tax_id === dbChild.tax_id))) {
                merged.push(dbChild);
              }
            }
          } else if (normalizedDb.length > 0) {
            merged = [...normalizedDb];
          }

          while (merged.length < targetCount) {
            merged.push({ birth_name: '', tax_id: '', birth_date: '', is_fetus: false });
          }

          return merged.length > 0 ? merged : current;
        });
      } catch (err) {
        console.error('Error fetching dependents for edit declaration:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [employeeId]);

  const handleAddChild = () => {
    hasUserEdited.current = true;
    setChildren(prev => [...prev, { birth_name: '', tax_id: '', birth_date: '', is_fetus: false }]);
  };

  const handleRemoveChild = (index: number) => {
    hasUserEdited.current = true;
    setChildren(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateChild = (index: number, field: keyof ChildItem, value: any) => {
    hasUserEdited.current = true;
    setChildren(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async () => {
    const params: Record<string, unknown> = { ...(declaration.parameters as Record<string, unknown>) };
    if (type === 'family' || type === 'anyak_3' || type === 'anyak_2' || type === 'netak') {
      const validChildren = children.filter(c => c.birth_name.trim() || c.tax_id.trim() || c.birth_date.trim());
      params.children_count = validChildren.length > 0 ? validChildren.length : children.length;
      params.children = children.map(c => ({
        id: c.id,
        birth_name: c.birth_name.trim(),
        tax_id: c.tax_id.trim(),
        birth_date: c.birth_date || '',
        is_fetus: Boolean(c.is_fetus),
      }));

      // Upsert into accounty_dependents
      for (const ch of children) {
        if (ch.birth_name.trim()) {
          try {
            if (ch.id) {
              await supabase.from('accounty_dependents').update({
                birth_name: ch.birth_name.trim(),
                tax_id: ch.tax_id.trim() || null,
                birth_date: ch.birth_date || null,
                is_fetus: Boolean(ch.is_fetus),
              }).eq('id', ch.id);
            } else {
              let existingId: string | null = null;
              if (ch.tax_id.trim()) {
                const { data: existingDep } = await supabase
                  .from('accounty_dependents')
                  .select('id')
                  .eq('employee_id', employeeId)
                  .eq('tax_id', ch.tax_id.trim())
                  .maybeSingle();
                if (existingDep?.id) {
                  existingId = existingDep.id;
                }
              }

              if (existingId) {
                await supabase.from('accounty_dependents').update({
                  birth_name: ch.birth_name.trim(),
                  tax_id: ch.tax_id.trim() || null,
                  birth_date: ch.birth_date || null,
                  is_fetus: Boolean(ch.is_fetus),
                }).eq('id', existingId);
                ch.id = existingId;
              } else {
                const { data: newDep } = await supabase.from('accounty_dependents').insert({
                  employee_id: employeeId,
                  birth_name: ch.birth_name.trim(),
                  tax_id: ch.tax_id.trim() || null,
                  birth_date: ch.birth_date || null,
                  is_fetus: Boolean(ch.is_fetus),
                }).select('id').single();
                if (newDep?.id) {
                  ch.id = newDep.id;
                }
              }
            }
          } catch (err) {
            console.error('Error updating dependent:', err);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['payroll', 'dependents', employeeId] });
    }

    updateDeclaration.mutate({
      id: declaration.id,
      employee_id: employeeId,
      declaration_type: type,
      valid_from: validFrom,
      valid_until: validUntil || null,
      parameters: params,
    }, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="mb-6 p-5 rounded-lg border-2 border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 space-y-4 page-animate slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-amber-500" />
          Nyilatkozat szerkesztése
        </h4>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nyilatkozat típusa</label>
          <div className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-sm text-muted-foreground dark:text-foreground/90 cursor-not-allowed">
            {DECLARATION_TYPES.find(t => t.value === type)?.label || type}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Érvényes ettől</label>
          <DatePicker
            value={validFrom}
            onChange={setValidFrom}
            placeholder="éééé. hh. nn."
            clearable
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Érvényes eddig (opcionális)</label>
          <DatePicker
            value={validUntil}
            onChange={setValidUntil}
            placeholder="éééé. hh. nn."
            clearable
            className="w-full"
          />
        </div>

        {(type === 'family' || type === 'anyak_3' || type === 'anyak_2' || type === 'netak') && (
          <div className="md:col-span-2 space-y-3 pt-2 border-t border-border/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-600" />
                Gyermekek adatai (Adóazonosító és Születési dátum):
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddChild}
                className="text-xs h-7 gap-1"
              >
                <Plus className="w-3 h-3" /> Gyermek hozzáadása
              </Button>
            </div>

            <div className="space-y-2">
              {children.map((child, idx) => (
                <div key={idx} className="p-3 bg-background rounded-lg border border-border grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs">
                  <div className="sm:col-span-4">
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Gyermek neve *</label>
                    <Input
                      value={child.birth_name}
                      onChange={(e) => handleUpdateChild(idx, 'birth_name', e.target.value)}
                      placeholder="pl. Kis Ádám"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Adóazonosító jel *</label>
                    <Input
                      value={child.tax_id}
                      onChange={(e) => handleUpdateChild(idx, 'tax_id', e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="8XXXXXXXXX"
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Születési dátum *</label>
                    <Input
                      type="date"
                      value={child.birth_date}
                      onChange={(e) => handleUpdateChild(idx, 'birth_date', e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="sm:col-span-1 flex flex-col items-center justify-center">
                    <label className="text-[10px] text-muted-foreground mb-0.5">Magzat</label>
                    <Checkbox
                      checked={child.is_fetus}
                      onCheckedChange={(c) => handleUpdateChild(idx, 'is_fetus', Boolean(c))}
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    {children.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveChild(idx)}
                        className="h-7 w-7 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              A NAV 08 bevallás M-lapjain kötelező a gyermek adóazonosító jele és születési dátuma a családi adó- és járulékkedvezmény jogszerű érvényesítéséhez.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Mégse
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={updateDeclaration.isPending || !validFrom}
          className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Check className="w-3 h-3" />
          {updateDeclaration.isPending ? 'Mentés...' : 'Módosítás mentése'}
        </Button>
      </div>
    </div>
  );
}
