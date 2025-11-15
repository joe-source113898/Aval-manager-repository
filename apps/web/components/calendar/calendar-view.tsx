"use client";

import { useMemo } from "react";
import Head from "next/head";
import FullCalendar from "@fullcalendar/react";
import { EventClickArg, EventContentArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { Disponibilidad, PublicFirma } from "@/lib/types";

interface CalendarViewProps {
  events: PublicFirma[];
  availability?: Disponibilidad[];
}

export function CalendarView({ events, availability = [] }: CalendarViewProps) {
  const calendarEvents = useMemo(
    () =>
      events.map((firma) => {
        const titleBase = firma.cliente_nombre ?? firma.asesor_nombre ?? firma.aval_nombre ?? "Firma";
        return {
          id: firma.id,
          title: `${titleBase} • ${firma.estado}`,
          start: firma.fecha_inicio,
          end: firma.fecha_fin ?? firma.fecha_inicio,
          extendedProps: {
            ubicacion_maps_url: firma.ubicacion_maps_url,
          },
        };
      }),
    [events]
  );

  const availabilityEvents = useMemo(
    () =>
      availability.map((block) => ({
        id: `availability-${block.id}`,
        title: "Disponible para firmar",
        start: block.fecha_inicio,
        end: block.fecha_fin,
        display: "block" as const,
        overlap: false,
        backgroundColor: "rgba(34,197,94,0.18)",
        borderColor: "rgb(34,197,94)",
        textColor: "rgb(21,128,61)",
        classNames: ["availability-block"],
        extendedProps: {
          type: "availability",
        },
      })),
    [availability]
  );

  const composedEvents = useMemo(() => [...availabilityEvents, ...calendarEvents], [availabilityEvents, calendarEvents]);

  const handleEventClick = (eventClickInfo: EventClickArg) => {
    const locationUrl = eventClickInfo.event.extendedProps["ubicacion_maps_url"];
    if (locationUrl) {
      window.open(String(locationUrl), "_blank", "noopener,noreferrer");
    }
  };

  const renderEventContent = (eventInfo: EventContentArg) => {
    if (eventInfo.event.extendedProps["type"] === "availability") {
      return (
        <div className="flex flex-col rounded-xl bg-emerald-50/80 px-2 py-1 text-emerald-800">
          <span className="text-[11px] font-semibold uppercase tracking-wide">Disponible para firmar</span>
          <span className="text-[10px] text-emerald-700">{eventInfo.timeText || "Todo el día"}</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-0.5 rounded-xl bg-primary/5 px-2 py-1 text-primary">
        <span className="text-xs font-semibold leading-tight">{eventInfo.event.title}</span>
        {eventInfo.timeText ? <span className="text-[10px] text-primary/80">{eventInfo.timeText}</span> : null}
      </div>
    );
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
      <Head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.19/main.min.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fullcalendar/daygrid@6.1.19/main.min.css" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fullcalendar/timegrid@6.1.19/main.min.css" />
      </Head>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        initialView="dayGridMonth"
        locale={esLocale}
        height="auto"
        events={composedEvents}
        eventClick={handleEventClick}
        eventContent={renderEventContent}
        expandRows
        weekends={false}
        firstDay={1}
        nowIndicator
        navLinks
        stickyHeaderDates
        businessHours={{
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: "08:00",
          endTime: "20:00",
        }}
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        dayMaxEvents
        displayEventEnd
        buttonText={{
          today: "Hoy",
          month: "Mes",
          week: "Semana",
          day: "Día",
        }}
      />
      {availability.length > 0 ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex h-3 w-3 rounded bg-emerald-400" />
          <span>Bloques de disponibilidad del aval en turno (Lun a Vie)</span>
        </div>
      ) : null}
    </div>
  );
}
