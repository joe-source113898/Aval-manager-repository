"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { getRoleFromSession, isAdminRole } from "@/lib/auth";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/calendario", label: "Calendario" },
  { href: "/documentos", label: "Documentos" },
  { href: "/lista-negra", label: "Lista negra" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, supabaseClient } = useSessionContext();
  const [signingOut, setSigningOut] = useState(false);
  const [role, setRole] = useState(() => getRoleFromSession(session));

  useEffect(() => {
    setRole(getRoleFromSession(session));
  }, [session]);

  const isAdmin = isAdminRole(role);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabaseClient.auth.signOut();
    setSigningOut(false);
    router.push("/");
    router.refresh();
  };

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-lg font-semibold text-primary">
            Aval-manager
          </Link>
          <nav className="hidden gap-6 text-sm font-medium md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "transition-colors hover:text-primary",
                  pathname === link.href ? "text-primary" : "text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {session && isAdmin ? (
            <Link
              href="/admin"
              className="hidden rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary sm:inline"
            >
              Ir al panel
            </Link>
          ) : null}
          <ThemeToggle />
          {session ? (
            <button
              type="button"
              disabled={signingOut}
              onClick={handleSignOut}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), signingOut ? "opacity-70" : null)}
            >
              {signingOut ? "Cerrando…" : "Cerrar sesión"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login?view=admin" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Acceso administrador
              </Link>
              <Link
                href="/login?view=asesor"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
              >
                Acceso asesores
              </Link>
              <Link
                href="/registro-asesor"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
              >
                Registro asesor
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
