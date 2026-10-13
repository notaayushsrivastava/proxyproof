from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union
import hmac
import hashlib
import struct
import uuid
import argon2
import jwt
from backend.app.core.config import settings

# Argon2id hasher configured per PRD requirements
_ph = argon2.PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    type=argon2.Type.ID,
)


def hash_password(password: str) -> str:
    """Hashes a password using Argon2id."""
    return _ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against an Argon2id hash in constant time."""
    try:
        return _ph.verify(hashed_password, plain_password)
    except (argon2.exceptions.VerifyMismatchError, argon2.exceptions.VerificationError, argon2.exceptions.InvalidHashError):
        return False


def create_access_token(
    subject: Union[str, uuid.UUID],
    role: str,
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """Creates a signed JWT access token."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "iat": now,
        "exp": expire,
        "type": "access",
    }
    if extra_claims:
        to_encode.update(extra_claims)

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Dict[str, Any]:
    """Decodes and validates a JWT token."""
    payload = jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={"require": ["sub", "role", "exp"]},
    )
    return payload


def verify_hmac_proof(
    candidate_proof: str,
    session_secret_hex: str,
    session_id: uuid.UUID,
    time_slot: int,
    protocol_version: int = 1,
) -> bool:
    """Verifies a 32-character hex HMAC proof in constant time."""
    secret_bytes = bytes.fromhex(session_secret_hex)
    msg = (
        struct.pack(">B", protocol_version)
        + session_id.bytes
        + struct.pack(">I", time_slot)
    )
    expected_full = hmac.new(secret_bytes, msg, hashlib.sha256).hexdigest()
    expected_truncated = expected_full[:32]
    return hmac.compare_digest(candidate_proof.lower(), expected_truncated.lower())
