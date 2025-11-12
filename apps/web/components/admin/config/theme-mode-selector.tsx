"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Sistema" },
];

export function ThemeModeSelector() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [current, setCurrent] = useState<string>("system");

  useEffect(() => {
    if (!theme) return;
    if (theme === "system") {
      setCurrent(resolvedTheme ? `sistema (${resolvedTheme})` : "sistema");
    } else {
      setCurrent(theme);
    }
  }, [theme, resolvedTheme]);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold">Tema de la aplicación</h3>
        <p className="text-sm text-muted-foreground">
          Elige cómo se muestra el panel administrativo. Puedes seguir el tema del sistema o fijar uno manualmente.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {MODES.map((mode) => {
          const selectedValue = theme === "system" ? "system" : theme;
          const isActive = selectedValue === mode.value;
          return (
            <Button
              key={mode.value}
              type="button"
              variant={isActive ? "default" : "outline"}
              className={cn("px-4", isActive ? "ring-2 ring-primary" : "")}
              onClick={() => setTheme(mode.value)}
            >
              {mode.label}
            </Button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Tema actual: <span className="font-medium capitalize">{current}</span>
      </p>
    </div>
  );
}
