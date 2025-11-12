import Link from "next/link";
import { ArrowRight, CalendarDays, FileText, ListChecks, ShieldCheck } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = getServerSupabase();
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const isLoggedIn = Boolean(session);

  const primaryCtaLabel = isLoggedIn ? "Ir al panel" : "Iniciar sesión";
  const primaryCtaHref = isLoggedIn ? "/admin" : "/login";

  return (
    <div className="space-y-16 pb-16">
      <section className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-8 text-center shadow-sm md:p-12">
        <div className="mx-auto max-w-3xl space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Gestión integral de avales
          </span>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Coordina avales, firmas y pagos sin fricción.
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              Programa firmas, comparte expedientes y sigue cada pago desde un solo panel. Aval-manager concentra la
              operación de tu equipo para que nunca pierdas el control.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Link href={primaryCtaHref} className={cn(buttonVariants({ size: "lg" }), "gap-2 flex-1 min-w-[180px]")}>
              {primaryCtaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/documentos"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2 flex-1 min-w-[180px]")}
            >
              Documentos del aval
            </Link>
            <Link
              href="/calendario"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2 flex-1 min-w-[180px]")}
            >
              Ver calendario público
            </Link>
            <Link
              href="/lista-negra"
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "gap-2 flex-1 min-w-[180px]")}
            >
              Lista negra pública
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: ShieldCheck,
            title: "Panel administrativo",
            description: "Orquesta avales, clientes, pagos y disponibilidad con flujos guiados y alertas contextuales.",
          },
          {
            icon: FileText,
            title: "Documentación segura",
            description: "Expediente digital con descargas controladas y enlaces firmados para cada documento crítico.",
          },
          {
            icon: CalendarDays,
            title: "Calendario de firmas",
            description: "Agenda inteligente y vista pública para que asesores, clientes e inmobiliarias lleguen alineados.",
          },
          {
            icon: ListChecks,
            title: "Lista negra colaborativa",
            description: "Comparte vetos de avales y clientes vetados para proteger tu operación y cuidar a tus aliados.",
          },
        ].map((feature) => (
          <article
            key={feature.title}
            className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition hover:shadow-md"
          >
            <feature.icon className="h-10 w-10 text-primary" />
            <h3 className="text-lg font-semibold">{feature.title}</h3>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </article>
        ))}
      </section>

      <section className="grid items-center gap-10 rounded-4xl border border-border bg-gradient-to-br from-muted/60 via-background to-background p-8 md:grid-cols-[1.2fr_0.8fr] md:p-12">
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Onboarding guiado</p>
            <h2 className="mt-1 text-3xl font-semibold">Empieza en menos de 10 minutos</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Registra tu primer aval, agenda firmas y comparte documentos con tus aliados sin depender de hojas de cálculo.
              Todo queda sincronizado en el panel y en las vistas públicas.
            </p>
          </div>
          <div className="grid gap-4 text-sm text-muted-foreground sm:grid-cols-2">
            {[
              "Registra avales, clientes y firmas sin repetir datos en distintas plataformas.",
              "Genera contratos, pagos y comisiones con plantillas guiadas y campos obligatorios.",
              "Publica al instante los documentos del aval, el calendario y la lista negra para consulta.",
              "Recibe alertas cuando un pago, comisión o veto necesite seguimiento adicional.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/80 p-4">
                <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <p>{item}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={primaryCtaHref} className={cn(buttonVariants({ size: "lg" }), "gap-2 flex-1 min-w-[180px]")}>
              {primaryCtaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/documentos"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2 flex-1 min-w-[180px]")}
            >
              Documentos del aval
            </Link>
            <Link
              href="/calendario"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2 flex-1 min-w-[180px]")}
            >
              Ver calendario público
            </Link>
            <Link
              href="/lista-negra"
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "gap-2 flex-1 min-w-[180px]")}
            >
              Lista negra pública
            </Link>
          </div>
        </div>
        <div className="rounded-3xl border border-dashed border-primary/50 bg-background/90 p-6 shadow-inner">
          <p className="text-sm font-semibold text-primary">Checklist previo al lanzamiento</p>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li>✓ Ten a la mano datos del aval, asesor y cliente.</li>
            <li>✓ Sube la identificación y solicitud del aval al módulo de documentos.</li>
            <li>✓ Define el rango de disponibilidad del aval para el calendario público.</li>
            <li>✓ Configura los montos de servicio y comisiones para registrar pagos al momento.</li>
          </ul>
          <p className="mt-5 text-xs text-muted-foreground">
            ¿Listo? Accede al panel para registrar tu siguiente operación.
          </p>
        </div>
      </section>
    </div>
  );
}
