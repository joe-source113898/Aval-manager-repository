"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { AlertTriangle, CalendarDays, FileText, Home, LogOut, Settings, Users } from "lucide-react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: Home },
  { href: "/admin/avales", label: "Avales", icon: FileText },
  { href: "/admin/asesores", label: "Asesores", icon: Users },
  { href: "/admin/inmobiliarias", label: "Inmobiliarias", icon: Users },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/firmas", label: "Firmas", icon: CalendarDays },
  { href: "/admin/lista-negra", label: "Lista negra", icon: AlertTriangle },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { session, supabaseClient } = useSessionContext();
  const userEmail = session?.user.email ?? "Administrador";

  const handleSignOut = async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sesión cerrada");
    window.location.href = "/";
  };

  return (
    <aside className="w-full border-b border-border bg-muted/20 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex flex-col md:h-full">
        <div className="px-4 py-4 md:px-6 md:py-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Conectado como</p>
          <p className="truncate text-lg font-semibold" title={userEmail}>
            {userEmail}
          </p>
          <p className="mt-1 hidden text-xs text-muted-foreground md:block">Gestiona tu operación diaria.</p>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:space-y-1 md:overflow-visible md:pb-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-[160px] items-center gap-3 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:min-w-0 md:rounded-md md:border-0 md:px-3 md:py-2",
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow md:bg-primary"
                    : "border-border/50 bg-background/70 text-foreground hover:bg-muted/70 md:bg-transparent md:text-muted-foreground md:hover:bg-muted md:hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border px-4 py-4">
          <button
            onClick={handleSignOut}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-center gap-2")}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  );
}
