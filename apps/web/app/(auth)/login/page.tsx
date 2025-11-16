import Link from "next/link";
import { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";
import { getRoleFromSession, isAdminRole } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Iniciar sesión | Aval-manager",
};

interface LoginPageProps {
  searchParams?: {
    view?: string | string[];
  };
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
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

  const requestedView = Array.isArray(searchParams?.view) ? searchParams?.view[0] : searchParams?.view;
  const intent = requestedView === "asesor" ? "asesor" : "admin";
  const heading = intent === "asesor" ? "Acceso para asesores" : "Acceso súper administrador";
  const description =
    intent === "asesor"
      ? "Los asesores pueden consultar documentos, calendario y lista negra desde la vista pública."
      : "El súper administrador controla el panel completo de Aval-manager.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 px-4 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">{heading}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <LoginForm intent={intent} />
        <div className="text-center text-sm text-muted-foreground">
          <p>¿Necesitas volver a la página principal?</p>
          <Link href="/" className={cn(buttonVariants({ variant: "link" }), "text-primary")}>
            Regresar al inicio
          </Link>
        </div>
        <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <Link href="/login?view=admin" className="underline">
            Acceso administradores
          </Link>
          <span>•</span>
          <Link href="/login?view=asesor" className="underline">
            Acceso asesores
          </Link>
          <span>•</span>
          <Link href="/registro-asesor" className="underline">
            Registrar asesor nuevo
          </Link>
        </div>
      </div>
    </div>
  );
}
