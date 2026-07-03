"use client";

import { useEffect, useState } from "react";
import { applyTheme, currentTheme, THEMES, type ThemeId } from "../lib/theme";

/**
 * Theme selection for the home menu. The active theme lives on the html
 * element (set before paint by the layout's init script); this component
 * reads it after mount so server and first client render always agree.
 */
export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  function select(next: ThemeId) {
    applyTheme(next);
    setTheme(next);
  }

  return (
    <div className="theme-picker" role="radiogroup" aria-label="Theme">
      {THEMES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={theme === id}
          className={`theme-chip ${theme === id ? "is-active" : ""}`}
          onClick={() => select(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
