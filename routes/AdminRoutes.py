from fastapi import APIRouter, Depends, HTTPException
from middleware.admin_auth import verify_admin_token
from services import supabase, logger
import os

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/env-check")
async def env_check(admin_token: str = Depends(verify_admin_token)):
    """Verifica las variables de entorno (solo admin)"""
    return {
        "api_url": os.getenv("API_URL", "No configurada"),
        "supabase_url": "Configurada" if os.getenv("SUPABASE_URL") else "No configurada",
        "supabase_key": "Configurada" if os.getenv("SUPABASE_KEY") else "No configurada",
        "admin_token": "Configurado" if os.getenv("ADMIN_TOKEN") else "No configurado"
    }

@router.get("/db-test")
async def db_test(admin_token: str = Depends(verify_admin_token)):
    """Prueba la conexión a Supabase (solo admin)"""
    try:
        result = supabase.table("licenses").select("count", count="exact").execute()
        return {
            "db_connected": True,
            "record_count": result.count
        }
    except Exception as e:
        return {
            "db_connected": False,
            "error": str(e)
        }