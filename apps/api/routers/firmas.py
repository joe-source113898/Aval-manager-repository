from __future__ import annotations

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.encoders import jsonable_encoder

from apps.api.core.auth import require_admin
from apps.api.db.supabase_client import get_client, handle_response
from apps.api.models.schemas import Firma, FirmaCreate, FirmaUpdate

router = APIRouter(prefix="/firmas", tags=["firmas"])


def _ensure_entities_habilitated(client, data_payload: dict) -> None:
    aval_id = data_payload.get("aval_id")
    cliente_id = data_payload.get("cliente_id")
    inmobiliaria_id = data_payload.get("inmobiliaria_id")

    if aval_id:
        query = (
            client.table("vetos_avales")
            .select("id,inmobiliaria_id")
            .eq("aval_id", str(aval_id))
            .eq("estatus", "activo")
        )
        vetos = handle_response(query.execute()) or []
        if vetos:
            for veto in vetos:
                target = veto.get("inmobiliaria_id")
                if target is None or (inmobiliaria_id and target == str(inmobiliaria_id)):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="El aval seleccionado tiene un veto activo para esta inmobiliaria.",
                    )
            if not inmobiliaria_id:
                # Si el veto es específico a una inmobiliaria y no se proporcionó, pero existe uno global
                has_global = any(veto.get("inmobiliaria_id") is None for veto in vetos)
                if has_global:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="El aval seleccionado tiene un veto activo.",
                    )

    if cliente_id:
        query = (
            client.table("clientes_morosidad")
            .select("id")
            .eq("cliente_id", str(cliente_id))
            .eq("estatus", "vetado")
        )
        registros = handle_response(query.execute()) or []
        if registros:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El cliente tiene un veto activo. No es posible registrar la firma.",
            )


@router.get("", response_model=List[Firma])
async def list_firmas(_: dict = Depends(require_admin)) -> List[Firma]:
    client = get_client()
    response = client.table("firmas").select("*").order("fecha_inicio", desc=True).execute()
    return [Firma(**row) for row in handle_response(response)]


@router.post("", response_model=Firma, status_code=status.HTTP_201_CREATED)
async def create_firma(payload: FirmaCreate, _: dict = Depends(require_admin)) -> Firma:
    client = get_client()
    data_payload = jsonable_encoder(payload, exclude_none=True)
    data_payload.setdefault("fecha_fin", data_payload.get("fecha_inicio"))
    _ensure_entities_habilitated(client, data_payload)
    response = client.table("firmas").insert(data_payload).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=500, detail="No se pudo crear la firma")
    return Firma(**data[0])


@router.put("/{firma_id}", response_model=Firma)
async def update_firma(firma_id: UUID, payload: FirmaUpdate, _: dict = Depends(require_admin)) -> Firma:
    client = get_client()
    data_payload = jsonable_encoder(payload, exclude_none=True)
    if "fecha_inicio" in data_payload and "fecha_fin" not in data_payload:
        data_payload["fecha_fin"] = data_payload["fecha_inicio"]
    requires_lookup = any(field not in data_payload for field in ("aval_id", "cliente_id", "inmobiliaria_id"))
    merged = dict(data_payload)
    if requires_lookup:
        existing_resp = (
            client.table("firmas").select("aval_id,cliente_id,inmobiliaria_id").eq("id", str(firma_id)).single().execute()
        )
        existing = handle_response(existing_resp) or {}
        for field in ("aval_id", "cliente_id", "inmobiliaria_id"):
            if field not in merged and existing.get(field):
                merged[field] = existing[field]
    _ensure_entities_habilitated(client, merged)
    response = client.table("firmas").update(data_payload).eq("id", str(firma_id)).execute()
    data = handle_response(response)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Firma no encontrada")
    return Firma(**data[0])


@router.delete("/{firma_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_firma(firma_id: UUID, _: dict = Depends(require_admin)) -> Response:
    client = get_client()
    client.table("firmas").delete().eq("id", str(firma_id)).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
