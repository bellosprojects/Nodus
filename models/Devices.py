from pydantic import BaseModel

class DeviceAuth(BaseModel):
    device_id: str
    app_version: str = "preview"

class ExtendRequest(BaseModel):
    device_id: str
    extra_days: int