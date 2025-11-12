"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function PreferencesForm() {
  const [publicDocsVisible, setPublicDocsVisible] = useState(true);
  const [calendarVisible, setCalendarVisible] = useState(true);
  const [showThumbnails, setShowThumbnails] = useState(true);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast.success("Preferencias guardadas (solo en esta sesión)");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id="public-docs"
            checked={publicDocsVisible}
            onChange={(event) => setPublicDocsVisible(event.target.checked)}
          />
          <label htmlFor="public-docs" className="text-sm leading-tight">
            Mostrar la sección de documentos públicos
            <span className="mt-1 block text-xs text-muted-foreground">
              Desactívalo si deseas ocultar temporalmente la página pública para revisión interna.
            </span>
          </label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="calendar"
            checked={calendarVisible}
            onChange={(event) => setCalendarVisible(event.target.checked)}
          />
          <label htmlFor="calendar" className="text-sm leading-tight">
            Mostrar calendario público de firmas
            <span className="mt-1 block text-xs text-muted-foreground">
              Controla si el calendario aparece para visitantes sin autenticación.
            </span>
          </label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="thumbnails"
            checked={showThumbnails}
            onChange={(event) => setShowThumbnails(event.target.checked)}
          />
          <label htmlFor="thumbnails" className="text-sm leading-tight">
            Mostrar miniaturas en el panel de administración
            <span className="mt-1 block text-xs text-muted-foreground">
              Desactívalo si prefieres solo enlaces de descarga para acelerar la carga.
            </span>
          </label>
        </div>
      </div>
      <Button type="submit" className="w-full sm:w-auto">
        Guardar preferencias
      </Button>
    </form>
  );
}
