"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Trash2 } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { z } from "zod";
import { toast } from "sonner";

import { DataTable } from "@/components/tables/data-table";
import { FormField, FormGrid } from "@/components/forms/form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentGallery } from "@/components/documentos/document-gallery";
import { useApi } from "@/hooks/use-api";
import { useStorageProxy } from "@/hooks/use-storage-proxy";
import { useZodForm } from "@/hooks/use-zod-form";
import { env } from "@/lib/env";
import { avalSchema } from "@/lib/schemas";
import { Aval, Disponibilidad } from "@/lib/types";
import { cn } from "@/lib/utils";

const schema = avalSchema.omit({ id: true });
const BUCKET = "documentos-aval";
const DEFAULT_ACCEPT = "application/pdf,image/*";

const documentFields = [
  { name: "identificacion_oficial_url", label: "Identificación oficial" },
  { name: "comprobante_domicilio_cfe_url", label: "Comprobante domicilio CFE" },
  { name: "comprobante_domicilio_siapa_url", label: "Comprobante domicilio SIAPA" },
  { name: "pago_predial_url", label: "Pago predial" },
  { name: "escrituras_url", label: "Escrituras" },
  { name: "certificado_libre_gravamen_url", label: "Certificado libre de gravamen" },
  { name: "rfc_url", label: "RFC" },
  { name: "curp_url", label: "CURP" },
  { name: "acta_nacimiento_url", label: "Acta de nacimiento" },
  { name: "comprobante_ingresos_1_url", label: "Comprobante de ingresos 1" },
  { name: "comprobante_ingresos_2_url", label: "Comprobante de ingresos 2" },
  { name: "comprobante_ingresos_3_url", label: "Comprobante de ingresos 3" },
  {
    name: "buro_credito_url",
    label: "Buró de crédito",
    accept: "application/pdf,application/zip,application/x-zip-compressed,.zip",
  },
] as const satisfies readonly {
  name: string;
  label: string;
  accept?: string;
}[];

type DocumentFieldName = (typeof documentFields)[number]["name"];

const WEEK_DAYS = [
  { value: 0 as const, label: "Lunes", short: "Lun" },
  { value: 1 as const, label: "Martes", short: "Mar" },
  { value: 2 as const, label: "Miércoles", short: "Mié" },
  { value: 3 as const, label: "Jueves", short: "Jue" },
  { value: 4 as const, label: "Viernes", short: "Vie" },
] as const;

type DayKey = (typeof WEEK_DAYS)[number]["value"];

type WeeklySlot = {
  start: string;
  end: string;
  recurrente: boolean;
};

type WeeklyAvailability = Record<DayKey, WeeklySlot[]>;

interface ToggleChipProps {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

function ToggleChip({ checked, onToggle, children, className }: ToggleChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        checked ? "border-primary bg-primary/10 text-primary" : "border-border/70 text-muted-foreground hover:border-border",
        className
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-full border text-[10px]",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
        )}
      >
        {checked ? <Check className="h-3 w-3" /> : null}
      </span>
      <span>{children}</span>
    </button>
  );
}

const createEmptyWeeklyAvailability = (): WeeklyAvailability =>
  WEEK_DAYS.reduce(
    (acc, day) => ({
      ...acc,
      [day.value]: [],
    }),
    {} as WeeklyAvailability
  );

const availabilityFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});
const weekLabelFormatter = new Intl.DateTimeFormat("es-MX", {
  month: "short",
  day: "numeric",
});

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getStartOfWeek = (rawDate: Date) => {
  const date = new Date(rawDate);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

const defaultWeekReference = () => formatDateInput(getStartOfWeek(new Date()));

const getDayIndexFromDate = (date: Date): DayKey | null => {
  const day = date.getDay(); // 0 domingo - 6 sábado
  const normalized = (day + 6) % 7;
  if (normalized > 4) return null;
  return normalized as DayKey;
};

const formatTimeInput = (date: Date) => date.toTimeString().slice(0, 5);

const formatWeekRangeLabel = (week: string) => {
  const start = new Date(`${week}T00:00`);
  if (Number.isNaN(start.getTime())) return week;
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  return `${weekLabelFormatter.format(start)} - ${weekLabelFormatter.format(end)}`;
};

const combineDateAndTime = (weekDate: string, dayOffset: number, time: string) => {
  if (!weekDate || !time) return null;
  const [hours, minutes] = time.split(":").map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const base = new Date(`${weekDate}T00:00`);
  if (Number.isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + dayOffset);
  base.setHours(hours, minutes, 0, 0);
  return base;
};

const formatAvailabilityRange = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "Sin horario registrado";
  }
  return `${availabilityFormatter.format(startDate)} → ${availabilityFormatter.format(endDate)}`;
};

