import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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

type EmailFormValues = {
  currentPassword: string;
  newEmail: string;
  confirmEmail: string;
};

interface ChangeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChangeEmailDialog = ({ open, onOpenChange }: ChangeEmailDialogProps) => {
  const { t } = useTranslation(['settings', 'common']);
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const emailSchema = useMemo(() => z.object({
    currentPassword: z.string().min(1, t('settings:change_email_dialog.validation.password_required')),
    newEmail: z
      .string()
      .min(1, t('settings:change_email_dialog.validation.email_required'))
      .email(t('settings:change_email_dialog.validation.email_invalid')),
    confirmEmail: z.string().min(1, t('settings:change_email_dialog.validation.confirm_email_required')),
  }).refine((data) => data.newEmail === data.confirmEmail, {
    message: t('settings:change_email_dialog.validation.emails_mismatch'),
    path: ['confirmEmail'],
  }), [t]);

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
        message: t('settings:change_email_dialog.validation.email_same'),
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
        message: t('settings:change_email_dialog.validation.wrong_password'),
      });
      return;
    }

    // 2. Password verified — now request email change.
    // emailRedirectTo ensures the confirmation link goes to /auth/callback so the
    // IIFE captures the type=email_change hash/params before Supabase clears them.
    const { error } = await supabase.auth.updateUser({
      email: data.newEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);

    if (error) {
      const msg = error.message.toLowerCase();
      let description = t('settings:change_email_dialog.errors.failed');
      if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('email address already')) {
        description = t('settings:change_email_dialog.errors.already_in_use');
      } else if (msg.includes('invalid email')) {
        description = t('settings:change_email_dialog.errors.invalid_format');
      } else if (msg.includes('rate limit') || msg.includes('too many')) {
        description = t('settings:change_email_dialog.errors.rate_limit');
      }
      toast({ variant: 'destructive', title: t('common:status.error'), description });
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
            {t('settings:change_email_dialog.title')}
          </DialogTitle>
          <DialogDescription>
            {sent
              ? t('settings:change_email_dialog.description_sent')
              : t('settings:change_email_dialog.description_current', { email: user?.email })}
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <div className="space-y-1">
                <p className="font-medium">{t('settings:change_email_dialog.confirmation_required')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('settings:change_email_dialog.confirmation_desc')}
                </p>
              </div>
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              {t('settings:change_email_dialog.close')}
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
                    <FormLabel>{t('settings:change_email_dialog.new_email_label')}</FormLabel>
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
                    <FormLabel>{t('settings:change_email_dialog.confirm_email_label')}</FormLabel>
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
                    <FormLabel>{t('settings:change_email_dialog.current_password_label')}</FormLabel>
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
                          aria-label={showPassword ? t('settings:change_email_dialog.hide_password') : t('settings:change_email_dialog.show_password')}
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
                {t('settings:change_email_dialog.info_text')}
              </p>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={loading}
                >
                  {t('settings:change_email_dialog.cancel')}
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? t('settings:change_email_dialog.verifying') : t('settings:change_email_dialog.submit')}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
