from __future__ import annotations

from typing import Any, Dict, List
from uuid import UUID

from supabase import Client

from apps.api.db.supabase_client import handle_response


def fetch_documentos(
    client: Client,
    *,
    contrato_id: UUID | None = None,
    aval_id: UUID | None = None,
    cliente_id: UUID | None = None,
    columns: str = "*",
) -> List[Dict[str, Any]]:
    """
    Recupera documentos aplicando filtros opcionales por contrato o aval.

    Cuando se filtra por aval se une con la tabla contratos para permitir el filtro.
    """
    select_clause = columns
    if aval_id is not None:
        select_clause = f"{columns}, contratos!inner(aval_id)"

    query = client.table("documentos").select(select_clause)

    if contrato_id is not None:
        query = query.eq("contrato_id", str(contrato_id))
    if aval_id is not None:
        query = query.eq("contratos.aval_id", str(aval_id))
    if cliente_id is not None:
        query = query.eq("cliente_id", str(cliente_id))

    response = query.order("created_at", desc=True).execute()
    data = handle_response(response)

    if not isinstance(data, list):
        return []

    if aval_id is not None:
        for row in data:
            row.pop("contratos", None)

    return data
