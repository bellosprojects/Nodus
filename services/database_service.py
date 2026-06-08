import os
from supabase import Client, create_client
from dotenv import load_dotenv

if os.path.exists(".env"):
    load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")

if not SUPABASE_URL:
    raise Exception("SUPABASE_URL no está definido en las variables de entorno.")
if not SUPABASE_KEY:
    raise Exception("SUPABASE_KEY no está definido en las variables de entorno.")
if not ADMIN_TOKEN:
    raise Exception("ADMIN_TOKEN no está definido en las variables de entorno.")

# NOTE: Initialize supabase lazily to avoid crashing on import
# Use get_supabase() to obtain a client when needed

# Lazy-initialized Supabase client to avoid crashing at import time
_supabase_client: Client | None = None

def get_supabase(retries: int = 3, backoff: float = 1.0) -> Client | None:
    """Return a Supabase client, initializing it lazily with retries.
    Returns None if configuration is missing or client couldn't be created.
    """
    global _supabase_client
    if _supabase_client:
        return _supabase_client

    if not SUPABASE_URL or not SUPABASE_KEY:
        # don't raise at import; log and return None so app stays up
        try:
            from .logger_service import logger
            logger.error("Supabase configuration missing (SUPABASE_URL or SUPABASE_KEY).")
        except Exception:
            pass
        return None

    import time
    from .logger_service import logger

    for attempt in range(retries):
        try:
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            # optional lightweight connectivity test (non-fatal)
            try:
                _supabase_client.table("licenses").select("device_id").limit(1).execute()
            except Exception:
                # test failed; not fatal
                pass
            logger.info("Supabase client initialized")
            return _supabase_client
        except Exception as e:
            logger.error(f"Failed to create Supabase client (attempt {attempt+1}/{retries}): {e}")
            time.sleep(backoff * (2 ** attempt))

    try:
        from .logger_service import logger
        logger.error("Could not initialize Supabase client after retries.")
    except Exception:
        pass
    return None