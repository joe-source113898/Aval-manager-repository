import { z } from "zod";

export const avalSchema = z.object({
  id: z.string().uuid().optional(),
  nombre_completo: z.string().min(3, "Nombre requerido"),
  edad: z.coerce.number().int().min(18, "Edad mínima 18"),
  telefono: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  estado_civil: z.string().optional().or(z.literal("")),
  domicilio_actual: z.string().optional().or(z.literal("")),
  identificacion_oficial_url: z.string().optional().or(z.literal("")),
  comprobante_domicilio_cfe_url: z.string().optional().or(z.literal("")),
  comprobante_domicilio_siapa_url: z.string().optional().or(z.literal("")),
  pago_predial_url: z.string().optional().or(z.literal("")),
  escrituras_url: z.string().optional().or(z.literal("")),
  certificado_libre_gravamen_url: z.string().optional().or(z.literal("")),
  rfc_url: z.string().optional().or(z.literal("")),
  curp_url: z.string().optional().or(z.literal("")),
  acta_nacimiento_url: z.string().optional().or(z.literal("")),
  comprobante_ingresos_1_url: z.string().optional().or(z.literal("")),
  comprobante_ingresos_2_url: z.string().optional().or(z.literal("")),
  comprobante_ingresos_3_url: z.string().optional().or(z.literal("")),
  buro_credito_url: z.string().optional().or(z.literal("")),
  buro_credito_password: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
  activo: z.boolean().default(true),
});

const referenciaFamiliarSchema = z.object({
  nombre_completo: z.string().min(3, "Nombre requerido"),
  parentesco: z.string().min(2, "Parentesco requerido"),
  telefono: z
    .string()
    .trim()
    .min(7, "Teléfono inválido")
    .regex(/^[0-9+()\s-]+$/, { message: "Formato inválido" }),
});

const referenciaConocidoSchema = z.object({
  nombre_completo: z.string().min(3, "Nombre requerido"),
  telefono: z
    .string()
    .trim()
    .min(7, "Teléfono inválido")
    .regex(/^[0-9+()\s-]+$/, { message: "Formato inválido" }),
});

export const clienteSchema = z.object({
  id: z.string().uuid().optional(),
  nombre_completo: z.string().min(3, "Nombre requerido"),
  identificacion_oficial_url: z.string().optional().or(z.literal("")),
  telefono: z.string().optional().or(z.literal("")),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
  referencias_familiares: z
    .array(referenciaFamiliarSchema)
    .length(2, "Debes capturar dos referencias familiares"),
  referencias_conocidos: z
    .array(referenciaConocidoSchema)
    .length(2, "Debes capturar dos referencias de conocidos"),
});

export const propiedadSchema = z.object({
  id: z.string().uuid().optional(),
  domicilio: z.string().min(3, "Domicilio requerido"),
  ciudad: z.string().default("Guadalajara"),
  estado: z.string().default("Jalisco"),
  notas: z.string().optional().or(z.literal("")),
});

export const contratoSchema = z.object({
  id: z.string().uuid().optional(),
  cliente_id: z.string().uuid("Selecciona un cliente"),
  aval_id: z.string().uuid("Selecciona un aval"),
  propiedad_id: z.string().uuid("Selecciona una propiedad"),
  lugar_firma_maps_url: z.string().url("URL inválida"),
  tipo_renta: z.string().min(3),
  monto_renta_mensual: z.coerce.number().min(0),
  pago_por_servicio: z.coerce.number().min(0),
  periodo_contrato: z.string().min(2),
  fecha_firma: z.string().min(1),
  estado: z.enum(["pendiente", "firmado", "cancelado"]).default("pendiente"),
});

export const pagoSchema = z.object({
  id: z.string().uuid().optional(),
  contrato_id: z.string().uuid("Selecciona contrato"),
  metodo: z.enum(["efectivo", "bancario"]),
  monto: z.coerce.number().positive(),
  fecha_pago: z.string().optional().or(z.literal("")),
  referencia: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
});

