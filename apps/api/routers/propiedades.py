from __future__ import annotations

from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from apps.api.core.auth import require_admin
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import Propiedad, PropiedadCreate, PropiedadUpdate

router = APIRouter(prefix="/propiedades", tags=["propiedades"])


@router.get("", response_model=List[Propiedad])
async def list_propiedades(_: dict = Depends(require_admin)) -> List[Propiedad]:
    client = get_client()
    response = client.table("propiedades").select("*").order("created_at", desc=True).execute()
    return [Propiedad(**row) for row in handle_response(response)]


@router.post("", response_model=Propiedad, status_code=status.HTTP_201_CREATED)
async def create_propiedad(payload: PropiedadCreate, _: dict = Depends(require_admin)) -> Propiedad:
    client = get_client()
    response = client.table("propiedades").insert(payload.dict()).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo crear la propiedad")
    return Propiedad(**data[0])


@router.get("/{propiedad_id}", response_model=Propiedad)
async def get_propiedad(propiedad_id: UUID, _: dict = Depends(require_admin)) -> Propiedad:
    client = get_client()
    response = client.table("propiedades").select("*").eq("id", str(propiedad_id)).single().execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propiedad no encontrada")
    return Propiedad(**data)


@router.put("/{propiedad_id}", response_model=Propiedad)
async def update_propiedad(propiedad_id: UUID, payload: PropiedadUpdate, _: dict = Depends(require_admin)) -> Propiedad:
    client = get_client()
    data_payload = {k: v for k, v in payload.dict().items() if v is not None}
    data_payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    response = client.table("propiedades").update(data_payload).eq("id", str(propiedad_id)).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Propiedad no encontrada")
    return Propiedad(**data[0])


@router.delete("/{propiedad_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_propiedad(propiedad_id: UUID, _: dict = Depends(require_admin)) -> Response:
    client = get_client()
    client.table("propiedades").delete().eq("id", str(propiedad_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
