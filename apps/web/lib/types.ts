export interface Aval {
  id: string;
  nombre_completo: string;
  edad?: number | null;
  telefono?: string | null;
  email?: string | null;
  estado_civil?: string | null;
  domicilio_actual?: string | null;
  identificacion_oficial_url?: string | null;
  comprobante_domicilio_cfe_url?: string | null;
  comprobante_domicilio_siapa_url?: string | null;
  pago_predial_url?: string | null;
  escrituras_url?: string | null;
  certificado_libre_gravamen_url?: string | null;
  rfc_url?: string | null;
  curp_url?: string | null;
  acta_nacimiento_url?: string | null;
  comprobante_ingresos_1_url?: string | null;
  comprobante_ingresos_2_url?: string | null;
  comprobante_ingresos_3_url?: string | null;
  buro_credito_url?: string | null;
  buro_credito_password?: string | null;
  notas?: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClienteReferenciaFamiliar {
  nombre_completo: string;
  parentesco: string;
  telefono: string;
}

export interface ClienteReferenciaConocido {
  nombre_completo: string;
  telefono: string;
}

export interface Cliente {
  id: string;
  nombre_completo: string;
  identificacion_oficial_url?: string | null;
  telefono?: string | null;
  email?: string | null;
  notas?: string | null;
  referencias_familiares: ClienteReferenciaFamiliar[];
  referencias_conocidos: ClienteReferenciaConocido[];
  created_at: string;
  updated_at: string;
}

export interface Propiedad {
  id: string;
  domicilio: string;
  ciudad: string;
  estado: string;
  notas?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contrato {
  id: string;
  cliente_id: string;
  aval_id: string;
  propiedad_id: string;
  lugar_firma_maps_url: string;
  tipo_renta: string;
  monto_renta_mensual: number;
  pago_por_servicio: number;
  periodo_contrato: string;
  fecha_firma: string;
  estado: "pendiente" | "firmado" | "cancelado";
  created_at: string;
  updated_at: string;
}

export interface Pago {
  id: string;
  contrato_id: string;
  metodo: "efectivo" | "bancario";
  monto: number;
  fecha_pago: string;
  referencia?: string | null;
  notas?: string | null;
  created_at: string;
}

export interface Firma {
  id: string;
  cliente_id?: string | null;
  aval_id: string;
  inmobiliaria_id?: string | null;
  asesor_nombre: string;
  cliente_nombre: string;
  telefono?: string | null;
  correo?: string | null;
  tipo_renta: string;
  periodo_contrato_anios: number;
  monto_renta: number;
  propiedad_domicilio: string;
  fecha_inicio: string;
  fecha_fin: string;
  ubicacion_maps_url: string;
  estado: "programada" | "realizada" | "reprogramada" | "cancelada";
  canal_firma: "inmobiliaria" | "dueno_directo";
  pago_por_servicio: number;
  solicitud_aval_url?: string | null;
  notas?: string | null;
  contrato_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Disponibilidad {
  id: string;
  aval_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  recurrente: boolean;
  created_at: string;
}

export interface Documento {
  id: string;
  contrato_id?: string | null;
  cliente_id?: string | null;
  tipo: string;
  archivo_path: string;
  bucket?: string | null;
  signed_url?: string | null;
  creado_por?: string | null;
  notas?: string | null;
  created_at: string;
}

export interface AvalVeto {
  id: string;
  aval_id: string;
  inmobiliaria_id?: string | null;
  motivo: string;
  estatus: "vetado" | "limpio";
  registrado_por?: string | null;
  limpio_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClienteVetado {
  id: string;
  cliente_id: string;
  registrado_por?: string | null;
  motivo_tipo: "moroso" | "problematico";
  motivo: string;
  estatus: "vetado" | "limpio";
  limpio_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicFirma {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  ubicacion_maps_url?: string | null;
  estado: "programada" | "realizada" | "reprogramada" | "cancelada";
  cliente_nombre?: string | null;
  asesor_nombre?: string | null;
  tipo_renta?: string | null;
  propiedad_domicilio?: string | null;
  pago_por_servicio?: number | null;
  aval_id?: string | null;
  aval_nombre?: string | null;
  inmobiliaria_id?: string | null;
}

export interface PublicDocumento {
  id: string;
  contrato_id: string;
  tipo: string;
  archivo_path: string;
  signed_url?: string | null;
  created_at: string;
}

export interface PublicVetoAval {
  id: string;
  aval_id: string;
  aval_nombre?: string | null;
  inmobiliaria_id?: string | null;
  inmobiliaria_nombre?: string | null;
  motivo: string;
  estatus: "vetado" | "limpio" | "activo";
  evidencia_url?: string | null;
  created_at: string;
}

export interface PublicClienteVetado {
  id: string;
  cliente_id: string;
  cliente_nombre?: string | null;
  motivo_tipo: "moroso" | "problematico";
  motivo: string;
  estatus: "vetado" | "limpio";
  created_at: string;
}

export interface PublicAval {
  id: string;
  nombre_completo: string;
  email?: string | null;
  telefono?: string | null;
}

export interface Asesor {
  id: string;
  nombre: string;
  telefono?: string | null;
  pago_comision: number;
  firmas_count: number;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Inmobiliaria {
  id: string;
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  notas?: string | null;
  created_at: string;
}

export interface PagoServicio {
  id: string;
  firma_id: string;
  monto_efectivo: number;
  monto_transferencia: number;
  fecha_pago?: string | null;
  comprobante_url?: string | null;
  notas?: string | null;
  estado: "registrado" | "liquidado";
  corte_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PagoComision {
  id: string;
  firma_id: string;
  beneficiario_tipo: "aval" | "asesor";
  beneficiario_id: string;
  monto: number;
  metodo?: "efectivo" | "transferencia" | "mixto" | null;
  fecha_programada?: string | null;
  fecha_pago?: string | null;
  comprobante_url?: string | null;
  notas?: string | null;
  estado: "pendiente" | "pagado";
  corte_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PagoCorte {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  incluir_servicios: boolean;
  incluir_comisiones: boolean;
  total_servicio: number;
  total_comisiones: number;
  pdf_path?: string | null;
  pdf_url?: string | null;
  created_at: string;
}
