import Link from "next/link";
import { Metadata } from "next";
import { CheckCircle2, Sparkles } from "lucide-react";

import { EmailConfirmationExperience } from "@/components/auth/email-confirmation-experience";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Correo confirmado | Aval-manager",
  description:
    "Confirma tu correo electrónico para acceder al portal de asesores de Aval-manager, tanto en la web como en la app PWA.",
};

export default function EmailConfirmationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted px-4 py-12">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 rounded-[32px] border border-border/60 bg-card/95 p-8 text-center shadow-2xl shadow-black/5 lg:p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CheckCircle2 className="h-11 w-11" />
            <Sparkles className="absolute -right-1 -top-1 h-5 w-5 text-primary/70" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold">¡Tu correo fue confirmado!</h1>
            <p className="text-base text-muted-foreground">
              Ya podemos activar tu acceso como asesor. Elige cómo continuar: desde el navegador de tu equipo o dentro de
              la app/PWA instalada.
            </p>
          </div>
        </div>

        <EmailConfirmationExperience />

        <div className="space-y-3 rounded-3xl border border-dashed border-border/80 bg-muted/30 p-6 text-left text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">¿Problemas para iniciar sesión?</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Verifica que estés usando el mismo correo con el que recibiste este mensaje.</li>
            <li>Si olvidaste tu contraseña, puedes restablecerla desde la pantalla de inicio de sesión.</li>
            <li>Ante cualquier duda, responde al correo de confirmación para que el equipo pueda ayudarte.</li>
          </ul>
        </div>

        <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
          <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Volver al inicio
          </Link>
          <Link href="/registro-asesor" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Registrar a otro asesor
          </Link>
        </div>
      </div>
    </div>
  );
}
