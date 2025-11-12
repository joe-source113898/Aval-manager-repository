import { ReactNode } from "react";

import { SiteHeader } from "@/components/navigation/site-header";

interface Props {
  children: ReactNode;
}

export default function PublicLayout({ children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      <footer className="border-t border-border bg-muted/30 py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Aval-manager. Todos los derechos reservados.
      </footer>
    </div>
  );
}
