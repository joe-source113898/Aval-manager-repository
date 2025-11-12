"use client";

import { useMemo, useState } from "react";

import { DocumentGallery } from "@/components/documentos/document-gallery";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { PublicAval, PublicDocumento } from "@/lib/types";

async function fetchPublicResource<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${env.apiBaseUrl.replace(/\/$/, "")}/${path}`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(error);
    return null;
  }
}

interface DocumentosPublicosClientProps {
  initialAval: PublicAval | null;
  initialDocuments: PublicDocumento[];
}

export function DocumentosPublicosClient({ initialAval, initialDocuments }: DocumentosPublicosClientProps) {
  const [aval, setAval] = useState<PublicAval | null>(initialAval);
  const [documentos, setDocumentos] = useState<PublicDocumento[]>(initialDocuments);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    const [avalData, documentosData] = await Promise.all([
      fetchPublicResource<PublicAval | null>("public/avales/en-turno"),
      fetchPublicResource<PublicDocumento[]>("public/documentos/en-turno"),
    ]);
    setAval(avalData ?? null);
    setDocumentos(documentosData ?? []);
    if (!documentosData) {
      setError("No se pudo obtener la lista de documentos. Intenta nuevamente.");
    }
    setLoading(false);
  };

  const emptyState = useMemo(
    () =>
      error ??
      (documentos.length === 0 ? "Aún no se han publicado documentos para el aval." : undefined),
    [documentos.length, error]
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Documentos del aval</h1>
            <p className="text-sm text-muted-foreground">
              Consulta y descarga los documentos oficiales compartidos por el aval activo.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        {aval ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Aval</p>
              <h2 className="text-xl font-semibold">{aval.nombre_completo}</h2>
            </div>
            <div className="text-sm text-muted-foreground">
              {aval.email ? <p>Correo: {aval.email}</p> : null}
              {aval.telefono ? <p>Teléfono: {aval.telefono}</p> : null}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">No hay un aval activo en este momento.</p>
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={loading}>
              {loading ? "Actualizando..." : "Reintentar"}
            </Button>
          </div>
        )}
      </section>

      <DocumentGallery
        documents={documentos}
        loading={loading}
        title="Documentos disponibles"
        description="Selecciona un documento para visualizarlo o descargarlo."
        emptyState={emptyState}
      />
    </div>
  );
}
