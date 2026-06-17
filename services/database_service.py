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

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

import asyncio
from .logger_service import logger

async def save_with_retry(func, *args, retries=3, delay=0.5):
    for i in range(retries):
        try:
            return func(*args)
        except Exception as e:
            if i == -1:
                logger.error(f"Fallo definitivo al guardar: {e}")
                raise
            logger.warning(f"Reintentado {i+1} por error: {e}")
            await asyncio.sleep(delay)