export const firmaSchema = z.object({
  id: z.string().uuid().optional(),
  cliente_id: z.string().uuid("Selecciona un cliente"),
  aval_id: z.string().uuid("Selecciona un aval"),
  inmobiliaria_id: z.string().uuid().optional().or(z.literal("")),
  asesor_nombre: z.string().trim().min(3, "Nombre del asesor requerido"),
  cliente_nombre: z.string().trim().min(3, "Nombre del cliente requerido"),
  telefono: z
    .string()
    .trim()
    .min(7, "Teléfono inválido")
    .regex(/^[0-9+()\s-]+$/, { message: "Teléfono inválido" })
    .optional()
    .or(z.literal("")),
  correo: z
    .string()
    .trim()
    .email("Correo inválido")
    .optional()
    .or(z.literal("")),
  tipo_renta: z.string().trim().min(3, "Tipo de renta requerido"),
  periodo_contrato_anios: z.coerce.number().min(0, "Periodo inválido").max(50, "Periodo demasiado largo"),
  monto_renta: z.coerce.number().min(0, "Monto inválido"),
  propiedad_domicilio: z.string().trim().min(3, "Propiedad requerida"),
  ubicacion_maps_url: z.string().trim().url("URL de Maps inválida"),
  fecha_inicio: z.string().min(1, "Fecha requerida"),
  fecha_fin: z.string().optional().or(z.literal("")),
  estado: z.enum(["programada", "realizada", "reprogramada", "cancelada"]).default("programada"),
  canal_firma: z.enum(["inmobiliaria", "dueno_directo"]).default("dueno_directo"),
  pago_por_servicio: z.coerce.number().min(0, "Monto inválido"),
  solicitud_aval_url: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
});

const documentoSchemaBase = z.object({
  id: z.string().uuid().optional(),
  contrato_id: z.string().uuid().optional().or(z.literal("")),
  cliente_id: z.string().uuid().optional().or(z.literal("")),
  tipo: z.string().min(2),
  archivo_path: z.string().min(2),
  notas: z.string().optional().or(z.literal("")),
});

export const documentoSchema = documentoSchemaBase.refine(
  (data) => Boolean(data.contrato_id) || Boolean(data.cliente_id),
  {
    message: "Selecciona un contrato o un cliente",
    path: ["contrato_id"],
  }
);

export const documentoFormSchema = documentoSchemaBase;

export const disponibilidadSchema = z.object({
  id: z.string().uuid().optional(),
  aval_id: z.string().uuid("Selecciona aval"),
  fecha_inicio: z.string().min(1),
  fecha_fin: z.string().min(1),
  recurrente: z.boolean().default(false),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export const asesorSchema = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().min(3, "Nombre requerido"),
  telefono: z
    .string()
    .trim()
    .min(7, "Teléfono inválido")
    .regex(/^[0-9+()\s-]+$/, { message: "Formato inválido" })
    .optional()
    .or(z.literal("")),
  pago_comision: z.coerce.number().min(0, "Monto inválido"),
  firmas_count: z.coerce.number().int().min(0, "Debe ser positivo"),
});

const PAGO_SERVICIO_BASE = z.object({
  id: z.string().uuid().optional(),
  firma_id: z.string().uuid("Selecciona una firma"),
  monto_efectivo: z.coerce.number().min(0, "Monto inválido").default(0),
  monto_transferencia: z.coerce.number().min(0, "Monto inválido").default(0),
  fecha_pago: z.string().optional().or(z.literal("")),
  comprobante_url: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
  estado: z.enum(["registrado", "liquidado"]).default("registrado"),
  corte_id: z.string().uuid().optional().or(z.literal("")),
});

const withPagoServicioValidations = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .refine((data) => data.monto_efectivo > 0 || data.monto_transferencia > 0, {
      message: "Captura un monto en efectivo o transferencia.",
      path: ["monto_efectivo"],
    })
    .refine((data) => (data.monto_transferencia > 0 ? Boolean(data.comprobante_url) : true), {
      message: "El comprobante es obligatorio cuando hay transferencia.",
      path: ["comprobante_url"],
    });

export const pagoServicioSchema = withPagoServicioValidations(PAGO_SERVICIO_BASE);
export const pagoServicioFormSchema = withPagoServicioValidations(PAGO_SERVICIO_BASE.omit({ id: true }));

export const pagoComisionSchema = z.object({
  id: z.string().uuid().optional(),
  firma_id: z.string().uuid("Selecciona una firma"),
  beneficiario_tipo: z.enum(["aval", "asesor"]),
  beneficiario_id: z.string().uuid("Selecciona beneficiario"),
  monto: z.coerce.number().min(0, "Monto inválido"),
  metodo: z.enum(["efectivo", "transferencia", "mixto"]).optional().or(z.literal("")),
  fecha_programada: z.string().optional().or(z.literal("")),
  fecha_pago: z.string().optional().or(z.literal("")),
  comprobante_url: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
  estado: z.enum(["pendiente", "pagado"]).default("pendiente"),
  corte_id: z.string().uuid().optional().or(z.literal("")),
});

export const inmobiliariaSchema = z.object({
  id: z.string().uuid().optional(),
  nombre: z.string().min(3, "Nombre requerido"),
  contacto: z.string().optional().or(z.literal("")),
  telefono: z
    .string()
    .trim()
    .min(7, "Teléfono inválido")
    .regex(/^[0-9+()\s-]+$/, { message: "Formato inválido" })
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("Correo inválido").optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
});
