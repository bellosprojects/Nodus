from pydantic import BaseModel, Field, field_validator
from typing import Dict, Any

class Conexion(BaseModel):
    id: str = Field(..., min_length=1, max_length=50)
    origenId: str = Field(..., min_length=1, max_length=50)
    destinoId: str = Field(..., min_length=1, max_length=50)
    style: int = Field(default=1, ge=1, le=7)
    properties: Dict[str, Any] = Field(default_factory=dict)

    @field_validator('properties')
    def sanitize_properties(cls, v):
        dangerous_keys = ['__proto__', 'constructor', 'prototype']
        return {k: v for k, v in v.items() if k not in dangerous_keys}