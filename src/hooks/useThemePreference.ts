// src/hooks/useThemePreference.ts
import { useCallback, useState } from "react";

export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "dnit_theme";

export function useThemePreference(): [ThemeMode, () => void] {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // ignore storage errors
    }
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const nextTheme: ThemeMode = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, nextTheme);
      } catch {
        // ignore storage errors
      }
      return nextTheme;
    });
  }, []);

  return [theme, toggleTheme];
}

