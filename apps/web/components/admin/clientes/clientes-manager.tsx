"use client";

import { useEffect, useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionContext } from "@supabase/auth-helpers-react";
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
import { useApi } from "@/hooks/use-api";
import { useStorageProxy } from "@/hooks/use-storage-proxy";
import { useZodForm } from "@/hooks/use-zod-form";
import { clienteSchema } from "@/lib/schemas";
import { Cliente, Documento, Firma } from "@/lib/types";

const schema = clienteSchema.omit({ id: true });
const CLIENTES_BUCKET = "documentos-aval";
const FIRMAS_BUCKET = "documentos-aval";

type VirtualDoc = {
  id: string;
  tipo: string;
  archivo_path: string;
  created_at: string;
  notas?: string | null;
  signed_url?: string | null;
  bucket?: string;
};

const createDefaultFamiliares = () =>
  Array.from({ length: 2 }, () => ({
    nombre_completo: "",
    parentesco: "",
    telefono: "",
  }));

const createDefaultConocidos = () =>
  Array.from({ length: 2 }, () => ({
    nombre_completo: "",
    telefono: "",
  }));

const ensureFamiliares = (refs?: z.infer<typeof schema>["referencias_familiares"]) => {
  const base = refs && refs.length > 0 ? refs.map((ref) => ({ ...ref })) : [];
  while (base.length < 2) {
    base.push({ nombre_completo: "", parentesco: "", telefono: "" });
  }
  return base.slice(0, 2);
};

const ensureConocidos = (refs?: z.infer<typeof schema>["referencias_conocidos"]) => {
  const base = refs && refs.length > 0 ? refs.map((ref) => ({ ...ref })) : [];
  while (base.length < 2) {
    base.push({ nombre_completo: "", telefono: "" });
  }
  return base.slice(0, 2);
};

