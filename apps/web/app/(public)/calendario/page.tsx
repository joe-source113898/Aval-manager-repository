import { Metadata } from "next";

import { CalendarView } from "@/components/calendar/calendar-view";
import { env } from "@/lib/env";
import { Disponibilidad, PublicFirma } from "@/lib/types";

export const metadata: Metadata = {
  title: "Calendario público | Aval-manager",
};

async function fetchFirmas(): Promise<PublicFirma[]> {
  try {
    const response = await fetch(`${env.apiBaseUrl.replace(/\/$/, "")}/public/firmas`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as PublicFirma[];
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function fetchDisponibilidades(): Promise<Disponibilidad[]> {
  try {
    const response = await fetch(`${env.apiBaseUrl.replace(/\/$/, "")}/public/avales/en-turno/disponibilidades`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as Disponibilidad[];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export default async function CalendarioPublicoPage() {
  const [firmas, disponibilidades] = await Promise.all([fetchFirmas(), fetchDisponibilidades()]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Calendario de firmas</h1>
        <p className="text-sm text-muted-foreground">
          Consulta las próximas citas de firma, su estado y accede a la ubicación con un clic.
        </p>
      </header>
      <CalendarView events={firmas} availability={disponibilidades} />
    </div>
  );
}
