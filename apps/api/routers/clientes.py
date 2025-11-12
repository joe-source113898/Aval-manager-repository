from __future__ import annotations

from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from apps.api.core.auth import require_admin
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import Cliente, ClienteCreate, ClienteUpdate

router = APIRouter(prefix="/clientes", tags=["clientes"])


@router.get("", response_model=List[Cliente])
async def list_clientes(
    search: str | None = Query(default=None, description="Coincidencia por nombre"),
    _: dict = Depends(require_admin),
) -> List[Cliente]:
    client = get_client()
    query = client.table("clientes").select("*")
    if search:
        pattern = f"%{search}%"
        query = query.or_(f"nombre_completo.ilike.{pattern}")
    response = query.order("created_at", desc=True).execute()
    return [Cliente(**row) for row in handle_response(response)]


@router.post("", response_model=Cliente, status_code=status.HTTP_201_CREATED)
async def create_cliente(payload: ClienteCreate, _: dict = Depends(require_admin)) -> Cliente:
    client = get_client()
    response = client.table("clientes").insert(payload.dict()).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo crear el cliente")
    return Cliente(**data[0])


@router.get("/{cliente_id}", response_model=Cliente)
async def get_cliente(cliente_id: UUID, _: dict = Depends(require_admin)) -> Cliente:
    client = get_client()
    response = client.table("clientes").select("*").eq("id", str(cliente_id)).single().execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    return Cliente(**data)


@router.put("/{cliente_id}", response_model=Cliente)
async def update_cliente(cliente_id: UUID, payload: ClienteUpdate, _: dict = Depends(require_admin)) -> Cliente:
    client = get_client()
    data_payload = {k: v for k, v in payload.dict().items() if v is not None}
    data_payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    response = client.table("clientes").update(data_payload).eq("id", str(cliente_id)).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    return Cliente(**data[0])


@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cliente(cliente_id: UUID, _: dict = Depends(require_admin)) -> Response:
    client = get_client()
    client.table("clientes").delete().eq("id", str(cliente_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
