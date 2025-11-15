"""WSGI bootstrapper for running FastAPI on PythonAnywhere.

PythonAnywhere solo acepta objetos WSGI, así que aquí integramos el app
de FastAPI (ASGI) mediante un pequeño adaptador compatible con WSGI.
"""

from __future__ import annotations

import asyncio
import os
import sys
from http import HTTPStatus
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path("/home/avalmanager/Aval-manager-repository").resolve()
API_ROOT = PROJECT_ROOT / "apps" / "api"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

load_dotenv(API_ROOT / ".env")
os.chdir(API_ROOT)

from apps.api.main import app  # noqa: E402


def _build_scope(environ: dict) -> dict:
    server_name = environ.get("SERVER_NAME", "localhost")
    server_port = int(environ.get("SERVER_PORT", "80"))
    client_addr = environ.get("REMOTE_ADDR")
    client_port = int(environ.get("REMOTE_PORT", "0") or 0)

    headers = []
    for key, value in environ.items():
        if key.startswith("HTTP_"):
            header_name = key[5:].replace("_", "-").lower().encode("latin1")
            headers.append((header_name, value.encode("latin1")))
    if environ.get("CONTENT_TYPE"):
        headers.append((b"content-type", environ["CONTENT_TYPE"].encode("latin1")))
    if environ.get("CONTENT_LENGTH"):
        headers.append((b"content-length", environ["CONTENT_LENGTH"].encode("latin1")))

    path = environ.get("PATH_INFO", "") or "/"
    raw_uri = environ.get("RAW_URI") or path

    return {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": environ.get("SERVER_PROTOCOL", "HTTP/1.1").split("/", 1)[-1],
        "method": environ.get("REQUEST_METHOD", "GET"),
        "scheme": environ.get("wsgi.url_scheme", "http"),
        "path": path,
        "raw_path": raw_uri.encode("latin1"),
        "query_string": environ.get("QUERY_STRING", "").encode("latin1"),
        "headers": headers,
        "client": (client_addr, client_port),
        "server": (server_name, server_port),
    }


class _AsgiToWsgi:
    """Adaptador mínimo de ASGI a WSGI (equivalente al removido AsgiToWsgi)."""

    def __init__(self, asgi_app):
        self.asgi_app = asgi_app

    def __call__(self, environ, start_response):
        scope = _build_scope(environ)
        body = environ["wsgi.input"].read()

        status_line = "500 Internal Server Error"
        response_headers: list[tuple[str, str]] = []
        response_body: list[bytes] = []

        async def receive():
            nonlocal body
            if body is not None:
                chunk, body = body, None
                return {"type": "http.request", "body": chunk, "more_body": False}
            return {"type": "http.disconnect"}

        async def send(message):
            nonlocal status_line, response_headers
            if message["type"] == "http.response.start":
                status_code = message["status"]
                try:
                    reason = HTTPStatus(status_code).phrase
                except ValueError:
                    reason = "OK"
                status_line = f"{status_code} {reason}"
                response_headers = [
                    (key.decode("latin1"), value.decode("latin1"))
                    for key, value in message.get("headers", [])
                ]
            elif message["type"] == "http.response.body":
                response_body.append(message.get("body", b""))
            else:
                raise RuntimeError(f"Mensaje ASGI no soportado: {message['type']}")

        asyncio.run(self.asgi_app(scope, receive, send))
        start_response(status_line, response_headers)
        return response_body


application = _AsgiToWsgi(app)
