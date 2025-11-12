import { Metadata } from "next";

import { DocumentosPublicosClient } from "@/components/public/documentos-publicos-client";
import { env } from "@/lib/env";
import { PublicAval, PublicDocumento } from "@/lib/types";

export const metadata: Metadata = {
  title: "Documentos públicos | Aval-manager",
};

async function fetchPublicResource<T>(path: string): Promise<T | null> {
  const response = await fetch(`${env.apiBaseUrl.replace(/\/$/, "")}/${path}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as T;
}

export default async function DocumentosPublicosPage() {
  const [aval, documentos] = await Promise.all([
    fetchPublicResource<PublicAval | null>("public/avales/en-turno"),
    fetchPublicResource<PublicDocumento[]>("public/documentos/en-turno"),
  ]);

  return <DocumentosPublicosClient initialAval={aval ?? null} initialDocuments={documentos ?? []} />;
}
