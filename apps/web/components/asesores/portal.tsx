"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";

import { FormField, FormGrid } from "@/components/forms/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { useZodForm } from "@/hooks/use-zod-form";
import { cn } from "@/lib/utils";
import { Disponibilidad, Firma, PublicAval } from "@/lib/types";

const firmaSchema = z.object({
  aval_id: z.string().uuid("Selecciona un aval"),
  cliente_nombre: z.string().min(3, "Nombre requerido"),
  cliente_curp: z.string().optional(),
  cliente_rfc: z.string().optional(),
  cliente_numero_identificacion: z.string().optional(),
  telefono: z.string().optional(),
  correo: z.string().email("Correo inválido").optional(),
  tipo_renta: z.string().min(3, "Tipo requerido"),
  periodo_contrato_anios: z.coerce.number().min(0).max(50),
  monto_renta: z.coerce.number().min(0),
  propiedad_domicilio: z.string().min(3, "Domicilio requerido"),
  ubicacion_maps_url: z.string().url("URL inválida"),
  fecha_inicio: z.string(),
  fecha_fin: z.string().optional(),
  canal_firma: z.enum(["inmobiliaria", "dueno_directo"]),
  pago_por_servicio: z.coerce.number().min(0),
  notas: z.string().optional(),
});

const listaNegraSchema = z.object({
  cliente_nombre: z.string().min(3, "Nombre requerido"),
  cliente_curp: z.string().optional(),
  cliente_rfc: z.string().optional(),
  cliente_numero_identificacion: z.string().optional(),
  motivo: z.string().min(5, "Describe el motivo"),
  motivo_tipo: z.enum(["moroso", "problematico"]),
});

