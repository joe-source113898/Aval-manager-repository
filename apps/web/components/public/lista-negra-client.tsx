"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, ShieldAlert, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { PublicClienteVetado, PublicVetoAval } from "@/lib/types";

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

export function ListaNegraPublicaClient() {
  const [vetos, setVetos] = useState<PublicVetoAval[]>([]);
  const [vetosLoading, setVetosLoading] = useState(true);
  const [vetosError, setVetosError] = useState<string | null>(null);
  const [vetosStatus, setVetosStatus] = useState<"activos" | "todos">("activos");
  const [vetosSearch, setVetosSearch] = useState("");
  const [vetosRefresh, setVetosRefresh] = useState(0);

  const [clientes, setClientes] = useState<PublicClienteVetado[]>([]);
  const [clientesLoading, setClientesLoading] = useState(true);
  const [clientesError, setClientesError] = useState<string | null>(null);
  const [clientesStatus, setClientesStatus] = useState<"vetados" | "limpios" | "todos">("vetados");
  const [clientesSearch, setClientesSearch] = useState("");
  const [clientesRefresh, setClientesRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const loadVetos = async () => {
      setVetosLoading(true);
      setVetosError(null);
      const params = new URLSearchParams();
      if (vetosStatus === "todos") {
        params.set("solo_activos", "false");
      }
      const path = params.toString()
        ? `public/lista-negra/avales?${params.toString()}`
        : "public/lista-negra/avales";
      const data = await fetchPublicResource<PublicVetoAval[]>(path);
      if (!active) return;
      if (!data) {
        setVetosError("No fue posible cargar los vetos de avales.");
        setVetos([]);
      } else {
        setVetos(data);
      }
      setVetosLoading(false);
    };
    loadVetos();
    return () => {
      active = false;
    };
  }, [vetosStatus, vetosRefresh]);

  useEffect(() => {
    let active = true;
    const loadClientes = async () => {
      setClientesLoading(true);
      setClientesError(null);
      const params = new URLSearchParams();
      if (clientesStatus !== "vetados") {
        params.set("solo_activos", "false");
      }
      const path = params.toString()
        ? `public/lista-negra/clientes?${params.toString()}`
        : "public/lista-negra/clientes";
      const data = await fetchPublicResource<PublicClienteVetado[]>(path);
      if (!active) return;
      if (!data) {
        setClientesError("No fue posible cargar la lista de clientes.");
        setClientes([]);
      } else {
        setClientes(data);
      }
      setClientesLoading(false);
    };
    loadClientes();
    return () => {
      active = false;
    };
  }, [clientesStatus, clientesRefresh]);

  const filteredVetos = useMemo(() => {
    if (!vetosSearch) return vetos;
    const query = vetosSearch.toLowerCase();
    return vetos.filter((veto) => {
      const aval = (veto.aval_nombre ?? "").toLowerCase();
      const inmobiliaria = (veto.inmobiliaria_nombre ?? "general").toLowerCase();
      const motivo = (veto.motivo ?? "").toLowerCase();
      return aval.includes(query) || inmobiliaria.includes(query) || motivo.includes(query);
    });
  }, [vetos, vetosSearch]);

  const filteredClientes = useMemo(() => {
    const byStatus = clientes.filter((cliente) => {
      if (clientesStatus === "todos") return true;
      if (clientesStatus === "vetados") return cliente.estatus === "vetado";
      return cliente.estatus === "limpio";
    });
    if (!clientesSearch) return byStatus;
    const query = clientesSearch.toLowerCase();
    return byStatus.filter((cliente) => {
      const nombre = (cliente.cliente_nombre ?? "").toLowerCase();
      const motivo = (cliente.motivo ?? "").toLowerCase();
      const motivoTipo = cliente.motivo_tipo.toLowerCase();
      return nombre.includes(query) || motivo.includes(query) || motivoTipo.includes(query);
    });
  }, [clientes, clientesSearch, clientesStatus]);

  const renderEmptyState = (message: string) => (
    <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          <AlertTriangle className="h-3.5 w-3.5" />
          Lista negra
        </span>
        <h1 className="text-3xl font-semibold">Consulta pública de vetos y clientes restringidos</h1>
        <p className="text-sm text-muted-foreground">
          Verifica si un aval tiene vetos por inmobiliaria o si un cliente se encuentra bloqueado por antecedentes y
          adeudos. La información es de solo lectura.
        </p>
      </header>

      <section className="space-y-4 rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Vetos de avales
            </h2>
            <p className="text-sm text-muted-foreground">Filtra por estatus y busca por aval o inmobiliaria.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Button size="sm" variant={vetosStatus === "activos" ? "default" : "outline"} onClick={() => setVetosStatus("activos")}>
                Activos
              </Button>
              <Button size="sm" variant={vetosStatus === "todos" ? "default" : "outline"} onClick={() => setVetosStatus("todos")}>
                Todos
              </Button>
            </div>
            <Input
              placeholder="Buscar aval o inmobiliaria"
              value={vetosSearch}
              onChange={(event) => setVetosSearch(event.target.value)}
              className="w-full sm:w-64"
            />
            <Button variant="outline" size="sm" onClick={() => setVetosRefresh((count) => count + 1)}>
              Actualizar
            </Button>
          </div>
        </div>

        {vetosError ? (
          renderEmptyState(vetosError)
        ) : vetosLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>
        ) : filteredVetos.length === 0 ? (
          renderEmptyState("No se encontraron vetos con los criterios seleccionados.")
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredVetos.map((veto) => (
              <article
                key={veto.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 transition hover:border-primary"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Aval</p>
                    <h3 className="text-lg font-semibold">{veto.aval_nombre ?? "Aval sin nombre"}</h3>
                    <p className="text-xs text-muted-foreground">
                      Inmobiliaria: {veto.inmobiliaria_nombre ?? "General"}
                    </p>
                  </div>
                  <Badge variant={veto.estatus === "activo" ? "error" : "secondary"}>{veto.estatus}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{veto.motivo}</p>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    Registrado el{" "}
                    {new Intl.DateTimeFormat("es-MX", {
                      dateStyle: "medium",
                    }).format(new Date(veto.created_at))}
                  </span>
                  {veto.evidencia_url ? (
                    <Button variant="link" size="sm" className="px-0" asChild>
                      <Link href={veto.evidencia_url} target="_blank" rel="noreferrer">
                        Ver evidencia
                        <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  ) : (
                    <span>Sin evidencia</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-3xl border border-border bg-card/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <UserX className="h-5 w-5 text-primary" />
              Clientes vetados
            </h2>
            <p className="text-sm text-muted-foreground">Consulta los registros con adeudos o antecedentes problemáticos.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Button size="sm" variant={clientesStatus === "vetados" ? "default" : "outline"} onClick={() => setClientesStatus("vetados")}>
                Vetados
              </Button>
              <Button size="sm" variant={clientesStatus === "limpios" ? "default" : "outline"} onClick={() => setClientesStatus("limpios")}>
                Limpios
              </Button>
              <Button size="sm" variant={clientesStatus === "todos" ? "default" : "outline"} onClick={() => setClientesStatus("todos")}>
                Todos
              </Button>
            </div>
            <Input
              placeholder="Buscar cliente o motivo"
              value={clientesSearch}
              onChange={(event) => setClientesSearch(event.target.value)}
              className="w-full sm:w-64"
            />
            <Button variant="outline" size="sm" onClick={() => setClientesRefresh((count) => count + 1)}>
              Actualizar
            </Button>
          </div>
        </div>

        {clientesError ? (
          renderEmptyState(clientesError)
        ) : clientesLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
            <Skeleton className="h-36 rounded-2xl" />
          </div>
        ) : filteredClientes.length === 0 ? (
          renderEmptyState("No se encontraron clientes con los criterios seleccionados.")
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredClientes.map((cliente) => (
              <article
                key={cliente.id}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 transition",
                  cliente.estatus === "limpio" ? "hover:border-emerald-500" : "hover:border-primary"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Cliente</p>
                    <h3 className="text-lg font-semibold">{cliente.cliente_nombre ?? "Sin nombre"}</h3>
                    <Badge variant="secondary" className="mt-1 w-fit capitalize">
                      {cliente.motivo_tipo === "moroso" ? "Moroso" : "Problemático"}
                    </Badge>
                  </div>
                  <Badge variant={cliente.estatus === "vetado" ? "error" : "secondary"} className="capitalize">
                    {cliente.estatus}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{cliente.motivo}</p>
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    Registrado el{" "}
                    {new Intl.DateTimeFormat("es-MX", {
                      dateStyle: "medium",
                    }).format(new Date(cliente.created_at))}
                  </span>
                  <Badge variant={cliente.estatus === "vetado" ? "error" : "secondary"} className="capitalize">
                    {cliente.estatus === "vetado" ? "Restricción vigente" : "Cliente limpio"}
                  </Badge>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
