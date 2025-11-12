from functools import lru_cache
from pydantic import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    api_base_url: str = "http://localhost:8000"
    supabase_jwt_secret: str

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
