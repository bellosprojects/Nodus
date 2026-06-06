from pydantic import BaseModel

class Nodo(BaseModel):
    id: str
    x: float
    y: float
    w: float
    h: float
    texto: str
    color: str
    opacidad: float
    radius: float
    pin: bool
    style: int
    properties: dict