from __future__ import annotations

from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder

from apps.api.core.auth import require_admin_or_asesor
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import (
    AsesorFirmaCreate,
    AsesorListaNegraCreate,
    Cliente,
    ClienteVetado,
    Disponibilidad,
    Firma,
    PublicAval,
)

router = APIRouter(prefix="/asesores", tags=["asesores"])


def _parse_datetime(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    cleaned = str(value).replace("Z", "+00:00")
    return datetime.fromisoformat(cleaned)


def _ensure_profile(client, user_id: UUID) -> dict:
    response = client.table("asesores").select("id,nombre,telefono").eq("user_id", str(user_id)).single().execute()
    profile = handle_response(response)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tu usuario no está vinculado a un perfil de asesor. Contacta a un administrador.",
        )
    return profile


def _resolve_cliente_id(client, payload, fallback_email: str | None = None, fallback_telefono: str | None = None) -> UUID:
    if payload.cliente_id:
        return UUID(str(payload.cliente_id))

    identifier_fields = {
        "curp": payload.cliente_curp,
        "rfc": payload.cliente_rfc,
        "numero_identificacion": payload.cliente_numero_identificacion,
    }
    for column, value in identifier_fields.items():
        if value:
            response = client.table("clientes").select("id").eq(column, value.strip()).limit(1).execute()
            results = handle_response(response)
            if results:
                return UUID(str(results[0]["id"]))

    if not payload.cliente_nombre:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Se requiere el nombre del cliente.")

    new_cliente = {
        "nombre_completo": payload.cliente_nombre.strip(),
        "telefono": fallback_telefono,
        "email": fallback_email,
        "curp": payload.cliente_curp,
        "rfc": payload.cliente_rfc,
        "numero_identificacion": payload.cliente_numero_identificacion,
    }
    created = client.table("clientes").insert(jsonable_encoder(new_cliente)).execute()
    data = handle_response(created)
    if not data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo crear el cliente")
    return UUID(str(data[0]["id"]))


def _ensure_availability(client, aval_id: UUID, fecha_inicio: datetime, fecha_fin: datetime) -> None:
    response = client.table("disponibilidades_avales").select("fecha_inicio,fecha_fin").eq("aval_id", str(aval_id)).execute()
    bloques = handle_response(response) or []
    for bloque in bloques:
        inicio = _parse_datetime(bloque["fecha_inicio"])
        fin = _parse_datetime(bloque["fecha_fin"])
        if fecha_inicio >= inicio and fecha_fin <= fin:
            return
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="El horario seleccionado está fuera de la disponibilidad del aval.",
    )


def _ensure_no_overlap(client, aval_id: UUID, fecha_inicio: datetime, fecha_fin: datetime) -> None:
    response = (
        client
        .table("firmas")
        .select("id,fecha_inicio,fecha_fin")
        .eq("aval_id", str(aval_id))
        .in_("estado", ["programada", "reprogramada"])
        .execute()
    )
    firmas = handle_response(response) or []
    for firma in firmas:
        inicio = _parse_datetime(firma["fecha_inicio"])
        fin = _parse_datetime(firma["fecha_fin"])
        if not (fecha_fin <= inicio or fecha_inicio >= fin):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Ya existe una firma programada en ese horario. Selecciona otro bloque.",
            )


@router.get("/avales", response_model=List[PublicAval])
async def listar_avales(_: dict = Depends(require_admin_or_asesor)) -> List[PublicAval]:
    client = get_client()
    response = (
        client.table("avales")
        .select("id,nombre_completo,email,telefono")
        .eq("activo", True)
        .order("nombre_completo")
        .execute()
    )
    return [PublicAval(**row) for row in handle_response(response)]


@router.get("/avales/{aval_id}/disponibilidades", response_model=List[Disponibilidad])
async def disponibilidades_aval(aval_id: UUID, _: dict = Depends(require_admin_or_asesor)) -> List[Disponibilidad]:
    client = get_client()
    response = client.table("disponibilidades_avales").select("*").eq("aval_id", str(aval_id)).order("fecha_inicio", desc=False).execute()
    return [Disponibilidad(**row) for row in handle_response(response)]


