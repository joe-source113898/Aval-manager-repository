"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Shield } from "lucide-react";

import { DataTable } from "@/components/tables/data-table";
import { FormField } from "@/components/forms/form";
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
import { Aval, AvalVeto, Inmobiliaria } from "@/lib/types";

const vetoSchema = z.object({
  id: z.string().uuid().optional(),
  aval_id: z.string().uuid("Selecciona un aval"),
  inmobiliaria_id: z.string().uuid({ message: "Selecciona una inmobiliaria" }),
  motivo: z.string().min(10, "Describe el motivo del veto"),
  estatus: z.enum(["vetado", "limpio"]).default("vetado"),
});

export function VetosAvalesManager() {
  const queryClient = useQueryClient();
  const vetosApi = useApi<AvalVeto[]>();
  const vetoSingleApi = useApi<AvalVeto>();
  const avalesApi = useApi<Aval[]>();
  const inmobiliariasApi = useApi<Inmobiliaria[]>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AvalVeto | null>(null);
  const [estatusFilter, setEstatusFilter] = useState<"vetado" | "limpio" | "todos">("vetado");

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

  const avalesMap = useMemo(() => new Map((avales ?? []).map((aval) => [aval.id, aval])), [avales]);
  const inmobiliariasMap = useMemo(
    () => new Map((inmobiliarias ?? []).map((item) => [item.id, item])),
    [inmobiliarias]
  );

  const form = useZodForm(vetoSchema, {
    defaultValues: {
      aval_id: "",
      inmobiliaria_id: "",
      motivo: "",
      estatus: "vetado",
    },
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
    form.reset({
      aval_id: "",
      inmobiliaria_id: "",
      motivo: "",
      estatus: "vetado",
    });
  };

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof vetoSchema>) => {
      const payload = { ...values };
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
      cell: ({ row }) =>
        row.original.inmobiliaria_id
          ? inmobiliariasMap.get(row.original.inmobiliaria_id)?.nombre ?? "—"
          : "Sin inmobiliaria",
    },
    { accessorKey: "motivo", header: "Motivo" },
    {
      accessorKey: "estatus",
      header: "Estatus",
      cell: ({ row }) => (
        <Badge variant={row.original.estatus === "vetado" ? "destructive" : "secondary"}>
          {row.original.estatus === "vetado" ? "Vetado" : "Limpio"}
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
            Registra y consulta las inmobiliarias donde un aval no puede operar. Cada registro pertenece a una agencia
            específica.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : handleClose())}>
          <DialogTrigger asChild>
            <Button>
              <Shield className="mr-2 h-4 w-4" />
              Registrar veto por inmobiliaria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[min(96vw,640px)]">
            <DialogHeader>
              <DialogTitle>{editing ? "Actualizar veto" : "Registrar veto"}</DialogTitle>
              <DialogDescription>
                Selecciona el aval y la inmobiliaria donde tiene restricciones. Todos los vetos se registran por agencia
                específica.
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
              <FormField control={form.control} name="inmobiliaria_id" label="Inmobiliaria vetada">
                {(field) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona inmobiliaria" />
                    </SelectTrigger>
                    <SelectContent>
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
              <FormField control={form.control} name="estatus" label="Estatus">
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
            <Button size="sm" variant={estatusFilter === "vetado" ? "default" : "outline"} onClick={() => setEstatusFilter("vetado")}>
              Vetados
            </Button>
            <Button
              size="sm"
              variant={estatusFilter === "limpio" ? "default" : "outline"}
              onClick={() => setEstatusFilter("limpio")}
            >
              Limpios
            </Button>
            <Button size="sm" variant={estatusFilter === "todos" ? "default" : "outline"} onClick={() => setEstatusFilter("todos")}>
              Todos
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{vetos?.length ?? 0} registros</p>
        </div>
        <DataTable columns={columns} data={vetos ?? []} searchKey="motivo" searchPlaceholder="Buscar por motivo" />
      </div>
    </div>
  );
}
