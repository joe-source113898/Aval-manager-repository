from __future__ import annotations

from collections import Counter
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.encoders import jsonable_encoder

from apps.api.core.auth import require_admin
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import Asesor, AsesorCreate, AsesorUpdate

router = APIRouter(prefix="/asesores", tags=["asesores"])


@router.get("", response_model=List[Asesor])
async def list_asesores(_: dict = Depends(require_admin)) -> List[Asesor]:
    client = get_client()
    asesores_resp = client.table("asesores").select("*").order("nombre", desc=False).execute()
    asesores_data = handle_response(asesores_resp) or []

    comisiones_resp = (
        client.table("pagos_comisiones")
        .select("beneficiario_id")
        .eq("beneficiario_tipo", "asesor")
        .execute()
    )
    comisiones = handle_response(comisiones_resp) or []
    firmas_counter = Counter(str(row["beneficiario_id"]) for row in comisiones if row.get("beneficiario_id"))

    enriched = []
    for row in asesores_data:
        asesor_id = str(row["id"])
        # Prefiere el recálculo dinámico basado en comisiones registradas
        row["firmas_count"] = firmas_counter.get(asesor_id, 0)
        enriched.append(Asesor(**row))
    return enriched


@router.post("", response_model=Asesor, status_code=status.HTTP_201_CREATED)
async def create_asesor(payload: AsesorCreate, _: dict = Depends(require_admin)) -> Asesor:
    client = get_client()
    serialized = jsonable_encoder(payload)
    response = client.table("asesores").insert(serialized).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo crear el asesor")
    return Asesor(**data[0])


@router.put("/{asesor_id}", response_model=Asesor)
async def update_asesor(asesor_id: UUID, payload: AsesorUpdate, _: dict = Depends(require_admin)) -> Asesor:
    client = get_client()
    data_payload = {k: v for k, v in jsonable_encoder(payload).items() if v is not None}
    response = client.table("asesores").update(data_payload).eq("id", str(asesor_id)).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asesor no encontrado")
    return Asesor(**data[0])


@router.delete("/{asesor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asesor(asesor_id: UUID, _: dict = Depends(require_admin)) -> Response:
    client = get_client()
    client.table("asesores").delete().eq("id", str(asesor_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