@router.get("/firmas", response_model=List[Firma])
async def listar_firmas_portal(user: dict = Depends(require_admin_or_asesor)) -> List[Firma]:
    client = get_client()
    query = client.table("firmas").select("*").order("fecha_inicio", desc=False)
    if user.get("role") == "asesor":
        query = query.eq("creado_por", str(user.get("id")))
    response = query.execute()
    return [Firma(**row) for row in handle_response(response)]


@router.post("/firmas", response_model=Firma, status_code=status.HTTP_201_CREATED)
async def registrar_firma(payload: AsesorFirmaCreate, user: dict = Depends(require_admin_or_asesor)) -> Firma:
    client = get_client()
    data_payload = jsonable_encoder(payload, exclude_none=True)
    fecha_inicio = payload.fecha_inicio
    fecha_fin = payload.fecha_fin or payload.fecha_inicio
    if fecha_fin < fecha_inicio:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La fecha de fin debe ser posterior al inicio.")
    _ensure_availability(client, payload.aval_id, fecha_inicio, fecha_fin)
    _ensure_no_overlap(client, payload.aval_id, fecha_inicio, fecha_fin)

    cliente_id = _resolve_cliente_id(
        client,
        payload,
        fallback_email=payload.correo,
        fallback_telefono=payload.telefono,
    )
    profile = _ensure_profile(client, user_id=UUID(str(user.get("id"))))

    firma_payload = {
        "aval_id": str(payload.aval_id),
        "cliente_id": str(cliente_id),
        "asesor_nombre": profile["nombre"],
        "cliente_nombre": payload.cliente_nombre,
        "telefono": payload.telefono,
        "correo": payload.correo,
        "tipo_renta": payload.tipo_renta,
        "periodo_contrato_anios": payload.periodo_contrato_anios,
        "monto_renta": str(payload.monto_renta),
        "propiedad_domicilio": payload.propiedad_domicilio,
        "ubicacion_maps_url": str(payload.ubicacion_maps_url),
        "fecha_inicio": fecha_inicio.isoformat(),
        "fecha_fin": fecha_fin.isoformat(),
        "estado": "programada",
        "canal_firma": payload.canal_firma,
        "pago_por_servicio": str(payload.pago_por_servicio),
        "solicitud_aval_url": None,
        "notas": payload.notas,
        "creado_por": str(user.get("id")),
    }
    response = client.table("firmas").insert(firma_payload).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo registrar la firma")
    return Firma(**data[0])


@router.post("/firmas/{firma_id}/cancelar", response_model=Firma)
async def cancelar_firma(firma_id: UUID, user: dict = Depends(require_admin_or_asesor)) -> Firma:
    client = get_client()
    query = client.table("firmas").select("*").eq("id", str(firma_id))
    if user.get("role") == "asesor":
        query = query.eq("creado_por", str(user.get("id")))
    existing = handle_response(query.single().execute())
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Firma no encontrada")
    response = client.table("firmas").update({"estado": "cancelada"}).eq("id", str(firma_id)).execute()
    data = handle_response(response)
    return Firma(**data[0])


@router.get("/clientes", response_model=List[Cliente])
async def buscar_clientes(
    query: str = Query(..., min_length=3, description="Nombre, CURP, RFC o número de identificación"),
    _: dict = Depends(require_admin_or_asesor),
) -> List[Cliente]:
    client = get_client()
    lowered = query.strip()
    lowered = lowered.replace(",", " ")
    filters = client.table("clientes").select("*").or_(
        f"nombre_completo.ilike.%{lowered}%,curp.eq.{lowered},rfc.eq.{lowered},numero_identificacion.eq.{lowered}"
    )
    response = filters.order("nombre_completo", desc=False).limit(50).execute()
    return [Cliente(**row) for row in handle_response(response)]


@router.post("/lista-negra/clientes", response_model=ClienteVetado, status_code=status.HTTP_201_CREATED)
async def registrar_cliente_lista_negra(
    payload: AsesorListaNegraCreate,
    user: dict = Depends(require_admin_or_asesor),
) -> ClienteVetado:
    client = get_client()
    cliente_id = _resolve_cliente_id(client, payload)
    entry = {
        "cliente_id": str(cliente_id),
        "registrado_por": str(user.get("id")),
        "motivo_tipo": payload.motivo_tipo,
        "motivo": payload.motivo,
        "estatus": "vetado",
    }
    response = client.table("clientes_morosidad").insert(entry).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo registrar la entrada")
    return ClienteVetado(**data[0])
