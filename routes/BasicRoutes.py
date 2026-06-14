from fastapi import APIRouter
from datetime import datetime, timezone
from models import manager

router = APIRouter()

@router.get("/")
async def root():
    return {
        "message": "Servidor de Diagramas Colaborativos está en funcionamiento.",
        "status": "runnig",
        "version": "1.0.0"
    }

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat()
        }

@router.get("/status/{room_id}")
async def state_of_room(room_id: str):
    room = await manager.get_or_create_diagram(room_id)
    response = {
        "usuarios": [user.model_dump() for user in room.usuarios.values()],
        "conexiones": [conx.model_dump() for conx in room.conexiones.values()],
        "nodos": [nodo.model_dump() for nodo in room.nodos.values()],
        "nombre": room.nombre_proyecto
    }

    return response