export function AvalesManager() {
  const queryClient = useQueryClient();
  const { session, supabaseClient } = useSessionContext();
  const api = useApi<Aval[]>();
  const apiSingle = useApi<Aval>();
  const disponibilidadApi = useApi<Disponibilidad[]>();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Aval | null>(null);
  const [selectedAvalId, setSelectedAvalId] = useState<string | null>(null);
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability>(() => createEmptyWeeklyAvailability());
  const [weekReference, setWeekReference] = useState<string>(() => defaultWeekReference());
  const [availabilityHydratedId, setAvailabilityHydratedId] = useState<string | null>(null);
  const [copySourceDay, setCopySourceDay] = useState<DayKey | null>(null);
  const [copyTargets, setCopyTargets] = useState<DayKey[]>([]);
  const [additionalWeeks, setAdditionalWeeks] = useState<string[]>([]);
  const [pendingWeekInput, setPendingWeekInput] = useState("");
  const emptyFileMap = () => Object.fromEntries(documentFields.map((field) => [field.name, null])) as Record<DocumentFieldName, File | null>;
  const [files, setFiles] = useState<Record<DocumentFieldName, File | null>>(emptyFileMap);
  const [existingLinks, setExistingLinks] = useState<Record<DocumentFieldName, string | null>>(() =>
    Object.fromEntries(documentFields.map((field) => [field.name, null])) as Record<DocumentFieldName, string | null>
  );
  const [documentGalleryItems, setDocumentGalleryItems] = useState<
    Array<{ id: string; tipo: string; archivo_path: string; created_at: string; notas: null; signed_url?: string | null }>
  >([]);
  const getStorageUrl = useStorageProxy();

  const { data: avales } = useQuery({ queryKey: ["avales"], queryFn: () => api("avales") });
  const {
    data: availabilityData,
    isLoading: availabilityLoading,
  } = useQuery({
    queryKey: ["disponibilidades", selectedAvalId],
    queryFn: () => disponibilidadApi(`disponibilidades?aval_id=${selectedAvalId}`),
    enabled: Boolean(selectedAvalId),
  });
  const availabilityList = availabilityData ?? [];

  const selectedAval = useMemo(
    () => avales?.find((item) => item.id === selectedAvalId) ?? null,
    [avales, selectedAvalId]
  );

  useEffect(() => {
    if (!selectedAvalId && avales && avales.length > 0) {
      setSelectedAvalId(avales[0].id);
    }
    if ((avales?.length ?? 0) === 0) {
      setSelectedAvalId(null);
    }
  }, [avales, selectedAvalId]);

  useEffect(() => {
    if (!editing) return;
    if (!selectedAvalId || selectedAvalId !== editing.id) return;
    if (availabilityLoading) return;
    if (availabilityHydratedId === editing.id) return;

    if (availabilityList.length === 0) {
      setWeeklyAvailability(createEmptyWeeklyAvailability());
      setWeekReference(defaultWeekReference());
      setAdditionalWeeks([]);
      setAvailabilityHydratedId(editing.id);
      return;
    }

    const weekGroups = new Map<string, WeeklyAvailability>();
    availabilityList.forEach((item) => {
      const startDate = new Date(item.fecha_inicio);
      const endDate = new Date(item.fecha_fin);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return;
      }
      const dayKey = getDayIndexFromDate(startDate);
      if (dayKey === null) {
        return;
      }
      const monday = formatDateInput(getStartOfWeek(startDate));
      if (!weekGroups.has(monday)) {
        weekGroups.set(monday, createEmptyWeeklyAvailability());
      }
      const group = weekGroups.get(monday)!;
      group[dayKey] = [
        ...group[dayKey],
        {
          start: formatTimeInput(startDate),
          end: formatTimeInput(endDate),
          recurrente: item.recurrente,
        },
      ];
    });

    const sortedWeeks = Array.from(weekGroups.keys()).sort();
    const baseWeek = sortedWeeks[0] ?? defaultWeekReference();
    setWeeklyAvailability(weekGroups.get(baseWeek) ?? createEmptyWeeklyAvailability());
    setWeekReference(baseWeek);
    setAdditionalWeeks(sortedWeeks.slice(1));
    setAvailabilityHydratedId(editing.id);
  }, [availabilityList, availabilityHydratedId, availabilityLoading, editing, selectedAvalId]);

  const defaultFormValues = useMemo(
    () => ({
      nombre_completo: "",
      edad: 25,
      telefono: "",
      email: "",
      estado_civil: "",
      domicilio_actual: "",
      notas: "",
      activo: true,
      identificacion_oficial_url: "",
      comprobante_domicilio_cfe_url: "",
      comprobante_domicilio_siapa_url: "",
      pago_predial_url: "",
      escrituras_url: "",
      certificado_libre_gravamen_url: "",
      rfc_url: "",
      curp_url: "",
      acta_nacimiento_url: "",
      comprobante_ingresos_1_url: "",
      comprobante_ingresos_2_url: "",
      comprobante_ingresos_3_url: "",
      buro_credito_url: "",
      buro_credito_password: "",
    }),
    []
  );

  const form = useZodForm(schema, { defaultValues: defaultFormValues });

  const resetFilesState = () => setFiles(emptyFileMap());

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
    form.reset(defaultFormValues);
    resetFilesState();
    setExistingLinks(Object.fromEntries(documentFields.map((field) => [field.name, null])) as Record<DocumentFieldName, string | null>);
    resetWeeklyAvailability();
  };

  const handleEdit = (aval: Aval) => {
    setEditing(aval);
    setSelectedAvalId(aval.id);
    setWeeklyAvailability(createEmptyWeeklyAvailability());
    setWeekReference(defaultWeekReference());
    setAvailabilityHydratedId(null);
    setCopySourceDay(null);
    setCopyTargets([]);
    form.reset({
      nombre_completo: aval.nombre_completo,
      edad: aval.edad ?? 25,
      telefono: aval.telefono ?? "",
      email: aval.email ?? "",
      estado_civil: aval.estado_civil ?? "",
      domicilio_actual: aval.domicilio_actual ?? "",
      notas: aval.notas ?? "",
      activo: aval.activo,
      identificacion_oficial_url: aval.identificacion_oficial_url ?? "",
      comprobante_domicilio_cfe_url: aval.comprobante_domicilio_cfe_url ?? "",
      comprobante_domicilio_siapa_url: aval.comprobante_domicilio_siapa_url ?? "",
      pago_predial_url: aval.pago_predial_url ?? "",
      escrituras_url: aval.escrituras_url ?? "",
      certificado_libre_gravamen_url: aval.certificado_libre_gravamen_url ?? "",
      rfc_url: aval.rfc_url ?? "",
      curp_url: aval.curp_url ?? "",
      acta_nacimiento_url: aval.acta_nacimiento_url ?? "",
      comprobante_ingresos_1_url: aval.comprobante_ingresos_1_url ?? "",
      comprobante_ingresos_2_url: aval.comprobante_ingresos_2_url ?? "",
      comprobante_ingresos_3_url: aval.comprobante_ingresos_3_url ?? "",
      buro_credito_url: aval.buro_credito_url ?? "",
      buro_credito_password: aval.buro_credito_password ?? "",
    });
    resetFilesState();
    setDialogOpen(true);
  };

  useEffect(() => {
    let active = true;
    const loadLinks = async () => {
      if (!editing) {
        if (active) {
          setExistingLinks(
            Object.fromEntries(documentFields.map((field) => [field.name, null])) as Record<DocumentFieldName, string | null>
          );
        }
        return;
      }

      const entries = await Promise.all(
        documentFields.map(async (field) => {
          const path = editing[field.name];
          if (!path) return [field.name, null];
          try {
            const url = await getStorageUrl(path, BUCKET);
            return [field.name, url];
          } catch {
            return [field.name, null];
          }
        })
      );

      if (active) {
        setExistingLinks(Object.fromEntries(entries) as Record<DocumentFieldName, string | null>);
      }
    };

    loadLinks().catch(() => {
      if (active) {
        setExistingLinks(Object.fromEntries(documentFields.map((field) => [field.name, null])) as Record<DocumentFieldName, string | null>);
      }
    });

    return () => {
      active = false;
    };
  }, [editing, getStorageUrl]);

  const handleDelete = async (aval: Aval) => {
    if (!confirm(`¿Eliminar el aval "${aval.nombre_completo}"?`)) return;
    try {
      await apiSingle(`avales/${aval.id}`, { method: "DELETE" });
      toast.success("Aval eliminado");
      queryClient.invalidateQueries({ queryKey: ["avales"] });
      if (selectedAvalId === aval.id) {
        setSelectedAvalId(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error eliminando aval");
    }
  };

  const sanitizeFileName = (filename: string) => {
    const lower = filename.toLowerCase().trim();
    const normalized = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const replaced = normalized.replace(/[^a-z0-9.]+/g, "-");
    const collapsed = replaced.replace(/-+/g, "-");
    const cleaned = collapsed.replace(/^-|-$/g, "");
    return cleaned || `archivo-${Date.now()}`;
  };

  const resetWeeklyAvailability = () => {
    setWeeklyAvailability(createEmptyWeeklyAvailability());
    setWeekReference(defaultWeekReference());
    setAvailabilityHydratedId(null);
    setCopySourceDay(null);
    setCopyTargets([]);
    setAdditionalWeeks([]);
    setPendingWeekInput("");
  };

const buildAvailabilityPayload = () => {
    const slots: Array<{ fecha_inicio: string; fecha_fin: string; recurrente: boolean }> = [];
    const weeks = Array.from(new Set([weekReference, ...additionalWeeks].filter(Boolean)));
    weeks.forEach((week) => {
      WEEK_DAYS.forEach(({ value }) => {
        weeklyAvailability[value].forEach((slot) => {
          if (!slot.start || !slot.end || !week) return;
          const startDate = combineDateAndTime(week, value, slot.start);
          const endDate = combineDateAndTime(week, value, slot.end);
          if (!startDate || !endDate) return;
          if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1);
          slots.push({
            fecha_inicio: startDate.toISOString(),
            fecha_fin: endDate.toISOString(),
            recurrente: slot.recurrente,
          });
        });
      });
    });
    return slots;
  };

const handleWeekReferenceChange = (value: string) => {
  if (!value) {
    const fallback = defaultWeekReference();
    setWeekReference(fallback);
    setAdditionalWeeks((prev) => prev.filter((week) => week !== fallback));
    return;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const fallback = defaultWeekReference();
    setWeekReference(fallback);
    setAdditionalWeeks((prev) => prev.filter((week) => week !== fallback));
    return;
  }
  const normalized = formatDateInput(getStartOfWeek(parsed));
  setWeekReference(normalized);
  setAdditionalWeeks((prev) => prev.filter((week) => week !== normalized));
};

const addSlot = (day: DayKey) => {
    setWeeklyAvailability((prev) => ({
      ...prev,
      [day]: [
        ...prev[day],
        {
          start: "09:00",
          end: "17:00",
          recurrente: true,
        },
      ],
    }));
  };

  const updateSlot = (day: DayKey, index: number, field: keyof WeeklySlot, value: string | boolean) => {
    setWeeklyAvailability((prev) => ({
      ...prev,
      [day]: prev[day].map((slot, idx) =>
        idx === index
          ? {
              ...slot,
              [field]: value,
            }
          : slot
      ),
    }));
  };

  const removeSlot = (day: DayKey, index: number) => {
    setWeeklyAvailability((prev) => ({
      ...prev,
      [day]: prev[day].filter((_, idx) => idx !== index),
    }));
  };

  const applyCopyToTargets = (sourceDay: DayKey) => {
    if (copyTargets.length === 0) {
      setCopySourceDay(null);
      return;
    }
    setWeeklyAvailability((prev) => {
      const next = { ...prev };
      const slotsToCopy = prev[sourceDay].map((slot) => ({ ...slot }));
      copyTargets.forEach((target) => {
        next[target] = slotsToCopy.map((slot) => ({ ...slot }));
      });
      return next;
    });
    setCopySourceDay(null);
    setCopyTargets([]);
  };

  const toggleCopyTarget = (target: DayKey) => {
    setCopyTargets((prev) => {
      if (prev.includes(target)) {
        return prev.filter((value) => value !== target);
      }
      return [...prev, target];
    });
  };

  const normalizeWeekInput = (value: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return formatDateInput(getStartOfWeek(parsed));
  };

  const addAdditionalWeek = (value: string) => {
    const normalized = normalizeWeekInput(value);
    if (!normalized || normalized === weekReference) {
      setPendingWeekInput("");
      return;
    }
    setAdditionalWeeks((prev) => {
      if (prev.includes(normalized)) return prev;
      return [...prev, normalized].sort();
    });
    setPendingWeekInput("");
  };

  const addNextWeek = () => {
    const source = [...additionalWeeks].sort().at(-1) ?? weekReference;
    const date = new Date(`${source}T00:00`);
    if (Number.isNaN(date.getTime())) return;
    date.setDate(date.getDate() + 7);
    addAdditionalWeek(formatDateInput(date));
  };

  const removeAdditionalWeek = (week: string) => {
    setAdditionalWeeks((prev) => prev.filter((item) => item !== week));
  };

  const uploadDocuments = async (avalId: string) => {
    if (!supabaseClient) {
      throw new Error("Supabase no disponible para subir archivos");
    }
    const updates: Partial<Record<DocumentFieldName, string>> = {};
    for (const field of documentFields) {
      if (field.name === "buro_credito_url") continue;
      const file = files[field.name];
      if (file) {
        const timestamp = Date.now();
        const sanitizedName = sanitizeFileName(file.name);
        const path = `avales/${avalId}/${field.name}/${timestamp}-${sanitizedName}`;
        const { error } = await supabaseClient.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: true,
        });
        if (error) {
          throw new Error(`Error subiendo ${field.label}: ${error.message}`);
        }
        updates[field.name] = path;
      }
    }
    return updates;
  };

  const uploadBuroCredito = async (avalId: string) => {
    const file = files.buro_credito_url;
    if (!file) return null;
    if (!session?.access_token) {
      throw new Error("La sesión expiró. Inicia sesión nuevamente para subir el Buró de crédito.");
    }
    const formData = new FormData();
    formData.append("file", file);
    const passwordValue = form.getValues("buro_credito_password") ?? "";
    if (passwordValue) {
      formData.append("password", passwordValue);
    }
    const response = await fetch(`${env.apiBaseUrl.replace(/\/$/, "")}/avales/${avalId}/buro-credito`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || "Error subiendo el Buró de crédito");
    }
    return response.json();
  };

  const normalizeValues = (values: z.infer<typeof schema>) => {
    const normalized: Record<string, unknown> = { ...values };
    const nullableFields: (keyof typeof normalized)[] = [
      "telefono",
      "email",
      "estado_civil",
      "domicilio_actual",
      "notas",
      ...documentFields.map((field) => field.name),
      "buro_credito_password",
    ];
    nullableFields.forEach((field) => {
      const value = normalized[field as keyof typeof normalized];
      if (typeof value === "string" && value.trim() === "") {
        normalized[field] = null;
      }
    });
    if (normalized.edad === "" || normalized.edad === null) {
      normalized.edad = null;
    }
    return normalized;
  };

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const payload = normalizeValues(values);
      const availabilityPayload = buildAvailabilityPayload();
      const payloadWithAvailability = {
        ...payload,
        disponibilidades: availabilityPayload,
      };

      let avalResponse: Aval;
      let targetAvalId: string;

      if (editing) {
        avalResponse = await apiSingle(`avales/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payloadWithAvailability),
        });
        targetAvalId = editing.id;
      } else {
        avalResponse = await apiSingle("avales", { method: "POST", body: JSON.stringify(payloadWithAvailability) });
        targetAvalId = avalResponse.id;
      }

      const docUpdates = await uploadDocuments(targetAvalId);
      if (Object.keys(docUpdates).length > 0) {
        avalResponse = await apiSingle(`avales/${targetAvalId}`, { method: "PUT", body: JSON.stringify(docUpdates) });
      }

      await uploadBuroCredito(targetAvalId);
      return avalResponse;
    },
    onSuccess: (result) => {
      toast.success(editing ? "Aval actualizado" : "Aval registrado");
      queryClient.invalidateQueries({ queryKey: ["avales"] });
      if (result?.id) {
        queryClient.invalidateQueries({ queryKey: ["disponibilidades", result.id] });
      }
      setSelectedAvalId(result.id);
      handleClose();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error guardando aval"),
  });

  const columns: ColumnDef<Aval>[] = [
    { accessorKey: "nombre_completo", header: "Nombre" },
    { accessorKey: "email", header: "Correo" },
    { accessorKey: "telefono", header: "Teléfono" },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const aval = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => handleEdit(aval)}>
              Editar
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleDelete(aval)}>
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!selectedAval) {
        if (active) setDocumentGalleryItems([]);
        return;
      }

      const items = documentFields
        .map((field) => {
          const path = selectedAval[field.name];
          if (!path) return null;
          return {
            id: field.name,
            tipo: field.label,
            archivo_path: path,
            created_at: selectedAval.updated_at,
            notas: null,
          };
        })
        .filter(Boolean) as Array<{ id: string; tipo: string; archivo_path: string; created_at: string; notas: null }>;

      if (active) {
        setDocumentGalleryItems(items);
      }

      const enriched = await Promise.all(
        items.map(async (item) => {
          try {
            const url = await getStorageUrl(item.archivo_path, BUCKET);
            return { ...item, signed_url: url };
          } catch {
            return { ...item, signed_url: null };
          }
        })
      );

      if (active) {
        setDocumentGalleryItems(enriched);
      }
    };

    load().catch(() => {
      if (active) {
        setDocumentGalleryItems((prev) => prev);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedAval, getStorageUrl]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Avales</h1>
          <p className="text-sm text-muted-foreground">Gestiona los avales registrados y sus documentos.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : handleClose())}>
          <DialogTrigger asChild>
            <Button>Agregar aval</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar aval" : "Registrar aval"}</DialogTitle>
              <DialogDescription>Captura la información general del aval y adjunta los documentos correspondientes.</DialogDescription>
            </DialogHeader>
            <form className="space-y-6" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <section className="space-y-4">
                <FormGrid className="grid-cols-1 md:grid-cols-2">
                  <FormField control={form.control} name="nombre_completo" label="Nombre completo">
                    {(field) => <Input {...field} />}
                  </FormField>
                  <FormField control={form.control} name="edad" label="Edad">
                    {(field) => <Input type="number" min={18} {...field} />}
                  </FormField>
                  <FormField control={form.control} name="telefono" label="Teléfono">
                    {(field) => <Input {...field} placeholder="33 1234 5678" />}
                  </FormField>
                  <FormField control={form.control} name="email" label="Correo electrónico">
                    {(field) => <Input type="email" {...field} />}
                  </FormField>
                  <FormField control={form.control} name="estado_civil" label="Estado civil">
                    {(field) => <Input {...field} />}
                  </FormField>
                  <FormField control={form.control} name="domicilio_actual" label="Domicilio actual">
                    {(field) => <Input {...field} />}
                  </FormField>
                </FormGrid>
                <FormField control={form.control} name="notas" label="Notas">
                  {(field) => <Input {...field} />}
                </FormField>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={form.watch("activo")}
                    onChange={(event) => form.setValue("activo", event.target.checked)}
                  />
                  <Label>Activo</Label>
                </div>
              </section>

              <section className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">Disponibilidad semanal</h3>
                  <p className="text-sm text-muted-foreground">
                    Define los horarios por día (por ejemplo, Lunes 09:00&nbsp;–&nbsp;17:00) y duplica configuraciones hacia
                    otros días según sea necesario. Estos horarios se guardan como bloques recurrentes para determinar el aval
                    en turno.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Semana base
                  </Label>
                  <Input
                    type="date"
                    value={weekReference}
                    onChange={(event) => handleWeekReferenceChange(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usamos esta semana como referencia para calcular las fechas exactas de cada horario recurrente.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Semanas adicionales
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Replica la misma configuración de lunes a viernes en otras semanas. Ideal para programar varios turnos por
                    adelantado.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {additionalWeeks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No se han añadido semanas extra.</p>
                    ) : (
                      additionalWeeks.map((week) => (
                        <span
                          key={week}
                          className="flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground"
                        >
                          {formatWeekRangeLabel(week)}
                          <button
                            type="button"
                            className="text-muted-foreground transition hover:text-foreground"
                            onClick={() => removeAdditionalWeek(week)}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      type="date"
                      value={pendingWeekInput}
                      onChange={(event) => setPendingWeekInput(event.target.value)}
                      className="w-48"
                    />
                    <Button type="button" onClick={() => addAdditionalWeek(pendingWeekInput)} disabled={!pendingWeekInput}>
                      Agregar semana
                    </Button>
                    <Button type="button" variant="outline" onClick={addNextWeek}>
                      Agregar semana siguiente
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  {WEEK_DAYS.map((day) => {
                    const slots = weeklyAvailability[day.value];
                    return (
                      <div key={day.value} className="space-y-3 rounded-2xl border border-dashed border-border/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{day.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {slots.length > 0 ? `${slots.length} horario(s) configurados` : "Sin horarios para este día"}
                            </p>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={() => addSlot(day.value)}>
                            Agregar horario
                          </Button>
                        </div>

                        {slots.length > 0 ? (
                          <div className="space-y-3">
                            {slots.map((slot, index) => (
                              <div key={`${day.value}-${index}`} className="space-y-3 rounded-xl border border-border/80 bg-background/70 p-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      Inicio
                                    </Label>
                                    <Input
                                      type="time"
                                      value={slot.start}
                                      onChange={(event) => updateSlot(day.value, index, "start", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      Fin
                                    </Label>
                                    <Input
                                      type="time"
                                      value={slot.end}
                                      onChange={(event) => updateSlot(day.value, index, "end", event.target.value)}
                                    />
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <ToggleChip
                                    checked={slot.recurrente}
                                    onToggle={() => updateSlot(day.value, index, "recurrente", !slot.recurrente)}
                                  >
                                    Horario recurrente
                                  </ToggleChip>
                                  <Button type="button" variant="ghost" size="sm" onClick={() => removeSlot(day.value, index)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Quitar
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {slots.length > 0 ? (
                          <div className="space-y-2 border-t border-dashed border-border/70 pt-3">
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => {
                                if (copySourceDay === day.value) {
                                  setCopySourceDay(null);
                                  setCopyTargets([]);
                                } else {
                                  setCopySourceDay(day.value);
                                  setCopyTargets([]);
                                }
                              }}
                            >
                              Copiar a otros días
                            </Button>
                            {copySourceDay === day.value ? (
                              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/40 p-3">
                                <p className="text-xs font-medium text-muted-foreground">Selecciona los días destino:</p>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {WEEK_DAYS.filter((option) => option.value !== day.value).map((option) => (
                                    <ToggleChip
                                      key={option.value}
                                      checked={copyTargets.includes(option.value)}
                                      onToggle={() => toggleCopyTarget(option.value)}
                                      className="justify-start"
                                    >
                                      {option.short}
                                    </ToggleChip>
                                  ))}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    size="xs"
                                    onClick={() => applyCopyToTargets(day.value)}
                                    disabled={copyTargets.length === 0}
                                  >
                                    Aplicar
                                  </Button>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="ghost"
                                    onClick={() => {
                                      setCopySourceDay(null);
                                      setCopyTargets([]);
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold">Documentos</h3>
                  <p className="text-sm text-muted-foreground">
                    Carga archivos en formato PDF o imagen. El Buró de crédito admite PDF o ZIP e intentará desbloquearse de forma
                    automática cuando proporciones la clave del documento. Todo se almacena en Supabase Storage (solo lectura).
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {documentFields.map((field) => {
                    const currentPath = form.watch(field.name as keyof z.infer<typeof schema>) as string | null | undefined;
                    const selectedFile = files[field.name];
                    const accept = "accept" in field ? field.accept : undefined;
                    return (
                      <div key={field.name} className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4">
                        <div>
                          <p className="text-sm font-semibold">{field.label}</p>
                          {currentPath ? (
                            existingLinks[field.name] ? (
                              <a
                                href={existingLinks[field.name] ?? undefined}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary underline"
                              >
                                Ver archivo actual
                              </a>
                            ) : (
                              <p className="text-xs text-muted-foreground">Generando enlace seguro...</p>
                            )
                          ) : (
                            <p className="text-xs text-muted-foreground">No hay archivo cargado.</p>
                          )}
                        </div>
                        <input
                          type="file"
                          accept={accept ?? DEFAULT_ACCEPT}
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            setFiles((prev) => ({ ...prev, [field.name]: file }));
                          }}
                          className="w-full rounded-md border border-dashed border-border bg-background p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground"
                        />
                        {selectedFile ? (
                          <p className="text-xs text-muted-foreground">Seleccionado: {selectedFile.name}</p>
                        ) : null}
                        {field.name === "buro_credito_url" ? (
                          <FormField
                            control={form.control}
                            name="buro_credito_password"
                            label="Contraseña del Buró de crédito"
                            description="Ingresa la clave necesaria para abrir el archivo (si aplica)."
                          >
                            {(passwordField) => (
                              <Input
                                {...passwordField}
                                type="text"
                                placeholder="Ej. CLAVE-1234"
                                autoComplete="off"
                              />
                            )}
                          </FormField>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="self-start text-xs"
                          onClick={() => {
                            form.setValue(field.name as keyof z.infer<typeof schema>, "" as never);
                            if (field.name === "buro_credito_url") {
                              form.setValue("buro_credito_password", "" as never);
                            }
                            setFiles((prev) => ({ ...prev, [field.name]: null }));
                          }}
                        >
                          Quitar archivo
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>

              <DialogFooter>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Guardando..." : editing ? "Actualizar" : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1.65fr)]">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm ring-1 ring-black/5">
          <DataTable
            columns={columns}
            data={avales ?? []}
            searchKey="nombre_completo"
            searchPlaceholder="Buscar por nombre"
            onRowClick={(aval) => setSelectedAvalId(aval.id)}
            selectedRowId={selectedAvalId}
            getRowId={(aval) => aval.id}
          />
        </div>
        <div className="space-y-6">
          <DocumentGallery
            documents={documentGalleryItems}
            loading={Boolean(selectedAval) && documentGalleryItems.length === 0}
            title={selectedAval ? `Documentos de ${selectedAval.nombre_completo}` : "Documentos del aval"}
            description={
              selectedAval
                ? "Visualiza o descarga los archivos asociados. Actualiza la información editando el registro."
                : "Selecciona un aval para ver sus documentos."
            }
            emptyState={
              selectedAval
                ? "Aún no se han cargado documentos para este aval."
                : "Selecciona un aval para consultar sus documentos."
            }
          />

          <section className="rounded-2xl border border-border bg-card/40 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold">Disponibilidad registrada</p>
                <p className="text-sm text-muted-foreground">
                  {selectedAval
                    ? "Bloques de horario que se tomarán como referencia para turnos y calendarios públicos."
                    : "Selecciona un aval para consultar su disponibilidad."}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {!selectedAval ? (
                <p className="text-sm text-muted-foreground">Aún no seleccionas un aval.</p>
              ) : availabilityLoading ? (
                <Skeleton className="h-16 w-full rounded-xl" />
              ) : availabilityList.length > 0 ? (
                <ul className="space-y-3">
                  {availabilityList.map((block) => (
                    <li
                      key={block.id}
                      className="rounded-xl border border-dashed border-border/70 bg-background/60 p-3 text-sm shadow-sm"
                    >
                      <p className="font-medium text-foreground">
                        {formatAvailabilityRange(block.fecha_inicio, block.fecha_fin)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {block.recurrente ? "Bloque recurrente" : "Bloque puntual"}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay bloques de disponibilidad registrados todavía. Puedes añadirlos al editar el aval.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
