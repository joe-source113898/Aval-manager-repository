"use client";

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import FullCalendar from "@fullcalendar/react";
import { EventClickArg, EventContentArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";

import { Disponibilidad, PublicFirma } from "@/lib/types";

interface CalendarViewProps {
  events: PublicFirma[];
  availability?: Disponibilidad[];
}

const buildDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfDay = (date: Date) => {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone;
};

const endOfDay = (date: Date) => {
  const clone = new Date(date);
  clone.setHours(23, 59, 59, 999);
  return clone;
};

const formatTimeLabel = (date: Date) =>
  date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatTimeRange = (start: Date, end: Date) => {
  const startLabel = formatTimeLabel(start);
  const endLabel = formatTimeLabel(end);
  if (startLabel === endLabel) {
    return startLabel;
  }
  return `${startLabel} - ${endLabel}`;
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function CalendarView({ events, availability = [] }: CalendarViewProps) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(max-width: 640px)").matches;
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    setIsMobile(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const selectedDayEvents = useMemo(() => {
    const targetKey = buildDateKey(selectedDate);
    return events
      .filter((firma) => buildDateKey(new Date(firma.fecha_inicio)) === targetKey)
      .map((firma) => {
        const startDate = new Date(firma.fecha_inicio);
        const endDate = new Date(firma.fecha_fin ?? firma.fecha_inicio);
        return {
          id: firma.id,
          title: firma.cliente_nombre ?? firma.asesor_nombre ?? firma.aval_nombre ?? "Firma",
          estado: firma.estado,
          startDate,
          endDate,
          ubicacion: firma.ubicacion_maps_url,
          cliente: firma.cliente_nombre,
          aval: firma.aval_nombre,
          asesor: firma.asesor_nombre,
        };
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [events, selectedDate]);

  const selectedDayAvailability = useMemo(() => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    return availability
      .filter((block) => {
        const blockStart = new Date(block.fecha_inicio);
        const blockEnd = new Date(block.fecha_fin ?? block.fecha_inicio);
        return blockStart <= dayEnd && blockEnd >= dayStart;
      })
      .map((block) => ({
        id: block.id,
        startDate: new Date(block.fecha_inicio),
        endDate: new Date(block.fecha_fin ?? block.fecha_inicio),
      }))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [availability, selectedDate]);

  const changeDay = (offset: number) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + offset);
      return next;
    });
  };

  const goToToday = () => setSelectedDate(new Date());

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

  if (isMobile) {
    const weekday = capitalize(
      selectedDate.toLocaleDateString("es-MX", {
        weekday: "long",
      })
    );
    const longDate = selectedDate.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return (
      <div className="space-y-4 rounded-3xl border border-border bg-card/90 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => changeDay(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-foreground transition hover:bg-background"
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-1 flex-col items-center text-center">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{weekday}</span>
            <span className="text-2xl font-bold capitalize leading-tight">{longDate}</span>
          </div>
          <button
            type="button"
            onClick={() => changeDay(1)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-foreground transition hover:bg-background"
            aria-label="Día siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={goToToday}
            className="rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary transition hover:bg-primary/15"
          >
            Hoy
          </button>
        </div>

        {selectedDayAvailability.length > 0 ? (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Disponibilidad del aval</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedDayAvailability.map((block) => (
                <span
                  key={block.id}
                  className="inline-flex items-center rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-200"
                >
                  {formatTimeRange(block.startDate, block.endDate)}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 p-4 text-center text-xs text-muted-foreground">
            Sin bloques de disponibilidad para este día.
          </div>
        )}

        <div className="space-y-3">
          {selectedDayEvents.length > 0 ? (
            selectedDayEvents.map((event) => (
              <article key={event.id} className="rounded-2xl border border-border bg-background/80 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Clock className="h-4 w-4" />
                    <span>{formatTimeRange(event.startDate, event.endDate)}</span>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    {event.estado}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold leading-tight">{event.title}</h3>
                <div className="mt-1 text-xs text-muted-foreground">
                  {event.cliente ? <p>Cliente: {event.cliente}</p> : null}
                  {event.aval ? <p>Aval: {event.aval}</p> : null}
                  {event.asesor ? <p>Asesor: {event.asesor}</p> : null}
                </div>
                {event.ubicacion ? (
                  <button
                    type="button"
                    onClick={() => window.open(String(event.ubicacion), "_blank", "noopener,noreferrer")}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    <MapPin className="h-4 w-4" />
                    Ver ubicación
                  </button>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-6 text-center text-sm text-muted-foreground">
              No hay firmas programadas para este día.
            </div>
          )}
        </div>
      </div>
    );
  }

  const headerToolbar = {
    left: "prev,next today",
    center: "title",
    right: "dayGridMonth,timeGridWeek,timeGridDay",
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
        headerToolbar={headerToolbar}
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
