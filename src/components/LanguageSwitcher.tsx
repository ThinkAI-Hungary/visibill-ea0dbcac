import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface LanguageSwitcherProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ variant = 'compact', className = '' }) => {
  const { i18n, t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();

  const currentLang = i18n.language?.startsWith('hr') ? 'hr' : 'hu';

  const switchLanguage = (targetLang: 'hu' | 'hr') => {
    if (targetLang === currentLang) return;

    i18n.changeLanguage(targetLang);

    // Synchronize URL if route routing is used
    const currentPath = location.pathname;
    if (targetLang === 'hr') {
      if (!currentPath.startsWith('/hr')) {
        const nextPath = currentPath === '/' ? '/hr' : `/hr${currentPath}`;
        navigate(nextPath, { replace: true });
      }
    } else {
      if (currentPath.startsWith('/hr')) {
        const nextPath = currentPath.replace(/^\/hr(\/|$)/, '$1') || '/';
        navigate(nextPath, { replace: true });
      }
    }
  };

  if (variant === 'full') {
    return (
      <div className={`flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/40 ${className}`}>
        <Button
          size="sm"
          variant={currentLang === 'hu' ? 'default' : 'ghost'}
          onClick={() => switchLanguage('hu')}
          className="h-7 text-xs px-2.5 font-medium gap-1.5"
        >
          <span>🇭🇺</span> Magyar
        </Button>
        <Button
          size="sm"
          variant={currentLang === 'hr' ? 'default' : 'ghost'}
          onClick={() => switchLanguage('hr')}
          className="h-7 text-xs px-2.5 font-medium gap-1.5"
        >
          <span>🇭🇷</span> Hrvatski
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={`h-8 w-8 hover:bg-primary/10 hover:text-primary hover:border-primary/30 text-xs font-semibold ${className}`}
              aria-label={t('user.language')}
            >
              {currentLang === 'hr' ? '🇭🇷' : '🇭🇺'}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{t('user.language')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem
          onClick={() => switchLanguage('hu')}
          className={`gap-2 cursor-pointer ${currentLang === 'hu' ? 'font-bold bg-accent' : ''}`}
        >
          <span className="text-base">🇭🇺</span>
          <span>Magyar</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => switchLanguage('hr')}
          className={`gap-2 cursor-pointer ${currentLang === 'hr' ? 'font-bold bg-accent' : ''}`}
        >
          <span className="text-base">🇭🇷</span>
          <span>Hrvatski</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
