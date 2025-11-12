"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { useZodForm } from "@/hooks/use-zod-form";
import { disponibilidadSchema } from "@/lib/schemas";
import { Aval, Disponibilidad } from "@/lib/types";
import { toDateTimeLocal, toISOFromLocal } from "@/lib/utils";

const schema = disponibilidadSchema.omit({ id: true });

export function DisponibilidadesManager() {
  const queryClient = useQueryClient();
  const api = useApi<Disponibilidad[]>();
  const apiSingle = useApi<Disponibilidad>();
  const avalesApi = useApi<Aval[]>();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Disponibilidad | null>(null);

  const { data: disponibilidades } = useQuery({
    queryKey: ["disponibilidades"],
    queryFn: () => api("disponibilidades"),
  });
  const [{ data: avales }] = useQueries({
    queries: [{ queryKey: ["avales"], queryFn: () => avalesApi("avales") }],
  });

  const form = useZodForm(schema, {
    defaultValues: {
      aval_id: "",
      fecha_inicio: "",
      fecha_fin: "",
      recurrente: false,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const payload = {
        ...values,
        fecha_inicio: toISOFromLocal(values.fecha_inicio),
        fecha_fin: toISOFromLocal(values.fecha_fin),
      };
      if (editing) {
        return apiSingle(`disponibilidades/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      return apiSingle("disponibilidades", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast.success(editing ? "Disponibilidad actualizada" : "Disponibilidad agregada");
      queryClient.invalidateQueries({ queryKey: ["disponibilidades"] });
      handleClose();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error guardando disponibilidad"),
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
    form.reset({
      aval_id: "",
      fecha_inicio: "",
      fecha_fin: "",
      recurrente: false,
    });
  };

  const handleEdit = (disponibilidad: Disponibilidad) => {
    setEditing(disponibilidad);
    form.reset({
      aval_id: disponibilidad.aval_id,
      fecha_inicio: toDateTimeLocal(disponibilidad.fecha_inicio),
      fecha_fin: toDateTimeLocal(disponibilidad.fecha_fin),
      recurrente: disponibilidad.recurrente,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (disponibilidad: Disponibilidad) => {
    if (!confirm("¿Eliminar esta disponibilidad?")) return;
    try {
      await apiSingle(`disponibilidades/${disponibilidad.id}`, { method: "DELETE" });
      toast.success("Disponibilidad eliminada");
      queryClient.invalidateQueries({ queryKey: ["disponibilidades"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error eliminando disponibilidad");
    }
  };

  const columns: ColumnDef<Disponibilidad>[] = [
    {
      header: "Aval",
      cell: ({ row }) => avales?.find((item) => item.id === row.original.aval_id)?.nombre_completo ?? "—",
    },
    {
      accessorKey: "fecha_inicio",
      header: "Inicio",
      cell: ({ row }) =>
        new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(row.original.fecha_inicio)
        ),
    },
    {
      accessorKey: "fecha_fin",
      header: "Fin",
      cell: ({ row }) =>
        new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(row.original.fecha_fin)
        ),
    },
    {
      accessorKey: "recurrente",
      header: "Recurrente",
      cell: ({ row }) => (row.original.recurrente ? "Sí" : "No"),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const disponibilidad = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(disponibilidad)}>
              Editar
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDelete(disponibilidad)}>
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Disponibilidad de avales</h1>
          <p className="text-sm text-muted-foreground">Gestiona los bloques de disponibilidad para asignar aval en turno.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : handleClose())}>
          <DialogTrigger asChild>
            <Button>Agregar disponibilidad</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar bloque" : "Nuevo bloque de disponibilidad"}</DialogTitle>
              <DialogDescription>Define horarios en los que el aval puede atender firmas.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <FormField control={form.control} name="aval_id" label="Aval">
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
              <FormGrid>
                <FormField control={form.control} name="fecha_inicio" label="Fecha inicio">
                  {(field) => <Input type="datetime-local" {...field} />}
                </FormField>
                <FormField control={form.control} name="fecha_fin" label="Fecha fin">
                  {(field) => <Input type="datetime-local" {...field} />}
                </FormField>
              </FormGrid>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.watch("recurrente")}
                  onChange={(event) => form.setValue("recurrente", event.target.checked)}
                />
                <Label>Bloque recurrente</Label>
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
      <DataTable
        columns={columns}
        data={disponibilidades ?? []}
        searchKey="recurrente"
        searchPlaceholder="Filtrar por aval o estado"
      />
    </div>
  );
}
