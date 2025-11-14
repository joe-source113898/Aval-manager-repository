from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query, status

from apps.api.db.supabase_client import get_client, handle_response
from apps.api.core.config import get_settings
from apps.api.models.schemas import (
    Disponibilidad,
    PublicAval,
    PublicClienteVetado,
    PublicDocumento,
    PublicFirma,
    PublicVetoAval,
)
from apps.api.services.documentos import fetch_documentos
from apps.api.services.storage import build_proxy_url


SETTINGS = get_settings()
STORAGE_BUCKET = "documentos-aval"


def _create_signed_url(path: str | None, expires_in: int = 3600) -> str | None:
    if not path:
        return None
    try:
        url, *_ = build_proxy_url(STORAGE_BUCKET, path, expires_in)
        return url
    except ValueError:
        return None


def _public_document_from_path(label: str, path: str, fallback_uuid: UUID, timestamp: str) -> PublicDocumento:
    resolved_path = path.strip()
    if resolved_path.startswith("/storage/v1/object/public/"):
        resolved_path = resolved_path.replace("/storage/v1/object/public/", "", 1)
    signed_url = _create_signed_url(resolved_path)
    return PublicDocumento(
        id=uuid4(),
        contrato_id=fallback_uuid,
        tipo=label,
        archivo_path=resolved_path,
        created_at=timestamp,
        signed_url=signed_url,
    )


def _build_signed_urls_for_documents(document_map: dict[UUID, dict]) -> dict[UUID, str | None]:
    signed_map: dict[UUID, str | None] = {}
    for doc_id, doc in document_map.items():
        path = doc.get("archivo_path")
        signed_map[doc_id] = _create_signed_url(path) if path else None
    return signed_map

AVAL_DOCUMENT_LABELS = {
    "identificacion_oficial_url": "Identificación oficial",
    "comprobante_domicilio_cfe_url": "Comprobante domicilio CFE",
    "comprobante_domicilio_siapa_url": "Comprobante domicilio SIAPA",
    "pago_predial_url": "Pago predial",
    "escrituras_url": "Escrituras",
    "certificado_libre_gravamen_url": "Certificado libre de gravamen",
    "rfc_url": "RFC",
    "curp_url": "CURP",
    "acta_nacimiento_url": "Acta de nacimiento",
    "comprobante_ingresos_1_url": "Comprobante de ingresos 1",
    "comprobante_ingresos_2_url": "Comprobante de ingresos 2",
    "comprobante_ingresos_3_url": "Comprobante de ingresos 3",
}

router = APIRouter(prefix="/public", tags=["public"])


def _get_active_aval_id() -> Optional[UUID]:
    client = get_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    response = client.rpc("fn_aval_en_turno", {"target": now_iso}).execute()
    data = handle_response(response)

    if data is None:
        return None

    if isinstance(data, list):
        if not data:
            return None
        data = data[0]

    try:
        return UUID(str(data))
    except (TypeError, ValueError):
        return None


@router.get("/firmas", response_model=List[PublicFirma])
async def obtener_firmas_publicas(
    fecha_desde: datetime | None = Query(default=None),
    fecha_hasta: datetime | None = Query(default=None),
    aval_id: UUID | None = Query(default=None),
    estado: str | None = Query(default=None),
) -> List[PublicFirma]:
    client = get_client()
    query = client.table("vw_firmas_publicas").select("*")
    if fecha_desde:
        query = query.gte("fecha_inicio", fecha_desde.isoformat())
    if fecha_hasta:
        query = query.lte("fecha_fin", fecha_hasta.isoformat())
    if aval_id:
        query = query.eq("aval_id", str(aval_id))
    if estado:
        query = query.eq("estado", estado)
    response = query.order("fecha_inicio", desc=False).execute()
    return [PublicFirma(**row) for row in handle_response(response)]


@router.get("/documentos", response_model=List[PublicDocumento])
async def obtener_documentos_publicos() -> List[PublicDocumento]:
    client = get_client()
    response = client.table("vw_documentos_publicos").select("*").order("created_at", desc=True).execute()
    documentos = []
    for row in handle_response(response):
        path = row.get("archivo_path")
        signed = _create_signed_url(client, path) if path else None
        documentos.append(PublicDocumento(**row, signed_url=signed))
    return documentos


@router.get("/documentos/en-turno", response_model=List[PublicDocumento])
async def obtener_documentos_aval_en_turno() -> List[PublicDocumento]:
    client = get_client()
    aval_id = _get_active_aval_id()
    if aval_id is None:
        fallback_response = client.table("avales").select("id").eq("activo", True).order("created_at", desc=False).limit(1).execute()
        fallback_data = handle_response(fallback_response)
        if fallback_data:
            try:
                aval_id = UUID(str(fallback_data[0]["id"]))
            except (KeyError, ValueError, TypeError):
                aval_id = None
    if aval_id is None:
        return []

    documentos = fetch_documentos(
        client,
        aval_id=aval_id,
        columns="id,contrato_id,tipo,archivo_path,created_at",
    )

    documentos_publicos: List[PublicDocumento] = []
    for row in documentos:
        path = row.get("archivo_path")
        signed = _create_signed_url(client, path) if path else None
        documentos_publicos.append(PublicDocumento(**row, signed_url=signed))

    aval_fields = ["id", "updated_at", *AVAL_DOCUMENT_LABELS.keys()]
    aval_response = client.table("avales").select(",".join(aval_fields)).eq("id", str(aval_id)).single().execute()
    aval_data = handle_response(aval_response)

    if aval_data:
        aval_uuid = UUID(str(aval_data["id"]))
        timestamp = aval_data.get("updated_at") or datetime.now(timezone.utc).isoformat()
        fallback_timestamp = datetime.fromisoformat(timestamp.replace("Z", ""))
        for field, label in AVAL_DOCUMENT_LABELS.items():
            path = aval_data.get(field)
            if path:
                documentos_publicos.append(
                    _public_document_from_path(label, path, aval_uuid, fallback_timestamp.isoformat())
                )

    return documentos_publicos


