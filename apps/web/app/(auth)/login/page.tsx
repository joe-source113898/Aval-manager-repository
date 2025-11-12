import Link from "next/link";
import { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Iniciar sesión | Aval-manager",
};

export default async function LoginPage() {
  const supabase = getServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 px-4 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Inicia sesión</h1>
          <p className="text-sm text-muted-foreground">Accede al panel administrativo con tu usuario y contraseña.</p>
        </div>
        <LoginForm />
        <div className="text-center text-sm text-muted-foreground">
          <p>¿Necesitas volver a la página principal?</p>
          <Link href="/" className={cn(buttonVariants({ variant: "link" }), "text-primary")}>
            Regresar al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
