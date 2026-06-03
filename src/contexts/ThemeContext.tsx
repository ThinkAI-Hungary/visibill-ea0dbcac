import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { STORAGE_KEYS } from '@/lib/constants';
import { safeStorage } from '@/lib/storage';

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = safeStorage.getItem(STORAGE_KEYS.THEME) as Theme | null;
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    applyTheme(theme);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(newTheme);
  };

  const setTheme = useCallback((newTheme: Theme) => {
    const body = document.body;

    // Suppress per-element transitions AND animations so nothing replays
    body.classList.add('no-transitions');
    body.style.setProperty('--theme-switching', '1');
    document.documentElement.style.animationPlayState = 'paused';
    document.documentElement.classList.add('theme-switching');

    setThemeState(newTheme);
    safeStorage.setItem(STORAGE_KEYS.THEME, newTheme);
    applyTheme(newTheme);

    // Re-enable transitions and animations after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        body.classList.remove('no-transitions');
        document.documentElement.style.animationPlayState = '';
        document.documentElement.classList.remove('theme-switching');
      });
    });
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
