from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from apps.api.core.auth import require_admin
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import Inmobiliaria, InmobiliariaCreate, InmobiliariaUpdate

router = APIRouter(prefix="/inmobiliarias", tags=["inmobiliarias"])


@router.get("", response_model=List[Inmobiliaria])
async def list_inmobiliarias(q: str | None = Query(default=None), _: dict = Depends(require_admin)) -> List[Inmobiliaria]:
    client = get_client()
    query = client.table("inmobiliarias").select("*")
    if q:
        query = query.ilike("nombre", f"%{q}%")
    response = query.order("nombre", desc=False).execute()
    return [Inmobiliaria(**row) for row in handle_response(response)]


@router.post("", response_model=Inmobiliaria, status_code=status.HTTP_201_CREATED)
async def create_inmobiliaria(payload: InmobiliariaCreate, _: dict = Depends(require_admin)) -> Inmobiliaria:
    client = get_client()
    existing = (
        client.table("inmobiliarias")
        .select("id")
        .ilike("nombre", payload.nombre)
        .limit(1)
        .execute()
    )
    data_existing = handle_response(existing)
    if data_existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La inmobiliaria ya está registrada")

    response = client.table("inmobiliarias").insert(payload.dict()).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo registrar la inmobiliaria")
    return Inmobiliaria(**data[0])


@router.put("/{inmobiliaria_id}", response_model=Inmobiliaria)
async def update_inmobiliaria(
    inmobiliaria_id: UUID, payload: InmobiliariaUpdate, _: dict = Depends(require_admin)
) -> Inmobiliaria:
    client = get_client()
    data_payload = {k: v for k, v in payload.dict().items() if v is not None}
    response = client.table("inmobiliarias").update(data_payload).eq("id", str(inmobiliaria_id)).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inmobiliaria no encontrada")
    return Inmobiliaria(**data[0])


@router.delete("/{inmobiliaria_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inmobiliaria(inmobiliaria_id: UUID, _: dict = Depends(require_admin)) -> Response:
    client = get_client()
    client.table("inmobiliarias").delete().eq("id", str(inmobiliaria_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
