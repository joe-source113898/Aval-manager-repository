from __future__ import annotations

from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.encoders import jsonable_encoder

import logging

from postgrest.exceptions import APIError

from apps.api.core.auth import require_admin_or_asesor
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import ClienteVetado, ClienteVetadoCreate, ClienteVetadoUpdate

router = APIRouter(prefix="/clientes-morosidad", tags=["clientes-morosidad"])
logger = logging.getLogger(__name__)


def _column_missing(exc: Exception, column: str) -> bool:
    return isinstance(exc, APIError) and column in str(exc).lower()


@router.get("", response_model=List[ClienteVetado])
async def list_clientes_morosidad(
    cliente_id: UUID | None = Query(default=None),
    estatus: str | None = Query(default=None),
    _: dict = Depends(require_admin_or_asesor),
) -> List[ClienteVetado]:
    client = get_client()
    query = client.table("clientes_morosidad").select("*")
    if cliente_id:
        query = query.eq("cliente_id", str(cliente_id))
    if estatus:
        query = query.eq("estatus", estatus)
    response = query.order("created_at", desc=True).execute()
    return [ClienteVetado(**row) for row in handle_response(response) or []]


@router.post("", response_model=ClienteVetado, status_code=status.HTTP_201_CREATED)
async def create_cliente_morosidad(payload: ClienteVetadoCreate, user: dict = Depends(require_admin_or_asesor)) -> ClienteVetado:
    client = get_client()
    data_payload = jsonable_encoder(payload, exclude_none=True)
    estatus_value = data_payload.get("estatus")
    if estatus_value:
        data_payload["estatus"] = str(estatus_value).strip().lower()
    motivo_tipo_value = data_payload.get("motivo_tipo")
    if motivo_tipo_value:
        data_payload["motivo_tipo"] = str(motivo_tipo_value).strip().lower()
    if not data_payload.get("registrado_por") and user.get("id"):
        data_payload["registrado_por"] = str(user["id"])
    if data_payload.get("estatus") == "limpio" and not data_payload.get("limpio_at"):
        data_payload["limpio_at"] = datetime.now(timezone.utc).isoformat()
    try:
        response = client.table("clientes_morosidad").insert(data_payload).execute()
    except APIError as exc:
        if _column_missing(exc, "motivo_tipo"):
            logger.warning("Columna motivo_tipo ausente en clientes_morosidad; usando valor por defecto.")
            data_payload.pop("motivo_tipo", None)
            response = client.table("clientes_morosidad").insert(data_payload).execute()
        else:
            raise
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo registrar el veto del cliente")
    return ClienteVetado(**data[0])


@router.put("/{registro_id}", response_model=ClienteVetado)
async def update_cliente_morosidad(
    registro_id: UUID, payload: ClienteVetadoUpdate, _: dict = Depends(require_admin_or_asesor)
) -> ClienteVetado:
    client = get_client()
    data_payload = {k: v for k, v in jsonable_encoder(payload, exclude_none=True).items() if v is not None}
    estatus_value = data_payload.get("estatus")
    if estatus_value:
        data_payload["estatus"] = str(estatus_value).strip().lower()
    motivo_tipo_value = data_payload.get("motivo_tipo")
    if motivo_tipo_value:
        data_payload["motivo_tipo"] = str(motivo_tipo_value).strip().lower()
    if data_payload.get("estatus") == "limpio" and not data_payload.get("limpio_at"):
        data_payload["limpio_at"] = datetime.now(timezone.utc).isoformat()
    data_payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    response = client.table("clientes_morosidad").update(data_payload).eq("id", str(registro_id)).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro de cliente vetado no encontrado")
    return ClienteVetado(**data[0])


@router.delete("/{registro_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cliente_morosidad(registro_id: UUID, _: dict = Depends(require_admin_or_asesor)) -> Response:
    client = get_client()
    client.table("clientes_morosidad").delete().eq("id", str(registro_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
