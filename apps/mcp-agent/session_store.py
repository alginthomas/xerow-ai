"""
Session Store — Redis-backed with in-memory fallback
Persists agent chat sessions across deploys.
"""

import json
import logging
import os
import time
from typing import Optional

logger = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL")
SESSION_TTL = 3600  # 1 hour

# Try to connect to Redis
_redis = None
if REDIS_URL:
    try:
        import redis
        _redis = redis.from_url(REDIS_URL, decode_responses=True)
        _redis.ping()
        logger.info("Redis session store connected")
    except Exception as e:
        logger.warning(f"Redis unavailable, using in-memory fallback: {e}")
        _redis = None
else:
    logger.info("No REDIS_URL set, using in-memory session store")


def save_session(session_id: str, messages: list, last_access: float):
    """Save agent messages to Redis or in-memory."""
    data = json.dumps({"messages": messages, "last_access": last_access}, default=str)
    if _redis:
        try:
            _redis.setex(f"session:{session_id}", SESSION_TTL, data)
            return
        except Exception as e:
            logger.error(f"Redis save error: {e}")
    # Fallback: in-memory (handled by caller)


def load_session(session_id: str) -> Optional[dict]:
    """Load agent messages from Redis."""
    if _redis:
        try:
            data = _redis.get(f"session:{session_id}")
            if data:
                return json.loads(data)
        except Exception as e:
            logger.error(f"Redis load error: {e}")
    return None


def delete_session(session_id: str):
    """Delete a session from Redis."""
    if _redis:
        try:
            _redis.delete(f"session:{session_id}")
        except Exception:
            pass


def is_redis_available() -> bool:
    return _redis is not None
