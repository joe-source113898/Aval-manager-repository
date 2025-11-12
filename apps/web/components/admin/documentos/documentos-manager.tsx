"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";

import { DataTable } from "@/components/tables/data-table";
import { DocumentGallery } from "@/components/documentos/document-gallery";
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
import { useApi } from "@/hooks/use-api";
import { useZodForm } from "@/hooks/use-zod-form";
import { documentoFormSchema } from "@/lib/schemas";
import { Cliente, Contrato, Documento } from "@/lib/types";
import { humanizeDocumentName } from "@/lib/documents";

const schema = documentoFormSchema.omit({ id: true });

export function DocumentosManager() {
  const queryClient = useQueryClient();
  const api = useApi<Documento[]>();
  const apiSingle = useApi<Documento>();
  const contratosApi = useApi<Contrato[]>();
  const clientesApi = useApi<Cliente[]>();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Documento | null>(null);
  const [contratoFilter, setContratoFilter] = useState<string | null>(null);
  const [clienteFilter, setClienteFilter] = useState<string | null>(null);

  const NO_SELECTION = "ninguno";

  const { data: documentos, isFetching } = useQuery({
    queryKey: ["documentos", contratoFilter, clienteFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (contratoFilter) params.append("contrato_id", contratoFilter);
      if (clienteFilter) params.append("cliente_id", clienteFilter);
      const qs = params.toString();
      return api(qs ? `documentos?${qs}` : "documentos");
    },
  });

  const [{ data: contratos }, { data: clientes }] = useQueries({
    queries: [
      { queryKey: ["contratos"], queryFn: () => contratosApi("contratos") },
      { queryKey: ["clientes"], queryFn: () => clientesApi("clientes") },
    ],
  });

  const contratosMap = useMemo(() => new Map((contratos ?? []).map((item) => [item.id, item])), [contratos]);
  const clientesMap = useMemo(() => new Map((clientes ?? []).map((item) => [item.id, item])), [clientes]);

  const form = useZodForm(schema, {
    defaultValues: {
      contrato_id: "",
      cliente_id: "",
      tipo: "",
      archivo_path: "",
      notas: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const payload = {
        ...values,
        contrato_id: values.contrato_id || null,
        cliente_id: values.cliente_id || null,
        notas: values.notas || null,
      };
      if (editing) {
        return apiSingle(`documentos/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      return apiSingle("documentos", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast.success(editing ? "Documento actualizado" : "Documento registrado");
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
      handleClose();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error guardando documento"),
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
    form.reset({
      contrato_id: "",
      cliente_id: "",
      tipo: "",
      archivo_path: "",
      notas: "",
    });
  };

  const handleEdit = (documento: Documento) => {
    setEditing(documento);
    form.reset({
      contrato_id: documento.contrato_id ?? "",
      cliente_id: documento.cliente_id ?? "",
      tipo: documento.tipo,
      archivo_path: documento.archivo_path,
      notas: documento.notas ?? "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (documento: Documento) => {
    if (!confirm("¿Eliminar este documento?")) return;
    try {
      await apiSingle(`documentos/${documento.id}`, { method: "DELETE" });
      toast.success("Documento eliminado");
      queryClient.invalidateQueries({ queryKey: ["documentos"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error eliminando documento");
    }
  };

  const columns: ColumnDef<Documento>[] = [
    {
      header: "Asociado a",
      cell: ({ row }) => {
        const doc = row.original;
        if (doc.cliente_id) {
          return clientesMap.get(doc.cliente_id)?.nombre_completo ?? "Cliente";
        }
        if (doc.contrato_id) {
          return contratosMap.get(doc.contrato_id)?.periodo_contrato ?? "Contrato";
        }
        return "—";
      },
    },
    { accessorKey: "tipo", header: "Tipo" },
    {
      accessorKey: "archivo_path",
      header: "Archivo",
      cell: ({ row }) => (
        <div className="text-sm">
          <p className="font-medium text-foreground">{humanizeDocumentName(row.original.archivo_path)}</p>
          <p className="text-xs text-muted-foreground break-all">{row.original.archivo_path}</p>
        </div>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Creado",
      cell: ({ row }) =>
        new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(row.original.created_at)
        ),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const documento = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(documento)}>
              Editar
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDelete(documento)}>
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  const galleryDocuments = useMemo(
    () =>
      (documentos ?? []).map((doc) => {
        let notas = doc.notas ?? null;
        if (!notas) {
          if (doc.cliente_id) {
            notas = `Cliente: ${clientesMap.get(doc.cliente_id)?.nombre_completo ?? doc.cliente_id}`;
          } else if (doc.contrato_id) {
            notas = `Contrato: ${contratosMap.get(doc.contrato_id)?.periodo_contrato ?? doc.contrato_id}`;
          }
        }
        return { ...doc, notas };
      }),
    [documentos, clientesMap, contratosMap]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Usa este repositorio para expedientes, evidencias de vetos o clientes vetados y documentos contractuales. Todos los archivos
            deben existir previamente en Storage.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            value={contratoFilter ?? "todos"}
            onValueChange={(value) => setContratoFilter(value === "todos" ? null : value)}
          >
            <SelectTrigger className="sm:w-64">
              <SelectValue placeholder="Filtrar por contrato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los contratos</SelectItem>
              {(contratos ?? []).map((contrato) => (
                <SelectItem key={contrato.id} value={contrato.id}>
                  {contrato.periodo_contrato}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={clienteFilter ?? "todos"}
            onValueChange={(value) => setClienteFilter(value === "todos" ? null : value)}
          >
            <SelectTrigger className="sm:w-64">
              <SelectValue placeholder="Filtrar por cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los clientes</SelectItem>
              {(clientes ?? []).map((cliente) => (
                <SelectItem key={cliente.id} value={cliente.id}>
                  {cliente.nombre_completo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : handleClose())}>
            <DialogTrigger asChild>
              <Button>Agregar documento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[min(96vw,800px)] sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar documento" : "Nuevo documento"}</DialogTitle>
                <DialogDescription>Registra metadatos de los documentos almacenados en Supabase Storage.</DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
                <FormField control={form.control} name="contrato_id" label="Contrato (opcional)">
                  {(field) => (
                    <Select
                      value={field.value || NO_SELECTION}
                      onValueChange={(value) => {
                        field.onChange(value === NO_SELECTION ? "" : value);
                        form.setValue("cliente_id", "", { shouldDirty: true });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona contrato" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_SELECTION}>Sin contrato</SelectItem>
                        {(contratos ?? []).map((contrato) => (
                          <SelectItem key={contrato.id} value={contrato.id}>
                            {contrato.periodo_contrato}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                <FormField control={form.control} name="cliente_id" label="Cliente (opcional)">
                  {(field) => (
                    <Select
                      value={field.value || NO_SELECTION}
                      onValueChange={(value) => {
                        field.onChange(value === NO_SELECTION ? "" : value);
                        form.setValue("contrato_id", "", { shouldDirty: true });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_SELECTION}>Sin cliente</SelectItem>
                        {(clientes ?? []).map((cliente) => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.nombre_completo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                <FormGrid>
                  <FormField control={form.control} name="tipo" label="Tipo">
                    {(field) => <Input {...field} placeholder="Identificación, contrato, etc." />}
                  </FormField>
                  <FormField control={form.control} name="archivo_path" label="Ruta en Storage">
                    {(field) => <Input {...field} placeholder="contratos/{id}/identificacion.pdf" />}
                  </FormField>
                </FormGrid>
                <FormField control={form.control} name="notas" label="Notas">
                  {(field) => <Input {...field} />}
                </FormField>
                <DialogFooter>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Guardando..." : editing ? "Actualizar" : "Registrar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={documentos ?? []}
        searchKey="tipo"
        searchPlaceholder="Buscar por tipo"
      />
      <DocumentGallery
        documents={galleryDocuments}
        loading={isFetching}
        title="Vista previa de documentos"
        description="Selecciona un documento para visualizarlo o abrirlo en una pestaña nueva."
      />
    </div>
  );
}
