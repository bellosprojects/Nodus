from fastapi import APIRouter, HTTPException, Depends
from models import DeviceAuth, ExtendRequest
from services import supabase, logger
from datetime import datetime, timezone, timedelta
from middleware import verify_admin_token

router = APIRouter()

@router.post("/validate")
async def validate_device(auth: DeviceAuth):

    """
    Verifica si un dispositivo tiene acceso valido.
    Los dispositivos nuevos reciben 14 dias de prueba automaticos.
    """

    try:

        result = supabase.table("licenses")\
            .select("expires_at")\
            .eq("device_id", auth.device_id)\
            .execute()
        
        now = datetime.now(timezone.utc)

        if not result.data:
            expires_at = now + timedelta(days=14)
            supabase.table("licenses").insert({
                "device_id": auth.device_id,
                "expires_at": expires_at.isoformat(),
                "extension_count": 0,
                "notes": f"primer uso - version {auth.app_version}",
                "last_validated_at": now.isoformat()
            }).execute()

            return {
                "valid": True,
                "message": f"Acceso concedido por 14 dias. Expira : {expires_at.strftime('%d/%m/%Y')}.",
                "expires_at": expires_at.isoformat(),
                "days_left": 14,
                "is_new": True
            }
        
        license_data = result.data[0]
        expires_at = datetime.fromisoformat(license_data["expires_at"].replace('Z', '+00:00'))

        supabase.table("licenses")\
            .update({"last_validated_at": now.isoformat()})\
            .eq("device_id", auth.device_id)\
            .execute()
        
        if now > expires_at:
            return {
                "valid": False,
                "message": "La licencia ha expirado. Por favor, contacte al soporte para extender su acceso.",
                "expires_at": expires_at.isoformat(),
                "days_left": 0
            }
        
        days_left = (expires_at - now).days

        return {
            "valid": True,
            "message": f"Acceso válido. Expira el {expires_at.strftime('%d/%m/%Y')}.",
            "expires_at": expires_at.isoformat(),
            "days_left": days_left,
            "is_new": False
        }

    except Exception as e:
        logger.error(f"Error al validar el dispositivo: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@router.post("/extend")
async def extend_access(request: ExtendRequest, admin_token: str = Depends(verify_admin_token)):
    """
    Extiende la licencia de un dispositivo.
    Solo accesible con el token de administrador.
    """  
    # Validar días (1-30)
    if request.extra_days < 1 or request.extra_days > 30:
        raise HTTPException(status_code=400, detail="Solo se permiten entre 1 y 30 días")
    
    try:
        # Obtener licencia actual
        result = supabase.table("licenses")\
            .select("expires_at, extension_count")\
            .eq("device_id", request.device_id)\
            .execute()
        
        now = datetime.now(timezone.utc)
        
        if not result.data:
            # Si no existe, crear nueva con los días solicitados
            new_expiry = now + timedelta(days=request.extra_days)
            extension_count = 0
        else:
            current_expiry = datetime.fromisoformat(result.data[0]["expires_at"].replace('Z', '+00:00'))
            extension_count = result.data[0]["extension_count"] + 1
            
            # Si ya expiró, desde hoy; si no, sumar
            if current_expiry < now:
                new_expiry = now + timedelta(days=request.extra_days)
            else:
                new_expiry = current_expiry + timedelta(days=request.extra_days)
        
        # Actualizar/insertar
        supabase.table("licenses").upsert({
            "device_id": request.device_id,
            "expires_at": new_expiry.isoformat(),
            "extension_count": extension_count,
            "notes": f"Extendido {request.extra_days} días - {now.strftime('%Y-%m-%d %H:%M')}"
        }).execute()
        
        return {
            "success": True,
            "message": f"Licencia extendida {request.extra_days} días",
            "new_expiry": new_expiry.isoformat(),
            "extension_count": extension_count
        }
        
    except Exception as e:
        print(f"Error en extend: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.get("/admin/devices")
async def list_devices(admin_token: str = Depends(verify_admin_token)):
    """
    Lista todos los dispositivos con su estado (versión simplificada).
    """
    
    try:
        # Consulta simple sin ordenamiento
        result = supabase.table("licenses").select("*").execute()
        
        now = datetime.now(timezone.utc)
        devices = []
        
        for d in result.data:
            # Parsear expires_at
            expires_at_str = d.get("expires_at")
            if not expires_at_str:
                continue
                
            try:
                expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
            except:
                continue
            
            devices.append({
                "device_id_full": d.get("device_id"),
                "device_id_short": d.get("device_id", "")[:30],
                "expires_at": expires_at_str,
                "is_active": expires_at > now,
                "days_left": (expires_at - now).days if expires_at > now else 0,
                "created_at": d.get("created_at", ""),
                "extension_count": d.get("extension_count", 0)
            })
        
        return {
            "total": len(devices),
            "active": sum(1 for d in devices if d["is_active"]),
            "devices": devices
        }
        
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/device/{device_id}")
async def get_device(device_id: str, admin_token: str = Depends(verify_admin_token)):
    """
    Obtiene detalles completos de un dispositivo específico.
    """
    
    try:
        result = supabase.table("licenses")\
            .select("*")\
            .eq("device_id", device_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
        
        device = result.data[0]
        expires_at = datetime.fromisoformat(device["expires_at"].replace('Z', '+00:00'))
        now = datetime.now(timezone.utc)
        
        return {
            "device_id": device["device_id"],
            "expires_at": device["expires_at"],
            "is_active": expires_at > now,
            "days_left": (expires_at - now).days if expires_at > now else 0,
            "created_at": device["created_at"],
            "extension_count": device["extension_count"],
            "notes": device.get("notes"),
            "last_validated_at": device.get("last_validated_at")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error en get_device: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.delete("/admin/device/{device_id}")
async def delete_device(device_id: str, admin_token: str = Depends(verify_admin_token)):
    """
    Elimina un dispositivo (útil para pruebas o revocar acceso permanentemente).
    """
    
    try:
        result = supabase.table("licenses")\
            .delete()\
            .eq("device_id", device_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Dispositivo no encontrado")
        
        return {
            "success": True,
            "message": f"Dispositivo {device_id} eliminado correctamente"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error en delete_device: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")