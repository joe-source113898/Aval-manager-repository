"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

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
  const [authState, setAuthState] = useState<"signed-in" | "signed-out" | "processing">(session ? "signed-in" : "signed-out");

  useEffect(() => {
    setAuthState(session ? "signed-in" : "signed-out");
  }, [session]);

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
          {session ? (
            <Link
              href="/admin"
              className="hidden rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary sm:inline"
            >
              Ir al panel
            </Link>
          ) : null}
          <ThemeToggle />
          <button
            type="button"
            disabled={authState === "processing"}
            onClick={async () => {
              if (authState === "signed-in") {
                setAuthState("processing");
                await supabaseClient.auth.signOut();
                router.push("/");
                router.refresh();
              } else if (authState === "signed-out") {
                router.push("/login");
              }
            }}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }),
              authState === "processing" ? "opacity-70" : null)}
          >
            {authState === "signed-in" ? "Cerrar sesión" : authState === "processing" ? "Cerrando…" : "Iniciar sesión"}
          </button>
        </div>
      </div>
    </header>
  );
}
