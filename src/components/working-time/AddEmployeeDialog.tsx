import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus } from 'lucide-react';

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    employee_name: string;
    employee_type: 'employee' | 'contractor';
    email: string | null;
    phone: string | null;
    hourly_rate: number | null;
  }) => void;
  isSaving: boolean;
}

export function AddEmployeeDialog({
  open,
  onOpenChange,
  onSubmit,
  isSaving,
}: AddEmployeeDialogProps) {
  const [form, setForm] = useState({
    employee_name: '',
    employee_type: 'employee' as 'employee' | 'contractor',
    email: '',
    phone: '',
    hourly_rate: '',
  });

  const reset = () =>
    setForm({
      employee_name: '',
      employee_type: 'employee',
      email: '',
      phone: '',
      hourly_rate: '',
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employee_name.trim()) return;
    onSubmit({
      employee_name: form.employee_name.trim(),
      employee_type: form.employee_type,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      hourly_rate: form.hourly_rate ? parseFloat(form.hourly_rate) : null,
    });
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Új dolgozó hozzáadása
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emp-name">Név *</Label>
            <Input
              id="emp-name"
              value={form.employee_name}
              onChange={(e) =>
                setForm({ ...form, employee_name: e.target.value })
              }
              placeholder="Teljes név"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="emp-type">Típus</Label>
            <Select
              value={form.employee_type}
              onValueChange={(v: 'employee' | 'contractor') =>
                setForm({ ...form, employee_type: v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Bejelentett dolgozó</SelectItem>
                <SelectItem value="contractor">Alvállalkozó</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emp-email">E-mail</Label>
              <Input
                id="emp-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-phone">Telefonszám</Label>
              <Input
                id="emp-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+36..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emp-rate">Óradíj (Ft/óra)</Label>
            <Input
              id="emp-rate"
              type="number"
              step="1"
              min="0"
              value={form.hourly_rate}
              onChange={(e) =>
                setForm({ ...form, hourly_rate: e.target.value })
              }
              placeholder="Pl. 3500"
            />
            <p className="text-xs text-muted-foreground">
              Bejelentett dolgozóknál a bérlistából automatikusan számítódik.
              Alvállalkozóknál itt adható meg manuálisan.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
            >
              Mégse
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Mentés...' : 'Hozzáadás'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
