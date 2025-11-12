"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/hooks/use-api";
import { useZodForm } from "@/hooks/use-zod-form";
import { inmobiliariaSchema } from "@/lib/schemas";
import { Aval, Firma, Inmobiliaria } from "@/lib/types";

const schema = inmobiliariaSchema.omit({ id: true });

export function InmobiliariasManager() {
  const queryClient = useQueryClient();
  const api = useApi<Inmobiliaria[]>();
  const apiSingle = useApi<Inmobiliaria>();
  const firmasApi = useApi<Firma[]>();
  const avalesApi = useApi<Aval[]>();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Inmobiliaria | null>(null);

  const { data: inmobiliarias } = useQuery({ queryKey: ["inmobiliarias"], queryFn: () => api("inmobiliarias") });
  const { data: firmas } = useQuery({ queryKey: ["firmas"], queryFn: () => firmasApi("firmas") });
  const { data: avales } = useQuery({ queryKey: ["avales"], queryFn: () => avalesApi("avales") });

  const avalesMap = useMemo(() => new Map((avales ?? []).map((aval) => [aval.id, aval])), [avales]);

  const firmasPorInmobiliaria = useMemo(() => {
    const map = new Map<string, Firma[]>();
    (firmas ?? []).forEach((firma) => {
      if (!firma.inmobiliaria_id) return;
      const list = map.get(firma.inmobiliaria_id) ?? [];
      list.push(firma);
      map.set(firma.inmobiliaria_id, list);
    });
    return map;
  }, [firmas]);

  const form = useZodForm(schema, {
    defaultValues: {
      nombre: "",
      contacto: "",
      telefono: "",
      email: "",
      notas: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const payload = {
        ...values,
        contacto: values.contacto || null,
        telefono: values.telefono || null,
        email: values.email || null,
        notas: values.notas || null,
      };
      if (editing) {
        return apiSingle(`inmobiliarias/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      return apiSingle("inmobiliarias", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast.success(editing ? "Inmobiliaria actualizada" : "Inmobiliaria registrada");
      queryClient.invalidateQueries({ queryKey: ["inmobiliarias"] });
      handleClose();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error guardando inmobiliaria"),
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
    form.reset({
      nombre: "",
      contacto: "",
      telefono: "",
      email: "",
      notas: "",
    });
  };

  const handleEdit = (inmobiliaria: Inmobiliaria) => {
    setEditing(inmobiliaria);
    form.reset({
      nombre: inmobiliaria.nombre,
      contacto: inmobiliaria.contacto ?? "",
      telefono: inmobiliaria.telefono ?? "",
      email: inmobiliaria.email ?? "",
      notas: inmobiliaria.notas ?? "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (inmobiliaria: Inmobiliaria) => {
    if (!confirm(`¿Eliminar la inmobiliaria "${inmobiliaria.nombre}"?`)) return;
    try {
      await apiSingle(`inmobiliarias/${inmobiliaria.id}`, { method: "DELETE" });
      toast.success("Inmobiliaria eliminada");
      queryClient.invalidateQueries({ queryKey: ["inmobiliarias"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error eliminando inmobiliaria");
    }
  };

  const columns: ColumnDef<Inmobiliaria>[] = [
    { accessorKey: "nombre", header: "Nombre" },
    { accessorKey: "contacto", header: "Contacto" },
    { accessorKey: "telefono", header: "Teléfono" },
    {
      accessorKey: "email",
      header: "Correo",
      cell: ({ row }) => row.original.email ?? "—",
    },
    {
      header: "Firmas",
      cell: ({ row }) => {
        const count = firmasPorInmobiliaria.get(row.original.id)?.length ?? 0;
        return <Badge variant="secondary">{count}</Badge>;
      },
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const inmobiliaria = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(inmobiliaria)}>
              Editar
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDelete(inmobiliaria)}>
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  const selected = inmobiliarias?.[0];
  const avalesAsociados = useMemo(() => {
    if (!inmobiliarias || inmobiliarias.length === 0) return [];
    return inmobiliarias.map((inmobiliaria) => {
      const firmasRelacionadas = firmasPorInmobiliaria.get(inmobiliaria.id) ?? [];
      const avalesUnicos = new Map<string, string>();
      firmasRelacionadas.forEach((firma) => {
        const avalNombre = avalesMap.get(firma.aval_id)?.nombre_completo ?? firma.aval_id;
        avalesUnicos.set(firma.aval_id, avalNombre);
      });
      return { inmobiliaria, avales: Array.from(avalesUnicos.values()) };
    });
  }, [inmobiliarias, firmasPorInmobiliaria, avalesMap]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inmobiliarias</h1>
          <p className="text-sm text-muted-foreground">Registra a las inmobiliarias con las que colaboras y vincúlalas a las firmas.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : handleClose())}>
          <DialogTrigger asChild>
            <Button>Registrar inmobiliaria</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[min(96vw,560px)]">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar inmobiliaria" : "Nueva inmobiliaria"}</DialogTitle>
              <DialogDescription>Captura los datos de la inmobiliaria para reutilizarlos en las firmas.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <FormField control={form.control} name="nombre" label="Nombre">
                {(field) => <Input {...field} />}
              </FormField>
              <FormGrid>
                <FormField control={form.control} name="contacto" label="Nombre de contacto">
                  {(field) => <Input {...field} />}
                </FormField>
                <FormField control={form.control} name="telefono" label="Teléfono">
                  {(field) => <Input {...field} />}
                </FormField>
              </FormGrid>
              <FormField control={form.control} name="email" label="Correo">
                {(field) => <Input type="email" {...field} />}
              </FormField>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)]">
        <DataTable
          columns={columns}
          data={inmobiliarias ?? []}
          searchKey="nombre"
          searchPlaceholder="Buscar inmobiliaria"
        />
        <div className="space-y-3 rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Relación con avales</h2>
          {avalesAsociados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Registra una firma ligada a una inmobiliaria para ver su historial.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {avalesAsociados.map(({ inmobiliaria, avales }) => (
                <li key={inmobiliaria.id} className="rounded-2xl border border-border/40 bg-background/70 p-3">
                  <p className="font-semibold">{inmobiliaria.nombre}</p>
                  {avales.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin avales asociados aún.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {avales.map((nombre) => (
                        <li key={nombre}>• {nombre}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
