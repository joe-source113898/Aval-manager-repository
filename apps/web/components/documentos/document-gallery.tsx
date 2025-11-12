"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { humanizeDocumentName } from "@/lib/documents";

type DocumentLike = {
  id: string;
  tipo: string;
  archivo_path: string;
  created_at: string;
  notas?: string | null;
  signed_url?: string | null;
};

interface DocumentGalleryProps<T extends DocumentLike> {
  documents: T[];
  title: string;
  description?: string;
  emptyState?: string;
  loading?: boolean;
}

const imageExtensions = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
const pdfExtensions = ["pdf"];

export function DocumentGallery<T extends DocumentLike>({
  documents,
  title,
  description,
  emptyState = "No hay documentos disponibles.",
  loading = false,
}: DocumentGalleryProps<T>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (documents.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current && documents.some((doc) => doc.id === current)) {
        return current;
      }
      return documents[0]?.id ?? null;
    });
  }, [documents]);

  const selectedDocument = useMemo(() => documents.find((doc) => doc.id === selectedId), [documents, selectedId]);

  const getDocumentUrl = (doc: DocumentLike | undefined) => {
    if (!doc) return "";
    if (doc.signed_url) return doc.signed_url;
    if (doc.archivo_path?.startsWith("http")) return doc.archivo_path;
    return "";
  };

  const getDisplayName = (doc: DocumentLike) => humanizeDocumentName(doc.archivo_path);

  const preview = useMemo(() => {
    if (!selectedDocument) {
      return { type: "none" as const, url: "" };
    }
    const url = getDocumentUrl(selectedDocument);
    const source = selectedDocument.archivo_path || url;
    const cleanSource = source.split(/[?#]/)[0];
    const extension = cleanSource.split(".").pop()?.toLowerCase() ?? "";
    if (url && imageExtensions.includes(extension)) {
      return { type: "image" as const, url };
    }
    if (url && pdfExtensions.includes(extension)) {
      return { type: "pdf" as const, url };
    }
    return { type: url ? ("download" as const) : ("none" as const), url };
  }, [selectedDocument]);

  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm ring-1 ring-black/5">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </header>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : null}

      {!loading && documents.length === 0 ? <p className="text-sm text-muted-foreground">{emptyState}</p> : null}

      {!loading && documents.length > 0 ? (
        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-3 lg:max-h-[520px] lg:w-[42%] lg:overflow-y-auto">
            {documents.map((doc) => {
              const isActive = doc.id === selectedId;
              const extension = doc.archivo_path.split(".").pop()?.toLowerCase();
              const isImage = extension ? imageExtensions.includes(extension) : false;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedId(doc.id)}
                  className={cn(
                    "w-full rounded-2xl border-2 px-4 py-3 text-left transition-all duration-200",
                    isActive
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-transparent bg-muted/40 hover:border-border/80"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Badge variant={isImage ? "default" : "outline"} className="capitalize">
                      {doc.tipo}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("es-MX", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(doc.created_at))}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{getDisplayName(doc)}</p>
                  {doc.notas ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{doc.notas}</p> : null}
                </button>
              );
            })}
          </div>
          <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-border/60 bg-background/80 p-5">
            {selectedDocument ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">{selectedDocument.tipo}</h3>
                    <p className="text-xs text-muted-foreground break-all">
                      {humanizeDocumentName(selectedDocument.archivo_path)}
                    </p>
                  </div>
                  <Button variant="outline" asChild size="sm">
                    <Link href={getDocumentUrl(selectedDocument)} target="_blank" rel="noreferrer">
                      <Download className="mr-2 h-4 w-4" />
                      Descargar
                    </Link>
                  </Button>
                </div>
                <div className="relative flex min-h-[260px] grow items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted/40">
                  {preview.type === "image" ? (
                    <Image
                      src={preview.url}
                      alt={selectedDocument.tipo}
                      fill
                      sizes="(min-width: 1280px) 50vw, 100vw"
                      className="object-contain p-3"
                    />
                  ) : null}
                  {preview.type === "pdf" ? (
                    <iframe
                      title={selectedDocument.tipo}
                      src={`${preview.url}#toolbar=0`}
                      className="h-full w-full rounded-md border-0"
                    />
                  ) : null}
                  {preview.type === "download" ? (
                    <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-10 w-10" />
                      <span>Vista previa no disponible.</span>
                      <Button variant="secondary" asChild size="sm">
                        <Link href={preview.url || getDocumentUrl(selectedDocument)} target="_blank" rel="noreferrer">
                          <Download className="mr-2 h-4 w-4" />
                          Abrir documento
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                  {preview.type === "none" ? (
                    <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                      <ImageIcon className="h-10 w-10" />
                      <span>Selecciona un documento para visualizarlo.</span>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="flex min-h-[200px] items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">
                Selecciona un documento para visualizarlo.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
