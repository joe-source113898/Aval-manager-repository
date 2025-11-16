import Link from "next/link";
import { ReactNode } from "react";

import { AdminSidebar } from "@/components/navigation/admin-sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getServerSupabase } from "@/lib/supabase/server";
import { getRoleFromSession, isAdminRole } from "@/lib/auth";

interface Props {
  children: ReactNode;
}

export default async function AdminLayout({ children }: Props) {
  const supabase = getServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const role = getRoleFromSession(session);
  const isAdmin = isAdminRole(role);

  if (!session || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-semibold">
            {session ? "Esta área es solo para administradores" : "Necesitas iniciar sesión"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {session
              ? "Tu cuenta actual está registrada como asesor. Continúa en la vista pública o solicita acceso administrativo."
              : "Por favor inicia sesión con tu usuario de Aval-manager."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-medium">
            {session ? (
              <>
                <Link href="/" className="text-primary underline">
                  Volver al inicio
                </Link>
                <Link href="/calendario" className="text-primary underline">
                  Ver calendario
                </Link>
              </>
            ) : (
              <>
                <Link href="/login?view=admin" className="text-primary underline">
                  Acceso administradores
                </Link>
                <Link href="/login?view=asesor" className="text-primary underline">
                  Acceso asesores
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/10 md:flex-row">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-end gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            Volver al inicio
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
