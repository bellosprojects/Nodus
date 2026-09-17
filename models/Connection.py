from typing import Optional
from pydantic import BaseModel

class Conexion(BaseModel):
    id: str
    origenId: str
    destinoId: str
    style: int
    properties: dict
    room_id: Optional[str] = None