export function AdvisorPortal() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [selectedAval, setSelectedAval] = useState<string | undefined>(undefined);

  const avalesQuery = useQuery({
    queryKey: ["asesor-avales"],
    queryFn: () => api("/asesores/avales"),
  });

  const firmasQuery = useQuery({
    queryKey: ["asesor-firmas"],
    queryFn: () => api("/asesores/firmas"),
  });

  const disponibilidadesQuery = useQuery({
    queryKey: ["asesor-disponibilidades", selectedAval],
    queryFn: () => api(`/asesores/avales/${selectedAval}/disponibilidades`),
    enabled: Boolean(selectedAval),
  });

  const firmaForm = useZodForm(firmaSchema, {
    defaultValues: {
      canal_firma: "dueno_directo",
      periodo_contrato_anios: 1,
      pago_por_servicio: 0,
      fecha_inicio: "",
      fecha_fin: "",
    },
  });

  const listaNegraForm = useZodForm(listaNegraSchema, {
    defaultValues: {
      motivo_tipo: "moroso",
    },
  });

  const registrarFirma = useMutation({
    mutationFn: async (values: z.infer<typeof firmaSchema>) => {
      const payload = {
        ...values,
        cliente_curp: values.cliente_curp || undefined,
        cliente_rfc: values.cliente_rfc || undefined,
        cliente_numero_identificacion: values.cliente_numero_identificacion || undefined,
        telefono: values.telefono || undefined,
        correo: values.correo || undefined,
        fecha_inicio: new Date(values.fecha_inicio).toISOString(),
        fecha_fin: values.fecha_fin ? new Date(values.fecha_fin).toISOString() : undefined,
      };
      return api("/asesores/firmas", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success("Firma registrada");
      firmaForm.reset();
      queryClient.invalidateQueries({ queryKey: ["asesor-firmas"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const registrarListaNegra = useMutation({
    mutationFn: (values: z.infer<typeof listaNegraSchema>) =>
      api("/asesores/lista-negra/clientes", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          cliente_curp: values.cliente_curp || undefined,
          cliente_rfc: values.cliente_rfc || undefined,
          cliente_numero_identificacion: values.cliente_numero_identificacion || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Registro enviado a lista negra");
      listaNegraForm.reset();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const cancelarFirma = useMutation({
    mutationFn: (firmaId: string) =>
      api(`/asesores/firmas/${firmaId}/cancelar`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Firma cancelada");
      queryClient.invalidateQueries({ queryKey: ["asesor-firmas"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const avales = (avalesQuery.data as PublicAval[]) ?? [];
  const firmas = (firmasQuery.data as Firma[]) ?? [];
  const disponibilidades = (disponibilidadesQuery.data as Disponibilidad[]) ?? [];

  const selectedAvalName = useMemo(() => {
    return avales.find((aval) => aval.id === selectedAval)?.nombre_completo ?? null;
  }, [avales, selectedAval]);

  useEffect(() => {
    if (!selectedAval && avales.length > 0) {
      setSelectedAval(avales[0].id);
    }
  }, [avales, selectedAval]);

  return (
    <div className="space-y-10 pb-12">
      <section className="rounded-3xl border border-border bg-card/90 p-6 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Registrar nueva firma</h1>
          <p className="text-sm text-muted-foreground">
            Elige un aval disponible y captura los datos de la cita. El sistema validará que el horario no se traslape con otra
            firma registrada.
          </p>
        </div>
        <form
          className="mt-6 space-y-5"
          onSubmit={firmaForm.handleSubmit((values) => registrarFirma.mutate(values))}
        >
          <FormField control={firmaForm.control} name="aval_id" label="Aval">
            {(field) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  setSelectedAval(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un aval" />
                </SelectTrigger>
                <SelectContent>
                  {avales.map((aval) => (
                    <SelectItem key={aval.id} value={aval.id}>
                      {aval.nombre_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          {selectedAval && disponibilidades.length > 0 ? (
            <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-sm text-primary">
              <p className="font-semibold">Disponibilidad de {selectedAvalName}</p>
              <ul className="mt-2 space-y-1">
                {disponibilidades.map((block) => (
                  <li key={block.id} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {new Date(block.fecha_inicio).toLocaleString()} → {new Date(block.fecha_fin).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <FormGrid>
            <FormField control={firmaForm.control} name="cliente_nombre" label="Nombre del cliente">
              {(field) => <Input placeholder="Nombre completo" {...field} />}
            </FormField>
            <FormField control={firmaForm.control} name="telefono" label="Teléfono">
              {(field) => <Input placeholder="33..." {...field} />}
            </FormField>
            <FormField control={firmaForm.control} name="correo" label="Correo">
              {(field) => <Input placeholder="cliente@correo.com" {...field} />}
            </FormField>
          </FormGrid>
          <FormGrid>
            <FormField control={firmaForm.control} name="cliente_curp" label="CURP">
              {(field) => <Input placeholder="CURP" {...field} />}
            </FormField>
            <FormField control={firmaForm.control} name="cliente_rfc" label="RFC">
              {(field) => <Input placeholder="RFC" {...field} />}
            </FormField>
            <FormField control={firmaForm.control} name="cliente_numero_identificacion" label="No. de identificación">
              {(field) => <Input placeholder="ID oficial" {...field} />}
            </FormField>
          </FormGrid>
          <FormGrid>
            <FormField control={firmaForm.control} name="tipo_renta" label="Tipo de renta">
              {(field) => <Input placeholder="Habitacional, comercial..." {...field} />}
            </FormField>
            <FormField control={firmaForm.control} name="periodo_contrato_anios" label="Años de contrato">
              {(field) => <Input type="number" min={0} {...field} />}
            </FormField>
            <FormField control={firmaForm.control} name="monto_renta" label="Monto renta">
              {(field) => <Input type="number" min={0} step="0.01" {...field} />}
            </FormField>
          </FormGrid>
          <FormField control={firmaForm.control} name="propiedad_domicilio" label="Domicilio de la propiedad">
            {(field) => <Input placeholder="Dirección completa" {...field} />}
          </FormField>
          <FormField control={firmaForm.control} name="ubicacion_maps_url" label="Ubicación (Google Maps)">
            {(field) => <Input placeholder="https://maps.google.com/..." {...field} />}
          </FormField>
          <FormGrid>
            <FormField control={firmaForm.control} name="fecha_inicio" label="Fecha y hora de inicio">
              {(field) => <Input type="datetime-local" {...field} />}
            </FormField>
            <FormField control={firmaForm.control} name="fecha_fin" label="Fecha y hora de fin">
              {(field) => <Input type="datetime-local" {...field} />}
            </FormField>
          </FormGrid>
          <FormGrid>
            <FormField control={firmaForm.control} name="canal_firma" label="Canal">
              {(field) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dueno_directo">Dueño directo</SelectItem>
                    <SelectItem value="inmobiliaria">Inmobiliaria</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField control={firmaForm.control} name="pago_por_servicio" label="Pago por servicio">
              {(field) => <Input type="number" min={0} step="0.01" {...field} />}
            </FormField>
          </FormGrid>
          <FormField control={firmaForm.control} name="notas" label="Notas adicionales">
            {(field) => <Textarea rows={3} placeholder="Información relevante" {...field} />}
          </FormField>
          <div className="flex justify-end">
            <Button type="submit" disabled={registrarFirma.isPending}>
              {registrarFirma.isPending ? "Guardando..." : "Registrar firma"}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Mis firmas</h2>
          <p className="text-sm text-muted-foreground">Consulta y, si es necesario, cancela firmas próximas.</p>
        </div>
        <div className="mt-4 space-y-3">
          {firmas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no has registrado firmas.</p>
          ) : (
            firmas.map((firma) => (
              <div
                key={firma.id}
                className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold">{firma.cliente_nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(firma.fecha_inicio).toLocaleString()} — {new Date(firma.fecha_fin).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">{firma.propiedad_domicilio}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={firma.estado === "cancelada" ? "secondary" : "outline"}>{firma.estado}</Badge>
                  {firma.estado !== "cancelada" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cancelarFirma.mutate(firma.id)}
                      disabled={cancelarFirma.isPending}
                    >
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card/90 p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Registrar cliente en lista negra</h2>
          <p className="text-sm text-muted-foreground">
            Usa CURP, RFC o número de identificación para detectar clientes repetidos antes de vetarlos.
          </p>
        </div>
        <form
          className="mt-6 space-y-4"
          onSubmit={listaNegraForm.handleSubmit((values) => registrarListaNegra.mutate(values))}
        >
          <FormField control={listaNegraForm.control} name="cliente_nombre" label="Nombre del cliente">
            {(field) => <Input placeholder="Nombre completo" {...field} />}
          </FormField>
          <FormGrid>
            <FormField control={listaNegraForm.control} name="cliente_curp" label="CURP">
              {(field) => <Input placeholder="CURP" {...field} />}
            </FormField>
            <FormField control={listaNegraForm.control} name="cliente_rfc" label="RFC">
              {(field) => <Input placeholder="RFC" {...field} />}
            </FormField>
            <FormField control={listaNegraForm.control} name="cliente_numero_identificacion" label="No. de identificación">
              {(field) => <Input placeholder="ID oficial" {...field} />}
            </FormField>
          </FormGrid>
          <FormGrid>
            <FormField control={listaNegraForm.control} name="motivo_tipo" label="Tipo de motivo">
              {(field) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moroso">Moroso</SelectItem>
                    <SelectItem value="problematico">Problemático</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <FormField control={listaNegraForm.control} name="motivo" label="Motivo">
              {(field) => <Textarea rows={3} placeholder="Describe la situación" {...field} />}
            </FormField>
          </FormGrid>
          <div className="flex justify-end">
            <Button type="submit" disabled={registrarListaNegra.isPending}>
              {registrarListaNegra.isPending ? "Guardando..." : "Registrar en lista negra"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
