from pydantic import BaseModel

class Conexion(BaseModel):
    id: str
    origenId: str
    destinoId: str
    style: int
    properties: dict