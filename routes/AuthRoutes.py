from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from services import supabase, logger
from typing import Optional

router = APIRouter(prefix="/auth", tags=["auth"])

class SignUpRequest(BaseModel):
    email: str
    password: str
    display_name: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/signup")
async def signup(req: SignUpRequest):
    try:
        # Registrar usuario en Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": req.email,
            "password": req.password,
            "options": {
                "data": {"display_name": req.display_name or req.email.split('@')[0]}
            }
        })
        user = auth_response.user
        if not user:
            raise HTTPException(status_code=400, detail="Registration failed")
        
        # Opcional: confirmar email automáticamente (en desarrollo)
        # En producción, el usuario debe confirmar su email.
        return {"message": "User created successfully", "user_id": user.id}
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login(req: LoginRequest):
    try:
        session = supabase.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password
        })
        return {
            "access_token": session.session.access_token,
            "refresh_token": session.session.refresh_token,
            "user_id": session.user.id,
            "display_name": session.user.user_metadata.get("display_name", req.email.split('@')[0])
        }
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

@router.post("/logout")
async def logout(request: Request):
    # El token se pasa en el header Authorization: Bearer <token>
    token = request.headers.get("Authorization")
    if token and token.startswith("Bearer "):
        token = token[7:]
        try:
            supabase.auth.set_session(token, "")  # solo para invalidar localmente
            # En Supabase, el logout realmente se maneja en el cliente, pero aquí podemos
            # simplemente devolver éxito. El token seguirá siendo válido hasta expirar.
            return {"message": "Logged out"}
        except:
            pass
    return {"message": "Logged out"}

@router.get("/me")
async def get_me(request: Request):
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = token[7:]
    try:
        user = supabase.auth.get_user(token)
        return {
            "user_id": user.user.id,
            "email": user.user.email,
            "display_name": user.user.user_metadata.get("display_name")
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")