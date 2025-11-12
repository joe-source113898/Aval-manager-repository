"use client";

import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";

import { DataTable } from "@/components/tables/data-table";
import { FormField, FormGrid } from "@/components/forms/form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useApi } from "@/hooks/use-api";
import { useStorageProxy } from "@/hooks/use-storage-proxy";
import { useZodForm } from "@/hooks/use-zod-form";
import { pagoComisionSchema, pagoServicioFormSchema } from "@/lib/schemas";
import { Asesor, Aval, Firma, PagoCorte, PagoComision, PagoServicio } from "@/lib/types";
import { toDateTimeLocal, toISOFromLocal } from "@/lib/utils";

const servicioSchema = pagoServicioFormSchema;
const comisionSchema = pagoComisionSchema.omit({ id: true });

const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const dateFormatter = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });
const STORAGE_BUCKET = "documentos-aval";
const formatStatus = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export function PagosManager() {
  const queryClient = useQueryClient();
  const { supabaseClient } = useSessionContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firmaParam = searchParams.get("firma") ?? "";

  const firmasApi = useApi<Firma[]>();
  const avalesApi = useApi<Aval[]>();
  const asesoresApi = useApi<Asesor[]>();
  const pagosServicioApi = useApi<PagoServicio[]>();
  const pagoServicioSingle = useApi<PagoServicio>();
  const pagosComisionApi = useApi<PagoComision[]>();
  const pagoComisionSingle = useApi<PagoComision>();
  const cortesApi = useApi<PagoCorte[]>();
  const corteSingle = useApi<PagoCorte>();
  const getStorageUrl = useStorageProxy();

  const { data: firmas } = useQuery({ queryKey: ["firmas"], queryFn: () => firmasApi("firmas") });
  const { data: avales } = useQuery({ queryKey: ["avales"], queryFn: () => avalesApi("avales") });
  const { data: asesores } = useQuery({ queryKey: ["asesores"], queryFn: () => asesoresApi("asesores") });
  const { data: pagosServicio } = useQuery({
    queryKey: ["pagos-servicio"],
    queryFn: () => pagosServicioApi("pagos-servicio"),
  });
  const { data: pagosComision } = useQuery({
    queryKey: ["pagos-comisiones"],
    queryFn: () => pagosComisionApi("pagos-comisiones"),
  });
  const { data: cortes } = useQuery({
    queryKey: ["pagos-cortes"],
    queryFn: () => cortesApi("pagos/cortes"),
  });

  const [servicioDialogOpen, setServicioDialogOpen] = useState(false);
  const [servicioEditing, setServicioEditing] = useState<PagoServicio | null>(null);
  const [comisionDialogOpen, setComisionDialogOpen] = useState(false);
  const [comisionEditing, setComisionEditing] = useState<PagoComision | null>(null);
  const [corteForm, setCorteForm] = useState({
    fecha_inicio: "",
    fecha_fin: "",
    incluir_servicios: true,
    incluir_comisiones: true,
  });
  const [servicioFile, setServicioFile] = useState<File | null>(null);
  const [comisionFile, setComisionFile] = useState<File | null>(null);
  const [firmaFilter, setFirmaFilter] = useState(firmaParam);

  const sanitizeFileName = (filename: string) => {
    const normalized = filename.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleaned = normalized.replace(/[^a-zA-Z0-9._-]+/g, "-");
    return cleaned.replace(/-+/g, "-").toLowerCase();
  };

  const uploadComprobante = async (file: File, folder: string) => {
    if (!supabaseClient) {
      throw new Error("Supabase no disponible para subir comprobantes");
    }
    const trimmedFolder = folder.replace(/^\/*/, "").replace(/\/*$/, "");
    const path = `${trimmedFolder}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const { error } = await supabaseClient.storage.from(STORAGE_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      throw new Error(`Error subiendo comprobante: ${error.message}`);
    }
    return path;
  };

  const servicioForm = useZodForm(servicioSchema, {
    defaultValues: {
      firma_id: "",
      monto_efectivo: 0,
      monto_transferencia: 0,
      fecha_pago: "",
      comprobante_url: "",
      notas: "",
      estado: "registrado",
      corte_id: "",
    },
  });

  const comisionForm = useZodForm(comisionSchema, {
    defaultValues: {
      beneficiario_tipo: "asesor",
      beneficiario_id: "",
      firma_id: "",
      monto: 0,
      metodo: "",
      fecha_programada: "",
      fecha_pago: "",
      comprobante_url: "",
      notas: "",
      estado: "pendiente",
      corte_id: "",
    },
  });

  useEffect(() => {
    setFirmaFilter(firmaParam);
  }, [firmaParam]);

  const syncFirmaParam = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("firma", value);
    } else {
      params.delete("firma");
    }
    params.set("tab", "pagos");
    const qs = params.toString();
    router.replace(`${pathname}?${qs}`, { scroll: false });
  };

  const handleFirmaFilterChange = (value: string) => {
    const normalized = value === "todos" ? "" : value;
    setFirmaFilter(normalized);
    syncFirmaParam(normalized);
  };

  const resetServicioForm = (firmaId?: string) =>
    servicioForm.reset({
      firma_id: firmaId ?? "",
      monto_efectivo: 0,
      monto_transferencia: 0,
      fecha_pago: "",
      comprobante_url: "",
      notas: "",
      estado: "registrado",
      corte_id: "",
    });

  const resetComisionForm = (firmaId?: string) =>
    comisionForm.reset({
      beneficiario_tipo: "asesor",
      beneficiario_id: "",
      firma_id: firmaId ?? "",
      monto: 0,
      metodo: "",
      fecha_programada: "",
      fecha_pago: "",
      comprobante_url: "",
      notas: "",
      estado: "pendiente",
      corte_id: "",
    });

  const handleServicioClose = () => {
    setServicioDialogOpen(false);
    setServicioEditing(null);
    resetServicioForm();
    setServicioFile(null);
  };

  const handleComisionClose = () => {
    setComisionDialogOpen(false);
    setComisionEditing(null);
    resetComisionForm();
    setComisionFile(null);
  };

  const servicioMutation = useMutation({
    mutationFn: async (values: z.infer<typeof servicioSchema>) => {
      let comprobantePath = values.comprobante_url?.trim() || null;
      if (servicioFile) {
        comprobantePath = await uploadComprobante(servicioFile, `pagos/servicio/${values.firma_id}`);
      }
      const payload = {
        ...values,
        monto_efectivo: Number(values.monto_efectivo),
        monto_transferencia: Number(values.monto_transferencia),
        fecha_pago: values.fecha_pago ? toISOFromLocal(values.fecha_pago) : null,
        comprobante_url: comprobantePath,
        notas: values.notas?.trim() || null,
        corte_id: values.corte_id?.trim() || null,
      };
      if (servicioEditing) {
        return pagoServicioSingle(`pagos-servicio/${servicioEditing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      return pagoServicioSingle("pagos-servicio", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast.success(servicioEditing ? "Pago actualizado" : "Pago registrado");
      queryClient.invalidateQueries({ queryKey: ["pagos-servicio"] });
      queryClient.invalidateQueries({ queryKey: ["pagos-cortes"] });
      handleServicioClose();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Error guardando pago de servicio"),
  });

  const comisionMutation = useMutation({
    mutationFn: async (values: z.infer<typeof comisionSchema>) => {
      let comprobantePath = values.comprobante_url?.trim() || null;
      if (comisionFile) {
        comprobantePath = await uploadComprobante(
          comisionFile,
          `pagos/comisiones/${values.firma_id}/${values.beneficiario_tipo}`
        );
      }
      const payload = {
        ...values,
        monto: Number(values.monto),
        metodo: values.metodo || null,
        fecha_programada: values.fecha_programada ? toISOFromLocal(values.fecha_programada) : null,
        fecha_pago: values.fecha_pago ? toISOFromLocal(values.fecha_pago) : null,
        comprobante_url: comprobantePath,
        notas: values.notas?.trim() || null,
        corte_id: values.corte_id?.trim() || null,
      };
      if (comisionEditing) {
        return pagoComisionSingle(`pagos-comisiones/${comisionEditing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      return pagoComisionSingle("pagos-comisiones", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast.success(comisionEditing ? "Registro actualizado" : "Comisión registrada");
      queryClient.invalidateQueries({ queryKey: ["pagos-comisiones"] });
      queryClient.invalidateQueries({ queryKey: ["pagos-cortes"] });
      handleComisionClose();
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Error guardando comisión"),
  });

  const corteMutation = useMutation({
    mutationFn: async () => {
      if (!corteForm.fecha_inicio || !corteForm.fecha_fin) {
        throw new Error("Selecciona el rango de fechas.");
      }
      const payload = {
        fecha_inicio: corteForm.fecha_inicio,
        fecha_fin: corteForm.fecha_fin,
        incluir_servicios: corteForm.incluir_servicios,
        incluir_comisiones: corteForm.incluir_comisiones,
      };
      return corteSingle("pagos/cortes", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: (corte) => {
      toast.success("Corte generado");
      queryClient.invalidateQueries({ queryKey: ["pagos-servicio"] });
      queryClient.invalidateQueries({ queryKey: ["pagos-comisiones"] });
      queryClient.invalidateQueries({ queryKey: ["pagos-cortes"] });
      if (corte.pdf_url) window.open(corte.pdf_url, "_blank", "noopener,noreferrer");
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "No se pudo generar el corte"),
  });

  const servicioData = useMemo(
    () => (firmaFilter ? (pagosServicio ?? []).filter((pago) => pago.firma_id === firmaFilter) : pagosServicio ?? []),
    [pagosServicio, firmaFilter]
  );
  const comisionData = useMemo(
    () => (firmaFilter ? (pagosComision ?? []).filter((pago) => pago.firma_id === firmaFilter) : pagosComision ?? []),
    [pagosComision, firmaFilter]
  );
  const totalServicio = useMemo(
    () =>
      servicioData.reduce(
        (acc, pago) => acc + Number(pago.monto_efectivo || 0) + Number(pago.monto_transferencia || 0),
        0
      ),
    [servicioData]
  );
  const totalComisiones = useMemo(
    () => comisionData.reduce((acc, pago) => acc + Number(pago.monto || 0), 0),
    [comisionData]
  );

  const firmasMap = useMemo(() => new Map((firmas ?? []).map((firma) => [firma.id, firma])), [firmas]);
  const avalesMap = useMemo(() => new Map((avales ?? []).map((aval) => [aval.id, aval])), [avales]);
  const asesoresMap = useMemo(() => new Map((asesores ?? []).map((asesor) => [asesor.id, asesor])), [asesores]);
  const selectedFirma = firmaFilter ? firmasMap.get(firmaFilter) ?? null : null;
  const servicioFormFirmaId = servicioForm.watch("firma_id");
  const servicioFormFirma = servicioFormFirmaId ? firmasMap.get(servicioFormFirmaId) ?? null : null;
  const comisionFormFirmaId = comisionForm.watch("firma_id");
  const comisionFormFirma = comisionFormFirmaId ? firmasMap.get(comisionFormFirmaId) ?? null : null;
  const handleViewDocument = async (path?: string | null, bucket: string = STORAGE_BUCKET) => {
    if (!path) return;
    const target = path.startsWith("http") ? path : await getStorageUrl(path, bucket);
    if (!target) {
      toast.error("No se pudo abrir el comprobante.");
      return;
    }
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const servicioColumns: ColumnDef<PagoServicio>[] = [
    {
      header: "Firma",
      cell: ({ row }) => firmasMap.get(row.original.firma_id)?.cliente_nombre ?? "—",
    },
    {
      header: "Efectivo",
      cell: ({ row }) => currencyFormatter.format(Number(row.original.monto_efectivo) || 0),
    },
    {
      header: "Transferencia",
      cell: ({ row }) => currencyFormatter.format(Number(row.original.monto_transferencia) || 0),
    },
    {
      header: "Total",
      cell: ({ row }) =>
        currencyFormatter.format(
          (Number(row.original.monto_efectivo) || 0) + (Number(row.original.monto_transferencia) || 0)
        ),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={row.original.estado === "liquidado" ? "success" : "secondary"}>
          {formatStatus(row.original.estado)}
        </Badge>
      ),
    },
    {
      accessorKey: "fecha_pago",
      header: "Fecha",
      cell: ({ row }) => (row.original.fecha_pago ? dateFormatter.format(new Date(row.original.fecha_pago)) : "—"),
    },
    {
      header: "Comprobante",
      cell: ({ row }) =>
        row.original.comprobante_url ? (
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={() => handleViewDocument(row.original.comprobante_url)}
          >
            Ver archivo
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Sin archivo</span>
        ),
    },
    {
      header: "Corte",
      cell: ({ row }) => (row.original.corte_id ? row.original.corte_id.slice(0, 8) + "…" : "Pendiente"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const pago = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setServicioEditing(pago);
                setServicioFile(null);
                servicioForm.reset({
                  firma_id: pago.firma_id,
                  monto_efectivo: Number(pago.monto_efectivo),
                  monto_transferencia: Number(pago.monto_transferencia),
                  fecha_pago: toDateTimeLocal(pago.fecha_pago),
                  comprobante_url: pago.comprobante_url ?? "",
                  notas: pago.notas ?? "",
                  estado: pago.estado,
                  corte_id: pago.corte_id ?? "",
                });
                setServicioDialogOpen(true);
              }}
            >
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!confirm("¿Eliminar este registro de pago?")) return;
                try {
                  await pagoServicioSingle(`pagos-servicio/${pago.id}`, { method: "DELETE" });
                  toast.success("Pago eliminado");
                  queryClient.invalidateQueries({ queryKey: ["pagos-servicio"] });
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Error eliminando pago");
                }
              }}
            >
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  const comisionColumns: ColumnDef<PagoComision>[] = [
    {
      header: "Beneficiario",
      cell: ({ row }) => {
        if (row.original.beneficiario_tipo === "aval") {
          return avalesMap.get(row.original.beneficiario_id)?.nombre_completo ?? "Aval";
        }
        return asesoresMap.get(row.original.beneficiario_id)?.nombre ?? "Asesor";
      },
    },
    {
      header: "Tipo",
      cell: ({ row }) => (row.original.beneficiario_tipo === "aval" ? "Aval" : "Asesor"),
    },
    {
      header: "Firma",
      cell: ({ row }) => firmasMap.get(row.original.firma_id)?.cliente_nombre ?? "—",
    },
    {
      accessorKey: "monto",
      header: "Monto",
      cell: ({ row }) => currencyFormatter.format(Number(row.original.monto) || 0),
    },
    {
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={row.original.estado === "pagado" ? "success" : "secondary"}>
          {formatStatus(row.original.estado)}
        </Badge>
      ),
    },
    {
      header: "Fecha pago",
      cell: ({ row }) => (row.original.fecha_pago ? dateFormatter.format(new Date(row.original.fecha_pago)) : "—"),
    },
    {
      header: "Comprobante",
      cell: ({ row }) =>
        row.original.comprobante_url ? (
          <button
            type="button"
            className="text-sm text-primary underline"
            onClick={() => handleViewDocument(row.original.comprobante_url)}
          >
            Ver archivo
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Sin archivo</span>
        ),
    },
    {
      header: "Corte",
      cell: ({ row }) => (row.original.corte_id ? row.original.corte_id.slice(0, 8) + "…" : "Pendiente"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const pago = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setComisionEditing(pago);
                setComisionFile(null);
                comisionForm.reset({
                  beneficiario_tipo: pago.beneficiario_tipo,
                  beneficiario_id: pago.beneficiario_id,
                  firma_id: pago.firma_id,
                  monto: Number(pago.monto),
                  metodo: pago.metodo ?? "",
                  fecha_programada: toDateTimeLocal(pago.fecha_programada),
                  fecha_pago: toDateTimeLocal(pago.fecha_pago),
                  comprobante_url: pago.comprobante_url ?? "",
                  notas: pago.notas ?? "",
                  estado: pago.estado,
                  corte_id: pago.corte_id ?? "",
                });
                setComisionDialogOpen(true);
              }}
            >
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!confirm("¿Eliminar este registro?")) return;
                try {
                  await pagoComisionSingle(`pagos-comisiones/${pago.id}`, { method: "DELETE" });
                  toast.success("Registro eliminado");
                  queryClient.invalidateQueries({ queryKey: ["pagos-comisiones"] });
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Error eliminando registro");
                }
              }}
            >
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            {firmaFilter ? "Ingresos del servicio para la firma seleccionada" : "Ingresos registrados del servicio"}
          </p>
          <p className="mt-2 text-3xl font-semibold">{currencyFormatter.format(totalServicio)}</p>
          <p className="text-xs text-muted-foreground">
            Pagos capturados: {servicioData.length}/{pagosServicio?.length ?? 0}
          </p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">
            {firmaFilter ? "Comisiones registradas para la firma" : "Comisiones registradas"}
          </p>
          <p className="mt-2 text-3xl font-semibold">{currencyFormatter.format(totalComisiones)}</p>
          <p className="text-xs text-muted-foreground">Entradas: {comisionData.length}/{pagosComision?.length ?? 0}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-sm space-y-2">
            <Label htmlFor="firma-filter">Filtrar por firma</Label>
            <Select
              value={firmaFilter || "todos"}
              onValueChange={(value) => handleFirmaFilterChange(value)}
            >
              <SelectTrigger id="firma-filter">
                <SelectValue placeholder="Selecciona firma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las firmas</SelectItem>
                {(firmas ?? []).map((firma) => (
                  <SelectItem key={firma.id} value={firma.id}>
                    {firma.cliente_nombre} · {new Date(firma.fecha_inicio).toLocaleDateString("es-MX")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {firmaFilter ? (
            <div className="flex flex-1 flex-col gap-1 rounded-2xl border border-border/60 bg-background/80 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">Firma seleccionada</p>
                <Button variant="ghost" size="sm" onClick={() => handleFirmaFilterChange("todos")}>
                  Quitar filtro
                </Button>
              </div>
              {selectedFirma ? (
                <>
                  <p>
                    Cliente: <span className="font-medium">{selectedFirma.cliente_nombre}</span>
                  </p>
                  <p>
                    Aval: <span className="font-medium">{avalesMap.get(selectedFirma.aval_id)?.nombre_completo ?? "—"}</span>
                  </p>
                  <p>
                    Fecha:{" "}
                    {new Intl.DateTimeFormat("es-MX", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(selectedFirma.fecha_inicio))}
                  </p>
                  <p>Pago por servicio pactado: {currencyFormatter.format(Number(selectedFirma.pago_por_servicio) || 0)}</p>
                </>
              ) : (
                <p className="text-muted-foreground">No encontramos la firma seleccionada.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Selecciona una firma para ver únicamente sus pagos y comisiones.
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-3xl border border-border/60 bg-card/60 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Pagos del servicio</h3>
              <p className="text-sm text-muted-foreground">Registra los ingresos por cada firma.</p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                resetServicioForm(firmaFilter || "");
                setServicioDialogOpen(true);
              }}
            >
              Registrar pago
            </Button>
          </div>
          <DataTable columns={servicioColumns} data={servicioData} searchKey="firma_id" />
        </div>

        <div className="space-y-3 rounded-3xl border border-border/60 bg-card/60 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Pagos de comisiones</h3>
              <p className="text-sm text-muted-foreground">Controla el pago a asesores y avales.</p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                resetComisionForm(firmaFilter || "");
                setComisionDialogOpen(true);
              }}
            >
              Registrar comisión
            </Button>
          </div>
          <DataTable columns={comisionColumns} data={comisionData} searchKey="firma_id" />
        </div>
      </section>

      <section className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <h3 className="text-base font-semibold">Generar corte</h3>
            <p className="text-sm text-muted-foreground">
              Selecciona un rango de fechas para consolidar pagos y comisiones en un PDF.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha inicio</label>
                <Input
                  type="date"
                  value={corteForm.fecha_inicio}
                  onChange={(event) => setCorteForm((prev) => ({ ...prev, fecha_inicio: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fecha fin</label>
                <Input
                  type="date"
                  value={corteForm.fecha_fin}
                  onChange={(event) => setCorteForm((prev) => ({ ...prev, fecha_fin: event.target.value }))}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={corteForm.incluir_servicios}
                  onCheckedChange={(checked) =>
                    setCorteForm((prev) => ({ ...prev, incluir_servicios: checked === true }))
                  }
                />
                Incluir pagos del servicio
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={corteForm.incluir_comisiones}
                  onCheckedChange={(checked) =>
                    setCorteForm((prev) => ({ ...prev, incluir_comisiones: checked === true }))
                  }
                />
                Incluir comisiones
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => corteMutation.mutate()}
                disabled={corteMutation.isPending}
              >
                {corteMutation.isPending ? "Generando..." : "Generar corte"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setCorteForm({ fecha_inicio: "", fecha_fin: "", incluir_servicios: true, incluir_comisiones: true })
                }
              >
                Limpiar
              </Button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Historial de cortes</h4>
            {cortes && cortes.length > 0 ? (
              <ul className="mt-3 space-y-3 text-sm">
                {cortes.map((corte) => (
                  <li key={corte.id} className="rounded-2xl border border-border/50 bg-background/80 p-3">
                    <p className="font-medium">
                      {corte.fecha_inicio} → {corte.fecha_fin}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Servicio: {currencyFormatter.format(Number(corte.total_servicio) || 0)} · Comisiones:{" "}
                      {currencyFormatter.format(Number(corte.total_comisiones) || 0)}
                    </p>
                    {corte.pdf_url ? (
                      <Button
                        size="sm"
                        variant="link"
                        className="px-0 text-xs"
                        onClick={() => window.open(corte.pdf_url ?? "#", "_blank", "noopener,noreferrer")}
                      >
                        Descargar PDF
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Aún no se han generado cortes.</p>
            )}
          </div>
        </div>
      </section>

      <Dialog open={servicioDialogOpen} onOpenChange={(open) => (open ? setServicioDialogOpen(true) : handleServicioClose())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{servicioEditing ? "Editar pago de servicio" : "Registrar pago del servicio"}</DialogTitle>
            <DialogDescription>Divide el importe pagado entre efectivo y transferencia.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={servicioForm.handleSubmit((values) => servicioMutation.mutate(values))}>
            <FormField control={servicioForm.control} name="firma_id" label="Firma asociada">
              {(field) => (
                <div className="space-y-3">
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona firma" />
                    </SelectTrigger>
                    <SelectContent>
                      {(firmas ?? []).map((firma) => (
                        <SelectItem key={firma.id} value={firma.id}>
                          {firma.cliente_nombre} · {new Date(firma.fecha_inicio).toLocaleDateString("es-MX")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {servicioFormFirma ? (
                    <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 text-xs">
                      <p className="font-semibold">{servicioFormFirma.cliente_nombre}</p>
                      <p>Aval: {avalesMap.get(servicioFormFirma.aval_id)?.nombre_completo ?? "—"}</p>
                      <p>
                        Fecha:{" "}
                        {new Intl.DateTimeFormat("es-MX", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(servicioFormFirma.fecha_inicio))}
                      </p>
                      <p>Servicio pactado: {currencyFormatter.format(Number(servicioFormFirma.pago_por_servicio) || 0)}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Selecciona la firma a la que pertenece este pago.</p>
                  )}
                </div>
              )}
            </FormField>
            <FormGrid>
              <FormField control={servicioForm.control} name="monto_efectivo" label="Monto en efectivo">
                {(field) => <Input type="number" min={0} step="0.01" {...field} />}
              </FormField>
              <FormField control={servicioForm.control} name="monto_transferencia" label="Monto en transferencia">
                {(field) => <Input type="number" min={0} step="0.01" {...field} />}
              </FormField>
            </FormGrid>
            <FormGrid>
              <FormField control={servicioForm.control} name="fecha_pago" label="Fecha de pago">
                {(field) => <Input type="datetime-local" {...field} />}
              </FormField>
              <FormField control={servicioForm.control} name="estado" label="Estado">
                {(field) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="registrado">Registrado</SelectItem>
                      <SelectItem value="liquidado">Liquidado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </FormGrid>
            <FormField
              control={servicioForm.control}
              name="comprobante_url"
              label="Comprobante"
              description="Carga un PDF o imagen; la ruta se genera automáticamente."
            >
              {(field) => (
                <div className="space-y-2">
                  <Input placeholder="Se generará al subir un archivo" {...field} />
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setServicioFile(file);
                      servicioForm.setValue("comprobante_url", file ? file.name : "");
                    }}
                    className="block w-full text-sm file:mr-4 file:rounded-2xl file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary"
                  />
                  {field.value ? (
                    <button
                      type="button"
                      className="text-xs text-primary underline"
                      onClick={() => void handleViewDocument(field.value)}
                    >
                      Ver comprobante actual
                    </button>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aún no se ha guardado un comprobante.</p>
                  )}
                </div>
              )}
            </FormField>
            <FormField control={servicioForm.control} name="notas" label="Notas">
              {(field) => <Input {...field} />}
            </FormField>
            <DialogFooter>
              <Button type="submit" disabled={servicioMutation.isPending}>
                {servicioMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={comisionDialogOpen} onOpenChange={(open) => (open ? setComisionDialogOpen(true) : handleComisionClose())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{comisionEditing ? "Editar comisión" : "Registrar comisión"}</DialogTitle>
            <DialogDescription>Captura la comisión a pagar al asesor o aval.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={comisionForm.handleSubmit((values) => comisionMutation.mutate(values))}>
            <FormGrid>
              <FormField control={comisionForm.control} name="beneficiario_tipo" label="Tipo de beneficiario">
                {(field) => (
                  <Select value={field.value} onValueChange={(value) => {
                    field.onChange(value);
                    comisionForm.setValue("beneficiario_id", "");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aval">Aval</SelectItem>
                      <SelectItem value="asesor">Asesor</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField control={comisionForm.control} name="beneficiario_id" label="Beneficiario">
                {(field) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona beneficiario" />
                    </SelectTrigger>
                    <SelectContent>
                      {(comisionForm.watch("beneficiario_tipo") === "aval" ? avales ?? [] : asesores ?? []).map(
                        (item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {"nombre" in item ? item.nombre : item.nombre_completo}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </FormGrid>
            <FormField control={comisionForm.control} name="firma_id" label="Firma asociada">
              {(field) => (
                <div className="space-y-3">
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona firma" />
                    </SelectTrigger>
                    <SelectContent>
                      {(firmas ?? []).map((firma) => (
                        <SelectItem key={firma.id} value={firma.id}>
                          {firma.cliente_nombre} · {new Date(firma.fecha_inicio).toLocaleDateString("es-MX")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {comisionFormFirma ? (
                    <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 text-xs">
                      <p className="font-semibold">{comisionFormFirma.cliente_nombre}</p>
                      <p>Aval: {avalesMap.get(comisionFormFirma.aval_id)?.nombre_completo ?? "—"}</p>
                      <p>Asesor: {comisionFormFirma.asesor_nombre}</p>
                      <p>
                        Fecha:{" "}
                        {new Intl.DateTimeFormat("es-MX", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(comisionFormFirma.fecha_inicio))}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Selecciona la firma relacionada con esta comisión.</p>
                  )}
                </div>
              )}
            </FormField>
            <FormGrid>
              <FormField control={comisionForm.control} name="monto" label="Monto ($ MXN)">
                {(field) => <Input type="number" min={0} step="0.01" {...field} />}
              </FormField>
              <FormField control={comisionForm.control} name="metodo" label="Método">
                {(field) => (
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="mixto">Mixto</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </FormGrid>
            <FormGrid>
              <FormField control={comisionForm.control} name="fecha_programada" label="Fecha programada">
                {(field) => <Input type="datetime-local" {...field} />}
              </FormField>
              <FormField control={comisionForm.control} name="fecha_pago" label="Fecha de pago">
                {(field) => <Input type="datetime-local" {...field} />}
              </FormField>
            </FormGrid>
            <FormField control={comisionForm.control} name="estado" label="Estado">
              {(field) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="pagado">Pagado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField
              control={comisionForm.control}
              name="comprobante_url"
              label="Comprobante"
              description="Adjunta la evidencia del pago realizado."
            >
              {(field) => (
                <div className="space-y-2">
                  <Input placeholder="Se generará al subir un archivo" {...field} />
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setComisionFile(file);
                      comisionForm.setValue("comprobante_url", file ? file.name : "");
                    }}
                    className="block w-full text-sm file:mr-4 file:rounded-2xl file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary"
                  />
                  {field.value ? (
                    <button
                      type="button"
                      className="text-xs text-primary underline"
                      onClick={() => void handleViewDocument(field.value)}
                    >
                      Ver comprobante actual
                    </button>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sin comprobante registrado.</p>
                  )}
                </div>
              )}
            </FormField>
            <FormField control={comisionForm.control} name="notas" label="Notas">
              {(field) => <Input {...field} />}
            </FormField>
            <DialogFooter>
              <Button type="submit" disabled={comisionMutation.isPending}>
                {comisionMutation.isPending ? "Guardando..." : "Guardar comisión"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
