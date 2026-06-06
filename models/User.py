from pydantic import BaseModel

class User(BaseModel):
    nombre: str
    color: str
    x: float
    y: float
    objeto: str = None