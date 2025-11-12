import Link from "next/link";
import { ReactNode } from "react";

import { AdminSidebar } from "@/components/navigation/admin-sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getServerSupabase } from "@/lib/supabase/server";

interface Props {
  children: ReactNode;
}

export default async function AdminLayout({ children }: Props) {
  const supabase = getServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Necesitas iniciar sesión</h1>
          <Link href="/login" className="text-primary underline">
            Ir a iniciar sesión
          </Link>
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
