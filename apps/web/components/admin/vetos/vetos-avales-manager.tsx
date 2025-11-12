"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Shield } from "lucide-react";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/hooks/use-api";
import { useZodForm } from "@/hooks/use-zod-form";
import { humanizeDocumentName } from "@/lib/documents";
import { Aval, AvalVeto, Documento, Inmobiliaria } from "@/lib/types";
import { DocumentGallery } from "@/components/documentos/document-gallery";

const vetoSchema = z.object({
  id: z.string().uuid().optional(),
  aval_id: z.string().uuid("Selecciona un aval"),
  inmobiliaria_id: z.string().uuid().optional().or(z.literal("")),
  motivo: z.string().min(10, "Describe el motivo del veto"),
  evidencia_documento_id: z.string().uuid().optional().or(z.literal("")),
  estatus: z.enum(["activo", "levantado"]).default("activo"),
});

export function VetosAvalesManager() {
  const queryClient = useQueryClient();
  const vetosApi = useApi<AvalVeto[]>();
  const vetoSingleApi = useApi<AvalVeto>();
  const avalesApi = useApi<Aval[]>();
  const inmobiliariasApi = useApi<Inmobiliaria[]>();
  const documentosApi = useApi<Documento[]>();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AvalVeto | null>(null);
  const [estatusFilter, setEstatusFilter] = useState<"activo" | "levantado" | "todos">("activo");

  const { data: vetos } = useQuery({
    queryKey: ["vetos-avales", estatusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (estatusFilter !== "todos") {
        params.append("estatus", estatusFilter);
      }
      const qs = params.toString();
      return vetosApi(qs ? `vetos-avales?${qs}` : "vetos-avales");
    },
  });

  const { data: avales } = useQuery({
    queryKey: ["avales-list"],
    queryFn: () => avalesApi("avales"),
  });

  const { data: inmobiliarias } = useQuery({
    queryKey: ["inmobiliarias"],
    queryFn: () => inmobiliariasApi("inmobiliarias"),
  });

  const { data: documentos } = useQuery({
    queryKey: ["documentos", "vetos"],
    queryFn: () => documentosApi("documentos"),
  });

  const avalesMap = useMemo(() => new Map((avales ?? []).map((aval) => [aval.id, aval])), [avales]);
  const inmobiliariasMap = useMemo(
    () => new Map((inmobiliarias ?? []).map((item) => [item.id, item])),
    [inmobiliarias]
  );
  const documentosMap = useMemo(() => new Map((documentos ?? []).map((doc) => [doc.id, doc])), [documentos]);
  const evidenceDocuments = useMemo(() => {
    const usedIds = new Set((vetos ?? []).map((veto) => veto.evidencia_documento_id).filter(Boolean));
    return (documentos ?? [])
      .filter((doc) => usedIds.has(doc.id))
      .map((doc) => ({
        ...doc,
        notas: doc.notas ?? doc.tipo,
      }));
  }, [documentos, vetos]);

  const form = useZodForm(vetoSchema, {
    defaultValues: {
      aval_id: "",
      inmobiliaria_id: "",
      motivo: "",
      evidencia_documento_id: "",
      estatus: "activo",
    },
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
    form.reset({
      aval_id: "",
      inmobiliaria_id: "",
      motivo: "",
      evidencia_documento_id: "",
      estatus: "activo",
    });
  };

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof vetoSchema>) => {
      const payload = {
        ...values,
        inmobiliaria_id: values.inmobiliaria_id === "global" ? null : values.inmobiliaria_id || null,
        evidencia_documento_id: values.evidencia_documento_id === "sin-evidencia" ? null : values.evidencia_documento_id || null,
      };
      if (editing) {
        return vetoSingleApi(`vetos-avales/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      return vetoSingleApi("vetos-avales", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast.success(editing ? "Veto actualizado" : "Veto registrado");
      queryClient.invalidateQueries({ queryKey: ["vetos-avales"] });
      handleClose();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error guardando veto"),
  });

  const handleEdit = (veto: AvalVeto) => {
    setEditing(veto);
    form.reset({
      aval_id: veto.aval_id,
      inmobiliaria_id: veto.inmobiliaria_id ?? "",
      motivo: veto.motivo,
      evidencia_documento_id: veto.evidencia_documento_id ?? "",
      estatus: veto.estatus,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (veto: AvalVeto) => {
    if (!confirm("¿Eliminar este veto?")) return;
    try {
      await vetoSingleApi(`vetos-avales/${veto.id}`, { method: "DELETE" });
      toast.success("Veto eliminado");
      queryClient.invalidateQueries({ queryKey: ["vetos-avales"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error eliminando veto");
    }
  };

  const columns: ColumnDef<AvalVeto>[] = [
    {
      header: "Aval",
      cell: ({ row }) => avalesMap.get(row.original.aval_id)?.nombre_completo ?? "—",
    },
    {
      header: "Inmobiliaria",
      cell: ({ row }) => inmobiliariasMap.get(row.original.inmobiliaria_id ?? "")?.nombre ?? "General",
    },
    { accessorKey: "motivo", header: "Motivo" },
    {
      accessorKey: "estatus",
      header: "Estatus",
      cell: ({ row }) => (
        <Badge variant={row.original.estatus === "activo" ? "destructive" : "secondary"}>{row.original.estatus}</Badge>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Registrado",
      cell: ({ row }) =>
        new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(row.original.created_at)
        ),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const veto = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(veto)}>
              Detalles
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDelete(veto)}>
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Vetos de avales</h1>
          <p className="text-sm text-muted-foreground">
            Registra y consulta los vetos levantados por cada inmobiliaria. Adjunta evidencia para respaldar la decisión.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : handleClose())}>
          <DialogTrigger asChild>
            <Button>
              <Shield className="mr-2 h-4 w-4" />
              Nuevo veto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[min(96vw,640px)]">
            <DialogHeader>
              <DialogTitle>{editing ? "Actualizar veto" : "Registrar veto"}</DialogTitle>
              <DialogDescription>
                Selecciona el aval, especifica si aplica para una inmobiliaria en particular y sube la evidencia.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <FormField control={form.control} name="aval_id" label="Aval vetado">
                {(field) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona aval" />
                    </SelectTrigger>
                    <SelectContent>
                      {(avales ?? []).map((aval) => (
                        <SelectItem key={aval.id} value={aval.id}>
                          {aval.nombre_completo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField control={form.control} name="inmobiliaria_id" label="Inmobiliaria (opcional)">
                {(field) => (
                  <Select value={field.value || "global"} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aplica a todas las inmobiliarias" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="global">Global (todas)</SelectItem>
                      {(inmobiliarias ?? []).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField control={form.control} name="motivo" label="Motivo del veto">
                {(field) => <Input placeholder="Ej. Documentación falsa, adeudos..." {...field} />}
              </FormField>
              <FormGrid>
                <FormField control={form.control} name="evidencia_documento_id" label="Documento de evidencia">
                  {(field) => (
                  <Select value={field.value || "sin-evidencia"} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona documento" />
                      </SelectTrigger>
                      <SelectContent>
                      <SelectItem value="sin-evidencia">Sin evidencia</SelectItem>
                        {(documentos ?? []).map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            {doc.tipo} · {humanizeDocumentName(doc.archivo_path)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                <FormField control={form.control} name="estatus" label="Estatus">
                  {(field) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona estatus" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="activo">Activo</SelectItem>
                        <SelectItem value="levantado">Levantado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              </FormGrid>
              <DialogFooter>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Guardando..." : editing ? "Actualizar" : "Registrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-3xl border border-border bg-card/70 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={estatusFilter === "activo" ? "default" : "outline"} onClick={() => setEstatusFilter("activo")}>
              Activos
            </Button>
            <Button
              size="sm"
              variant={estatusFilter === "levantado" ? "default" : "outline"}
              onClick={() => setEstatusFilter("levantado")}
            >
              Levantados
            </Button>
            <Button size="sm" variant={estatusFilter === "todos" ? "default" : "outline"} onClick={() => setEstatusFilter("todos")}>
              Todos
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {vetos?.length ?? 0} registros · evidencia alojada en la sección Documentos
          </p>
        </div>
        <DataTable columns={columns} data={vetos ?? []} searchKey="motivo" searchPlaceholder="Buscar por motivo" />
      </div>

      {evidenceDocuments.length > 0 ? (
        <DocumentGallery
          documents={evidenceDocuments}
          loading={!documentos}
          title="Evidencias asociadas"
          description="Listado de archivos usados como soporte de los vetos activos."
          emptyState="Aún no has vinculado evidencias."
        />
      ) : null}
    </div>
  );
}
