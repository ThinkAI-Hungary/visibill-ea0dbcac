import { createContext, useContext, useEffect, useState } from "react";
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

  const setTheme = (newTheme: Theme) => {
    const body = document.body;

    const commit = () => {
      // Suppress per-element transitions so colors snap instantly
      body.classList.add('no-transitions');
      setThemeState(newTheme);
      safeStorage.setItem(STORAGE_KEYS.THEME, newTheme);
      applyTheme(newTheme);
      // Re-enable transitions after a single frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          body.classList.remove('no-transitions');
        });
      });
    };

    // Use View Transitions API for a clean full-page crossfade
    if ((document as any).startViewTransition) {
      (document as any).startViewTransition(commit);
    } else {
      commit();
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
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
