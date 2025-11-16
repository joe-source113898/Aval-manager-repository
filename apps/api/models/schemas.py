from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, constr, root_validator


class AvalBase(BaseModel):
    nombre_completo: str
    edad: int | None = Field(default=None, ge=0)
    telefono: str | None = None
    email: constr(strip_whitespace=True, min_length=3) | None = None
    estado_civil: str | None = None
    domicilio_actual: str | None = None
    identificacion_oficial_url: str | None = None
    comprobante_domicilio_cfe_url: str | None = None
    comprobante_domicilio_siapa_url: str | None = None
    pago_predial_url: str | None = None
    escrituras_url: str | None = None
    certificado_libre_gravamen_url: str | None = None
    rfc_url: str | None = None
    curp_url: str | None = None
    acta_nacimiento_url: str | None = None
    comprobante_ingresos_1_url: str | None = None
    comprobante_ingresos_2_url: str | None = None
    comprobante_ingresos_3_url: str | None = None
    buro_credito_url: str | None = None
    buro_credito_password: str | None = None
    notas: str | None = None
    activo: bool = True


class AvalDisponibilidadInput(BaseModel):
    fecha_inicio: datetime
    fecha_fin: datetime
    recurrente: bool = False


class AvalCreate(AvalBase):
    disponibilidades: list[AvalDisponibilidadInput] | None = None


class AvalUpdate(AvalBase):
    nombre_completo: str | None = None
    edad: int | None = Field(default=None, ge=0)
    disponibilidades: list[AvalDisponibilidadInput] | None = None


