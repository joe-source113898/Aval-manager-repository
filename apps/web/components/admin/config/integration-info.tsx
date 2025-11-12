"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";

const BUCKET_NAME = "documentos-aval";

export function IntegrationInfo() {
  const [copying, setCopying] = useState<string | null>(null);

  const handleCopy = async (value: string, label: string) => {
    try {
      setCopying(label);
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado al portapapeles`);
    } catch (error) {
      toast.error("No pudimos copiar el valor");
    } finally {
      setCopying(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Integraciones</h3>
        <p className="text-sm text-muted-foreground">
          Usa estos valores cuando configures automatizaciones o revises los endpoints públicos del proyecto.
        </p>
      </div>
      <div className="space-y-3">
        <IntegrationField
          label="Supabase URL"
          value={env.supabaseUrl || "No configurado"}
          onCopy={handleCopy}
          copying={copying}
        />
        <IntegrationField
          label="Supabase anon key"
          value={env.supabaseAnonKey ? `${env.supabaseAnonKey.slice(0, 12)}…` : "No configurada"}
          fullValue={env.supabaseAnonKey ?? ""}
          onCopy={handleCopy}
          copying={copying}
        />
        <IntegrationField
          label="Bucket de documentos"
          value={BUCKET_NAME}
          onCopy={handleCopy}
          copying={copying}
        />
        <IntegrationField
          label="Endpoint público de documentos"
          value={`${env.apiBaseUrl?.replace(/\/$/, "") ?? "http://localhost:8000"}/public/documentos/en-turno`}
          onCopy={handleCopy}
          copying={copying}
        />
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  fullValue?: string;
  copying: string | null;
  onCopy: (value: string, label: string) => void;
}

function IntegrationField({ label, value, fullValue, copying, onCopy }: FieldProps) {
  const displayed = value || "—";
  const toCopy = fullValue ?? value;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground break-all">{displayed}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!toCopy || copying === label}
        onClick={() => onCopy(toCopy, label)}
      >
        {copying === label ? "Copiando…" : "Copiar"}
      </Button>
    </div>
  );
}
