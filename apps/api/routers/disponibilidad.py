from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from apps.api.core.auth import require_admin
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import Disponibilidad, DisponibilidadCreate, DisponibilidadUpdate

router = APIRouter(prefix="/disponibilidades", tags=["disponibilidades"])


@router.get("", response_model=List[Disponibilidad])
async def list_disponibilidades(
    aval_id: UUID | None = Query(default=None),
    _: dict = Depends(require_admin),
) -> List[Disponibilidad]:
    client = get_client()
    query = client.table("disponibilidades_avales").select("*")
    if aval_id:
        query = query.eq("aval_id", str(aval_id))
    response = query.order("fecha_inicio", desc=True).execute()
    return [Disponibilidad(**row) for row in handle_response(response)]


@router.post("", response_model=Disponibilidad, status_code=status.HTTP_201_CREATED)
async def create_disponibilidad(payload: DisponibilidadCreate, _: dict = Depends(require_admin)) -> Disponibilidad:
    client = get_client()
    response = client.table("disponibilidades_avales").insert(payload.dict()).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo registrar la disponibilidad")
    return Disponibilidad(**data[0])


@router.put("/{disponibilidad_id}", response_model=Disponibilidad)
async def update_disponibilidad(
    disponibilidad_id: UUID,
    payload: DisponibilidadUpdate,
    _: dict = Depends(require_admin),
) -> Disponibilidad:
    client = get_client()
    data_payload = {k: v for k, v in payload.dict().items() if v is not None}
    response = client.table("disponibilidades_avales").update(data_payload).eq("id", str(disponibilidad_id)).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Disponibilidad no encontrada")
    return Disponibilidad(**data[0])


@router.delete("/{disponibilidad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_disponibilidad(disponibilidad_id: UUID, _: dict = Depends(require_admin)) -> Response:
    client = get_client()
    client.table("disponibilidades_avales").delete().eq("id", str(disponibilidad_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
