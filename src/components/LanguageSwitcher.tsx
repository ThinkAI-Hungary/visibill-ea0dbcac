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
import { Globe, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  variant?: 'compact' | 'full' | 'header';
  buttonVariant?: 'outline' | 'ghost' | 'default';
  className?: string;
  showText?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  variant = 'header',
  buttonVariant = 'outline',
  className = '',
  showText = true,
}) => {
  const { i18n, t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();

  const currentLang = i18n.language?.startsWith('hr') ? 'hr' : 'hu';

  const switchLanguage = (targetLang: 'hu' | 'hr') => {
    if (targetLang === currentLang) return;

    i18n.changeLanguage(targetLang);

    // Synchronize URL if route routing is used
    const currentPath = location.pathname;
    let nextPath = currentPath;
    if (targetLang === 'hr') {
      if (!currentPath.startsWith('/hr')) {
        nextPath = currentPath === '/' ? '/hr' : `/hr${currentPath}`;
      }
    } else {
      if (currentPath.startsWith('/hr')) {
        nextPath = currentPath.replace(/^\/hr(\/|$)/, '$1') || '/';
      }
    }
    navigate(nextPath + location.search, { replace: true });
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
              variant={buttonVariant}
              size="sm"
              className={cn(
                "h-7 text-xs px-2.5 flex items-center gap-1.5 font-normal text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors",
                className
              )}
              aria-label={t('user.language', { defaultValue: 'Nyelvválasztó' })}
            >
              <Globe className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
              {showText && (
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  {currentLang.toUpperCase()}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {t('user.language', { defaultValue: 'Nyelv / Jezik' })}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-40 bg-card border-border shadow-md">
        <DropdownMenuItem
          onClick={() => switchLanguage('hu')}
          className={`flex items-center justify-between gap-2 cursor-pointer ${currentLang === 'hu' ? 'font-bold bg-accent' : ''}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🇭🇺</span>
            <span>Magyar</span>
          </div>
          {currentLang === 'hu' && <Check className="w-4 h-4 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => switchLanguage('hr')}
          className={`flex items-center justify-between gap-2 cursor-pointer ${currentLang === 'hr' ? 'font-bold bg-accent' : ''}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🇭🇷</span>
            <span>Hrvatski</span>
          </div>
          {currentLang === 'hr' && <Check className="w-4 h-4 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
