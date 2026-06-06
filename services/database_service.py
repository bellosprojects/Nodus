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