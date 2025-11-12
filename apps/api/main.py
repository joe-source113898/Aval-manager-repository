from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.core.config import get_settings
from apps.api.routers import (
    asesores,
    avales,
    clientes,
    clientes_morosidad,
    contratos,
    disponibilidad,
    inmobiliarias,
    documentos,
    firmas,
    pagos,
    pagos_comisiones,
    pagos_cortes,
    pagos_servicio,
    propiedades,
    public,
    storage,
    vetos_avales,
)

settings = get_settings()

app = FastAPI(title="Aval-manager API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"]
    ,
    allow_headers=["*"]
)

app.include_router(public.router)
app.include_router(avales.router)
app.include_router(clientes.router)
app.include_router(propiedades.router)
app.include_router(contratos.router)
app.include_router(pagos.router)
app.include_router(pagos_servicio.router)
app.include_router(pagos_comisiones.router)
app.include_router(pagos_cortes.router)
app.include_router(firmas.router)
app.include_router(asesores.router)
app.include_router(inmobiliarias.router)
app.include_router(disponibilidad.router)
app.include_router(documentos.router)
app.include_router(storage.router)
app.include_router(vetos_avales.router)
app.include_router(clientes_morosidad.router)


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    return {"status": "ok"}