export function ClientesManager() {
  const queryClient = useQueryClient();
  const api = useApi<Cliente[]>();
  const apiSingle = useApi<Cliente>();
  const documentosApi = useApi<Documento[]>();
  const firmasApi = useApi<Firma[]>();
  const { supabaseClient } = useSessionContext();
  const getStorageUrl = useStorageProxy();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [identificacionFile, setIdentificacionFile] = useState<File | null>(null);

  const { data: clientes } = useQuery({ queryKey: ["clientes"], queryFn: () => api("clientes") });
  const [{ data: firmas }] = useQueries({
    queries: [{ queryKey: ["firmas"], queryFn: () => firmasApi("firmas") }],
  });

  const { data: documentosCliente, isFetching: docsLoading } = useQuery({
    queryKey: ["documentos", "cliente", selectedClienteId],
    queryFn: () => documentosApi(`documentos?cliente_id=${selectedClienteId}`),
    enabled: Boolean(selectedClienteId),
  });

  const form = useZodForm(schema, {
    defaultValues: {
      nombre_completo: "",
      identificacion_oficial_url: "",
      telefono: "",
      email: "",
      notas: "",
      referencias_familiares: createDefaultFamiliares(),
      referencias_conocidos: createDefaultConocidos(),
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
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
      if (editing) {
        const updated = await apiSingle(`clientes/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        if (identificacionFile) {
          const newPath = await uploadIdentificacion(editing.id);
          if (newPath) {
            await apiSingle(`clientes/${editing.id}`, {
              method: "PUT",
              body: JSON.stringify({ identificacion_oficial_url: newPath }),
            });
          }
        }
        return updated;
      }
      const created = await apiSingle("clientes", { method: "POST", body: JSON.stringify(payload) });
      if (created?.id && identificacionFile) {
        const newPath = await uploadIdentificacion(created.id);
        if (newPath) {
          await apiSingle(`clientes/${created.id}`, {
            method: "PUT",
            body: JSON.stringify({ identificacion_oficial_url: newPath }),
          });
        }
      }
      return created;
    },
    onSuccess: () => {
      toast.success(editing ? "Cliente actualizado" : "Cliente registrado");
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      handleClose();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error guardando cliente"),
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
    setIdentificacionFile(null);
    form.reset({
      nombre_completo: "",
      identificacion_oficial_url: "",
      telefono: "",
      email: "",
      notas: "",
      referencias_familiares: createDefaultFamiliares(),
      referencias_conocidos: createDefaultConocidos(),
    });
  };

  const handleEdit = (cliente: Cliente) => {
    setEditing(cliente);
    setIdentificacionFile(null);
    form.reset({
      nombre_completo: cliente.nombre_completo,
      identificacion_oficial_url: cliente.identificacion_oficial_url ?? "",
      telefono: cliente.telefono ?? "",
      email: cliente.email ?? "",
      notas: cliente.notas ?? "",
      referencias_familiares: ensureFamiliares(cliente.referencias_familiares),
      referencias_conocidos: ensureConocidos(cliente.referencias_conocidos),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (cliente: Cliente) => {
    if (!confirm(`¿Eliminar al cliente "${cliente.nombre_completo}"?`)) return;
    try {
      await apiSingle(`clientes/${cliente.id}`, { method: "DELETE" });
      toast.success("Cliente eliminado");
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error eliminando cliente");
    }
  };

  const sanitizeFileName = (filename: string) => {
    const normalized = filename.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleaned = normalized.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
    return cleaned.toLowerCase();
  };

  const uploadIdentificacion = async (clienteId: string) => {
    if (!identificacionFile || !supabaseClient) return null;
    const sanitized = sanitizeFileName(identificacionFile.name);
    const path = `clientes/${clienteId}/identificacion/${Date.now()}-${sanitized}`;
    const { error } = await supabaseClient.storage.from(CLIENTES_BUCKET).upload(path, identificacionFile, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      throw new Error(`Error subiendo identificación: ${error.message}`);
    }
    return path;
  };

  const openIdentificacion = async (path: string) => {
    const url = path.startsWith("http") ? path : await getStorageUrl(path, CLIENTES_BUCKET, 120);
    if (!url) {
      toast.error("No se pudo obtener la identificación.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const columns: ColumnDef<Cliente>[] = [
    { accessorKey: "nombre_completo", header: "Nombre" },
    { accessorKey: "email", header: "Correo" },
    { accessorKey: "telefono", header: "Teléfono" },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const cliente = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(cliente)}>
              Editar
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDelete(cliente)}>
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  useEffect(() => {
    if (!selectedClienteId && clientes && clientes.length > 0) {
      setSelectedClienteId(clientes[0].id);
    }
  }, [clientes, selectedClienteId]);

  const selectedCliente = useMemo(
    () => clientes?.find((cliente) => cliente.id === selectedClienteId) ?? null,
    [clientes, selectedClienteId]
  );

  const firmasDelCliente = useMemo(
    () => (firmas ?? []).filter((firma) => firma.cliente_id === selectedClienteId),
    [firmas, selectedClienteId]
  );

  const documentosConContexto = useMemo(
    () =>
      (documentosCliente ?? []).map((doc) => ({
        ...doc,
        notas: doc.notas ?? doc.tipo,
      })),
    [documentosCliente]
  );

  const virtualDocuments = useMemo<VirtualDoc[]>(() => {
    if (!selectedCliente) return [];
    const docs: Array<{
      id: string;
      tipo: string;
      archivo_path: string;
      created_at: string;
      notas?: string | null;
    }> = [];
    if (selectedCliente.identificacion_oficial_url) {
      docs.push({
        id: `identificacion-${selectedCliente.id}`,
        tipo: "Identificación oficial",
        archivo_path: selectedCliente.identificacion_oficial_url,
        created_at: selectedCliente.updated_at ?? selectedCliente.created_at ?? new Date().toISOString(),
        notas: "Documento cargado desde el expediente del cliente.",
        bucket: CLIENTES_BUCKET,
      });
    }
    firmasDelCliente.forEach((firma) => {
      if (firma.solicitud_aval_url) {
        docs.push({
          id: `solicitud-${firma.id}`,
          tipo: "Solicitud de aval",
          archivo_path: firma.solicitud_aval_url,
          created_at: firma.updated_at ?? firma.created_at ?? firma.fecha_inicio,
          notas: `Firma en ${firma.propiedad_domicilio}`,
          bucket: FIRMAS_BUCKET,
        });
      }
    });
    return docs;
  }, [selectedCliente, firmasDelCliente]);

  const [virtualDocumentsResolved, setVirtualDocumentsResolved] = useState<VirtualDoc[]>([]);

  useEffect(() => {
    let active = true;
    const resolveUrls = async () => {
      const resolved = await Promise.all(
        virtualDocuments.map(async (doc) => {
          if (doc.archivo_path.startsWith("http")) {
            return { ...doc, signed_url: doc.archivo_path };
          }
          const bucket = doc.bucket ?? CLIENTES_BUCKET;
          try {
            const url = await getStorageUrl(doc.archivo_path, bucket);
            return { ...doc, signed_url: url };
          } catch {
            return { ...doc, signed_url: null };
          }
        })
      );
      if (active) setVirtualDocumentsResolved(resolved);
    };
    resolveUrls();
    return () => {
      active = false;
    };
  }, [virtualDocuments, getStorageUrl]);

  const galleryDocuments = useMemo(
    () => [...virtualDocumentsResolved, ...documentosConContexto],
    [virtualDocumentsResolved, documentosConContexto]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Administra la información de tus clientes.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : handleClose())}>
          <DialogTrigger asChild>
            <Button>Agregar cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar cliente" : "Registrar cliente"}</DialogTitle>
              <DialogDescription>Captura los datos principales del cliente.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <FormField control={form.control} name="nombre_completo" label="Nombre completo">
                {(field) => <Input {...field} />}
              </FormField>
              <FormGrid>
                <FormField control={form.control} name="email" label="Correo">
                  {(field) => <Input type="email" {...field} />}
                </FormField>
                <FormField control={form.control} name="telefono" label="Teléfono">
                  {(field) => <Input {...field} />}
                </FormField>
              </FormGrid>
              <FormField
                control={form.control}
                name="identificacion_oficial_url"
                label="Identificación oficial"
                description="Sube el documento; se guardará en Storage de forma segura."
              >
                {(field) => (
                  <div className="space-y-2">
                    <input type="hidden" {...field} />
                    {field.value ? (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Hay un archivo almacenado para este cliente.</span>
                        <Button type="button" variant="outline" size="sm" onClick={() => openIdentificacion(field.value)}>
                          Ver identificación
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aún no has cargado la identificación.</p>
                    )}
                    <Input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(event) => setIdentificacionFile(event.target.files?.[0] ?? null)}
                    />
                    {identificacionFile ? (
                      <p className="text-xs text-muted-foreground">Archivo seleccionado: {identificacionFile.name}</p>
                    ) : null}
                  </div>
                )}
              </FormField>
              <FormField control={form.control} name="notas" label="Notas">
                {(field) => <Input {...field} />}
              </FormField>

              <div className="space-y-3 rounded-2xl border border-dashed border-border/70 p-4">
                <div>
                  <h4 className="text-sm font-semibold">Referencias familiares</h4>
                  <p className="text-xs text-muted-foreground">Captura dos familiares con parentesco y teléfono.</p>
                </div>
                {form.watch("referencias_familiares").map((_, index) => (
                  <div key={`familiar-${index}`} className="rounded-xl border border-border/50 bg-muted/10 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Familiar {index + 1}</p>
                    <FormField
                      control={form.control}
                      name={`referencias_familiares.${index}.nombre_completo` as const}
                      label="Nombre completo"
                    >
                      {(field) => <Input {...field} />}
                    </FormField>
                    <FormGrid>
                      <FormField
                        control={form.control}
                        name={`referencias_familiares.${index}.parentesco` as const}
                        label="Parentesco"
                      >
                        {(field) => <Input {...field} />}
                      </FormField>
                      <FormField
                        control={form.control}
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
                  <h4 className="text-sm font-semibold">Referencias conocidas</h4>
                  <p className="text-xs text-muted-foreground">Personas que no sean familiares.</p>
                </div>
                {form.watch("referencias_conocidos").map((_, index) => (
                  <div key={`conocido-${index}`} className="rounded-xl border border-border/50 bg-muted/10 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Conocido {index + 1}
                    </p>
                    <FormField
                      control={form.control}
                      name={`referencias_conocidos.${index}.nombre_completo` as const}
                      label="Nombre completo"
                    >
                      {(field) => <Input {...field} />}
                    </FormField>
                    <FormField
                      control={form.control}
                      name={`referencias_conocidos.${index}.telefono` as const}
                      label="Teléfono"
                    >
                      {(field) => <Input {...field} />}
                    </FormField>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending ? "Guardando..." : editing ? "Actualizar" : "Guardar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1.6fr)]">
        <DataTable
          columns={columns}
          data={clientes ?? []}
          searchKey="nombre_completo"
          searchPlaceholder="Buscar por nombre"
          onRowClick={(cliente) => setSelectedClienteId(cliente.id)}
          getRowId={(cliente) => cliente.id}
          selectedRowId={selectedClienteId}
        />

        <div className="space-y-4">
          {selectedCliente ? (
            <>
              <section className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm">
                <h2 className="text-lg font-semibold">{selectedCliente.nombre_completo}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedCliente.email || "Sin correo"} · {selectedCliente.telefono || "Sin teléfono"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Firmas registradas: {firmasDelCliente.length}
                </p>
                {selectedCliente.identificacion_oficial_url ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Identificación cargada y disponible en la sección de documentos.
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">Aún no has cargado la identificación oficial.</p>
                )}
              </section>

              <section className="rounded-3xl border border-border/60 bg-background/80 p-4 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Firmas asociadas</h3>
                {firmasDelCliente.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Aún no has registrado firmas con este cliente.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm">
                    {firmasDelCliente.map((firma) => (
                      <li key={firma.id} className="rounded-xl border border-border/40 bg-card/70 px-3 py-2">
                        <p className="font-medium">{firma.propiedad_domicilio}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(firma.fecha_inicio).toLocaleString("es-MX")} · {firma.estado}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="grid gap-4 rounded-3xl border border-border/60 bg-card/60 p-4 shadow-sm md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Referencias familiares
                  </h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {(selectedCliente.referencias_familiares ?? []).map((ref, idx) => (
                      <li key={`familiar-${idx}`} className="rounded-xl border border-border/40 bg-background/70 p-3">
                        <p className="font-medium">{ref.nombre_completo}</p>
                        <p className="text-xs text-muted-foreground">
                          {ref.parentesco} · {ref.telefono}
                        </p>
                      </li>
                    ))}
                    {(selectedCliente.referencias_familiares ?? []).length === 0 ? (
                      <li className="text-xs text-muted-foreground">Sin referencias registradas.</li>
                    ) : null}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Referencias conocidas
                  </h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {(selectedCliente.referencias_conocidos ?? []).map((ref, idx) => (
                      <li key={`conocido-${idx}`} className="rounded-xl border border-border/40 bg-background/70 p-3">
                        <p className="font-medium">{ref.nombre_completo}</p>
                        <p className="text-xs text-muted-foreground">{ref.telefono}</p>
                      </li>
                    ))}
                    {(selectedCliente.referencias_conocidos ?? []).length === 0 ? (
                      <li className="text-xs text-muted-foreground">Sin referencias registradas.</li>
                    ) : null}
                  </ul>
                </div>
              </section>

              <DocumentGallery
                documents={galleryDocuments}
                loading={docsLoading}
                title="Documentos del cliente"
                description="Visualiza los archivos asociados a este cliente."
                emptyState="Aún no has vinculado documentos a este cliente."
              />
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-6 text-sm text-muted-foreground">
              Selecciona un cliente para ver su resumen, documentos y firmas relacionadas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
