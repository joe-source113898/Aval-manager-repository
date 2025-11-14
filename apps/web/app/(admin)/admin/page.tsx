import Link from "next/link";
import { AlertTriangle, CalendarDays, ClipboardList, FileText, Settings, Users } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = getServerSupabase();

  const nowISO = new Date().toISOString();

  const [
    avalesStats,
    clientesStats,
    firmasStats,
    documentosStats,
    vetosStats,
    clientesVetadosStats,
    pagosServicioRes,
    pagosComisionRes,
    proximasFirmasRes,
  ] = await Promise.all([
    supabase.from("avales").select("*", { count: "exact", head: true }),
    supabase.from("clientes").select("*", { count: "exact", head: true }),
    supabase.from("firmas").select("*", { count: "exact", head: true }),
    supabase.from("documentos").select("*", { count: "exact", head: true }),
    supabase.from("vetos_avales").select("*", { count: "exact", head: true }),
    supabase.from("clientes_morosidad").select("*", { count: "exact", head: true }),
    supabase.from("pagos_servicio").select("monto_efectivo, monto_transferencia, estado"),
    supabase.from("pagos_comisiones").select("monto, estado"),
    supabase
      .from("firmas")
      .select("id, cliente_nombre, estado, fecha_inicio")
      .in("estado", ["programada", "reprogramada"])
      .gte("fecha_inicio", nowISO)
      .order("fecha_inicio", { ascending: true })
      .limit(5),
  ]);

  const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

  const computeServicioMonto = (pago: { monto_efectivo?: number | null; monto_transferencia?: number | null }) =>
    Number(pago.monto_efectivo || 0) + Number(pago.monto_transferencia || 0);

  const totalServicio = (pagosServicioRes.data ?? []).reduce(
    (sum, pago) => sum + computeServicioMonto(pago),
    0
  );
  const totalServicioPendiente = (pagosServicioRes.data ?? [])
    .filter((pago) => pago.estado === "registrado")
    .reduce((sum, pago) => sum + computeServicioMonto(pago), 0);

  const totalComisiones = (pagosComisionRes.data ?? []).reduce((sum, pago) => sum + Number(pago.monto || 0), 0);
  const totalComisionesPendientes = (pagosComisionRes.data ?? [])
    .filter((pago) => pago.estado === "pendiente")
    .reduce((sum, pago) => sum + Number(pago.monto || 0), 0);

  const balanceEstimado = totalServicio - totalComisiones;

  const summaryCards = [
    { label: "Avales registrados", value: avalesStats.count ?? 0 },
    { label: "Clientes activos", value: clientesStats.count ?? 0 },
    { label: "Firmas totales", value: firmasStats.count ?? 0 },
    { label: "Documentos en expediente", value: documentosStats.count ?? 0 },
    { label: "Vetos activos", value: vetosStats.count ?? 0 },
    { label: "Clientes vetados", value: clientesVetadosStats.count ?? 0 },
  ];

  const shortcuts = [
    { href: "/admin/avales", label: "Avales", icon: FileText },
    { href: "/admin/asesores", label: "Asesores", icon: Users },
    { href: "/admin/inmobiliarias", label: "Inmobiliarias", icon: Users },
    { href: "/admin/clientes", label: "Clientes", icon: Users },
    { href: "/admin/firmas", label: "Firmas", icon: CalendarDays },
    { href: "/admin/firmas?tab=contratos", label: "Contratos firmados", icon: ClipboardList },
    { href: "/admin/lista-negra", label: "Lista negra", icon: AlertTriangle },
    { href: "/admin/configuracion", label: "Configuración", icon: Settings },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Panel administrativo</h1>
        <p className="text-sm text-muted-foreground">
          Visualiza el estado de tus operaciones y accede rápidamente a cada módulo.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm ring-1 ring-black/5"
          >
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm lg:col-span-2">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Atajos</p>
              <p className="text-xs text-muted-foreground">Lleva tu operación a un clic de distancia.</p>
            </div>
          </header>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {shortcuts.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-4 rounded-2xl border border-border bg-background/70 p-4 transition hover:border-primary hover:shadow-md"
              >
                <item.icon className="h-7 w-7 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">Accede a la información relacionada.</p>
                </div>
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Flujo financiero
          </h3>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Ingresos por servicio</p>
              <p className="text-lg font-semibold">{currencyFormatter.format(totalServicio)}</p>
              <p className="text-xs text-muted-foreground">
                Pendiente de cobrar: {currencyFormatter.format(totalServicioPendiente)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Comisiones a asesores</p>
              <p className="text-lg font-semibold">{currencyFormatter.format(totalComisiones)}</p>
              <p className="text-xs text-muted-foreground">
                Pendiente de pago: {currencyFormatter.format(totalComisionesPendientes)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Balance estimado</p>
              <p className="text-lg font-semibold">{currencyFormatter.format(balanceEstimado)}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-border/60 bg-background/80 p-5 shadow-sm">
        <header className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Próximas firmas</h3>
            <p className="text-xs text-muted-foreground">Citas programadas pendientes de realizarse.</p>
          </div>
          <Link href="/admin/firmas" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Ver agenda
          </Link>
        </header>
        <div className="mt-4 divide-y divide-border/70 text-sm">
          {(proximasFirmasRes.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">No tienes firmas pendientes en los próximos días.</p>
          ) : (
            proximasFirmasRes.data?.map((firma) => (
              <div key={firma.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-semibold">{firma.cliente_nombre}</p>
                  <p className="text-xs text-muted-foreground">{firma.estado}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {firma.fecha_inicio ? new Date(firma.fecha_inicio).toLocaleString("es-MX") : "—"}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
