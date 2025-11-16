import Link from "next/link";
import { Metadata } from "next";
import { redirect } from "next/navigation";

import { RegisterAdvisorForm } from "@/components/auth/register-advisor-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { getRoleFromSession, isAdminRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Registro de asesor | Aval-manager",
};

export default async function RegisterAdvisorPage() {
  const supabase = getServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const role = getRoleFromSession(session);
  if (session) {
    if (isAdminRole(role)) {
      redirect("/admin");
    }
    redirect("/calendario");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 px-4 py-10">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Regístrate como asesor</h1>
          <p className="text-sm text-muted-foreground">
            Crea tu cuenta para acceder a la vista pública y consultar documentos, calendario y lista negra.
          </p>
        </div>
        <RegisterAdvisorForm />
        <div className="text-center text-sm text-muted-foreground">
          <p>¿Ya tienes cuenta?</p>
          <Link href="/login?view=asesor" className={cn(buttonVariants({ variant: "link" }), "text-primary")}>
            Ir a iniciar sesión
          </Link>
        </div>
        <div className="text-center text-xs text-muted-foreground">
          Solo los administradores pueden otorgar acceso al panel completo. Si necesitas más permisos, contacta al equipo
          de Aval-manager.
        </div>
      </div>
    </div>
  );
}
