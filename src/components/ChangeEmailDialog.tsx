import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Mail, CheckCircle2, Eye, EyeOff } from 'lucide-react';

const emailSchema = z.object({
  currentPassword: z.string().min(1, 'A jelszó megadása kötelező'),
  newEmail: z
    .string()
    .min(1, 'Az email cím megadása kötelező')
    .email('Érvénytelen email cím formátum'),
  confirmEmail: z.string().min(1, 'Az email cím megerősítése kötelező'),
}).refine((data) => data.newEmail === data.confirmEmail, {
  message: 'A két email cím nem egyezik',
  path: ['confirmEmail'],
});

type EmailFormValues = z.infer<typeof emailSchema>;

interface ChangeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChangeEmailDialog = ({ open, onOpenChange }: ChangeEmailDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      currentPassword: '',
      newEmail: '',
      confirmEmail: '',
    },
  });

  const onSubmit = async (data: EmailFormValues) => {
    if (data.newEmail === user?.email) {
      form.setError('newEmail', {
        message: 'Az új email cím nem lehet ugyanaz, mint a jelenlegi',
      });
      return;
    }

    setLoading(true);

    // 1. Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email ?? '',
      password: data.currentPassword,
    });

    if (signInError) {
      setLoading(false);
      form.setError('currentPassword', {
        message: 'Helytelen jelszó. Kérjük ellenőrizd és próbáld újra.',
      });
      return;
    }

    // 2. Password verified — now request email change
    const { error } = await supabase.auth.updateUser({ email: data.newEmail });
    setLoading(false);

    if (error) {
      const msg = error.message.toLowerCase();
      let description = 'Az email cím módosítása sikertelen. Kérjük próbáld újra.';
      if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('email address already')) {
        description = 'Ez az email cím már használatban van.';
      } else if (msg.includes('invalid email')) {
        description = 'Érvénytelen email cím formátum.';
      } else if (msg.includes('rate limit') || msg.includes('too many')) {
        description = 'Túl sok próbálkozás. Kérjük várj egy kicsit, majd próbáld újra.';
      }
      toast({ variant: 'destructive', title: 'Hiba történt', description });
    } else {
      setSent(true);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      form.reset();
      setSent(false);
      setShowPassword(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email cím módosítása
          </DialogTitle>
          <DialogDescription>
            {sent
              ? 'Ellenőrzési emailt küldtünk az új email címedre.'
              : `Jelenlegi email cím: ${user?.email}`}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <div className="space-y-1">
                <p className="font-medium">Megerősítés szükséges</p>
                <p className="text-sm text-muted-foreground">
                  Küldtünk egy megerősítő emailt az <strong>új</strong> email
                  címedre. Kattints a levélben lévő linkre a változtatás
                  érvényesítéséhez.
                </p>
              </div>
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              Bezárás
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              <FormField
                control={form.control}
                name="newEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Új email cím</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="uj@pelda.hu"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Új email cím megerősítése</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="uj@pelda.hu"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Current password — verification step, last */}
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jelenlegi jelszó</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          {...field}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="text-xs text-muted-foreground">
                A módosítás érvényesítéséhez megerősítő emailt küldünk az új
                email címedre. A jelenlegi cím addig érvényes marad.
              </p>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={loading}
                >
                  Mégse
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Ellenőrzés...' : 'Megerősítő email küldése'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
