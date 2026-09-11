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
import { Eye, EyeOff } from 'lucide-react';

type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChangePasswordDialog = ({ open, onOpenChange }: ChangePasswordDialogProps) => {
  const { t } = useTranslation('settings');
  const { updatePassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordSchema = useMemo(() => z.object({
    currentPassword: z.string().min(1, t('change_password_dialog.validation.current_password_required')),
    newPassword: z.string().min(8, t('change_password_dialog.validation.new_password_min')),
    confirmPassword: z.string().min(1, t('change_password_dialog.validation.confirm_password_required')),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('change_password_dialog.validation.passwords_mismatch'),
    path: ['confirmPassword'],
  }).refine((data) => data.currentPassword !== data.newPassword, {
    message: t('change_password_dialog.validation.new_password_same'),
    path: ['newPassword'],
  }), [t]);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: PasswordFormValues) => {
    setLoading(true);
    const { error } = await updatePassword(data.currentPassword, data.newPassword);
    setLoading(false);

    if (!error) {
      form.reset();
      onOpenChange(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: '', color: '' };
    if (password.length < 8) return { strength: t('change_password_dialog.strength_weak'), color: 'text-destructive' };
    if (password.length < 12) return { strength: t('change_password_dialog.strength_medium'), color: 'text-yellow-600' };
    return { strength: t('change_password_dialog.strength_strong'), color: 'text-green-600' };
  };

  const newPasswordValue = form.watch('newPassword');
  const passwordStrength = getPasswordStrength(newPasswordValue);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('change_password_dialog.title')}</DialogTitle>
          <DialogDescription>
            {t('change_password_dialog.description')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('change_password_dialog.current_password_label')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showCurrentPassword ? 'text' : 'password'}
                        placeholder={t('change_password_dialog.current_password_placeholder')}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('change_password_dialog.new_password_label')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder={t('change_password_dialog.new_password_placeholder')}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  {passwordStrength.strength && (
                    <p className={`text-sm ${passwordStrength.color}`}>
                      {t('change_password_dialog.strength_prefix')} {passwordStrength.strength}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('change_password_dialog.confirm_password_label')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder={t('change_password_dialog.confirm_password_placeholder')}
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                {t('change_password_dialog.cancel')}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? t('change_password_dialog.submitting') : t('change_password_dialog.submit')}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