@router.get("/avales/en-turno", response_model=Optional[PublicAval])
async def obtener_aval_en_turno() -> Optional[PublicAval]:
    aval_id = _get_active_aval_id()
    if aval_id is None:
        client = get_client()
        fallback = client.table("avales").select("id,nombre_completo,email,telefono").eq("activo", True).order("created_at", desc=False).limit(1).execute()
        data = handle_response(fallback)
        if not data:
            return None
        return PublicAval(**data[0])

    client = get_client()
    response = client.table("avales").select("id,nombre_completo,email,telefono").eq("id", str(aval_id)).single().execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aval no encontrado")
    return PublicAval(**data)


@router.get("/avales/en-turno/disponibilidades", response_model=List[Disponibilidad])
async def obtener_disponibilidades_aval_en_turno() -> List[Disponibilidad]:
    client = get_client()
    aval_id = _get_active_aval_id()
    if aval_id is None:
        fallback = client.table("avales").select("id").eq("activo", True).order("created_at", desc=False).limit(1).execute()
        fallback_data = handle_response(fallback)
        if fallback_data:
            try:
                aval_id = UUID(str(fallback_data[0]["id"]))
            except (KeyError, ValueError, TypeError):
                aval_id = None
    if aval_id is None:
        return []
    response = (
        client.table("disponibilidades_avales")
        .select("id,aval_id,fecha_inicio,fecha_fin,recurrente,created_at")
        .eq("aval_id", str(aval_id))
        .order("fecha_inicio", desc=False)
        .execute()
    )
    return [Disponibilidad(**row) for row in handle_response(response) or []]


@router.get("/lista-negra/avales", response_model=List[PublicVetoAval])
async def obtener_lista_negra_avales(
    inmobiliaria_id: UUID | None = Query(default=None),
    solo_activos: bool = Query(default=True),
) -> List[PublicVetoAval]:
    client = get_client()
    query = client.table("vetos_avales").select("*")
    if inmobiliaria_id:
        query = query.eq("inmobiliaria_id", str(inmobiliaria_id))
    if solo_activos:
        query = query.eq("estatus", "activo")
    response = query.order("created_at", desc=True).execute()
    registros = handle_response(response) or []
    if not registros:
        return []

    aval_ids = {row["aval_id"] for row in registros if row.get("aval_id")}
    inmobiliaria_ids = {row["inmobiliaria_id"] for row in registros if row.get("inmobiliaria_id")}

    aval_map = {}
    if aval_ids:
        aval_resp = client.table("avales").select("id,nombre_completo").in_("id", list(aval_ids)).execute()
        aval_map = {item["id"]: item for item in handle_response(aval_resp) or []}

    inmobiliaria_map = {}
    if inmobiliaria_ids:
        inm_resp = client.table("inmobiliarias").select("id,nombre").in_("id", list(inmobiliaria_ids)).execute()
        inmobiliaria_map = {item["id"]: item for item in handle_response(inm_resp) or []}

    results: List[PublicVetoAval] = []
    for row in registros:
        results.append(
            PublicVetoAval(
                id=row["id"],
                aval_id=row["aval_id"],
                aval_nombre=aval_map.get(row["aval_id"], {}).get("nombre_completo"),
                inmobiliaria_id=row.get("inmobiliaria_id"),
                inmobiliaria_nombre=inmobiliaria_map.get(row.get("inmobiliaria_id"), {}).get("nombre"),
                motivo=row.get("motivo"),
                estatus=row.get("estatus"),
                created_at=row.get("created_at"),
            )
        )
    return results


@router.get("/lista-negra/clientes", response_model=List[PublicClienteVetado])
async def obtener_clientes_vetados(
    search: str | None = Query(default=None),
    solo_activos: bool = Query(default=True),
) -> List[PublicClienteVetado]:
    client = get_client()
    query = client.table("clientes_morosidad").select("*")
    if solo_activos:
        query = query.eq("estatus", "vetado")
    if search:
        pattern = f"%{search}%"
        query = query.or_(f"motivo.ilike.{pattern}")
    response = query.order("created_at", desc=True).execute()
    registros = handle_response(response) or []
    if not registros:
        return []

    cliente_ids = {row["cliente_id"] for row in registros if row.get("cliente_id")}
    clientes_map = {}
    if cliente_ids:
        cli_resp = client.table("clientes").select("id,nombre_completo").in_("id", list(cliente_ids)).execute()
        clientes_map = {item["id"]: item for item in handle_response(cli_resp) or []}

    results: List[PublicClienteVetado] = []
    for row in registros:
        results.append(
            PublicClienteVetado(
                id=row["id"],
                cliente_id=row["cliente_id"],
                cliente_nombre=clientes_map.get(row["cliente_id"], {}).get("nombre_completo"),
                motivo_tipo=row.get("motivo_tipo") or "moroso",
                motivo=row.get("motivo"),
                estatus=row.get("estatus"),
                created_at=row.get("created_at"),
            )
        )
    return results
