from __future__ import annotations

from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.encoders import jsonable_encoder

from apps.api.core.auth import require_admin
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import AvalVeto, AvalVetoCreate, AvalVetoUpdate

router = APIRouter(prefix="/vetos-avales", tags=["vetos-avales"])


@router.get("", response_model=List[AvalVeto])
async def list_vetos_avales(
    aval_id: UUID | None = Query(default=None),
    inmobiliaria_id: UUID | None = Query(default=None),
    estatus: str | None = Query(default=None),
    _: dict = Depends(require_admin),
) -> List[AvalVeto]:
    client = get_client()
    query = client.table("vetos_avales").select("*")
    if aval_id:
        query = query.eq("aval_id", str(aval_id))
    if inmobiliaria_id:
        query = query.eq("inmobiliaria_id", str(inmobiliaria_id))
    if estatus:
        query = query.eq("estatus", estatus)
    response = query.order("created_at", desc=True).execute()
    return [AvalVeto(**row) for row in handle_response(response) or []]


@router.post("", response_model=AvalVeto, status_code=status.HTTP_201_CREATED)
async def create_veto_aval(payload: AvalVetoCreate, user: dict = Depends(require_admin)) -> AvalVeto:
    client = get_client()
    data_payload = jsonable_encoder(payload, exclude_none=True)
    if not data_payload.get("registrado_por") and user.get("id"):
        data_payload["registrado_por"] = str(user["id"])
    if data_payload.get("estatus") == "levantado" and not data_payload.get("levantado_at"):
        data_payload["levantado_at"] = datetime.now(timezone.utc).isoformat()
    response = client.table("vetos_avales").insert(data_payload).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo registrar el veto")
    return AvalVeto(**data[0])


@router.put("/{veto_id}", response_model=AvalVeto)
async def update_veto_aval(veto_id: UUID, payload: AvalVetoUpdate, _: dict = Depends(require_admin)) -> AvalVeto:
    client = get_client()
    data_payload = {k: v for k, v in jsonable_encoder(payload, exclude_none=True).items() if v is not None}
    if data_payload.get("estatus") == "levantado" and not data_payload.get("levantado_at"):
        data_payload["levantado_at"] = datetime.now(timezone.utc).isoformat()
    data_payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    response = client.table("vetos_avales").update(data_payload).eq("id", str(veto_id)).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veto no encontrado")
    return AvalVeto(**data[0])


@router.delete("/{veto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_veto_aval(veto_id: UUID, _: dict = Depends(require_admin)) -> Response:
    client = get_client()
    client.table("vetos_avales").delete().eq("id", str(veto_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
