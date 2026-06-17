from pydantic import BaseModel
from typing import Optional

class User(BaseModel):
    nombre: str
    color: str
    x: float
    y: float
    objeto: str = None
    user_id:str
    token:str
    userId: Optional[str] = None