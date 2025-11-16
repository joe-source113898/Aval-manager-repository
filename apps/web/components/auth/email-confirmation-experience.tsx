"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, MonitorSmartphone, Smartphone } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Mode = "browser" | "pwa" | "unknown";

export function EmailConfirmationExperience() {
  const [mode, setMode] = useState<Mode>("unknown");

  useEffect(() => {
    const detect = () => {
      const matchMedia = window.matchMedia?.("(display-mode: standalone)");
      const isStandalone = Boolean(matchMedia?.matches || (window.navigator as typeof window.navigator & { standalone?: boolean }).standalone);
      setMode(isStandalone ? "pwa" : "browser");
    };

    detect();

    const media = window.matchMedia?.("(display-mode: standalone)");
    if (media?.addEventListener) {
      media.addEventListener("change", detect);
      return () => media.removeEventListener("change", detect);
    }
    if (media?.addListener) {
      media.addListener(detect);
      return () => media.removeListener(detect);
    }
    return undefined;
  }, []);

  const cards = [
    {
      key: "browser" as const,
      title: "Seguir en el navegador",
      description: "Confirma tu correo y vuelve al acceso de asesores para iniciar sesión desde la versión web.",
      icon: <MonitorSmartphone className="h-6 w-6 text-primary" />,
      steps: [
        "Abre la liga desde tu computadora o navegador móvil.",
        "Pulsa el botón «Iniciar sesión como asesor».",
        "Usa las mismas credenciales con las que te registraste.",
      ],
      actionLabel: "Ir a iniciar sesión",
      actionHref: "/login?view=asesor",
    },
    {
      key: "pwa" as const,
      title: "Seguir en la app instalada (PWA)",
      description:
        "Si ya añadiste Aval-manager como app en tu dispositivo, abre la app y entra con tus credenciales confirmadas.",
      icon: <Smartphone className="h-6 w-6 text-primary" />,
      steps: [
        "Toca el icono de Aval-manager en tu pantalla de inicio.",
        "Pulsa «Acceso asesores» dentro de la app.",
        "Introduce tu correo y contraseña ya confirmados.",
      ],
      actionLabel: "Abrir login para PWA",
      actionHref: "/login?view=asesor",
    },
  ];

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {cards.map((card) => (
        <section
          key={card.key}
          className={cn(
            "flex flex-col gap-4 rounded-3xl border border-border/70 bg-background/90 p-6 shadow-sm transition",
            mode === card.key ? "ring-2 ring-primary/50" : "ring-1 ring-transparent"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {card.icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{card.title}</h3>
              <p className="text-sm text-muted-foreground">{card.description}</p>
            </div>
          </div>
          <ol className="space-y-2 text-sm text-muted-foreground">
            {card.steps.map((step, index) => (
              <li key={step} className="flex gap-3 rounded-2xl bg-muted/40 px-3 py-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Link
            href={card.actionHref}
            className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "mt-auto justify-between")}
          >
            {card.actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ))}
    </div>
  );
}
