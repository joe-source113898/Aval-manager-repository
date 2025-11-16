import { redirect } from "next/navigation";

import { getRoleFromSession, isAdminRole, isAdvisorRole } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function AsesoresPage() {
  const supabase = getServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login?view=asesor");
  }

  const role = getRoleFromSession(session);
  if (!isAdvisorRole(role) && !isAdminRole(role)) {
    redirect("/");
  }

  const links = [
    { href: "/asesores/firmas", title: "Firmas", description: "Accede al mismo módulo de firmas del panel administrativo." },
    {
      href: "/asesores/clientes",
      title: "Clientes",
      description: "Registra y administra clientes con los mismos formularios del panel.",
    },
    {
      href: "/asesores/lista-negra",
      title: "Lista negra",
      description: "Gestiona los vetos de clientes igual que en el panel.",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold">Portal para asesores</h1>
        <p className="text-sm text-muted-foreground">
          Usa los mismos módulos del panel administrativo para gestionar firmas, clientes y la lista negra. Los pagos siguen
          siendo exclusivos de los administradores.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-3">
        {links.map((item) => (
          <div key={item.href} className="rounded-3xl border border-border bg-card/80 p-5 shadow-sm">
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            <Link
              href={item.href}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-4 w-full justify-center gap-2")}
            >
              Abrir módulo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
