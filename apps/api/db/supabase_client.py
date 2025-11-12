from functools import lru_cache
from typing import Any

from supabase import Client, create_client
from gotrue._sync import gotrue_base_api as gotrue_base
from gotrue import http_clients as gotrue_http_clients


class PatchedSyncClient(gotrue_http_clients.SyncClient):
    def __init__(self, *args, proxy=None, **kwargs):
        proxies = kwargs.pop("proxies", None)
        if proxy is not None:
            proxies = proxies or {}
            if isinstance(proxies, dict):
                proxies.setdefault("http", proxy)
                proxies.setdefault("https", proxy)
            else:
                proxies = {"http": proxy, "https": proxy}
        kwargs["proxies"] = proxies
        super().__init__(*args, **kwargs)


gotrue_base.SyncClient = PatchedSyncClient

from apps.api.core.config import get_settings


@lru_cache
def _client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_client() -> Client:
    return _client()


def handle_response(response: Any) -> Any:
    if getattr(response, "error", None):
        raise RuntimeError(str(response.error))
    return response.data
