"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, Ban } from "lucide-react";

import { useApi } from "@/hooks/use-api";
import { useZodForm } from "@/hooks/use-zod-form";
import { Cliente, ClienteVetado } from "@/lib/types";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/tables/data-table";
import { FormField, FormGrid } from "@/components/forms/form";

const vetosSchema = z.object({
  id: z.string().uuid().optional(),
  cliente_id: z.string().uuid("Selecciona un cliente"),
  motivo_tipo: z.enum(["moroso", "problematico"]).default("moroso"),
  motivo: z.string().min(10, "Describe el motivo del bloqueo"),
  estatus: z.enum(["vetado", "limpio"]).default("vetado"),
});

type VetoFormValues = z.infer<typeof vetosSchema>;

export function ClientesVetadosManager() {
  const queryClient = useQueryClient();
  const api = useApi<ClienteVetado[]>();
  const singleApi = useApi<ClienteVetado>();
  const clientesApi = useApi<Cliente[]>();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClienteVetado | null>(null);
  const [estatusFilter, setEstatusFilter] = useState<"vetado" | "limpio" | "todos">("vetado");

  const { data: registros } = useQuery({
    queryKey: ["clientes-morosidad", estatusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (estatusFilter !== "todos") {
        params.append("estatus", estatusFilter);
      }
      const queryString = params.toString();
      return api(queryString ? `clientes-morosidad?${queryString}` : "clientes-morosidad");
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["clientes-simple"],
    queryFn: () => clientesApi("clientes"),
  });

  const clientesMap = useMemo(() => new Map((clientes ?? []).map((cliente) => [cliente.id, cliente])), [clientes]);

  const form = useZodForm(vetosSchema, {
    defaultValues: {
      cliente_id: "",
      motivo_tipo: "moroso",
      motivo: "",
      estatus: "vetado",
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    form.reset({
      cliente_id: "",
      motivo_tipo: "moroso",
      motivo: "",
      estatus: "vetado",
    });
  };

  const mutation = useMutation({
    mutationFn: async (values: VetoFormValues) => {
      const payload = {
        cliente_id: values.cliente_id,
        motivo_tipo: values.motivo_tipo,
        motivo: values.motivo,
        estatus: values.estatus,
      };
      if (editing) {
        return singleApi(`clientes-morosidad/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      return singleApi("clientes-morosidad", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast.success(editing ? "Registro actualizado" : "Cliente marcado como vetado");
      queryClient.invalidateQueries({ queryKey: ["clientes-morosidad"] });
      closeDialog();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error guardando registro"),
  });

  const handleEdit = (registro: ClienteVetado) => {
    setEditing(registro);
    form.reset({
      cliente_id: registro.cliente_id,
      motivo_tipo: registro.motivo_tipo,
      motivo: registro.motivo,
      estatus: registro.estatus,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (registro: ClienteVetado) => {
    if (!confirm("¿Eliminar este registro de veto al cliente?")) return;
    try {
      await singleApi(`clientes-morosidad/${registro.id}`, { method: "DELETE" });
      toast.success("Registro eliminado");
      queryClient.invalidateQueries({ queryKey: ["clientes-morosidad"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error eliminando registro");
    }
  };

  const columns: ColumnDef<ClienteVetado>[] = [
    {
      header: "Cliente",
      cell: ({ row }) => clientesMap.get(row.original.cliente_id)?.nombre_completo ?? "—",
    },
    {
      header: "Razón",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <Badge variant="secondary" className="w-fit capitalize">
            {row.original.motivo_tipo === "moroso" ? "Moroso" : "Problemático"}
          </Badge>
          <p className="max-w-sm text-sm text-muted-foreground">{row.original.motivo}</p>
        </div>
      ),
    },
    {
      accessorKey: "estatus",
      header: "Estatus",
      cell: ({ row }) => (
        <Badge variant={row.original.estatus === "vetado" ? "destructive" : "default"} className="capitalize">
          {row.original.estatus}
        </Badge>
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
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handleEdit(row.original)}>
            Detalles
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDelete(row.original)}>
            Eliminar
          </Button>
        </div>
      ),
    },
  ];

  const vetosActivos = (registros ?? []).filter((registro) => registro.estatus === "vetado").length;
  const vetosLimpios = (registros ?? []).filter((registro) => registro.estatus === "limpio").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Clientes vetados</h2>
          <p className="text-sm text-muted-foreground">
            Registra los clientes con adeudos o comportamientos problemáticos y comparte la evidencia con tu equipo.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
          <DialogTrigger asChild>
            <Button>
              <AlertTriangle className="mr-2 h-4 w-4" />
              Registrar cliente vetado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[min(96vw,640px)]">
            <DialogHeader>
              <DialogTitle>{editing ? "Actualizar registro" : "Nuevo cliente vetado"}</DialogTitle>
              <DialogDescription>
                Selecciona al cliente y define el motivo del veto junto con los detalles o antecedentes.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <FormField control={form.control} name="cliente_id" label="Cliente">
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
              <FormGrid>
                <FormField control={form.control} name="motivo_tipo" label="Motivo principal">
                  {(field) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="moroso">Moroso (adeudo o pago incompleto)</SelectItem>
                        <SelectItem value="problematico">Problemático (incidencias de comportamiento)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
                <FormField control={form.control} name="estatus" label="Estatus del cliente">
                  {(field) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona estatus" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vetado">Vetado</SelectItem>
                        <SelectItem value="limpio">Limpio</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              </FormGrid>
              <FormField control={form.control} name="motivo" label="Motivo">
                {(field) => (
                  <Textarea rows={4} placeholder="Describe la razón del bloqueo o antecedentes" {...field} />
                )}
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

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-border/70 bg-card/70 p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Vetos activos</p>
          <p className="mt-1 text-3xl font-semibold">{vetosActivos}</p>
          <p className="text-xs text-muted-foreground">Clientes que no pueden registrar nuevas firmas.</p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-card/70 p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Liberados</p>
          <p className="mt-1 text-3xl font-semibold">{vetosLimpios}</p>
          <p className="text-xs text-muted-foreground">Registros con evidencia resuelta o limpia.</p>
        </div>
      </section>

      <div className="rounded-3xl border border-border bg-card/70 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={estatusFilter === "vetado" ? "default" : "outline"} onClick={() => setEstatusFilter("vetado")}>
              Vetados
            </Button>
            <Button size="sm" variant={estatusFilter === "limpio" ? "default" : "outline"} onClick={() => setEstatusFilter("limpio")}>
              Limpios
            </Button>
            <Button size="sm" variant={estatusFilter === "todos" ? "default" : "outline"} onClick={() => setEstatusFilter("todos")}>
              Todos
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Ban className="h-4 w-4" />
            Registros totales: {registros?.length ?? 0}
          </div>
        </div>
        <DataTable columns={columns} data={registros ?? []} searchKey="motivo" searchPlaceholder="Buscar por motivo" />
      </div>

    </div>
  );
}