class Aval(AvalBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class AvalBuroCreditoUploadResponse(BaseModel):
    buro_credito_url: str


class ClienteReferenciaFamiliar(BaseModel):
    nombre_completo: str
    parentesco: str
    telefono: str


class ClienteReferenciaConocido(BaseModel):
    nombre_completo: str
    telefono: str


class ClienteBase(BaseModel):
    nombre_completo: str
    identificacion_oficial_url: str | None = None
    telefono: str | None = None
    email: constr(strip_whitespace=True, min_length=3) | None = None
    notas: str | None = None
    referencias_familiares: list[ClienteReferenciaFamiliar] = Field(default_factory=list)
    referencias_conocidos: list[ClienteReferenciaConocido] = Field(default_factory=list)


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(ClienteBase):
    nombre_completo: str | None = None
    referencias_familiares: list[ClienteReferenciaFamiliar] | None = None
    referencias_conocidos: list[ClienteReferenciaConocido] | None = None


class Cliente(ClienteBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class PropiedadBase(BaseModel):
    domicilio: str
    ciudad: str = "Guadalajara"
    estado: str = "Jalisco"
    notas: str | None = None


class PropiedadCreate(PropiedadBase):
    pass


class PropiedadUpdate(PropiedadBase):
    domicilio: str | None = None


class Propiedad(PropiedadBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class ContratoBase(BaseModel):
    cliente_id: UUID
    aval_id: UUID
    propiedad_id: UUID
    lugar_firma_maps_url: HttpUrl
    tipo_renta: str
    monto_renta_mensual: Decimal
    pago_por_servicio: Decimal
    periodo_contrato: str
    fecha_firma: datetime
    estado: Literal["pendiente", "firmado", "cancelado"] = "pendiente"


class ContratoCreate(ContratoBase):
    pass


class ContratoUpdate(BaseModel):
    cliente_id: UUID | None = None
    aval_id: UUID | None = None
    propiedad_id: UUID | None = None
    lugar_firma_maps_url: HttpUrl | None = None
    tipo_renta: str | None = None
    monto_renta_mensual: Decimal | None = None
    pago_por_servicio: Decimal | None = None
    periodo_contrato: str | None = None
    fecha_firma: datetime | None = None
    estado: Literal["pendiente", "firmado", "cancelado"] | None = None


class Contrato(ContratoBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class ContratoResumen(BaseModel):
    id: UUID
    cliente_id: UUID
    cliente_nombre: str
    aval_id: UUID
    aval_nombre: str
    propiedad_id: UUID
    propiedad_domicilio: str
    lugar_firma_maps_url: HttpUrl
    tipo_renta: str
    monto_renta_mensual: Decimal
    pago_por_servicio: Decimal
    periodo_contrato: str
    fecha_firma: datetime
    estado: Literal["pendiente", "firmado", "cancelado"]
    created_at: datetime


class PagoBase(BaseModel):
    contrato_id: UUID
    metodo: Literal["efectivo", "bancario"]
    monto: Decimal
    fecha_pago: datetime | None = None
    referencia: str | None = None
    notas: str | None = None


class PagoCreate(PagoBase):
    pass


class PagoUpdate(BaseModel):
    metodo: Literal["efectivo", "bancario"] | None = None
    monto: Decimal | None = None
    fecha_pago: datetime | None = None
    referencia: str | None = None
    notas: str | None = None


class Pago(PagoBase):
    id: UUID
    created_at: datetime


class AsesorBase(BaseModel):
    nombre: constr(strip_whitespace=True, min_length=3)
    telefono: constr(strip_whitespace=True, min_length=7) | None = None
    pago_comision: Decimal = Field(ge=0)
    firmas_count: int = Field(default=0, ge=0)
    user_id: UUID | None = None


class AsesorCreate(AsesorBase):
    pass


class AsesorUpdate(BaseModel):
    nombre: constr(strip_whitespace=True, min_length=3) | None = None
    telefono: constr(strip_whitespace=True, min_length=7) | None = None
    pago_comision: Decimal | None = Field(default=None, ge=0)
    firmas_count: int | None = Field(default=None, ge=0)
    user_id: UUID | None = None


class Asesor(AsesorBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class InmobiliariaBase(BaseModel):
    nombre: constr(strip_whitespace=True, min_length=3)
    contacto: str | None = None
    telefono: str | None = None
    email: constr(strip_whitespace=True, min_length=3) | None = None
    notas: str | None = None


class InmobiliariaCreate(InmobiliariaBase):
    pass


class InmobiliariaUpdate(BaseModel):
    nombre: constr(strip_whitespace=True, min_length=3) | None = None
    contacto: str | None = None
    telefono: str | None = None
    email: constr(strip_whitespace=True, min_length=3) | None = None
    notas: str | None = None


class Inmobiliaria(InmobiliariaBase):
    id: UUID
    created_at: datetime


EMAIL_REGEX = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class FirmaBase(BaseModel):
    cliente_id: UUID | None = None
    inmobiliaria_id: UUID | None = None
    asesor_nombre: constr(strip_whitespace=True, min_length=3)
    cliente_nombre: constr(strip_whitespace=True, min_length=3)
    telefono: constr(strip_whitespace=True, min_length=7) | None = None
    correo: constr(strip_whitespace=True, min_length=5, regex=EMAIL_REGEX) | None = None
    tipo_renta: constr(strip_whitespace=True, min_length=3)
    periodo_contrato_anios: int = Field(ge=0, le=50)
    monto_renta: Decimal = Field(ge=0)
    propiedad_domicilio: constr(strip_whitespace=True, min_length=3)
    ubicacion_maps_url: HttpUrl
    fecha_inicio: datetime
    fecha_fin: datetime
    estado: Literal["programada", "realizada", "reprogramada", "cancelada"] = "programada"
    canal_firma: Literal["inmobiliaria", "dueno_directo"] = "dueno_directo"
    pago_por_servicio: Decimal = Field(ge=0)
    solicitud_aval_url: str | None = None
    notas: str | None = None
    contrato_id: UUID | None = None
    aval_id: UUID


class FirmaCreate(FirmaBase):
    pass


class FirmaUpdate(BaseModel):
    cliente_id: UUID | None = None
    inmobiliaria_id: UUID | None = None
    asesor_nombre: constr(strip_whitespace=True, min_length=3) | None = None
    cliente_nombre: constr(strip_whitespace=True, min_length=3) | None = None
    telefono: constr(strip_whitespace=True, min_length=7) | None = None
    correo: constr(strip_whitespace=True, min_length=5, regex=EMAIL_REGEX) | None = None
    tipo_renta: constr(strip_whitespace=True, min_length=3) | None = None
    periodo_contrato_anios: int | None = Field(default=None, ge=0, le=50)
    monto_renta: Decimal | None = Field(default=None, ge=0)
    propiedad_domicilio: constr(strip_whitespace=True, min_length=3) | None = None
    ubicacion_maps_url: HttpUrl | None = None
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None
    estado: Literal["programada", "realizada", "reprogramada", "cancelada"] | None = None
    canal_firma: Literal["inmobiliaria", "dueno_directo"] | None = None
    pago_por_servicio: Decimal | None = Field(default=None, ge=0)
    solicitud_aval_url: str | None = None
    notas: str | None = None
    contrato_id: UUID | None = None
    aval_id: UUID | None = None


class Firma(FirmaBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class DisponibilidadBase(BaseModel):
    aval_id: UUID
    fecha_inicio: datetime
    fecha_fin: datetime
    recurrente: bool = False


class DisponibilidadCreate(DisponibilidadBase):
    pass


class DisponibilidadUpdate(BaseModel):
    fecha_inicio: datetime | None = None
    fecha_fin: datetime | None = None
    recurrente: bool | None = None


class Disponibilidad(DisponibilidadBase):
    id: UUID
    created_at: datetime


class DocumentoBase(BaseModel):
    contrato_id: UUID | None = None
    cliente_id: UUID | None = None
    cliente_id: UUID | None = None
    tipo: str
    archivo_path: str
    creado_por: UUID | None = None
    notas: str | None = None


class DocumentoCreate(DocumentoBase):
    pass


class DocumentoUpdate(BaseModel):
    contrato_id: UUID | None = None
    cliente_id: UUID | None = None
    tipo: str | None = None
    archivo_path: str | None = None
    notas: str | None = None


class Documento(DocumentoBase):
    id: UUID
    created_at: datetime


class AvalVetoBase(BaseModel):
    aval_id: UUID
    inmobiliaria_id: UUID
    motivo: str
    estatus: Literal["vetado", "limpio"] = "vetado"
    registrado_por: UUID | None = None
    limpio_at: datetime | None = None


class AvalVetoCreate(AvalVetoBase):
    pass


class AvalVetoUpdate(BaseModel):
    inmobiliaria_id: UUID | None = None
    motivo: str | None = None
    estatus: Literal["vetado", "limpio"] | None = None
    registrado_por: UUID | None = None
    limpio_at: datetime | None = None


class AvalVeto(AvalVetoBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class ClienteVetadoBase(BaseModel):
    cliente_id: UUID
    registrado_por: UUID | None = None
    motivo_tipo: Literal["moroso", "problematico"] = "moroso"
    motivo: str
    estatus: Literal["vetado", "limpio"] = "vetado"
    limpio_at: datetime | None = None


class ClienteVetadoCreate(ClienteVetadoBase):
    pass


class ClienteVetadoUpdate(BaseModel):
    motivo_tipo: Literal["moroso", "problematico"] | None = None
    motivo: str | None = None
    estatus: Literal["vetado", "limpio"] | None = None
    registrado_por: UUID | None = None
    limpio_at: datetime | None = None


class ClienteVetado(ClienteVetadoBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class PublicFirma(BaseModel):
    id: UUID
    fecha_inicio: datetime
    fecha_fin: datetime
    ubicacion_maps_url: HttpUrl | None = None
    estado: Literal["programada", "realizada", "reprogramada", "cancelada"]
    cliente_nombre: str | None = None
    asesor_nombre: str | None = None
    tipo_renta: str | None = None
    propiedad_domicilio: str | None = None
    pago_por_servicio: Decimal | None = None
    contrato_id: UUID | None = None
    aval_id: UUID | None = None
    aval_nombre: str | None = None
    inmobiliaria_id: UUID | None = None


class PublicDocumento(BaseModel):
    id: UUID
    contrato_id: UUID
    tipo: str
    archivo_path: str
    created_at: datetime
    signed_url: str | None = None


class PublicVetoAval(BaseModel):
    id: UUID
    aval_id: UUID
    aval_nombre: str | None = None
    inmobiliaria_id: UUID | None = None
    inmobiliaria_nombre: str | None = None
    motivo: str
    estatus: Literal["vetado", "limpio"]
    created_at: datetime


class PublicClienteVetado(BaseModel):
    id: UUID
    cliente_id: UUID
    cliente_nombre: str | None = None
    motivo_tipo: Literal["moroso", "problematico"]
    motivo: str
    estatus: Literal["vetado", "limpio"]
    created_at: datetime


class Usuario(BaseModel):
    id: UUID
    email: constr(strip_whitespace=True, min_length=3)
    rol: str
    created_at: datetime


class PublicAval(BaseModel):
    id: UUID
    nombre_completo: str
    email: constr(strip_whitespace=True, min_length=3) | None = None
    telefono: str | None = None


class PagoServicioBase(BaseModel):
    firma_id: UUID
    monto_efectivo: Decimal = Field(default=0, ge=0)
    monto_transferencia: Decimal = Field(default=0, ge=0)
    fecha_pago: datetime | None = None
    comprobante_url: str | None = None
    notas: str | None = None
    estado: Literal["registrado", "liquidado"] = "registrado"
    corte_id: UUID | None = None

    @root_validator
    def validate_montos(cls, values):
        efectivo = values.get("monto_efectivo") or Decimal(0)
        transferencia = values.get("monto_transferencia") or Decimal(0)
        if efectivo <= 0 and transferencia <= 0:
            raise ValueError("Debes capturar al menos un monto en efectivo o transferencia.")
        if transferencia > 0 and not values.get("comprobante_url"):
            raise ValueError("El comprobante es obligatorio cuando existe pago por transferencia.")
        return values


class PagoServicioCreate(PagoServicioBase):
    pass


class PagoServicioUpdate(BaseModel):
    monto_efectivo: Decimal | None = Field(default=None, ge=0)
    monto_transferencia: Decimal | None = Field(default=None, ge=0)
    fecha_pago: datetime | None = None
    comprobante_url: str | None = None
    notas: str | None = None
    estado: Literal["registrado", "liquidado"] | None = None
    corte_id: UUID | None = None


class PagoServicio(PagoServicioBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class PagoComisionBase(BaseModel):
    firma_id: UUID
    beneficiario_tipo: Literal["aval", "asesor"]
    beneficiario_id: UUID
    monto: Decimal
    metodo: Literal["efectivo", "transferencia", "mixto"] | None = None
    fecha_programada: datetime | None = None
    fecha_pago: datetime | None = None
    comprobante_url: str | None = None
    notas: str | None = None
    estado: Literal["pendiente", "pagado"] = "pendiente"
    corte_id: UUID | None = None


class PagoComisionCreate(PagoComisionBase):
    pass


class PagoComisionUpdate(BaseModel):
    monto: Decimal | None = None
    metodo: Literal["efectivo", "transferencia", "mixto"] | None = None
    fecha_programada: datetime | None = None
    fecha_pago: datetime | None = None
    comprobante_url: str | None = None
    notas: str | None = None
    estado: Literal["pendiente", "pagado"] | None = None
    corte_id: UUID | None = None
    beneficiario_tipo: Literal["aval", "asesor"] | None = None
    beneficiario_id: UUID | None = None


class PagoComision(PagoComisionBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class PagoCorteBase(BaseModel):
    fecha_inicio: date
    fecha_fin: date
    incluir_servicios: bool = True
    incluir_comisiones: bool = True


class PagoCorteCreate(PagoCorteBase):
    pass


class PagoCorte(PagoCorteBase):
    id: UUID
    total_servicio: Decimal
    total_comisiones: Decimal
    pdf_path: str | None = None
    pdf_url: str | None = None
    created_at: datetime
