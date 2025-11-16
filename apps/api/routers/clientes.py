from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from postgrest.exceptions import APIError

from apps.api.core.auth import require_admin_or_asesor
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import Cliente, ClienteCreate, ClienteUpdate

router = APIRouter(prefix="/clientes", tags=["clientes"])
logger = logging.getLogger(__name__)


def _column_missing(exc: Exception, column: str) -> bool:
    return isinstance(exc, APIError) and column in str(exc).lower()


@router.get("", response_model=List[Cliente])
async def list_clientes(
    search: str | None = Query(default=None, description="Coincidencia por nombre"),
    _: dict = Depends(require_admin_or_asesor),
) -> List[Cliente]:
    client = get_client()
    query = client.table("clientes").select("*")
    if search:
        pattern = f"%{search}%"
        query = query.or_(f"nombre_completo.ilike.{pattern}")
    response = query.order("created_at", desc=True).execute()
    return [Cliente(**row) for row in handle_response(response)]


@router.post("", response_model=Cliente, status_code=status.HTTP_201_CREATED)
async def create_cliente(payload: ClienteCreate, user: dict = Depends(require_admin_or_asesor)) -> Cliente:
    client = get_client()
    data_payload = payload.dict()
    if user.get("id"):
        data_payload["creado_por"] = str(user["id"])
    try:
        response = client.table("clientes").insert(data_payload).execute()
    except APIError as exc:
        if _column_missing(exc, "creado_por"):
            logger.warning("Columna creado_por ausente en clientes; reintentando inserción sin el campo.")
            data_payload.pop("creado_por", None)
            response = client.table("clientes").insert(data_payload).execute()
        else:
            raise
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo crear el cliente")
    return Cliente(**data[0])


@router.get("/{cliente_id}", response_model=Cliente)
async def get_cliente(cliente_id: UUID, _: dict = Depends(require_admin_or_asesor)) -> Cliente:
    client = get_client()
    response = client.table("clientes").select("*").eq("id", str(cliente_id)).single().execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    return Cliente(**data)


@router.put("/{cliente_id}", response_model=Cliente)
async def update_cliente(cliente_id: UUID, payload: ClienteUpdate, user: dict = Depends(require_admin_or_asesor)) -> Cliente:
    client = get_client()
    data_payload = {k: v for k, v in payload.dict().items() if v is not None}
    data_payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    query = client.table("clientes").update(data_payload).eq("id", str(cliente_id))
    if user.get("role") != "admin" and user.get("id"):
        query = query.eq("creado_por", str(user["id"]))
    try:
        response = query.execute()
    except APIError as exc:
        if _column_missing(exc, "creado_por"):
            logger.warning("Columna creado_por ausente en clientes; se actualiza sin filtro por asesor.")
            response = client.table("clientes").update(data_payload).eq("id", str(cliente_id)).execute()
        else:
            raise
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    return Cliente(**data[0])


@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cliente(cliente_id: UUID, user: dict = Depends(require_admin_or_asesor)) -> Response:
    client = get_client()
    query = client.table("clientes").delete().eq("id", str(cliente_id))
    if user.get("role") != "admin" and user.get("id"):
        query = query.eq("creado_por", str(user["id"]))
    try:
        query.execute()
    except APIError as exc:
        if _column_missing(exc, "creado_por"):
            logger.warning("Columna creado_por ausente en clientes; se elimina sin filtro por asesor.")
            client.table("clientes").delete().eq("id", str(cliente_id)).execute()
        else:
            raise
    return Response(status_code=status.HTTP_204_NO_CONTENT)
