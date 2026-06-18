from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN")

if not ADMIN_TOKEN:
    raise ValueError("ADMIN_TOKEN no esta configurado en variables de entorno")

security = HTTPBearer()

async def verify_admin_token(credentials: HTTPAuthorizationCredentials = Depends(security)):

    """
    Verifica que el token Bearer sea el token de usuario
    """

    token = credentials.credentials

    if token != ADMIN_TOKEN:
        raise HTTPException(
            status_code=403,
            detail="Invalid admin token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    return token