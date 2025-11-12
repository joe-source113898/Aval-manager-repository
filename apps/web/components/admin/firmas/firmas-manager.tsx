"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { z } from "zod";
import { toast } from "sonner";

import { DataTable } from "@/components/tables/data-table";
import { FormField, FormGrid } from "@/components/forms/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { useStorageProxy } from "@/hooks/use-storage-proxy";
import { useZodForm } from "@/hooks/use-zod-form";
import { clienteSchema, firmaSchema, inmobiliariaSchema } from "@/lib/schemas";
import { Asesor, Aval, Cliente, Firma, Inmobiliaria } from "@/lib/types";
import { toDateTimeLocal, toISOFromLocal } from "@/lib/utils";

const schema = firmaSchema.omit({ id: true });
const clienteInlineSchema = clienteSchema.omit({ id: true });
const inmobiliariaCreateSchema = inmobiliariaSchema.omit({ id: true });
const asesorInlineSchema = z.object({
  nombre: z.string().min(3, "Nombre requerido"),
  telefono: z
    .string()
    .trim()
    .min(7, "Teléfono inválido")
    .regex(/^[0-9+()\s-]+$/, { message: "Formato inválido" })
    .optional()
    .or(z.literal("")),
});
const BUCKET = "documentos-aval";
const CLIENTE_BUCKET = "documentos-aval";
const FILE_FIELDS = [
  { name: "solicitud_aval_url", label: "Solicitud de aval (PDF o imagen)", accept: "application/pdf,image/*" },
] as const;
const NO_ASESOR_SELECTION = "ninguno";

const createClienteFamiliares = () =>
  Array.from({ length: 2 }, () => ({
    nombre_completo: "",
    parentesco: "",
    telefono: "",
  }));

const createClienteConocidos = () =>
  Array.from({ length: 2 }, () => ({
    nombre_completo: "",
    telefono: "",
  }));

type FileFieldName = (typeof FILE_FIELDS)[number]["name"];

const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

function createEmptyFileMap<T>(value: T) {
  return Object.fromEntries(FILE_FIELDS.map(({ name }) => [name, value])) as Record<FileFieldName, T>;
}

function SummaryCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const ESTADO_VARIANT: Record<Firma["estado"], "default" | "success" | "warning" | "error" | "secondary"> = {
  programada: "secondary",
  reprogramada: "warning",
  realizada: "success",
  cancelada: "error",
};

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="space-y-4 rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm ring-1 ring-black/5 backdrop-blur-sm sm:p-5 lg:p-6">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function FirmasManager() {
  const queryClient = useQueryClient();
  const { supabaseClient } = useSessionContext();
  const router = useRouter();
  const api = useApi<Firma[]>();
  const apiSingle = useApi<Firma>();
  const avalesApi = useApi<Aval[]>();
  const asesoresApi = useApi<Asesor[]>();
  const asesorSingleApi = useApi<Asesor>();
  const clientesApi = useApi<Cliente[]>();
  const inmobiliariasApi = useApi<Inmobiliaria[]>();
  const inmobiliariaSingleApi = useApi<Inmobiliaria>();
  const clienteSingleApi = useApi<Cliente>();
  const getStorageUrl = useStorageProxy();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [inmobiliariaDialogOpen, setInmobiliariaDialogOpen] = useState(false);
  const [asesorDialogOpen, setAsesorDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Firma | null>(null);
  const [files, setFiles] = useState<Record<FileFieldName, File | null>>(() => createEmptyFileMap<File | null>(null));
  const [existingLinks, setExistingLinks] = useState<Record<FileFieldName, string | null>>(() =>
    createEmptyFileMap<string | null>(null)
  );
  const [clienteFile, setClienteFile] = useState<File | null>(null);
  const [selectedAsesorId, setSelectedAsesorId] = useState<string>("");

  const defaultValues = {
    cliente_id: "",
    aval_id: "",
    inmobiliaria_id: "",
    asesor_nombre: "",
    cliente_nombre: "",
    telefono: "",
    correo: "",
    tipo_renta: "",
    periodo_contrato_anios: 1,
    monto_renta: 0,
    propiedad_domicilio: "",
    ubicacion_maps_url: "",
    fecha_inicio: "",
    fecha_fin: "",
    estado: "programada" as const,
    canal_firma: "dueno_directo" as const,
    pago_por_servicio: 0,
    solicitud_aval_url: "",
    notas: "",
  };

  const form = useZodForm(schema, { defaultValues });
  const clienteForm = useZodForm(clienteInlineSchema, {
    defaultValues: {
      nombre_completo: "",
      identificacion_oficial_url: "",
      telefono: "",
      email: "",
      notas: "",
      referencias_familiares: createClienteFamiliares(),
      referencias_conocidos: createClienteConocidos(),
    },
  });
  const inmobiliariaForm = useZodForm(inmobiliariaCreateSchema, {
    defaultValues: {
      nombre: "",
      contacto: "",
      telefono: "",
      email: "",
      notas: "",
    },
  });
  const asesorForm = useZodForm(asesorInlineSchema, {
    defaultValues: {
      nombre: "",
      telefono: "",
    },
  });

  const { data: firmas } = useQuery({ queryKey: ["firmas"], queryFn: () => api("firmas") });
  const { data: avales } = useQuery({ queryKey: ["avales"], queryFn: () => avalesApi("avales") });
  const { data: clientes } = useQuery({ queryKey: ["clientes"], queryFn: () => clientesApi("clientes") });
  const { data: asesores } = useQuery({ queryKey: ["asesores"], queryFn: () => asesoresApi("asesores") });
  const { data: inmobiliarias } = useQuery({
    queryKey: ["inmobiliarias"],
    queryFn: () => inmobiliariasApi("inmobiliarias"),
  });
  const avalesMap = useMemo(() => new Map((avales ?? []).map((aval) => [aval.id, aval])), [avales]);
  const asesoresMap = useMemo(() => new Map((asesores ?? []).map((asesor) => [asesor.id, asesor])), [asesores]);
  const clientesMap = useMemo(() => new Map((clientes ?? []).map((cliente) => [cliente.id, cliente])), [clientes]);
  const inmobiliariasMap = useMemo(
    () => new Map((inmobiliarias ?? []).map((inmo) => [inmo.id, inmo])),
    [inmobiliarias]
  );
  const selectedClienteId = form.watch("cliente_id");
  const selectedInmobiliariaId = form.watch("inmobiliaria_id");
  const selectedCliente = selectedClienteId ? clientesMap.get(selectedClienteId) ?? null : null;
  const selectedAsesor = selectedAsesorId ? asesoresMap.get(selectedAsesorId) ?? null : null;
  const selectedInmobiliaria = selectedInmobiliariaId ? inmobiliariasMap.get(selectedInmobiliariaId) ?? null : null;

  useEffect(() => {
    if (!selectedCliente) return;
    form.setValue("cliente_nombre", selectedCliente.nombre_completo, { shouldDirty: true });
    form.setValue("telefono", selectedCliente.telefono ?? "", { shouldDirty: true });
    form.setValue("correo", selectedCliente.email ?? "", { shouldDirty: true });
  }, [selectedCliente, form]);

  useEffect(() => {
    if (!dialogOpen) return;
    const currentName = form.getValues("asesor_nombre")?.trim();
    if (!currentName) {
      setSelectedAsesorId("");
      return;
    }
    const match = asesores?.find((asesor) => asesor.nombre === currentName);
    setSelectedAsesorId(match?.id ?? "");
  }, [dialogOpen, asesores, form]);

  const handleClienteDialogClose = () => {
    setClienteDialogOpen(false);
    clienteForm.reset({
      nombre_completo: "",
      identificacion_oficial_url: "",
      telefono: "",
      email: "",
      notas: "",
      referencias_familiares: createClienteFamiliares(),
      referencias_conocidos: createClienteConocidos(),
    });
    setClienteFile(null);
  };

  const handleInmobiliariaDialogClose = () => {
    setInmobiliariaDialogOpen(false);
    inmobiliariaForm.reset({
      nombre: "",
      contacto: "",
      telefono: "",
      email: "",
      notas: "",
    });
  };

  const handleAsesorDialogClose = () => {
    setAsesorDialogOpen(false);
    asesorForm.reset({
      nombre: "",
      telefono: "",
    });
  };

  const clienteMutation = useMutation({
    mutationFn: async (values: z.infer<typeof clienteInlineSchema>) => {
      const referenciasFamiliares = values.referencias_familiares.map((ref) => ({
        nombre_completo: ref.nombre_completo.trim(),
        parentesco: ref.parentesco.trim(),
        telefono: ref.telefono.trim(),
      }));
      const referenciasConocidos = values.referencias_conocidos.map((ref) => ({
        nombre_completo: ref.nombre_completo.trim(),
        telefono: ref.telefono.trim(),
      }));
      const payload = {
        ...values,
        identificacion_oficial_url: values.identificacion_oficial_url || null,
        telefono: values.telefono || null,
        email: values.email || null,
        notas: values.notas || null,
        referencias_familiares: referenciasFamiliares,
        referencias_conocidos: referenciasConocidos,
      };
      const created = await clienteSingleApi("clientes", { method: "POST", body: JSON.stringify(payload) });

      if (created?.id && clienteFile && supabaseClient) {
        const timestamp = Date.now();
        const sanitized = sanitizeFileName(clienteFile.name);
        const path = `clientes/${created.id}/identificacion/${timestamp}-${sanitized}`;
        const { error } = await supabaseClient.storage.from(CLIENTE_BUCKET).upload(path, clienteFile, {
          cacheControl: "3600",
          upsert: true,
        });
        if (error) {
          throw new Error(`Error subiendo identificación: ${error.message}`);
        }
        await clienteSingleApi(`clientes/${created.id}`, {
          method: "PUT",
          body: JSON.stringify({ identificacion_oficial_url: path }),
        });
        created.identificacion_oficial_url = path;
      }

      return created;
    },
    onSuccess: (cliente) => {
      toast.success("Cliente registrado");
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      form.setValue("cliente_id", cliente.id, { shouldDirty: true });
      form.setValue("cliente_id", cliente.id, { shouldDirty: true });
      handleClienteDialogClose();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error guardando cliente"),
  });

  const inmobiliariaMutation = useMutation({
    mutationFn: async (values: z.infer<typeof inmobiliariaCreateSchema>) => {
      const payload = {
        ...values,
        contacto: values.contacto || null,
        telefono: values.telefono || null,
        email: values.email || null,
        notas: values.notas || null,
      };
      return inmobiliariaSingleApi("inmobiliarias", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: (inmobiliaria) => {
      toast.success("Inmobiliaria registrada");
      queryClient.invalidateQueries({ queryKey: ["inmobiliarias"] });
      form.setValue("inmobiliaria_id", inmobiliaria.id, { shouldDirty: true });
      handleInmobiliariaDialogClose();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error guardando inmobiliaria"),
  });

  const asesorMutation = useMutation({
    mutationFn: async (values: z.infer<typeof asesorInlineSchema>) => {
      const payload = {
        nombre: values.nombre.trim(),
        telefono: values.telefono?.trim() || null,
        pago_comision: 0,
        firmas_count: 0,
      };
      return asesorSingleApi("asesores", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: (asesor) => {
      toast.success("Asesor registrado");
      queryClient.invalidateQueries({ queryKey: ["asesores"] });
      setSelectedAsesorId(asesor.id);
      form.setValue("asesor_nombre", asesor.nombre, { shouldDirty: true });
      handleAsesorDialogClose();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error guardando asesor"),
  });

  const summary = useMemo(() => {
    const data = firmas ?? [];
    const counts = data.reduce(
      (acc, firma) => {
        acc[firma.estado] += 1;
        return acc;
      },
      { programada: 0, reprogramada: 0, realizada: 0, cancelada: 0 }
    );
    const recaudadoRealizadas = data
      .filter((firma) => firma.estado === "realizada")
      .reduce((acc, firma) => acc + (Number(firma.pago_por_servicio) || 0), 0);
    const recaudadoTotal = data.reduce((acc, firma) => acc + (Number(firma.pago_por_servicio) || 0), 0);
    const upcoming = data.filter((firma) => firma.estado === "programada" && new Date(firma.fecha_inicio) > new Date()).length;

    return {
      total: data.length,
      counts,
      recaudadoRealizadas,
      recaudadoTotal,
      upcoming,
    };
  }, [firmas]);

  const resetState = () => {
    setFiles(createEmptyFileMap<File | null>(null));
    setExistingLinks(createEmptyFileMap<string | null>(null));
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
    form.reset(defaultValues);
    resetState();
    setSelectedAsesorId("");
  };

  const sanitizeFileName = (filename: string) => {
    const lower = filename.toLowerCase().trim();
    const normalized = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const replaced = normalized.replace(/[^a-z0-9.]+/g, "-");
    const collapsed = replaced.replace(/-+/g, "-");
    const cleaned = collapsed.replace(/^-|-$/g, "");
    return cleaned || `archivo-${Date.now()}`;
  };

  const uploadFiles = async (firmaId: string) => {
    if (!supabaseClient) throw new Error("Supabase no disponible para subir archivos");
    const updates: Partial<Record<FileFieldName, string>> = {};
    for (const field of FILE_FIELDS) {
      const file = files[field.name];
      if (!file) continue;
      const timestamp = Date.now();
      const sanitized = sanitizeFileName(file.name);
      const path = `firmas/${firmaId}/${field.name}/${timestamp}-${sanitized}`;
      const { error } = await supabaseClient.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (error) {
        throw new Error(`Error subiendo ${field.label}: ${error.message}`);
      }
      updates[field.name] = path;
    }
    return updates;
  };

  const normalizeValues = (values: z.infer<typeof schema>) => {
    const normalized: Record<string, unknown> = { ...values };
    const nullableFields: (keyof typeof normalized)[] = [
      "telefono",
      "correo",
      "solicitud_aval_url",
      "notas",
    ];
    nullableFields.forEach((field) => {
      const value = normalized[field];
      if (typeof value === "string" && value.trim() === "") {
        normalized[field] = null;
      }
    });
    if (!normalized.fecha_fin) {
      normalized.fecha_fin = normalized.fecha_inicio;
    }
    if (normalized.cliente_id === "") {
      normalized.cliente_id = null;
    }
    if (normalized.inmobiliaria_id === "") {
      normalized.inmobiliaria_id = null;
    }
    return normalized as z.infer<typeof schema>;
  };

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const normalized = normalizeValues(values);
      const payload = {
        ...normalized,
        periodo_contrato_anios: Number(normalized.periodo_contrato_anios),
        monto_renta: Number(normalized.monto_renta),
        pago_por_servicio: Number(normalized.pago_por_servicio),
        fecha_inicio: toISOFromLocal(normalized.fecha_inicio),
        fecha_fin: toISOFromLocal(normalized.fecha_fin || normalized.fecha_inicio),
      };

      if (editing) {
        const updated = await apiSingle(`firmas/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        const fileUpdates = await uploadFiles(editing.id);
        if (Object.keys(fileUpdates).length > 0) {
          return apiSingle(`firmas/${editing.id}`, { method: "PUT", body: JSON.stringify(fileUpdates) });
        }
        return updated;
      }

      const created = await apiSingle("firmas", { method: "POST", body: JSON.stringify(payload) });
      const fileUpdates = await uploadFiles(created.id);
      if (Object.keys(fileUpdates).length > 0) {
        return apiSingle(`firmas/${created.id}`, { method: "PUT", body: JSON.stringify(fileUpdates) });
      }
      return created;
    },
    onSuccess: () => {
      toast.success(editing ? "Firma actualizada" : "Firma registrada");
      queryClient.invalidateQueries({ queryKey: ["firmas"] });
      handleClose();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error guardando firma"),
  });

  const handleEdit = (firma: Firma) => {
    setEditing(firma);
    form.reset({
      cliente_id: firma.cliente_id ?? "",
      aval_id: firma.aval_id,
      inmobiliaria_id: firma.inmobiliaria_id ?? "",
      asesor_nombre: firma.asesor_nombre,
      cliente_nombre: firma.cliente_nombre,
      telefono: firma.telefono ?? "",
      correo: firma.correo ?? "",
      tipo_renta: firma.tipo_renta,
      periodo_contrato_anios: firma.periodo_contrato_anios,
      monto_renta: Number(firma.monto_renta),
      propiedad_domicilio: firma.propiedad_domicilio,
      ubicacion_maps_url: firma.ubicacion_maps_url,
      fecha_inicio: toDateTimeLocal(firma.fecha_inicio),
      fecha_fin: toDateTimeLocal(firma.fecha_fin ?? firma.fecha_inicio),
      estado: firma.estado,
      canal_firma: firma.canal_firma,
      pago_por_servicio: Number(firma.pago_por_servicio),
      solicitud_aval_url: firma.solicitud_aval_url ?? "",
      notas: firma.notas ?? "",
    });
    const matchingAsesor = asesores?.find((asesor) => asesor.nombre === firma.asesor_nombre);
    setSelectedAsesorId(matchingAsesor?.id ?? "");
    setDialogOpen(true);
  };

  useEffect(() => {
    let active = true;
    const loadLinks = async () => {
      if (!editing) {
        if (active) resetState();
        return;
      }
      const entries = await Promise.all(
        FILE_FIELDS.map(async ({ name }) => {
          const path = editing[name] as string | null | undefined;
          if (!path) return [name, null];
          try {
            const url = await getStorageUrl(path, BUCKET);
            return [name, url];
          } catch {
            return [name, null];
          }
        })
      );
      if (active) {
        setExistingLinks(Object.fromEntries(entries) as Record<FileFieldName, string | null>);
      }
    };

    loadLinks().catch(() => {
      if (active) resetState();
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, getStorageUrl]);

  const handleDelete = async (firma: Firma) => {
    if (!confirm(`¿Eliminar la firma de ${firma.cliente_nombre}?`)) return;
    try {
      await apiSingle(`firmas/${firma.id}`, { method: "DELETE" });
      toast.success("Firma eliminada");
      queryClient.invalidateQueries({ queryKey: ["firmas"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error eliminando firma");
    }
  };

  const columns: ColumnDef<Firma>[] = [
    {
      accessorKey: "cliente_nombre",
      header: "Cliente / Asesor",
      cell: ({ row }) => (
        <div className="space-y-1">
          <p className="font-medium leading-none">{row.original.cliente_nombre}</p>
          <p className="text-xs text-muted-foreground">Asesor: {row.original.asesor_nombre}</p>
        </div>
      ),
    },
    {
      header: "Aval asignado",
      cell: ({ row }) => avalesMap.get(row.original.aval_id)?.nombre_completo ?? "—",
    },
    {
      accessorKey: "fecha_inicio",
      header: "Día y hora",
      cell: ({ row }) =>
        new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(row.original.fecha_inicio)
        ),
    },
    {
      accessorKey: "tipo_renta",
      header: "Tipo de renta",
    },
    {
      accessorKey: "canal_firma",
      header: "Administrador de la propiedad",
      cell: ({ row }) =>
        row.original.canal_firma === "inmobiliaria" ? "Inmobiliaria" : "Dueño directo",
    },
    {
      header: "Inmobiliaria",
      cell: ({ row }) =>
        row.original.inmobiliaria_id
          ? inmobiliariasMap.get(row.original.inmobiliaria_id)?.nombre ?? "—"
          : "—",
    },
    {
      accessorKey: "monto_renta",
      header: "Monto de renta",
      cell: ({ row }) => currencyFormatter.format(Number(row.original.monto_renta) || 0),
    },
    {
      accessorKey: "pago_por_servicio",
      header: "Pago del servicio",
      cell: ({ row }) => currencyFormatter.format(Number(row.original.pago_por_servicio) || 0),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={ESTADO_VARIANT[row.original.estado]}>
          {row.original.estado.charAt(0).toUpperCase() + row.original.estado.slice(1)}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const firma = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(firma)}>
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/admin/firmas?tab=pagos&firma=${firma.id}`)}
            >
              Ver pagos
            </Button>
            {firma.ubicacion_maps_url ? (
              <Button variant="outline" size="sm" asChild>
                <a href={firma.ubicacion_maps_url} target="_blank" rel="noopener noreferrer">
                  Ver mapa
                </a>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => handleDelete(firma)}>
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Firmas</h1>
            <p className="text-sm text-muted-foreground">
              Registra cada firma con sus datos operativos, documentación y comprobantes en un único paso.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : handleClose())}>
            <DialogTrigger asChild>
              <Button>Registrar firma</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[min(96vw,960px)]">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar firma" : "Nueva firma"}</DialogTitle>
                <DialogDescription>
                  Captura la información completa de la firma, adjunta la solicitud y agrega el comprobante de pago si
                  aplica.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-6" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
                <FormSection
                  title="Personas involucradas"
                  description="Separación clara entre asesor, cliente y sus medios de contacto."
                >
                  <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                    <div className="space-y-3 rounded-2xl border border-border/60 bg-background/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Asesor</p>
                      <FormField control={form.control} name="asesor_nombre">
                        {(field) => (
                          <div className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Select
                                value={selectedAsesorId || NO_ASESOR_SELECTION}
                                onValueChange={(value) => {
                                  if (value === NO_ASESOR_SELECTION) {
                                    setSelectedAsesorId("");
                                    field.onChange("");
                                    return;
                                  }
                                  setSelectedAsesorId(value);
                                  const asesor = asesoresMap.get(value);
                                  field.onChange(asesor?.nombre ?? "");
                                }}
                              >
                                <SelectTrigger className="sm:w-64">
                                  <SelectValue placeholder="Selecciona asesor" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NO_ASESOR_SELECTION}>Sin seleccionar</SelectItem>
                                  {(asesores ?? []).map((asesor) => (
                                    <SelectItem key={asesor.id} value={asesor.id}>
                                      {asesor.nombre}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button type="button" variant="outline" size="sm" onClick={() => setAsesorDialogOpen(true)}>
                                Registrar nuevo asesor
                              </Button>
                            </div>
                            {selectedAsesor ? (
                              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                                <p className="font-semibold text-foreground">{selectedAsesor.nombre}</p>
                                <p>{selectedAsesor.telefono || "Sin teléfono"}</p>
                              </div>
                            ) : null}
                            <div className="space-y-2">
                              <Label className="text-sm font-medium text-foreground">Nombre del asesor</Label>
                              <Input
                                placeholder="Quien gestionó la firma"
                                {...field}
                                disabled={Boolean(selectedAsesorId)}
                                onChange={(event) => {
                                  setSelectedAsesorId("");
                                  field.onChange(event.target.value);
                                }}
                              />
                              {selectedAsesorId ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  className="text-xs text-muted-foreground"
                                  onClick={() => setSelectedAsesorId("")}
                                >
                                  Usar otro nombre
                                </Button>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Escribe el nombre si aún no tienes al asesor registrado.
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </FormField>
                    </div>
                    <div className="space-y-4 rounded-2xl border border-border/60 bg-background/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</p>
                      <div className="space-y-2">
                        <FormField control={form.control} name="cliente_id" label="Selecciona un cliente registrado">
                          {(field) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona cliente" />
                              </SelectTrigger>
                              <SelectContent>
                                {(clientes ?? []).map((cliente) => (
                                  <SelectItem key={cliente.id} value={cliente.id}>
                                    {cliente.nombre_completo}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </FormField>
                        <Button size="sm" variant="outline" type="button" onClick={() => setClienteDialogOpen(true)}>
                          Registrar nuevo cliente
                        </Button>
                      </div>
                      {selectedCliente ? (
                        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                          <p className="font-semibold text-foreground">{selectedCliente.nombre_completo}</p>
                          <p>{selectedCliente.email || "Sin correo"}</p>
                          <p>{selectedCliente.telefono || "Sin teléfono"}</p>
                        </div>
                      ) : null}
                      <FormField control={form.control} name="cliente_nombre" label="Nombre del cliente">
                        {(field) => <Input placeholder="Cliente asociado a la firma" {...field} />}
                      </FormField>
                      <FormGrid>
                        <FormField control={form.control} name="telefono" label="Teléfono del cliente">
                          {(field) => <Input type="tel" placeholder="33..." {...field} />}
                        </FormField>
                        <FormField control={form.control} name="correo" label="Correo del cliente">
                          {(field) => <Input type="email" placeholder="cliente@correo.com" {...field} />}
                        </FormField>
                      </FormGrid>
                    </div>
                  </div>
                </FormSection>

                <FormSection
                  title="Asignación y canal"
                  description="Selecciona el aval responsable y define si la firma proviene de una inmobiliaria o dueño directo."
                >
                  <FormGrid>
                    <FormField control={form.control} name="aval_id" label="Aval que firma">
                      {(field) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona aval" />
                          </SelectTrigger>
                          <SelectContent>
                            {(avales ?? []).length === 0 ? (
                              <SelectItem value="no-avales" disabled>
                                No hay avales registrados
                              </SelectItem>
                            ) : null}
                            {(avales ?? []).map((aval) => (
                              <SelectItem key={aval.id} value={aval.id}>
                                {aval.nombre_completo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>
                    <FormField control={form.control} name="canal_firma" label="Origen de la firma">
                      {(field) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona canal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inmobiliaria">Inmobiliaria</SelectItem>
                            <SelectItem value="dueno_directo">Dueño directo</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </FormField>
                    <FormField control={form.control} name="inmobiliaria_id" label="Inmobiliaria (opcional)">
                      {(field) => (
                        <div className="space-y-2">
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona inmobiliaria" />
                            </SelectTrigger>
                            <SelectContent>
                              {(inmobiliarias ?? []).map((inmo) => (
                                <SelectItem key={inmo.id} value={inmo.id}>
                                  {inmo.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" size="sm" variant="outline" onClick={() => setInmobiliariaDialogOpen(true)}>
                            Registrar inmobiliaria
                          </Button>
                          {selectedInmobiliaria ? (
                            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                              <p className="font-semibold text-foreground">{selectedInmobiliaria.nombre}</p>
                              <p>{selectedInmobiliaria.contacto || "Sin contacto"}</p>
                              <p>{selectedInmobiliaria.telefono || "Sin teléfono"}</p>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </FormField>
                  </FormGrid>
                </FormSection>

                <FormSection
                  title="Detalles del contrato"
                  description="Información económica y operativa del arrendamiento."
                >
                  <FormGrid>
                    <FormField control={form.control} name="tipo_renta" label="Tipo de renta">
                      {(field) => <Input placeholder="Habitacional, comercial, etc." {...field} />}
                    </FormField>
                    <FormField control={form.control} name="periodo_contrato_anios" label="Periodo del contrato (años)">
                      {(field) => <Input type="number" min={0} step="1" {...field} />}
                    </FormField>
                  </FormGrid>
                  <FormGrid>
                    <FormField control={form.control} name="monto_renta" label="Monto de renta ($ MXN)">
                      {(field) => <Input type="number" min={0} step="0.01" {...field} />}
                    </FormField>
                    <FormField control={form.control} name="pago_por_servicio" label="Pago por el servicio ($ MXN)">
                      {(field) => <Input type="number" min={0} step="0.01" {...field} />}
                    </FormField>
                  </FormGrid>
                  <FormField control={form.control} name="propiedad_domicilio" label="Propiedad a rentarse (domicilio)">
                    {(field) => <Input placeholder="Domicilio completo de la propiedad" {...field} />}
                  </FormField>
                </FormSection>

                <FormSection title="Programación" description="Horarios, ubicación de firma y estado actual.">
                  <FormGrid>
                    <FormField control={form.control} name="fecha_inicio" label="Día y hora">
                      {(field) => <Input type="datetime-local" {...field} />}
                    </FormField>
                    <FormField control={form.control} name="ubicacion_maps_url" label="Ubicación (Google Maps)">
                      {(field) => <Input placeholder="https://maps.google.com/..." {...field} />}
                    </FormField>
                  </FormGrid>
                  <FormField control={form.control} name="estado" label="Estatus">
                    {(field) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona estatus" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="programada">Programada</SelectItem>
                          <SelectItem value="realizada">Realizada</SelectItem>
                          <SelectItem value="reprogramada">Reprogramada</SelectItem>
                          <SelectItem value="cancelada">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                  <FormField control={form.control} name="notas" label="Notas adicionales">
                    {(field) => (
                      <Textarea placeholder="Información adicional relevante para la firma" {...field} value={field.value ?? ""} />
                    )}
                  </FormField>
                </FormSection>

                <FormSection title="Documentación" description="Solicitud de aval y comprobante de pago si aplica.">
                  <div className="grid gap-4 md:grid-cols-2">
                    {FILE_FIELDS.map((fileField) => (
                      <FormField
                        key={fileField.name}
                        control={form.control}
                        name={fileField.name}
                        label={fileField.label}
                      >
                        {({ name }) => {
                          const currentValue = form.watch(fileField.name as keyof z.infer<typeof schema>);
                          return (
                            <div className="space-y-3 rounded-2xl border border-dashed border-border/70 bg-background/70 p-4">
                            <Input
                              id={name}
                              type="file"
                              accept={fileField.accept}
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                setFiles((prev) => ({ ...prev, [fileField.name]: file }));
                                setExistingLinks((prev) => ({ ...prev, [fileField.name]: null }));
                                form.setValue(fileField.name, file ? file.name : "", { shouldDirty: true });
                              }}
                            />
                            {files[fileField.name] ? (
                              <p className="text-xs text-muted-foreground">
                                Archivo seleccionado: {files[fileField.name]?.name}
                              </p>
                            ) : existingLinks[fileField.name] ? (
                              <Button asChild size="sm" variant="outline">
                                <a href={existingLinks[fileField.name] ?? ""} target="_blank" rel="noopener noreferrer">
                                  Ver archivo actual
                                </a>
                              </Button>
                            ) : currentValue ? (
                              <p className="text-xs text-muted-foreground">Generando enlace seguro...</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">Formatos aceptados: PDF, JPG o PNG.</p>
                            )}
                            </div>
                          );
                        }}
                      </FormField>
                    ))}
                  </div>
                </FormSection>

                <DialogFooter>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Guardando..." : editing ? "Actualizar firma" : "Registrar firma"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Firmas registradas"
            value={summary.total.toString()}
            hint={`${summary.counts.programada} programadas / ${summary.counts.reprogramada} reprogramadas`}
          />
          <SummaryCard
            title="Firmas realizadas"
            value={summary.counts.realizada.toString()}
            hint={`${currencyFormatter.format(summary.recaudadoRealizadas)} recaudado con firma concluida`}
          />
          <SummaryCard
            title="Ingreso acumulado"
            value={currencyFormatter.format(summary.recaudadoTotal)}
            hint="Incluye todas las firmas registradas"
          />
          <SummaryCard
            title="Próximas firmas programadas"
            value={summary.upcoming.toString()}
            hint={`${summary.counts.cancelada} canceladas hasta ahora`}
          />
        </section>
      </header>

      <DataTable
        columns={columns}
        data={firmas ?? []}
        searchKey="cliente_nombre"
        searchPlaceholder="Buscar por cliente o asesor"
      />
      <Dialog
        open={clienteDialogOpen}
        onOpenChange={(open) => (open ? setClienteDialogOpen(true) : handleClienteDialogClose())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar cliente</DialogTitle>
            <DialogDescription>Captura los datos del nuevo cliente y lo vincularemos a la firma.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={clienteForm.handleSubmit((values) => clienteMutation.mutate(values))}>
            <FormField control={clienteForm.control} name="nombre_completo" label="Nombre completo">
              {(field) => <Input {...field} />}
            </FormField>
            <FormGrid>
              <FormField control={clienteForm.control} name="email" label="Correo">
                {(field) => <Input type="email" {...field} />}
              </FormField>
              <FormField control={clienteForm.control} name="telefono" label="Teléfono">
                {(field) => <Input {...field} />}
              </FormField>
            </FormGrid>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Subir identificación (PDF o imagen)</label>
              <Input
                type="file"
                accept="application/pdf,image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setClienteFile(file);
                }}
              />
              {clienteFile ? (
                <p className="text-xs text-muted-foreground">Seleccionado: {clienteFile.name}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Opcional, se almacenará en Storage.</p>
              )}
            </div>
            <FormField control={clienteForm.control} name="notas" label="Notas">
              {(field) => <Input {...field} />}
            </FormField>
            <div className="space-y-3 rounded-2xl border border-dashed border-border/70 p-4">
              <div>
                <p className="text-sm font-semibold">Referencias familiares</p>
                <p className="text-xs text-muted-foreground">Dos contactos con parentesco y teléfono.</p>
              </div>
              {clienteForm.watch("referencias_familiares").map((_, index) => (
                <div key={`cliente-familiar-${index}`} className="rounded-xl border border-border/50 bg-muted/10 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Familiar {index + 1}</p>
                  <FormField
                    control={clienteForm.control}
                    name={`referencias_familiares.${index}.nombre_completo` as const}
                    label="Nombre completo"
                  >
                    {(field) => <Input {...field} />}
                  </FormField>
                  <FormGrid>
                    <FormField
                      control={clienteForm.control}
                      name={`referencias_familiares.${index}.parentesco` as const}
                      label="Parentesco"
                    >
                      {(field) => <Input {...field} />}
                    </FormField>
                    <FormField
                      control={clienteForm.control}
                      name={`referencias_familiares.${index}.telefono` as const}
                      label="Teléfono"
                    >
                      {(field) => <Input {...field} />}
                    </FormField>
                  </FormGrid>
                </div>
              ))}
            </div>
            <div className="space-y-3 rounded-2xl border border-dashed border-border/70 p-4">
              <div>
                <p className="text-sm font-semibold">Referencias conocidas</p>
                <p className="text-xs text-muted-foreground">Personas que no sean familiares.</p>
              </div>
              {clienteForm.watch("referencias_conocidos").map((_, index) => (
                <div key={`cliente-conocido-${index}`} className="rounded-xl border border-border/50 bg-muted/10 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Conocido {index + 1}</p>
                  <FormField
                    control={clienteForm.control}
                    name={`referencias_conocidos.${index}.nombre_completo` as const}
                    label="Nombre completo"
                  >
                    {(field) => <Input {...field} />}
                  </FormField>
                  <FormField
                    control={clienteForm.control}
                    name={`referencias_conocidos.${index}.telefono` as const}
                    label="Teléfono"
                  >
                    {(field) => <Input {...field} />}
                  </FormField>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={clienteMutation.isPending}>
                {clienteMutation.isPending ? "Guardando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={asesorDialogOpen}
        onOpenChange={(open) => (open ? setAsesorDialogOpen(true) : handleAsesorDialogClose())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar asesor</DialogTitle>
            <DialogDescription>Da de alta al asesor para reutilizarlo en firmas futuras.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={asesorForm.handleSubmit((values) => asesorMutation.mutate(values))}>
            <FormField control={asesorForm.control} name="nombre" label="Nombre completo">
              {(field) => <Input placeholder="Nombre y apellidos" {...field} />}
            </FormField>
            <FormField control={asesorForm.control} name="telefono" label="Teléfono">
              {(field) => <Input type="tel" placeholder="33..." {...field} />}
            </FormField>
            <DialogFooter>
              <Button type="submit" disabled={asesorMutation.isPending}>
                {asesorMutation.isPending ? "Guardando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={inmobiliariaDialogOpen}
        onOpenChange={(open) => (open ? setInmobiliariaDialogOpen(true) : handleInmobiliariaDialogClose())}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar inmobiliaria</DialogTitle>
            <DialogDescription>Captura los datos de la inmobiliaria y la vincularemos a tus firmas.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={inmobiliariaForm.handleSubmit((values) => inmobiliariaMutation.mutate(values))}
          >
            <FormField control={inmobiliariaForm.control} name="nombre" label="Nombre comercial">
              {(field) => <Input {...field} />}
            </FormField>
            <FormGrid>
              <FormField control={inmobiliariaForm.control} name="contacto" label="Contacto">
                {(field) => <Input {...field} />}
              </FormField>
              <FormField control={inmobiliariaForm.control} name="telefono" label="Teléfono">
                {(field) => <Input {...field} />}
              </FormField>
            </FormGrid>
            <FormField control={inmobiliariaForm.control} name="email" label="Correo">
              {(field) => <Input type="email" {...field} />}
            </FormField>
            <FormField control={inmobiliariaForm.control} name="notas" label="Notas">
              {(field) => <Input {...field} />}
            </FormField>
            <DialogFooter>
              <Button type="submit" disabled={inmobiliariaMutation.isPending}>
                {inmobiliariaMutation.isPending ? "Guardando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
