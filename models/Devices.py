from pydantic import BaseModel

class DeviceAuth(BaseModel):
    device_id: str
    app_version: str = "preview"

class ExtendRequest(BaseModel):
    device_id: str
    admin_token: str
    extra_days: int