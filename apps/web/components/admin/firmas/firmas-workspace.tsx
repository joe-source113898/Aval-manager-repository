"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ClipboardList, CreditCard } from "lucide-react";

import { cn } from "@/lib/utils";
import { FirmasManager } from "./firmas-manager";
import { PagosManager } from "@/components/admin/pagos/pagos-manager";
import { useApi } from "@/hooks/use-api";
import { Aval, Firma } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

const TAB_CONFIG = [
  {
    key: "firmas" as const,
    label: "Agenda de firmas",
    description: "Programación y seguimiento",
    icon: CalendarDays,
  },
  {
    key: "contratos" as const,
    label: "Contratos firmados",
    description: "Registros creados a partir de las firmas",
    icon: ClipboardList,
  },
  {
    key: "pagos" as const,
    label: "Pagos",
    description: "Montos declarados en cada firma",
    icon: CreditCard,
  },
];

type TabKey = (typeof TAB_CONFIG)[number]["key"];

const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const dateFormatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });

function useFirmasList() {
  const api = useApi<Firma[]>();
  return useQuery({ queryKey: ["firmas"], queryFn: () => api("firmas") });
}

export function FirmasWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get("tab") as TabKey) ?? "firmas";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const ActiveComponent = useMemo(() => {
    switch (activeTab) {
      case "contratos":
        return <ContractsFromFirmas />;
      case "pagos":
        return <PagosManager />;
      default:
        return <FirmasManager />;
    }
  }, [activeTab]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    const nextUrl = tab === "firmas" ? "/admin/firmas" : `/admin/firmas?tab=${tab}`;
    router.replace(nextUrl, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Operación integral</p>
        <h1 className="text-3xl font-semibold">Firmas de contratos</h1>
        <p className="text-sm text-muted-foreground">Gestiona avales, contratos, propiedades y pagos.</p>
      </header>

      <div className="flex flex-wrap gap-3">
        {TAB_CONFIG.map((tab) => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "flex min-w-[180px] flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow"
                  : "border-border bg-background/80 text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold leading-tight">{tab.label}</p>
                <p className="text-xs text-muted-foreground">{tab.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <section className="rounded-3xl border border-border bg-card/40 p-3 sm:p-4 lg:p-6">
        {ActiveComponent}
      </section>
    </div>
  );
}

function ContractsFromFirmas() {
  const { data, isLoading } = useFirmasList();
  const firmas = data ?? [];
  const avalesApi = useApi<Aval[]>();
  const { data: avales } = useQuery({ queryKey: ["avales"], queryFn: () => avalesApi("avales") });
  const avalesMap = useMemo(() => new Map((avales ?? []).map((aval) => [aval.id, aval])), [avales]);

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-3xl border border-border/60 bg-muted/40" />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Contratos generados</h2>
        <p className="text-sm text-muted-foreground">
          Cada fila representa un registro de firma con la información contractual capturada en el formulario.
        </p>
      </section>
      {firmas.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          Aún no hay firmas registradas. Crea una desde la pestaña &quot;Agenda de firmas&quot;.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-border/60 bg-background/80 shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <th className="px-4 py-3 text-left font-medium">Aval asignado</th>
                <th className="px-4 py-3 text-left font-medium">Propiedad / Tipo</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {firmas.map((firma) => (
                <tr key={firma.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{firma.cliente_nombre}</p>
                    <p className="text-xs text-muted-foreground">Asesor: {firma.asesor_nombre}</p>
                  </td>
                  <td className="px-4 py-3">
                    {firma.aval_id ? (
                      <>
                        <p className="text-sm font-medium">{avalesMap.get(firma.aval_id)?.nombre_completo ?? "Aval asignado"}</p>
                        <p className="text-xs text-muted-foreground">ID: {firma.aval_id.slice(0, 8)}…</p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sin aval asignado</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm">{firma.propiedad_domicilio}</p>
                    <p className="text-xs text-muted-foreground">{firma.tipo_renta}</p>
                  </td>
                  <td className="px-4 py-3">{dateFormatter.format(new Date(firma.fecha_inicio))}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">
                      {firma.estado.slice(0, 1).toUpperCase() + firma.estado.slice(1)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
