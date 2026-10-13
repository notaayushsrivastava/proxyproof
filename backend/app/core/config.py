import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "ProxyProof API"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/proxyproof"
    POSTGRES_DB: str = "proxyproof"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_HOST: str = "127.0.0.1"
    POSTGRES_PORT: int = 5432

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def resolve_database_url_host(cls, v: str) -> str:
        if "@db:" in v:
            import socket
            try:
                socket.gethostbyname("db")
            except Exception:
                return v.replace("@db:", "@127.0.0.1:")
        return v

    @field_validator("POSTGRES_HOST", mode="after")
    @classmethod
    def resolve_postgres_host(cls, v: str) -> str:
        if v == "db":
            import socket
            try:
                socket.gethostbyname("db")
            except Exception:
                return "127.0.0.1"
        return v

    # JWT & Auth
    SECRET_KEY: str = "dev_insecure_secret_key_change_in_production_32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # BLE & Attendance Protocol Policy
    PROTOCOL_VERSION: int = 1
    PROOF_VALIDITY_SECONDS: int = 5
    DRIFT_WINDOW_SLOTS: int = 1
    DEFAULT_RSSI_THRESHOLD: int = -75
    MIN_RSSI_SAMPLES: int = 3

    # CORS
    ALLOWED_ORIGINS: Union[str, List[str]] = "http://localhost:8081,http://localhost:8000,http://localhost:3000"

    @property
    def cors_origins(self) -> List[str]:
        if isinstance(self.ALLOWED_ORIGINS, list):
            return self.ALLOWED_ORIGINS
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()
