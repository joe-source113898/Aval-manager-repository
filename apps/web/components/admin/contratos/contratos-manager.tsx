"use client";

import { useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { useZodForm } from "@/hooks/use-zod-form";
import { contratoSchema } from "@/lib/schemas";
import { Cliente, Contrato, Aval, Propiedad } from "@/lib/types";
import { toDateTimeLocal, toISOFromLocal } from "@/lib/utils";

const schema = contratoSchema.omit({ id: true });

export function ContratosManager() {
  const queryClient = useQueryClient();
  const api = useApi<Contrato[]>();
  const apiSingle = useApi<Contrato>();
  const avalesApi = useApi<Aval[]>();
  const clientesApi = useApi<Cliente[]>();
  const propiedadesApi = useApi<Propiedad[]>();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contrato | null>(null);

  const { data: contratos } = useQuery({ queryKey: ["contratos"], queryFn: () => api("contratos") });

  const [{ data: avales }, { data: clientes }, { data: propiedades }] = useQueries({
    queries: [
      { queryKey: ["avales"], queryFn: () => avalesApi("avales") },
      { queryKey: ["clientes"], queryFn: () => clientesApi("clientes") },
      { queryKey: ["propiedades"], queryFn: () => propiedadesApi("propiedades") },
    ],
  });

  const clientesMap = useMemo(() => new Map((clientes ?? []).map((item) => [item.id, item])), [clientes]);
  const avalesMap = useMemo(() => new Map((avales ?? []).map((item) => [item.id, item])), [avales]);
  const propiedadesMap = useMemo(() => new Map((propiedades ?? []).map((item) => [item.id, item])), [propiedades]);

  const form = useZodForm(schema, {
    defaultValues: {
      cliente_id: "",
      aval_id: "",
      propiedad_id: "",
      lugar_firma_maps_url: "",
      tipo_renta: "",
      monto_renta_mensual: 0,
      pago_por_servicio: 0,
      periodo_contrato: "",
      fecha_firma: "",
      estado: "pendiente",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const payload = {
        ...values,
        monto_renta_mensual: Number(values.monto_renta_mensual),
        pago_por_servicio: Number(values.pago_por_servicio),
        fecha_firma: toISOFromLocal(values.fecha_firma),
      };
      if (editing) {
        return apiSingle(`contratos/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      return apiSingle("contratos", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast.success(editing ? "Contrato actualizado" : "Contrato creado");
      queryClient.invalidateQueries({ queryKey: ["contratos"] });
      handleClose();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error guardando contrato"),
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
    form.reset({
      cliente_id: "",
      aval_id: "",
      propiedad_id: "",
      lugar_firma_maps_url: "",
      tipo_renta: "",
      monto_renta_mensual: 0,
      pago_por_servicio: 0,
      periodo_contrato: "",
      fecha_firma: "",
      estado: "pendiente",
    });
  };

  const handleEdit = (contrato: Contrato) => {
    setEditing(contrato);
    form.reset({
      cliente_id: contrato.cliente_id,
      aval_id: contrato.aval_id,
      propiedad_id: contrato.propiedad_id,
      lugar_firma_maps_url: contrato.lugar_firma_maps_url,
      tipo_renta: contrato.tipo_renta,
      monto_renta_mensual: Number(contrato.monto_renta_mensual),
      pago_por_servicio: Number(contrato.pago_por_servicio),
      periodo_contrato: contrato.periodo_contrato,
      fecha_firma: toDateTimeLocal(contrato.fecha_firma),
      estado: contrato.estado,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (contrato: Contrato) => {
    if (!confirm("¿Eliminar este contrato?")) return;
    try {
      await apiSingle(`contratos/${contrato.id}`, { method: "DELETE" });
      toast.success("Contrato eliminado");
      queryClient.invalidateQueries({ queryKey: ["contratos"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error eliminando contrato");
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  const columns: ColumnDef<Contrato>[] = [
    {
      header: "Cliente",
      cell: ({ row }) => clientesMap.get(row.original.cliente_id)?.nombre_completo ?? "—",
    },
    {
      header: "Aval",
      cell: ({ row }) => avalesMap.get(row.original.aval_id)?.nombre_completo ?? "—",
    },
    {
      header: "Propiedad",
      cell: ({ row }) => propiedadesMap.get(row.original.propiedad_id)?.domicilio ?? "—",
    },
    {
      accessorKey: "fecha_firma",
      header: "Fecha de firma",
      cell: ({ row }) => formatDate(row.original.fecha_firma),
    },
    {
      accessorKey: "monto_renta_mensual",
      header: "Renta",
      cell: ({ row }) => formatCurrency(Number(row.original.monto_renta_mensual)),
    },
    {
      accessorKey: "pago_por_servicio",
      header: "Servicio",
      cell: ({ row }) => formatCurrency(Number(row.original.pago_por_servicio)),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => row.original.estado,
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const contrato = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(contrato)}>
              Editar
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDelete(contrato)}>
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
          <h1 className="text-2xl font-semibold">Contratos</h1>
          <p className="text-sm text-muted-foreground">Gestiona los contratos y vincula clientes, avales y propiedades.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : handleClose())}>
          <DialogTrigger asChild>
            <Button>Registrar contrato</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[min(96vw,1100px)] sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar contrato" : "Nuevo contrato"}</DialogTitle>
              <DialogDescription>Completa los campos para registrar un contrato.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <FormGrid>
                <FormField control={form.control} name="cliente_id" label="Cliente">
                  {(field) => (
                    <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un cliente" />
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
                <FormField control={form.control} name="aval_id" label="Aval">
                  {(field) => (
                    <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un aval" />
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
                <FormField control={form.control} name="propiedad_id" label="Propiedad">
                  {(field) => (
                    <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una propiedad" />
                      </SelectTrigger>
                      <SelectContent>
                        {(propiedades ?? []).map((propiedad) => (
                          <SelectItem key={propiedad.id} value={propiedad.id}>
                            {propiedad.domicilio}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              </FormGrid>
              <FormGrid>
                <FormField control={form.control} name="tipo_renta" label="Tipo de renta">
                  {(field) => <Input {...field} />}
                </FormField>
                <FormField control={form.control} name="periodo_contrato" label="Periodo">
                  {(field) => <Input {...field} placeholder="12 meses" />}
                </FormField>
              </FormGrid>
              <FormGrid>
                <FormField control={form.control} name="monto_renta_mensual" label="Renta mensual">
                  {(field) => <Input type="number" step="0.01" {...field} />}
                </FormField>
                <FormField control={form.control} name="pago_por_servicio" label="Pago por servicio">
                  {(field) => <Input type="number" step="0.01" {...field} />}
                </FormField>
                <FormField control={form.control} name="fecha_firma" label="Fecha de firma">
                  {(field) => <Input type="datetime-local" {...field} />}
                </FormField>
              </FormGrid>
              <FormField control={form.control} name="lugar_firma_maps_url" label="URL de lugar de firma (Maps)">
                {(field) => <Input placeholder="https://maps.google.com/..." {...field} />}
              </FormField>
              <FormField control={form.control} name="estado" label="Estado">
                {(field) => (
                  <Select value={field.value} onValueChange={(value) => field.onChange(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendiente">Pendiente</SelectItem>
                      <SelectItem value="firmado">Firmado</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
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
      <DataTable
        columns={columns}
        data={contratos ?? []}
        searchKey="estado"
        searchPlaceholder="Filtrar por estado"
      />
    </div>
  );
}
