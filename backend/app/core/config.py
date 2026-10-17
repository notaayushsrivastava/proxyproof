import os
import socket
from typing import List, Optional, Union
from pydantic import AnyHttpUrl, model_validator
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

    # Docker PostgreSQL development configuration
    DOCKER_POSTGRES_HOST: Optional[str] = None
    DOCKER_POSTGRES_PORT: int = 5432
    DOCKER_POSTGRES_USER: str = "postgres"
    DOCKER_POSTGRES_PASSWORD: str = "postgres"
    DOCKER_POSTGRES_DB: str = "proxyproof"
    DOCKER_DATABASE_URL: Optional[str] = None
    USE_REMOTE_DB_IN_DEV: bool = False

    @staticmethod
    def _resolve_docker_host() -> str:
        # Never perform local network DNS resolution in serverless / cloud deployments
        if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
            return "127.0.0.1"
        override_host = os.getenv("DOCKER_POSTGRES_HOST")
        if override_host:
            return override_host
        try:
            socket.gethostbyname("db")
            return "db"
        except Exception:
            return "127.0.0.1"

    @model_validator(mode="after")
    def resolve_database_configuration(self) -> "Settings":
        is_serverless_env = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
        cloud_url = os.getenv("POSTGRES_URL") or os.getenv("POSTGRES_PRISMA_URL") or os.getenv("DATABASE_URL")

        # In serverless deployments, always prefer the remote connection URL
        if is_serverless_env and cloud_url:
            self.DATABASE_URL = cloud_url

        env = (self.ENVIRONMENT or "development").lower().strip()
        # In serverless cloud deployment, we are NEVER in local docker dev mode
        is_dev = not is_serverless_env and env in ("development", "dev", "local", "docker")

        if is_dev and not self.USE_REMOTE_DB_IN_DEV:
            docker_host = self.DOCKER_POSTGRES_HOST or self._resolve_docker_host()
            docker_port = self.DOCKER_POSTGRES_PORT or 5432
            docker_user = self.DOCKER_POSTGRES_USER or "postgres"
            docker_pass = self.DOCKER_POSTGRES_PASSWORD or "postgres"
            docker_db = self.DOCKER_POSTGRES_DB or "proxyproof"
            docker_url = (
                self.DOCKER_DATABASE_URL
                or f"postgresql+psycopg://{docker_user}:{docker_pass}@{docker_host}:{docker_port}/{docker_db}"
            )
            # In development mode, automatically use Docker PostgreSQL
            self.DATABASE_URL = docker_url
            self.POSTGRES_HOST = docker_host
            self.POSTGRES_PORT = docker_port
            self.POSTGRES_USER = docker_user
            self.POSTGRES_PASSWORD = docker_pass
            self.POSTGRES_DB = docker_db
        else:
            # If not local dev, ensure DATABASE_URL uses cloud credentials
            if cloud_url and (
                self.DATABASE_URL.startswith("postgresql+psycopg://postgres:postgres@127.0.0.1")
                or self.DATABASE_URL.startswith("postgresql://postgres:postgres@127.0.0.1")
                or "@db:" in self.DATABASE_URL
            ):
                self.DATABASE_URL = cloud_url

            if "@db:" in self.DATABASE_URL:
                docker_host = self.DOCKER_POSTGRES_HOST or self._resolve_docker_host()
                self.DATABASE_URL = self.DATABASE_URL.replace("@db:", f"@{docker_host}:")

        # Normalize driver prefix for psycopg 3
        if "postgresql+asyncpg://" in self.DATABASE_URL:
            self.DATABASE_URL = self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg://")
        elif self.DATABASE_URL.startswith("postgresql://"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

        return self

    @property
    def is_development(self) -> bool:
        if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
            return False
        return (self.ENVIRONMENT or "development").lower().strip() in ("development", "dev", "local", "docker")

    @property
    def is_production(self) -> bool:
        if os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
            return True
        return (self.ENVIRONMENT or "").lower().strip() in ("production", "prod")

    # JWT & Auth
    SECRET_KEY: str = "dev_insecure_secret_key_change_in_production_32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # BLE & Attendance Protocol Policy
    PROTOCOL_VERSION: int = 1
    PROOF_VALIDITY_SECONDS: int = 5
    DRIFT_WINDOW_SLOTS: int = 1
    PAST_DRIFT_SLOTS: Optional[int] = None
    FUTURE_DRIFT_SLOTS: Optional[int] = None
    DEFAULT_RSSI_THRESHOLD: int = -75
    MIN_RSSI_SAMPLES: int = 3

    # CORS
    ALLOWED_ORIGINS: Union[str, List[str]] = "https://proxyproof.aayushsrivastava.com,https://aayushsrivastava.com,https://www.aayushsrivastava.com,http://localhost:8081,http://localhost:8000,http://localhost:3000"

    @property
    def cors_origins(self) -> List[str]:
        if isinstance(self.ALLOWED_ORIGINS, list):
            return self.ALLOWED_ORIGINS
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()
