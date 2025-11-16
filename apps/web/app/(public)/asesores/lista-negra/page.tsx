import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { ClientesVetadosManager } from "@/components/admin/morosidad/clientes-vetados-manager";
import { VetosAvalesManager } from "@/components/admin/vetos/vetos-avales-manager";
import { cn } from "@/lib/utils";
import { getRoleFromSession, isAdminRole, isAdvisorRole } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function AsesoresListaNegraPage() {
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
        <Link href="/asesores" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-2")}>
          <ArrowLeft className="h-4 w-4" />
          Volver al portal de asesores
        </Link>
        <p className="text-sm text-muted-foreground">Estás gestionando: Lista negra</p>
      </div>
      <div className="space-y-10">
        <VetosAvalesManager />
        <ClientesVetadosManager />
      </div>
    </div>
  );
}
