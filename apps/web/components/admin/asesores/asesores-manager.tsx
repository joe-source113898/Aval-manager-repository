"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";

import { DataTable } from "@/components/tables/data-table";
import { FormField, FormGrid } from "@/components/forms/form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/hooks/use-api";
import { useZodForm } from "@/hooks/use-zod-form";
import { asesorSchema } from "@/lib/schemas";
import { Asesor, PagoComision } from "@/lib/types";

const schema = asesorSchema.omit({ id: true });
const currencyFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function AsesoresManager() {
  const queryClient = useQueryClient();
  const api = useApi<Asesor[]>();
  const apiSingle = useApi<Asesor>();
  const pagosComisionApi = useApi<PagoComision[]>();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Asesor | null>(null);

  const { data: asesores } = useQuery({ queryKey: ["asesores"], queryFn: () => api("asesores") });
  const { data: pagosComision } = useQuery({
    queryKey: ["pagos-comisiones"],
    queryFn: () => pagosComisionApi("pagos-comisiones"),
  });

  const totalComisiones = useMemo(
    () =>
      (pagosComision ?? [])
        .filter((pago) => pago.beneficiario_tipo === "asesor")
        .reduce((acc, pago) => acc + (Number(pago.monto) || 0), 0),
    [pagosComision]
  );

  const totalFirmas = useMemo(
    () => (asesores ?? []).reduce((acc, asesor) => acc + (Number(asesor.firmas_count) || 0), 0),
    [asesores]
  );

  const comisionesPorAsesor = useMemo(() => {
    const map = new Map(
      (asesores ?? []).map((asesor) => [asesor.id, { pagado: 0, total: 0 }])
    );
    (pagosComision ?? []).forEach((pago) => {
      if (pago.beneficiario_tipo !== "asesor") return;
      const current = map.get(pago.beneficiario_id) ?? { pagado: 0, total: 0 };
      current.total += Number(pago.monto) || 0;
      if (pago.estado === "pagado") {
        current.pagado += Number(pago.monto) || 0;
      }
      map.set(pago.beneficiario_id, current);
    });
    return map;
  }, [asesores, pagosComision]);

  const form = useZodForm(schema, {
    defaultValues: {
      nombre: "",
      telefono: "",
      pago_comision: 0,
      firmas_count: 0,
      user_id: "",
    },
  });

  const handleClose = () => {
    setDialogOpen(false);
    setEditing(null);
    form.reset({
      nombre: "",
      telefono: "",
      pago_comision: 0,
      firmas_count: 0,
      user_id: "",
    });
  };

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const payload = {
        nombre: values.nombre.trim(),
        telefono: values.telefono?.trim() || null,
        pago_comision: Number(values.pago_comision),
        firmas_count: Number(values.firmas_count),
        user_id: values.user_id?.trim() ? values.user_id.trim() : null,
      };
      if (editing) {
        return apiSingle(`asesores/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      return apiSingle("asesores", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      toast.success(editing ? "Asesor actualizado" : "Asesor registrado");
      queryClient.invalidateQueries({ queryKey: ["asesores"] });
      handleClose();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Error guardando asesor"),
  });

  const handleEdit = (asesor: Asesor) => {
    setEditing(asesor);
    form.reset({
      nombre: asesor.nombre,
      telefono: asesor.telefono ?? "",
      pago_comision: Number(asesor.pago_comision),
      firmas_count: Number(asesor.firmas_count),
      user_id: asesor.user_id ?? "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (asesor: Asesor) => {
    if (!confirm(`¿Eliminar al asesor "${asesor.nombre}"?`)) return;
    try {
      await apiSingle(`asesores/${asesor.id}`, { method: "DELETE" });
      toast.success("Asesor eliminado");
      queryClient.invalidateQueries({ queryKey: ["asesores"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error eliminando asesor");
    }
  };

  const columns: ColumnDef<Asesor>[] = [
    { accessorKey: "nombre", header: "Nombre" },
    { accessorKey: "telefono", header: "Teléfono" },
    {
      accessorKey: "user_id",
      header: "Acceso",
      cell: ({ row }) =>
        row.original.user_id ? (
          <Badge variant="secondary" className="text-xs">
            Vinculado
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            Sin usuario
          </Badge>
        ),
    },
    {
      accessorKey: "pago_comision",
      header: "Pago / Comisión",
      cell: ({ row }) => {
        const summary = comisionesPorAsesor.get(row.original.id);
        return currencyFormatter.format(summary?.pagado ?? 0);
      },
    },
    {
      accessorKey: "firmas_count",
      header: "Firmas",
      cell: ({ row }) => (
        <Badge variant="secondary" className="text-xs">
          {row.original.firmas_count} firm{row.original.firmas_count === 1 ? "a" : "as"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const asesor = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(asesor)}>
              Editar
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDelete(asesor)}>
              Eliminar
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Asesores</h1>
          <p className="text-sm text-muted-foreground">
            Registra y controla el pago de comisión por firma y el total de firmas gestionadas por cada asesor.
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          <p>El registro de nuevos asesores se realiza desde el portal público.</p>
          <Link href="/registro-asesor" className="text-primary underline">
            Abrir formulario de registro
          </Link>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : handleClose())}>
          <DialogContent className="max-w-[min(96vw,560px)]">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar asesor" : "Registrar asesor"}</DialogTitle>
              <DialogDescription>Completa la información solicitada para calcular comisiones y firmas.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <FormField control={form.control} name="nombre" label="Nombre completo">
                {(field) => <Input placeholder="Nombre y apellidos" {...field} />}
              </FormField>
              <FormGrid>
                <FormField control={form.control} name="telefono" label="Teléfono">
                  {(field) => <Input type="tel" placeholder="33..." {...field} />}
                </FormField>
                <FormField control={form.control} name="pago_comision" label="Pago / Comisión ($ MXN)">
                  {(field) => (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={!editing}
                      placeholder={editing ? "Define comisión" : "Se asignará en Pagos"}
                      {...field}
                    />
                  )}
                </FormField>
              </FormGrid>
              <FormField control={form.control} name="firmas_count" label="Firmas de aval registradas">
                {(field) => (
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    disabled={!editing}
                    placeholder={editing ? "Define total" : "Se calculará automáticamente"}
                    {...field}
                  />
                )}
              </FormField>
              <FormField control={form.control} name="user_id" label="Usuario vinculado (UID de Supabase)">
                {(field) => (
                  <div className="space-y-1.5">
                    <Input placeholder="00000000-0000-0000-0000-000000000000" {...field} />
                    <p className="text-xs text-muted-foreground">
                      Opcional. Enlaza al asesor con un usuario autenticado para habilitar el acceso público.
                    </p>
                  </div>
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
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total de asesores</p>
          <p className="mt-2 text-2xl font-semibold">{asesores?.length ?? 0}</p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Comisiones declaradas</p>
          <p className="mt-2 text-2xl font-semibold">{currencyFormatter.format(totalComisiones)}</p>
          <p className="text-xs text-muted-foreground">Firmas acumuladas: {totalFirmas}</p>
        </div>
      </section>

      <div className="rounded-3xl border border-border/60 bg-card/70 p-4 shadow-sm ring-1 ring-black/5">
        <DataTable columns={columns} data={asesores ?? []} searchKey="nombre" searchPlaceholder="Buscar asesor" />
      </div>
    </div>
  );
}
