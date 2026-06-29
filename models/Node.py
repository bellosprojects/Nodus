from pydantic import BaseModel, Field, field_validator
from typing import Dict, Any
import re

class Nodo(BaseModel):
    id: str = Field(..., min_length=1, max_length=50)
    x: float = Field(..., ge=-100000, le=100000)
    y: float = Field(..., ge=-100000, le=100000)
    w: float = Field(..., ge=60, le=5000)
    h: float = Field(..., ge=20, le=5000)
    texto: str = Field(default="", max_length=500)
    color: str = Field(..., pattern=r'^#[0-9a-fA-F]{6}$')
    opacidad: float = Field(default=1.0, ge=0, le=1)
    radius: float = Field(default=8, ge=0, le=2500)
    pin: bool = False
    style: int = Field(default=1, ge=1, le=3)
    properties: Dict[str, Any] = Field(default_factory=dict)

    @field_validator('properties')
    def sanitize_properties(cls, v):
        """Elimina claves peligrosas para prevenir propotype pollution"""
        dangerous_keys = ['__proto__', 'constructor', 'prototype', '__defineGetter__', "__defineSetter__"]
        sanitized = {}

        for key, value in v.items():
            if key not in dangerous_keys and not key.startswith('__'):
                if len(key) > 100:
                    continue
                
                if isinstance(value, str) and len(value) > 1000:
                    continue

                sanitized[key] = value

        return sanitized