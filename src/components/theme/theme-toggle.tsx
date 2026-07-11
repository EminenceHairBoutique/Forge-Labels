"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

function currentIsDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle() {
  const [isDark, setIsDark] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setIsDark(currentIsDark());
  }, []);

  function toggle() {
    const next = !currentIsDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("fl-theme", next ? "dark" : "light");
    } catch {
      // Storage may be unavailable (private browsing); the toggle still works.
    }
    setIsDark(next);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark === null ? (
        <Sun className="size-4 opacity-0" aria-hidden />
      ) : isDark ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </Button>
  );
}
