import { createContext, useContext, useEffect, useState } from "react";
import { STORAGE_KEYS } from '@/lib/constants';

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Sync with whatever the inline script already applied
    const saved = localStorage.getItem(STORAGE_KEYS.THEME) as Theme | null;
    return saved === 'dark' ? 'dark' : 'light';
  });

  // Apply on mount (should match inline script, but just in case)
  useEffect(() => {
    applyTheme(theme);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(newTheme);
    // CSS vars (--initial-bg, --initial-text) respond instantly via .dark selector
    // No manual body.style needed — the CSS vars handle it
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
    applyTheme(newTheme);
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
